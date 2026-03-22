import React, { createContext, useContext, useState, useCallback } from "react";

interface MultiViewContextValue {
  selectedIds: string[];
  toggle: (videoId: string) => void;
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

  const clear = useCallback(() => setSelectedIds([]), []);

  return (
    <MultiViewContext.Provider value={{ selectedIds, toggle, isSelected, clear }}>
      {children}
    </MultiViewContext.Provider>
  );
}

export function useMultiView() {
  const ctx = useContext(MultiViewContext);
  if (!ctx) throw new Error("useMultiView must be used within MultiViewProvider");
  return ctx;
}
