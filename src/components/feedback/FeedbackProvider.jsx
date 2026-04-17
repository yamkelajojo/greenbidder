import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { View, StyleSheet } from "react-native";
import Toast from "./Toast";
import Sheet from "./Sheet";
import { haptic } from "../../utils/haptics";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   FeedbackProvider — The Global Feedback System
 *
 *   Wraps the app and exposes three APIs via useFeedback():
 *
 *     toast    — ambient feedback (success, error, info)
 *     sheet    — decisions (confirm/cancel)
 *     (banner will be added when we need inline feedback)
 *
 *   This replaces every Alert.alert() in the app. No more Apple's grey
 *   boxes. Every feedback moment is on-brand.
 *
 *   ─── Toast API ──────────────────────────────────────────────────
 *     toast.success("Listing saved")
 *     toast.success({ title: "Saved", message: "Check your feed" })
 *     toast.error("Couldn't connect")
 *     toast.warning("Low stock")
 *     toast.info("New listings nearby")
 *
 *   ─── Sheet API ──────────────────────────────────────────────────
 *     const ok = await sheet.confirm({
 *       title: "Delete this listing?",
 *       description: "This cannot be undone.",
 *       confirmLabel: "Delete",
 *       destructive: true,
 *     });
 *     if (ok) doTheDelete();
 *
 *   ─── Mount ──────────────────────────────────────────────────────
 *   In App.js:
 *     <GestureHandlerRootView style={{ flex: 1 }}>
 *       <FeedbackProvider>
 *         <AuthProvider>
 *           <RootNavigator />
 *         </AuthProvider>
 *       </FeedbackProvider>
 *     </GestureHandlerRootView>
 * ═══════════════════════════════════════════════════════════════════════
 */

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [sheets, setSheets] = useState([]);
  const sheetResolvers = useRef({});
  const idCounter = useRef(0);

  const nextId = () => `fb-${++idCounter.current}`;

  // ── Toast ──────────────────────────────────────────────────────

  const addToast = useCallback((variant, input) => {
    const toast =
      typeof input === "string"
        ? { title: input, message: null }
        : { title: input.title || null, message: input.message || null };

    const id = nextId();
    setToasts((prev) => [...prev, { id, variant, ...toast }]);

    // Fire appropriate haptic alongside the toast
    if (variant === "success") haptic.success();
    else if (variant === "error") haptic.error();
    else if (variant === "warning") haptic.warning();
    else haptic.tap();
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (input) => addToast("success", input),
    error: (input) => addToast("error", input),
    warning: (input) => addToast("warning", input),
    info: (input) => addToast("info", input),
  };

  // ── Sheet ──────────────────────────────────────────────────────

  const sheet = {
    confirm: (config) => {
      return new Promise((resolve) => {
        const id = nextId();
        sheetResolvers.current[id] = resolve;
        setSheets((prev) => [...prev, { id, ...config }]);
      });
    },
  };

  const resolveSheet = useCallback((id, result) => {
    const resolver = sheetResolvers.current[id];
    if (resolver) {
      resolver(result);
      delete sheetResolvers.current[id];
    }
    setSheets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return (
    <FeedbackContext.Provider value={{ toast, sheet }}>
      {children}

      {/* Toast layer — stacks multiple toasts vertically */}
      <View style={styles.toastLayer} pointerEvents="box-none">
        {toasts.map((t, i) => (
          <View
            key={t.id}
            style={[styles.toastSlot, { top: 60 + i * 76 }]}
            pointerEvents="box-none"
          >
            <Toast toast={t} onDismiss={dismissToast} />
          </View>
        ))}
      </View>

      {/* Sheet layer — one at a time (by design) */}
      {sheets.map((s) => (
        <Sheet key={s.id} sheet={s} onResolve={resolveSheet} />
      ))}
    </FeedbackContext.Provider>
  );
}

/**
 * Hook — access the feedback system from any screen/component.
 * Throws if called outside FeedbackProvider.
 */
export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error("useFeedback must be used within FeedbackProvider");
  }
  return ctx;
};

const styles = StyleSheet.create({
  toastLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  toastSlot: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
