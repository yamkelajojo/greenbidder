import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Only the deprecated readAsStringAsync lives in /legacy; all other FileSystem
// operations (copyAsync, cacheDirectory, etc.) come from the main module.
import * as FileSystem from "expo-file-system";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { pickImage } from "../../services/imageService";
import {
  isModelReady,
  loadModel,
  diagnose,
  preloadModel,
  saveScan,
  getScanHistory,
  deleteScan,
  clearAllScans,
} from "../../services/diseaseService";
import DiseaseResultCard from "./DiseaseResultCard";
import ScanHistoryItem from "./ScanHistoryItem";
import AppButton from "../shared/AppButton";
import { useFadeIn, usePulse, useStaggerEntrance, DURATIONS } from "../../utils/animations";

// Lightweight haptics helper. expo-haptics isn't bundled in Expo Go minimal
// installs and we don't want to add a dependency just for tactile feedback,
// so we import it lazily and no-op if unavailable. Web also doesn't support
// haptics — we skip silently there.
let hapticsModule = null;
let hapticsTried = false;
const HAPTIC_STYLE_MAP = {
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
};
const safeHaptic = (styleName) => {
  if (Platform.OS === "web") return;
  if (!hapticsTried) {
    hapticsTried = true;
    try {
      // eslint-disable-next-line global-require
      hapticsModule = require("expo-haptics");
    } catch {
      hapticsModule = null;
    }
  }
  if (!hapticsModule?.ImpactFeedbackStyle) return;
  const key = HAPTIC_STYLE_MAP[styleName] || HAPTIC_STYLE_MAP.light;
  const style = hapticsModule.ImpactFeedbackStyle[key];
  if (style && hapticsModule.impactAsync) {
    hapticsModule.impactAsync(style).catch(() => {});
  }
};

const PAGE_SIZE = 10;

/**
 * Delete cached crop/cabbage-scan files older than 7 days to prevent
 * unbounded cache growth. Called once on mount; failures are swallowed
 * because cache hygiene is non-critical.
 */
async function cleanupOldCache() {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return;
    const now = Date.now();
    const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const targets = files.filter(
      (f) =>
        f.startsWith("cabbage-scan-") ||
        f.startsWith("picked-") ||
        f === "cabbage-test.jpg"
    );
    await Promise.all(
      targets.map(async (f) => {
        try {
          const info = await FileSystem.getInfoAsync(cacheDir + f);
          if (info.exists && info.modificationTime) {
            const mtimeMs =
              info.modificationTime instanceof Date
                ? info.modificationTime.getTime()
                : info.modificationTime * 1000;
            if (now - mtimeMs > MAX_AGE_MS) {
              await FileSystem.deleteAsync(cacheDir + f, { idempotent: true });
            }
          }
        } catch {
          // ignore individual file failures
        }
      })
    );
  } catch {
    // Entire cleanup is best-effort.
  }
}

/**
 * Diagnose tab — photograph or upload a cabbage image, run on-device
 * CabbageGuard inference, and manage scan history.
 *
 * States:
 *   model-not-ready -> setup instructions (placeholder model still bundled)
 *   idle            -> pick buttons
 *   preview         -> chosen image + Analyze
 *   analyzing       -> on-device inference in progress
 *   result          -> DiseaseResultCard (auto-saved to history)
 *   error           -> retry / pick again
 *
 * The valuation and listing flows are untouched — this screen only talks to
 * `diseaseService` and the existing `pickImage` helper.
 */
export default function DiseaseScanScreen() {
  const [modelReady] = useState(() => isModelReady());

  // Scan flow state
  const [phase, setPhase] = useState("idle"); // idle|preview|analyzing|result|error
  const [imageUri, setImageUri] = useState(null);
  const [result, setResult] = useState(null);
  const [savedScan, setSavedScan] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [modelLoadingError, setModelLoadingError] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  // Delete state
  const [deletingCurrent, setDeletingCurrent] = useState(false);
  const [deletingHistoryId, setDeletingHistoryId] = useState(null);
  const [clearing, setClearing] = useState(false);

  // History state (paginated + pull-to-refresh)
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [historyError, setHistoryError] = useState("");

  // Guard against double-tap / stale updates when a diagnosis is in flight.
  const analyzeInFlightRef = useRef(false);
  // Mounted guard — prevents setState-after-unmount warnings if the user
  // navigates away while inference/history saves are in flight.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Use a ref for history state inside callbacks to avoid stale closures
  // (we read it for pagination `before` cursors and optimistic updates).
  const historyRef = useRef([]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Kick off model warm-up as soon as the screen mounts, so by the time the
  // user taps "Analyze" the model is already loaded. This removes the
  // first-inference cold-start delay. Also surfaces a persistent
  // model-load error banner if warm-up fails (so the user doesn't tap
  // Analyze only to hit an immediate error).
  useEffect(() => {
    if (modelReady) {
      preloadModel();
      loadModel().catch((err) => {
        setModelLoadingError(
          err?.message || "CabbageGuard couldn't start. Please restart the app."
        );
      });
    }
    loadHistory("first");
    // Best-effort cleanup of old cached scans (background, fire-and-forget)
    // so the cache doesn't grow unbounded across many diagnoses.
    cleanupOldCache().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // History
  // ------------------------------------------------------------------
  const loadHistory = useCallback(async (mode = "first") => {
    if (mode === "first") setLoadingHistory(true);
    if (mode === "more") setLoadingMore(true);
    setHistoryError("");

    const currentHistory = historyRef.current;
    const before =
      mode === "more" && currentHistory.length > 0
        ? currentHistory[currentHistory.length - 1].created_at
        : null;

    const { data, error, hasMore: more } = await getScanHistory({
      limit: PAGE_SIZE,
      before,
    });

    if (error) {
      setHistoryError("Could not load your scan history.");
    } else if (data) {
      setHistory((prev) => (mode === "more" ? [...prev, ...data] : data));
      setHasMore(more);
    }

    if (mode === "first") setLoadingHistory(false);
    if (mode === "more") setLoadingMore(false);
  }, []); // no deps — reads history via ref to avoid stale closures

  // Stable-callback refresh/loadMore so FlatList callbacks don't churn.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory("first");
    setRefreshing(false);
  }, [loadHistory]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loadingHistory) return;
    await loadHistory("more");
  }, [hasMore, loadingMore, loadingHistory, loadHistory]);

  // ------------------------------------------------------------------
  // Scan flow
  // ------------------------------------------------------------------
  const handlePick = async (source) => {
    // Debug/test source: copy a known test image from /sdcard/Download into
    // the app cache directory so it can be read across scoped-storage
    // boundaries. This is only wired up in __DEV__ builds.
    if (source === "debug") {
      try {
        const srcUri = "file:///sdcard/Download/cabbage-test.jpg";
        const destUri = FileSystem.cacheDirectory + "cabbage-test.jpg";
        await FileSystem.copyAsync({ from: srcUri, to: destUri });
        setResult(null);
        setSavedScan(null);
        setSaveError(null);
        setErrorMsg("");
        setImageUri(destUri);
        setPhase("preview");
      } catch (e) {
        Alert.alert(
          "Debug error",
          `Could not load test image: ${e.message || String(e)}\n\n` +
            "Push an image via `adb push cabbage-test.jpg /sdcard/Download/cabbage-test.jpg` first."
        );
      }
      return;
    }

    if (source !== "camera" && source !== "gallery") return;

    const { uri, cancelled, error } = await pickImage(source);
    if (error) {
      Alert.alert(
        source === "camera" ? "Camera" : "Gallery",
        error
      );
      return;
    }
    if (cancelled || !uri) return;

    setResult(null);
    setSavedScan(null);
    setSaveError(null);
    setErrorMsg("");
    setImageUri(uri);
    setPhase("preview");
  };

  const handleAnalyze = async () => {
    if (!imageUri) return;
    // Prevent double-submits (the button is also disabled via isAnalyzing).
    if (analyzeInFlightRef.current) return;
    analyzeInFlightRef.current = true;

    setPhase("analyzing");
    setErrorMsg("");

    try {
      // Let the UI paint the "Analyzing…" state before we block the JS thread
      // in TFLite's synchronous runSync. A short setTimeout yields to the
      // native bridge and lets the ActivityIndicator mount first.
      await new Promise((resolve) => setTimeout(resolve, 50));

      const { data, error } = await diagnose(imageUri);
      if (!mountedRef.current) return;
      if (error) {
        setErrorMsg(error.message || "Diagnosis failed. Please try again.");
        setPhase("error");
        return;
      }
      setResult(data);
      setPhase("result");
      // Subtle tactile confirmation so the user knows the diagnosis landed,
      // mirroring how iOS/Android system components confirm a successful
      // operation (Light impact is unobtrusive — no buzz, just a tick).
      safeHaptic("light");

      // Auto-save every scan to Supabase (PRD §13). Failures are surfaced
      // in the result card rather than as a blocking alert — inference
      // itself succeeded even if history persistence didn't.
      setSaving(true);
      setSaveError(null);
      const saved = await saveScan(data, imageUri);
      if (!mountedRef.current) return;
      setSaving(false);
      if (saved.data) {
        setSavedScan(saved.data);
        setHistory((prev) => [saved.data, ...prev]);
      } else {
        setSaveError(saved.error?.message || "Could not save to your history.");
        // Don't Alert.alert on save failure during the main dev/smoke-testing
        // flow when Supabase is paused — it's noisy and blocks the result.
      }
    } catch (unexpectedErr) {
      // Defensive catch for anything diagnose() didn't already wrap.
      console.error("[DiseaseScanScreen] Unexpected error in handleAnalyze:", unexpectedErr);
      if (!mountedRef.current) return;
      setErrorMsg(unexpectedErr?.message || "Diagnosis failed. Please try again.");
      setPhase("error");
    } finally {
      analyzeInFlightRef.current = false;
    }
  };

  const handleRetake = () => {
    if (analyzeInFlightRef.current) return;
    setImageUri(null);
    setResult(null);
    setSavedScan(null);
    setSaveError(null);
    setErrorMsg("");
    setPhase("idle");
  };

  // Re-run inference on the same photo (same imageUri). Used for "Re-analyze"
  // on the result card — keeps the current result visible while we run again
  // and replaces it with the new result when done.
  const handleReanalyze = async () => {
    if (!imageUri || analyzeInFlightRef.current) return;
    analyzeInFlightRef.current = true;
    setReanalyzing(true);
    setErrorMsg("");
    // Reset save-status state: the previous savedScan corresponds to the
    // previous diagnosis, so it would be misleading to keep showing
    // "✓ Saved to your history" next to a different result.
    setSavedScan(null);
    setSaveError(null);
    setSaving(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const { data, error } = await diagnose(imageUri);
      if (!mountedRef.current) return;
      if (error) {
        setErrorMsg(error.message || "Diagnosis failed. Please try again.");
        setPhase("error");
        return;
      }
      setResult(data);
      safeHaptic("light");
    } catch (unexpectedErr) {
      console.error(
        "[DiseaseScanScreen] Unexpected error in handleReanalyze:",
        unexpectedErr
      );
      if (!mountedRef.current) return;
      setErrorMsg(unexpectedErr?.message || "Diagnosis failed. Please try again.");
      setPhase("error");
    } finally {
      if (mountedRef.current) setReanalyzing(false);
      analyzeInFlightRef.current = false;
    }
  };

  const handleDeleteCurrent = async () => {
    if (!savedScan?.id) {
      // Nothing persisted yet (save failed) — just reset.
      handleRetake();
      return;
    }
    setDeletingCurrent(true);
    const { error } = await deleteScan(savedScan.id);
    setDeletingCurrent(false);
    if (error) {
      Alert.alert("Delete failed", error.message || "Please try again.");
      return;
    }
    setHistory((prev) => prev.filter((s) => s.id !== savedScan.id));
    handleRetake();
  };

  const handleDeleteHistory = async (id) => {
    Alert.alert(
      "Delete this scan?",
      "The photo and the diagnosis will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingHistoryId(id);
            const { error } = await deleteScan(id);
            setDeletingHistoryId(null);
            if (error) {
              Alert.alert("Delete failed", error.message || "Please try again.");
              return;
            }
            setHistory((prev) => prev.filter((s) => s.id !== id));
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear all scans?",
      "This permanently deletes all photos and diagnoses in your history.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: async () => {
            setClearing(true);
            const { error } = await clearAllScans();
            setClearing(false);
            if (error) {
              Alert.alert("Clear failed", error.message || "Please try again.");
              return;
            }
            setHistory([]);
            setHasMore(false);
          },
        },
      ]
    );
  };

  // ------------------------------------------------------------------
  // Header section (above the history list)
  // ------------------------------------------------------------------
  const isAnalyzing = phase === "analyzing";

  // Each time the "top" content changes phase (idle/preview/analyzing/
  // result/error), we trigger a fresh fade-in + slight upward slide.
  // We use a key-driven restart so the fade plays on every phase change.
  const [animKey, setAnimKey] = useState(() => ({ phase: "idle", n: 0 }));
  useEffect(() => {
    setAnimKey((prev) => ({ phase, n: prev.n + 1 }));
  }, [phase]);
  const entrance = useFadeIn({
    duration: DURATIONS.normal,
    translateY: 12,
    delay: 50,
  });
  // Re-run entrance animation when key changes.
  useEffect(() => {
    entrance.restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey.n]);

  // Staggered tips for the EmptyState (4 rows).
  const tipsAnim = useStaggerEntrance({
    count: PHOTO_TIPS.length,
    delay: 200,
    stagger: 70,
    translateY: 6,
  });

  const renderTop = () => {
    if (Platform.OS === "web") {
      return (
        <>
          <Header />
          <WebOnlyCard />
        </>
      );
    }

    if (!modelReady) {
      return (
        <>
          <Header />
          <ModelNotReadyCard />
        </>
      );
    }

    // Render the phase-appropriate content inside an animatable wrapper.
    let phaseContent = null;
    if (modelLoadingError) {
      phaseContent = (
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>CabbageGuard couldn't start</Text>
          <Text style={styles.errorBody}>{modelLoadingError}</Text>
          <AppButton
            label="Try again"
            onPress={async () => {
              setModelLoadingError(null);
              try {
                await loadModel();
              } catch (err) {
                setModelLoadingError(
                  err?.message ||
                    "Still couldn't load — please restart the app."
                );
              }
            }}
            style={styles.flowButton}
          />        </View>
      );
    } else if (phase === "idle") {
      phaseContent = <EmptyState onPick={handlePick} tipsAnim={tipsAnim} />;
    } else if (phase === "preview") {
      phaseContent = (
        <View>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={styles.preview}
              resizeMode="cover"
              accessibilityLabel="Selected cabbage leaf photo ready for analysis"
              accessible
            />
          )}
          <Text style={styles.previewHint}>
            Make sure the leaf fills the frame and symptoms are clearly
            visible, then tap Analyze.
          </Text>
          <AppButton
            label="Analyze cabbage"
            onPress={handleAnalyze}
            disabled={isAnalyzing}
            isLoading={isAnalyzing}
            style={styles.flowButton}
          />
          <AppButton
            label="Retake"
            variant="outline"
            onPress={handleRetake}
            disabled={isAnalyzing}
            style={styles.flowButton}
          />
        </View>
      );
    } else if (phase === "analyzing") {
      phaseContent = (
        <View style={styles.analyzingCard}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.analyzingTitle}>Analyzing your cabbage…</Text>
          <View style={styles.privacyBadge}>
            <Text style={styles.privacyBadgeText}>🔒 100% on-device · no data sent</Text>
          </View>
          <Text style={styles.analyzingSub}>
            Running CabbageGuard directly on your phone — works offline.
          </Text>
          <Text style={styles.analyzingHint}>
            First run may take a few seconds while the model loads.
          </Text>
        </View>
      );
    } else if (phase === "result" && result) {
      phaseContent = (
        <DiseaseResultCard
          result={result}
          imageUrl={savedScan?.image_url || imageUri}
          isSaving={saving}
          saveError={saveError}
          saved={!!savedScan}
          isDeleting={deletingCurrent}
          isReanalyzing={reanalyzing}
          onRetake={handleRetake}
          onReanalyze={handleReanalyze}
          onDelete={handleDeleteCurrent}
        />
      );
    } else if (phase === "error") {
      phaseContent = (
        <View style={styles.errorCard}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Couldn't analyze this photo</Text>
          <Text style={styles.errorBody}>{errorMsg}</Text>
          <AppButton
            label="Try again"
            onPress={handleAnalyze}
            disabled={isAnalyzing}
            isLoading={isAnalyzing}
            style={styles.flowButton}
          />
          <AppButton
            label="Take a new photo"
            variant="outline"
            onPress={() => handlePick("camera")}
            disabled={isAnalyzing}
            style={styles.flowButton}
          />
          <AppButton
            label="Choose from gallery"
            variant="outline"
            onPress={() => handlePick("gallery")}
            disabled={isAnalyzing}
            style={styles.flowButton}
          />
        </View>
      );
    }

    return (
      <>
        <Header />
        <Animated.View
          key={`${animKey.phase}-${animKey.n}`}
          style={{
            opacity: entrance.opacity,
            transform: [{ translateY: entrance.translateY }],
          }}
        >
          {phaseContent}
        </Animated.View>
      </>
    );
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <ScanHistoryItem
            item={item}
            index={index}
            onDelete={handleDeleteHistory}
            isDeleting={deletingHistoryId === item.id}
          />
        )}
        ListHeaderComponent={renderTop}
        ListEmptyComponent={
          loadingHistory ? (
            <ActivityIndicator color={colors.primary} style={styles.listSpinner} />
          ) : historyError ? (
            <Text style={styles.listError}>{historyError}</Text>
          ) : (
            <Text style={styles.listEmpty}>
              No scans yet. Take a photo of a cabbage leaf to get started.
            </Text>
          )
        }
        ListFooterComponent={
          clearing ? (
            <View style={styles.listSpinner}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.loadMoreHint}>Clearing…</Text>
            </View>
          ) : loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.listSpinner} />
          ) : (
            <View style={styles.listFooter}>
              {hasMore ? (
                <Text style={styles.loadMoreHint}>Scroll for more…</Text>
              ) : history.length > 0 ? (
                <AppButton
                  label="Clear all scans"
                  variant="danger"
                  onPress={handleClearAll}
                  disabled={clearing}
                  style={styles.clearAllButton}
                />
              ) : null}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      />
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------
// Local sub-components
// ----------------------------------------------------------------------
function Header() {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>Diagnose</Text>
      <Text style={styles.subtitle}>
        Photograph a cabbage leaf and get an on-device diagnosis
      </Text>
    </View>
  );
}

const PHOTO_TIPS = [
  "Fill the frame with a single leaf",
  "Use natural daylight, avoid harsh shadows",
  "Focus clearly on the lesion or affected area",
  "Keep the camera 15–30 cm from the leaf",
];

function EmptyState({ onPick, tipsAnim }) {
  // Subtle pulse on the cabbage mascot to draw the eye and feel alive.
  const mascotScale = usePulse({ minScale: 0.96, maxScale: 1.04, duration: 2000 });

  return (
    <View style={styles.emptyCard}>
      <Animated.Text
        style={[styles.emptyIcon, { transform: [{ scale: mascotScale }] }]}
      >
        🥬
      </Animated.Text>
      <Text style={styles.emptyTitle}>Scan a cabbage leaf</Text>
      <Text style={styles.emptyBody}>
        Take a clear photo of a single cabbage leaf and CabbageGuard will
        identify disease signs instantly. Everything runs on your phone —
        no photos leave your device.
      </Text>

      <View style={styles.tipsBox}>
        <Text style={styles.tipsTitle}>For the best results</Text>
        {PHOTO_TIPS.map((tip, i) => (
          <Animated.View
            key={i}
            style={[styles.tipRow, tipsAnim ? tipsAnim.buildStyle(i) : null]}
          >
            <Text style={styles.tipBullet}>•</Text>
            <Text style={styles.tipText}>{tip}</Text>
          </Animated.View>
        ))}
      </View>

      <AppButton
        label="Take photo"
        onPress={() => onPick("camera")}
        style={styles.flowButton}
      />
      <AppButton
        label="Choose from gallery"
        variant="outline"
        onPress={() => onPick("gallery")}
        style={styles.flowButton}
      />
      {/* Debug helper only present in dev builds — never shipped to users. */}
      {__DEV__ && (
        <AppButton
          label="Debug: Test inference (cache image)"
          variant="outline"
          onPress={() => onPick("debug")}
          style={styles.flowButton}
        />
      )}
    </View>
  );
}

function WebOnlyCard() {
  return (
    <View style={styles.notReadyCard}>
      <Text style={styles.notReadyTitle}>Diagnosis needs the native app</Text>
      <Text style={styles.notReadyBody}>
        Cabbage disease detection runs a model directly on your phone
        (TensorFlow Lite), so it is only available in the Android/iOS app —
        not in the browser. Everything else in GreenBidder works as normal.
      </Text>
    </View>
  );
}

function ModelNotReadyCard() {
  return (
    <View style={styles.notReadyCard}>
      <Text style={styles.notReadyTitle}>CabbageGuard model not bundled yet</Text>
      <Text style={styles.notReadyBody}>
        This screen is fully wired, but the disease-detection model is still the
        placeholder. Two steps remain:
      </Text>
      <Text style={styles.notReadyStep}>
        1. Run the conversion pipeline:{"\n"}
        docs/cabbage-feature/colab/cabbageguard-to-tflite.ipynb (Google Colab,
        upload final.keras)
      </Text>
      <Text style={styles.notReadyStep}>
        2. Copy the generated cabbageguard.tflite + labels.json into
        src/models/ (overwriting the placeholders), then rebuild the native
        app.
      </Text>
      <Text style={styles.notReadyNote}>
        Note: on-device inference requires a dev or release build —
        react-native-fast-tflite does not run inside Expo Go.
      </Text>
    </View>
  );
}

// ----------------------------------------------------------------------
// Styles
// ----------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  content: {
    padding: spacing.md,
    flexGrow: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fonts.h1,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  preview: {
    width: "100%",
    height: 280,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundTertiary,
  },
  previewHint: {
    fontSize: fonts.small,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.md,
    fontStyle: "italic",
  },
  flowButton: {
    marginTop: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.lg,
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    fontSize: fonts.h2,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyBody: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tipsBox: {
    alignSelf: "stretch",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  tipsTitle: {
    fontSize: fonts.small,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  tipBullet: {
    color: colors.primary,
    fontSize: fonts.caption,
    fontWeight: "700",
    width: 10,
  },
  tipText: {
    flex: 1,
    fontSize: fonts.small,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  analyzingCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.xl,
    alignItems: "center",
  },
  analyzingTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  analyzingSub: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  privacyBadge: {
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  privacyBadgeText: {
    fontSize: fonts.small,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  analyzingHint: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: "center",
    fontStyle: "italic",
  },
  errorCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    padding: spacing.lg,
    alignItems: "center",
  },
  errorIcon: {
    fontSize: 36,
  },
  errorTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.danger,
    marginTop: spacing.sm,
  },
  errorBody: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  notReadyCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  notReadyTitle: {
    fontSize: fonts.h3,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  notReadyBody: {
    fontSize: fonts.caption,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  notReadyStep: {
    fontSize: fonts.caption,
    color: colors.textPrimary,
    lineHeight: 20,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  notReadyNote: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    fontStyle: "italic",
    lineHeight: 18,
  },
  listSpinner: {
    marginVertical: spacing.md,
  },
  listFooter: {
    marginTop: spacing.sm,
    alignItems: "center",
  },
  listEmpty: {
    fontSize: fonts.caption,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  listError: {
    fontSize: fonts.caption,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  loadMoreHint: {
    fontSize: fonts.small,
    color: colors.textTertiary,
    textAlign: "center",
    marginVertical: spacing.sm,
  },
  clearAllButton: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    alignSelf: "center",
  },
});
