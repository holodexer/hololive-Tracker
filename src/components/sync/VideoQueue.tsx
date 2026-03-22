import { useState, useRef, useCallback } from "react";
import { ListVideo, Trash2, Play, Plus, Loader2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { QueueItem } from "@/hooks/useSyncWatch";
import { deserializeMedia, parseMediaInput, serializeMedia } from "@/lib/mediaSource";
import { cn } from "@/lib/utils";

interface VideoQueueProps {
  queue: QueueItem[];
  isHost: boolean;
  onAdd: (videoId: string, title?: string) => void;
  onRemove: (itemId: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  onPlay: (itemId: string) => void;
  locale: "en" | "zh-TW" | "ja";
}

const queueLabels = {
  en: {
    empty: "Queue is empty",
    addHint: "Paste URL to add to queue",
    add: "Add",
    upNext: "Up Next",
    hostOnly: "Only the Host can manage the queue",
    playNow: "Play now",
  },
  "zh-TW": {
    empty: "待播清單為空",
    addHint: "貼上網址加入待播清單",
    add: "加入",
    upNext: "即將播放",
    hostOnly: "只有房主可以管理待播清單",
    playNow: "立即播放",
  },
  ja: {
    empty: "キューは空です",
    addHint: "URLを貼り付けてキューに追加",
    add: "追加",
    upNext: "次に再生",
    hostOnly: "ホストのみがキューを管理できます",
    playNow: "今すぐ再生",
  },
} as const;

async function fetchVideoTitle(serializedMedia: string): Promise<string | undefined> {
  const media = deserializeMedia(serializedMedia);
  if (!media) return undefined;

  if (media.source === "direct") {
    try {
      const parsed = new URL(media.value);
      return decodeURIComponent(parsed.pathname.split("/").pop() || "") || parsed.hostname;
    } catch {
      return undefined;
    }
  }

  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${media.value}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.title || undefined;
  } catch {
    return undefined;
  }
}

export function VideoQueue({ queue, isHost, onAdd, onRemove, onMove, onPlay, locale }: VideoQueueProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const l = queueLabels[locale];

  const handleAdd = async () => {
    const media = parseMediaInput(input);
    if (!media) return;
    const serialized = serializeMedia(media);
    setInput("");
    setLoading(true);
    const title = await fetchVideoTitle(serialized);
    onAdd(serialized, title);
    setLoading(false);
  };

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget as HTMLDivElement;
    e.dataTransfer.effectAllowed = "move";
    // Make the drag image slightly transparent
    requestAnimationFrame(() => {
      if (dragNodeRef.current) dragNodeRef.current.style.opacity = "0.4";
    });
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = "1";
    if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
      onMove(dragIndex, overIndex);
    }
    setDragIndex(null);
    setOverIndex(null);
    dragNodeRef.current = null;
  }, [dragIndex, overIndex, onMove]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIndex(index);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {isHost && (
        <div className="flex gap-2 p-3 border-b border-border/30">
          <Input
            placeholder={l.addHint}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="h-10 flex-1 text-sm"
            disabled={loading}
          />
          <Button size="sm" variant="secondary" className="h-10 px-3 shrink-0" onClick={handleAdd} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <ListVideo className="w-8 h-8 opacity-30" />
            <p className="text-xs">{isHost ? l.empty : l.hostOnly}</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium px-1 mb-1">
              {l.upNext}
            </p>
            {queue.map((item, index) => {
              const isOver = overIndex === index && dragIndex !== null && dragIndex !== index;
              const isAbove = isOver && dragIndex !== null && dragIndex > index;
              const isBelow = isOver && dragIndex !== null && dragIndex < index;

              return (
                <div
                  key={item.id}
                  draggable={isHost}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setOverIndex(null)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs group transition-all duration-150",
                    "bg-card/60 border border-border/30 hover:border-border/60",
                    isAbove && "border-t-2 border-t-primary mt-[-1px]",
                    isBelow && "border-b-2 border-b-primary mb-[-1px]",
                    dragIndex === index && "opacity-40",
                    isHost && "cursor-grab active:cursor-grabbing"
                  )}
                >
                  {isHost && (
                    <GripVertical className="w-3 h-3 text-muted-foreground/40 shrink-0 group-hover:text-muted-foreground transition-colors" />
                  )}

                  <span className="text-muted-foreground/60 font-mono w-4 text-center shrink-0">
                    {index + 1}
                  </span>

                  {(() => {
                    const media = deserializeMedia(item.videoId);
                    if (media?.source === "youtube") {
                      return (
                        <img
                          src={`https://img.youtube.com/vi/${media.value}/default.jpg`}
                          alt=""
                          className="w-10 h-7 rounded object-cover shrink-0 pointer-events-none"
                        />
                      );
                    }
                    return (
                      <div className="w-10 h-7 rounded shrink-0 bg-muted/60 border border-border/40" />
                    );
                  })()}

                  <span className="flex-1 truncate text-foreground font-medium pointer-events-none">
                    {item.title || deserializeMedia(item.videoId)?.value || item.videoId}
                  </span>

                  {isHost && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onPlay(item.id)}
                        className="p-0.5 rounded hover:bg-primary/20 text-primary transition-colors"
                        title={l.playNow}
                      >
                        <Play className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onRemove(item.id)}
                        className="p-0.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
