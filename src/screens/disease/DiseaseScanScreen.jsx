import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, ImagePlus } from "@tamagui/lucide-icons-2";
import * as FileSystem from "expo-file-system/legacy";
import { colors, spacing, fonts, radius } from "../../config/theme";
import { pickImage } from "../../services/imageService";
import {
  isModelReady,
  diagnose,
  saveScan,
  getScanHistory,
  deleteScan,
  clearAllScans,
} from "../../services/diseaseService";
import DiseaseResultCard from "./DiseaseResultCard";
import ScanHistoryItem from "./ScanHistoryItem";
import AppButton from "../shared/AppButton";

const PAGE_SIZE = 10;

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
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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

  useEffect(() => {
    loadHistory("first");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------------------
  // History
  // ------------------------------------------------------------------
  const loadHistory = useCallback(
    async (mode = "first") => {
      if (mode === "first") setLoadingHistory(true);
      if (mode === "more") setLoadingMore(true);
      setHistoryError("");

      const before = mode === "more" && history.length > 0
        ? history[history.length - 1].created_at
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
    },
    [history]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory("first");
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loadingHistory) return;
    await loadHistory("more");
  };

  // ------------------------------------------------------------------
  // Scan flow
  // ------------------------------------------------------------------
  const handlePick = async (source) => {
    if (source === "debug") {
      try {
        const srcUri = "file:///sdcard/Download/cabbage-test.jpg";
        const destUri = FileSystem.cacheDirectory + "cabbage-test.jpg";
        await FileSystem.copyAsync({ from: srcUri, to: destUri });
        setResult(null);
        setSavedScan(null);
        setImageUri(destUri);
        setPhase("preview");
      } catch (e) {
        Alert.alert("Debug error", e.message || String(e));
      }
      return;
    }
    const { uri, cancelled, error } = await pickImage(source);
    if (error) {
      Alert.alert("Camera", error);
      return;
    }
    if (cancelled || !uri) return;
    setResult(null);
    setSavedScan(null);
    setImageUri(uri);
    setPhase("preview");
  };

  const handleAnalyze = async () => {
    if (!imageUri) return;
    setPhase("analyzing");
    const { data, error } = await diagnose(imageUri);
    if (error) {
      setErrorMsg(error.message || "Diagnosis failed. Please try again.");
      setPhase("error");
      return;
    }
    setResult(data);
    setPhase("result");

    // Auto-save every scan to Supabase (PRD §13).
    setSaving(true);
    const saved = await saveScan(data, imageUri);
    setSaving(false);
    if (saved.data) {
      setSavedScan(saved.data);
      setHistory((prev) => [saved.data, ...prev]);
    } else {
      Alert.alert(
        "Saved on device only",
        `The diagnosis was not saved to your history: ${
          saved.error?.message || "unknown error"
        }`
      );
    }
  };

  const handleRetake = () => {
    setImageUri(null);
    setResult(null);
    setSavedScan(null);
    setErrorMsg("");
    setPhase("idle");
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

    return (
      <>
        <Header />
        {phase === "idle" && <EmptyState onPick={handlePick} />}

        {phase === "preview" && (
          <View>
            {imageUri && <Image source={{ uri: imageUri }} style={styles.preview} />}
            <AppButton
              label="Analyze cabbage"
              onPress={handleAnalyze}
              style={styles.flowButton}
            />
            <AppButton
              label="Retake"
              variant="outline"
              onPress={handleRetake}
              style={styles.flowButton}
            />
          </View>
        )}

        {phase === "analyzing" && (
          <View style={styles.analyzingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.analyzingTitle}>Analyzing your cabbage…</Text>
            <Text style={styles.analyzingSub}>
              Running CabbageGuard on-device — no data leaves your phone.
            </Text>
          </View>
        )}

        {phase === "result" && result && (
          <DiseaseResultCard
            result={result}
            imageUrl={savedScan?.image_url || imageUri}
            isSaving={saving}
            isDeleting={deletingCurrent}
            onRetake={handleRetake}
            onDelete={handleDeleteCurrent}
          />
        )}

        {phase === "error" && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{errorMsg}</Text>
            <AppButton
              label="Try again"
              onPress={handleAnalyze}
              style={styles.flowButton}
            />
            <AppButton
              label="Pick a new photo"
              variant="outline"
              onPress={() => handlePick("gallery")}
              style={styles.flowButton}
            />
          </View>
        )}
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
        renderItem={({ item }) => (
          <ScanHistoryItem
            item={item}
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
          loadingMore ? (
            <ActivityIndicator color={colors.primary} style={styles.listSpinner} />
          ) : hasMore ? (
            <Text style={styles.loadMoreHint}>Scroll for more…</Text>
          ) : null
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

function EmptyState({ onPick }) {
  const debugUri = "file:///sdcard/Download/cabbage-test.jpg";
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>🥬</Text>
      <Text style={styles.emptyTitle}>Scan a cabbage leaf</Text>
      <Text style={styles.emptyBody}>
        Hold the phone steady and fill the frame with a single leaf in good
        light. The analysis runs entirely on your device.
      </Text>
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
      <AppButton
        label="Debug: Test inference"
        variant="outline"
        onPress={() => onPick("debug")}
        style={styles.flowButton}
      />
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
    height: 240,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.backgroundTertiary,
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
});
