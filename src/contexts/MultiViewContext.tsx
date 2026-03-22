import React, { createContext, useContext, useState, useCallback } from "react";

export interface SelectedStream {
  videoId: string;
  channelId: string;
  channelName: string;
  viewers?: number;
}

interface MultiViewContextValue {
  selectedIds: string[];
  selectedStreams: SelectedStream[];
  toggle: (videoId: string, streamInfo?: Omit<SelectedStream, "videoId">) => void;
  isSelected: (videoId: string) => boolean;
  clear: () => void;
}

const MultiViewContext = createContext<MultiViewContextValue | null>(null);

export function MultiViewProvider({ children }: { children: React.ReactNode }) {
  const [selectedStreams, setSelectedStreams] = useState<SelectedStream[]>([]);

  const toggle = useCallback((videoId: string, streamInfo?: Omit<SelectedStream, "videoId">) => {
    setSelectedStreams((prev) => {
      const exists = prev.find((s) => s.videoId === videoId);
      if (exists) {
        return prev.filter((s) => s.videoId !== videoId);
      } else if (prev.length < 4 && streamInfo) {
        return [...prev, { videoId, ...streamInfo }];
      }
      return prev;
    });
  }, []);

  const isSelected = useCallback(
    (videoId: string) => selectedStreams.some((s) => s.videoId === videoId),
    [selectedStreams]
  );

  const clear = useCallback(() => setSelectedStreams([]), []);

  const selectedIds = selectedStreams.map((s) => s.videoId);

  return (
    <MultiViewContext.Provider
      value={{ selectedIds, selectedStreams, toggle, isSelected, clear }}
    >
      {children}
    </MultiViewContext.Provider>
  );
}

export function useMultiView() {
  const ctx = useContext(MultiViewContext);
  if (!ctx) throw new Error("useMultiView must be used within MultiViewProvider");
  return ctx;
}
