import { useState, useEffect, useRef } from "react";
import { X, Film, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchHololiveClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { useSettings } from "@/contexts/SettingsContext";
import { format } from "date-fns";

interface ClipsOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectClip: (videoId: string, title: string) => void;
  locale?: "en" | "zh-TW" | "ja";
  labels: {
    clipsTitle: string;
    selectClipToAdd: string;
    noClipsFound: string;
    clipsLoading: string;
    loadMore: string;
    loading: string;
  };
}

const CLIPS_PAGE_SIZE = 50;
const INITIAL_PAGES = 2;
const INITIAL_LOAD_COUNT = CLIPS_PAGE_SIZE * INITIAL_PAGES;

function dedupeVideosById(videos: HolodexVideo[]) {
  const map = new Map<string, HolodexVideo>();
  for (const video of videos) {
    if (!map.has(video.id)) map.set(video.id, video);
  }
  return Array.from(map.values());
}

export function ClipsOverlay({
  open,
  onClose,
  onSelectClip,
  locale = "en",
  labels,
}: ClipsOverlayProps) {
  const { hidePrivateVideos, clipLanguages } = useSettings();
  const [clips, setClips] = useState<HolodexVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const loadedQueryKeyRef = useRef<string>("");

  // Follow Settings > clip language filter; fallback to locale when empty.
  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");
  const currentQueryKey = `${clipLangKey}|${hidePrivateVideos ? "1" : "0"}`;

  // Load initial clips (preload 2 pages by default)
  useEffect(() => {
    if (!open) return;
    if (loadedQueryKeyRef.current === currentQueryKey && clips.length > 0) return;

    setIsLoading(true);
    Promise.all(
      activeClipLangs.map(async (lang) => ({
        lang,
        videos: await fetchHololiveClips(INITIAL_LOAD_COUNT, 0, lang),
      }))
    )
      .then((results) => {
        const mixed = mixClipsByLanguage(results);
        const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
        setClips(filtered);
        setPage(INITIAL_PAGES);
        setHasMore(results.some((result) => result.videos.length >= INITIAL_LOAD_COUNT));
        loadedQueryKeyRef.current = currentQueryKey;
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [open, clipLangKey, hidePrivateVideos, locale, currentQueryKey, clips.length]);

  // Keep and restore scroll position in the overlay list viewport
  useEffect(() => {
    if (!open) return;

    const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) return;

    const onScroll = () => {
      scrollTopRef.current = viewport.scrollTop;
    };

    viewport.addEventListener("scroll", onScroll);

    const raf = requestAnimationFrame(() => {
      viewport.scrollTop = scrollTopRef.current;
    });

    return () => {
      cancelAnimationFrame(raf);
      viewport.removeEventListener("scroll", onScroll);
    };
  }, [open, clips.length]);

  useEffect(() => {
    // Reset stored position when switching filter/language.
    scrollTopRef.current = 0;
  }, [currentQueryKey]);

  const handleLoadMore = async () => {
    setIsLoading(true);
    try {
      const offset = page * CLIPS_PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchHololiveClips(CLIPS_PAGE_SIZE, offset, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClips((prev) => dedupeVideosById([...prev, ...filtered]));
      setPage((p) => p + 1);
      if (!results.some((result) => result.videos.length >= CLIPS_PAGE_SIZE)) setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-6xl max-h-[92vh] mx-2 md:mx-4 my-3 md:my-5 bg-card rounded-lg border border-border shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-3">
            <Film className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">{labels.clipsTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Info text */}
        <div className="px-6 py-2 bg-muted/30 text-xs text-muted-foreground border-b border-border/20">
          {labels.selectClipToAdd}
        </div>

        {/* Clips list */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="p-4 md:p-5">
            {isLoading && clips.length === 0 ? (
              <div className="flex justify-center py-8">
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{labels.clipsLoading}</p>
                </div>
              </div>
            ) : clips.length === 0 ? (
              <div className="flex justify-center py-8">
                <p className="text-sm text-muted-foreground">{labels.noClipsFound}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
                {clips.map((clip) => {
                  const thumbnailUrl = `https://i.ytimg.com/vi/${clip.id}/mqdefault.jpg`;
                  const channelName = clip.channel?.name || "";

                  return (
                    <button
                      key={clip.id}
                      type="button"
                      className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                      onClick={() => onSelectClip(clip.id, clip.title)}
                    >
                      <div className="relative aspect-video">
                        <img
                          src={thumbnailUrl}
                          alt={clip.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {clip.title}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground truncate pr-2">{channelName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(clip.available_at), "MMM d, HH:mm")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Load more button */}
            {hasMore && clips.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {labels.loading}
                    </>
                  ) : (
                    labels.loadMore
                  )}
                </button>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-border/30 bg-muted/20 text-xs text-muted-foreground shrink-0">
          👉 {labels.selectClipToAdd}
        </div>
      </div>
    </div>
  );
}
