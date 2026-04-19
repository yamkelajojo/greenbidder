import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useSharedValue } from "react-native-reanimated";

/**
 * ═══════════════════════════════════════════════════════════════════════
 *   AIModalContext v3 — Synchronized Close
 *
 *   Adds closeProgress: a shared value that ticks 0 → 1 during the modal's
 *   close animation. The active source AIBadge reads this value and fades
 *   its own opacity back in during the final ~30% of the close — timed so
 *   the badge is fully visible at the exact moment the modal vanishes into
 *   its position. Zero gap, no pop-in.
 *
 *   Flow during close:
 *     0.0  modal at center, full scale     — badge invisible (hidden)
 *     0.7  modal ~halfway shrunk back      — badge starts fading in
 *     1.0  modal fully disappeared         — badge at full opacity
 * ═══════════════════════════════════════════════════════════════════════
 */

const AIModalContext = createContext(null);

export function AIModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    aiData: null,
    sourceRect: null,
    score: null,
    activeSourceId: null,
  });

  // Shared value — ticks during close animation so badges can sync
  const closeProgress = useSharedValue(0);

  const showAIModal = useCallback((rect, aiData, score, sourceId) => {
    closeProgress.value = 0; // reset
    setModalState({
      isOpen: true,
      aiData,
      sourceRect: rect,
      score,
      activeSourceId: sourceId,
    });
  }, []);

  const hideAIModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const finalizeClose = useCallback(() => {
    setModalState({
      isOpen: false,
      aiData: null,
      sourceRect: null,
      score: null,
      activeSourceId: null,
    });
    closeProgress.value = 0;
  }, []);

  // Memoize context value so consumers don't re-render on every render
  const value = useMemo(
    () => ({
      ...modalState,
      closeProgress,
      showAIModal,
      hideAIModal,
      finalizeClose,
    }),
    [modalState, showAIModal, hideAIModal, finalizeClose],
  );

  return (
    <AIModalContext.Provider value={value}>{children}</AIModalContext.Provider>
  );
}

export function useAIModal() {
  const ctx = useContext(AIModalContext);
  if (!ctx) {
    throw new Error("useAIModal must be used within AIModalProvider");
  }
  return ctx;
}
