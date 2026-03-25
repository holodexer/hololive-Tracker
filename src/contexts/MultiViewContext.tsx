import React, { createContext, useContext, useState, useCallback } from "react";

interface MultiViewContextValue {
  selectedIds: string[];
  toggle: (videoId: string) => void;
  setSelectedIds: (videoIds: string[]) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  isSelected: (videoId: string) => boolean;
  clear: () => void;
}

const MultiViewContext = createContext<MultiViewContextValue | null>(null);

export function MultiViewProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggle = useCallback((videoId: string) => {
    setSelectedIds((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : prev.length < 4
        ? [...prev, videoId]
        : prev
    );
  }, []);

  const isSelected = useCallback(
    (videoId: string) => selectedIds.includes(videoId),
    [selectedIds]
  );

  const applySelectedIds = useCallback((videoIds: string[]) => {
    const deduped = Array.from(new Set(videoIds.filter(Boolean))).slice(0, 4);
    setSelectedIds(deduped);
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedIds((prev) => {
      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= prev.length ||
        toIndex >= prev.length ||
        fromIndex === toIndex
      ) {
        return prev;
      }

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds([]), []);

  return (
    <MultiViewContext.Provider value={{ selectedIds, toggle, setSelectedIds: applySelectedIds, reorder, isSelected, clear }}>
      {children}
    </MultiViewContext.Provider>
  );
}

export function useMultiView() {
  const ctx = useContext(MultiViewContext);
  if (!ctx) throw new Error("useMultiView must be used within MultiViewProvider");
  return ctx;
}
