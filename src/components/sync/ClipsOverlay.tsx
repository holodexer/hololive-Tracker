import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, Film, Radio, Archive, Loader2, Eye, Clock, ListMusic, ChevronLeft } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchHololiveClips,
  fetchHololiveLive,
  fetchHololivePastStreams,
  fetchChannelVideos,
  fetchChannelClips,
  type HolodexVideo,
} from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { useSettings } from "@/contexts/SettingsContext";
import { format } from "date-fns";
import { buildYouTubeThumbnailUrl } from "@/lib/urls";

interface ClipsOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectClip: (videoId: string, title: string) => void;
  onTabChange?: (tab: "live" | "archives" | "clips" | "playlists") => void;
  activeTab?: "live" | "archives" | "clips" | "playlists";
  locale?: "en" | "zh-TW" | "ja";
  labels: {
    clipsTitle: string;
    clipsTab: string;
    archivesTab: string;
    favoriteOnly: string;
    selectClipToAdd: string;
    selectLiveToAdd?: string;
    selectArchiveToAdd?: string;
    noClipsFound: string;
    noArchivesFound?: string;
    clipsLoading: string;
    archivesLoading?: string;
    loadMore: string;
    loading: string;
    liveNow?: string;
    noLive?: string;
    playlistsTab?: string;
  };
}

const CLIPS_PAGE_SIZE = 48;
const INITIAL_PAGES = 1;
const INITIAL_LOAD_COUNT = CLIPS_PAGE_SIZE * INITIAL_PAGES;
const ARCHIVES_PAGE_SIZE = 48;

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
  onTabChange,
  activeTab: externalActiveTab = "live",
  locale = "en",
  labels,
}: ClipsOverlayProps) {
  const { hidePrivateVideos, clipLanguages, favorites, playlists, getVideoMeta } = useSettings();
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips" | "playlists">(externalActiveTab);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Sync internal state with external activeTab
  useEffect(() => {
    setActiveTab(externalActiveTab);
    if (externalActiveTab !== "playlists") setSelectedPlaylistId(null);
  }, [externalActiveTab]);

  // Live tab state
  const [liveVideos, setLiveVideos] = useState<HolodexVideo[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);

  // Archives tab state
  const [archives, setArchives] = useState<HolodexVideo[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [archivesHasMore, setArchivesHasMore] = useState(true);
  const [archivesPage, setArchivesPage] = useState(0);

  // Clips tab state
  const [clips, setClips] = useState<HolodexVideo[]>([]);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [clipsHasMore, setClipsHasMore] = useState(true);
  const [clipsPage, setClipsPage] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const loadedClipQueryKeyRef = useRef<string>("");
  const loadedArchiveQueryKeyRef = useRef<string>("");

  // Follow Settings > clip language filter; fallback to locale when empty.
  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = useMemo(
    () => (clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang]),
    [clipLanguages, fallbackClipLang]
  );
  const clipLangKey = activeClipLangs.join("|");
  const favoritesKey = favorites.join("|");
  const currentClipQueryKey = `${clipLangKey}|${hidePrivateVideos ? "1" : "0"}|${favoritesOnly ? "1" : "0"}|${favoritesKey}`;
  const currentArchiveQueryKey = `${hidePrivateVideos ? "1" : "0"}|${favoritesOnly ? "1" : "0"}|${favoritesKey}`;
  const favoriteIds = useMemo(() => favorites, [favorites]);

  const applyFavoriteFilter = useCallback(
    (videos: HolodexVideo[]) => {
      if (!favoritesOnly) return videos;
      const favoriteSet = new Set(favorites);
      return videos.filter((video) => favoriteSet.has(video.channel?.id ?? ""));
    },
    [favoritesOnly, favorites]
  );

  const normalizeClipBatch = useCallback((videos: HolodexVideo[]) => {
    return dedupeVideosById(videos).slice(0, CLIPS_PAGE_SIZE);
  }, []);

  const getTabShortLabel = useCallback(
    (tab: "live" | "archives" | "clips" | "playlists") => {
      if (locale === "ja") {
        if (tab === "live") return "配信";
        if (tab === "archives") return "アーカ";
        if (tab === "playlists") return "リスト";
        return "切り抜き";
      }
      if (locale === "zh-TW") {
        if (tab === "live") return "直播";
        if (tab === "archives") return "存檔";
        if (tab === "playlists") return "清單";
        return "剪輯";
      }
      if (tab === "live") return "Live";
      if (tab === "archives") return "Archive";
      if (tab === "playlists") return "Lists";
      return "Clips";
    },
    [locale]
  );

  // Load live videos
  useEffect(() => {
    if (!open) return;

    setLiveLoading(true);
    fetchHololiveLive()
      .then((videos) => {
        const filtered = filterUnavailableVideos(videos, hidePrivateVideos);
        setLiveVideos(applyFavoriteFilter(filtered));
        setLiveLoading(false);
      })
      .catch(() => {
        setLiveLoading(false);
      });
  }, [open, hidePrivateVideos, applyFavoriteFilter]);

  // Load initial archives
  useEffect(() => {
    if (!open || activeTab !== "archives") return;
    if (loadedArchiveQueryKeyRef.current === currentArchiveQueryKey && archives.length > 0) return;

    if (favoritesOnly && favoriteIds.length === 0) {
      setArchives([]);
      setArchivesPage(1);
      setArchivesHasMore(false);
      loadedArchiveQueryKeyRef.current = currentArchiveQueryKey;
      return;
    }

    setArchivesLoading(true);
    (favoritesOnly && favoriteIds.length > 0
      ? Promise.all(
          favoriteIds.map((channelId) => fetchChannelVideos(channelId, "stream", "past", ARCHIVES_PAGE_SIZE, 0))
        ).then((results) => ({
          videos: results
            .flat()
            .sort((a, b) => new Date(b.available_at).getTime() - new Date(a.available_at).getTime()),
          hasMore: results.some((items) => items.length >= ARCHIVES_PAGE_SIZE),
        }))
      : fetchHololivePastStreams(ARCHIVES_PAGE_SIZE, 0).then((videos) => ({
          videos,
          hasMore: videos.length >= ARCHIVES_PAGE_SIZE,
        })))
      .then(({ videos, hasMore }) => {
        const filtered = applyFavoriteFilter(filterUnavailableVideos(videos, hidePrivateVideos));
        setArchives(dedupeVideosById(filtered));
        setArchivesPage(1);
        setArchivesHasMore(hasMore);
        loadedArchiveQueryKeyRef.current = currentArchiveQueryKey;
        setArchivesLoading(false);
      })
      .catch(() => {
        setArchivesLoading(false);
      });
  }, [open, activeTab, currentArchiveQueryKey, archives.length, hidePrivateVideos, applyFavoriteFilter, favoritesOnly, favoriteIds]);

  // Load initial clips (preload 2 pages by default)
  useEffect(() => {
    if (!open || activeTab !== "clips") return;
    if (loadedClipQueryKeyRef.current === currentClipQueryKey && clips.length > 0) return;

    if (favoritesOnly && favoriteIds.length === 0) {
      setClips([]);
      setClipsPage(INITIAL_PAGES);
      setClipsHasMore(false);
      loadedClipQueryKeyRef.current = currentClipQueryKey;
      return;
    }

    setClipsLoading(true);
    (favoritesOnly && favoriteIds.length > 0
      ? Promise.all(
          activeClipLangs.map(async (lang) => {
            const byChannel = await Promise.all(
              favoriteIds.map((channelId) => fetchChannelClips(channelId, INITIAL_LOAD_COUNT, 0, lang))
            );
            return {
              lang,
              videos: byChannel.flat(),
              hasMore: byChannel.some((items) => items.length >= INITIAL_LOAD_COUNT),
            };
          })
        )
      : Promise.all(
          activeClipLangs.map(async (lang) => ({
            lang,
            videos: await fetchHololiveClips(INITIAL_LOAD_COUNT, 0, lang),
            hasMore: false,
          }))
        ))
      .then((results) => {
        const mixed = mixClipsByLanguage(results.map(({ lang, videos }) => ({ lang, videos })));
        const baseFiltered = filterUnavailableVideos(mixed, hidePrivateVideos);
        // In favorites-only mode clips are already fetched per favorite channel.
        const filtered = favoritesOnly ? baseFiltered : applyFavoriteFilter(baseFiltered);
        setClips(normalizeClipBatch(filtered));
        setClipsPage(INITIAL_PAGES);
        setClipsHasMore(
          favoritesOnly && favoriteIds.length > 0
            ? results.some((result) => result.hasMore)
            : results.some((result) => result.videos.length >= INITIAL_LOAD_COUNT)
        );
        loadedClipQueryKeyRef.current = currentClipQueryKey;
        setClipsLoading(false);
      })
      .catch(() => {
        setClipsLoading(false);
      });
  }, [open, activeTab, activeClipLangs, hidePrivateVideos, currentClipQueryKey, clips.length, applyFavoriteFilter, favoritesOnly, favoriteIds]);

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
  }, [open, clips.length, archives.length]);

  useEffect(() => {
    // Reset stored position when switching filter/language.
    scrollTopRef.current = 0;
  }, [currentClipQueryKey, currentArchiveQueryKey]);

  const handleLoadMoreArchives = async () => {
    if (favoritesOnly && favoriteIds.length === 0) {
      setArchivesHasMore(false);
      return;
    }

    setArchivesLoading(true);
    try {
      const offset = archivesPage * ARCHIVES_PAGE_SIZE;
      const archiveByChannel = favoritesOnly && favoriteIds.length > 0
        ? await Promise.all(
            favoriteIds.map((channelId) => fetchChannelVideos(channelId, "stream", "past", ARCHIVES_PAGE_SIZE, offset))
          )
        : null;
      const videos = archiveByChannel
        ? archiveByChannel
            .flat()
            .sort((a, b) => new Date(b.available_at).getTime() - new Date(a.available_at).getTime())
        : await fetchHololivePastStreams(ARCHIVES_PAGE_SIZE, offset);
      const filtered = applyFavoriteFilter(filterUnavailableVideos(videos, hidePrivateVideos));
      setArchives((prev) => dedupeVideosById([...prev, ...filtered]));
      setArchivesPage((p) => p + 1);
      if (archiveByChannel) {
        setArchivesHasMore(archiveByChannel.some((items) => items.length >= ARCHIVES_PAGE_SIZE));
      } else if (videos.length < ARCHIVES_PAGE_SIZE) {
        setArchivesHasMore(false);
      }
    } finally {
      setArchivesLoading(false);
    }
  };

  const handleLoadMoreClips = async () => {
    if (favoritesOnly && favoriteIds.length === 0) {
      setClipsHasMore(false);
      return;
    }

    setClipsLoading(true);
    try {
      const offset = clipsPage * CLIPS_PAGE_SIZE;
      const results = favoritesOnly && favoriteIds.length > 0
        ? await Promise.all(
            activeClipLangs.map(async (lang) => {
              const byChannel = await Promise.all(
                favoriteIds.map((channelId) => fetchChannelClips(channelId, CLIPS_PAGE_SIZE, offset, lang))
              );
              return {
                lang,
                videos: byChannel.flat(),
                hasMore: byChannel.some((items) => items.length >= CLIPS_PAGE_SIZE),
              };
            })
          )
        : await Promise.all(
            activeClipLangs.map(async (lang) => ({
              lang,
              videos: await fetchHololiveClips(CLIPS_PAGE_SIZE, offset, lang),
              hasMore: false,
            }))
          );
      const mixed = mixClipsByLanguage(results.map(({ lang, videos }) => ({ lang, videos })));
      const baseFiltered = filterUnavailableVideos(mixed, hidePrivateVideos);
      const filtered = favoritesOnly ? baseFiltered : applyFavoriteFilter(baseFiltered);
      const batch = normalizeClipBatch(filtered);
      setClips((prev) => dedupeVideosById([...prev, ...batch]));
      setClipsPage((p) => p + 1);
      if (favoritesOnly && favoriteIds.length > 0) {
        setClipsHasMore(results.some((result) => result.hasMore));
      } else if (!results.some((result) => result.videos.length >= CLIPS_PAGE_SIZE)) {
        setClipsHasMore(false);
      }
    } finally {
      setClipsLoading(false);
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
            {activeTab === "live" ? (
              <Radio className="w-5 h-5 text-primary" />
            ) : activeTab === "archives" ? (
              <Archive className="w-5 h-5 text-primary" />
            ) : activeTab === "playlists" ? (
              <ListMusic className="w-5 h-5 text-primary" />
            ) : (
              <Film className="w-5 h-5 text-primary" />
            )}
            <h2 className="text-lg font-semibold text-foreground">
              {activeTab === "live"
                ? (labels.liveNow || "直播中")
                : activeTab === "archives"
                  ? labels.archivesTab
                  : activeTab === "playlists"
                    ? (labels.playlistsTab || "播放清單")
                    : labels.clipsTitle}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border/30 bg-card/40 px-3 py-2 md:px-6 shrink-0">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-w-max gap-1 pr-2">
                {(["live", "archives", "clips", "playlists"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      onTabChange?.(tab);
                      scrollTopRef.current = 0;
                      if (tab !== "playlists") setSelectedPlaylistId(null);
                    }}
                    className={`shrink-0 min-w-[76px] md:min-w-0 flex items-center justify-center gap-1.5 px-3 md:px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                    aria-label={tab === "live"
                      ? (labels.liveNow || "直播中")
                      : tab === "archives"
                        ? labels.archivesTab
                        : tab === "playlists"
                          ? (labels.playlistsTab || "播放清單")
                          : labels.clipsTab}
                  >
                    {tab === "live" ? <Radio className="w-4 h-4" />
                      : tab === "archives" ? <Archive className="w-4 h-4" />
                      : tab === "playlists" ? <ListMusic className="w-4 h-4" />
                      : <Film className="w-4 h-4" />}
                    <span className="md:hidden">{getTabShortLabel(tab)}</span>
                    <span className="hidden md:inline">
                      {tab === "live"
                        ? (labels.liveNow || "直播中")
                        : tab === "archives"
                          ? labels.archivesTab
                          : tab === "playlists"
                            ? (labels.playlistsTab || "播放清單")
                            : labels.clipsTab}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end md:justify-start">
              <button
                type="button"
                onClick={() => setFavoritesOnly((v) => !v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors whitespace-nowrap ${
                  favoritesOnly
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels.favoriteOnly}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
          <div className="p-4 md:p-5">
            {activeTab === "live" ? (
              // Live videos section
              liveLoading ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{labels.clipsLoading}</p>
                  </div>
                </div>
              ) : liveVideos.length === 0 ? (
                <div className="flex justify-center py-8">
                  <p className="text-sm text-muted-foreground">{labels.noLive || "目前沒有直播中的成員"}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveVideos.map((video) => {
                    const thumbnail = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`;
                    const channelName = video.channel?.name || "";
                    const isLive = video.status === "live";
                    const isUpcoming = video.status === "upcoming";

                    return (
                      <button
                        key={video.id}
                        type="button"
                        onClick={() => onSelectClip(video.id, video.title)}
                        className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                      >
                        <div className="relative aspect-video">
                          <img
                            src={thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                          {isLive && (
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-live px-2 py-0.5 rounded text-xs font-semibold text-foreground">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
                              </span>
                              LIVE
                            </div>
                          )}

                          {isUpcoming && (
                            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-primary/90 px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
                              <Clock className="w-3 h-3" />
                              UPCOMING
                            </div>
                          )}

                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {video.title}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground">{channelName}</span>
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                {isLive && (
                                  <>
                                    <Eye className="w-3 h-3" />
                                    {(video.live_viewers ?? 0).toLocaleString()}
                                  </>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : activeTab === "archives" ? (
              archivesLoading && archives.length === 0 ? (
                <div className="flex justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{labels.archivesLoading || labels.clipsLoading}</p>
                  </div>
                </div>
              ) : archives.length === 0 ? (
                <div className="flex justify-center py-8">
                  <p className="text-sm text-muted-foreground">{labels.noArchivesFound || labels.noClipsFound}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {archives.map((video) => {
                    const thumbnail = buildYouTubeThumbnailUrl(video.id);
                    const channelName = video.channel?.name || "";

                    return (
                      <button
                        key={video.id}
                        type="button"
                        className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                        onClick={() => onSelectClip(video.id, video.title)}
                      >
                        <div className="relative aspect-video">
                          <img
                            src={thumbnail}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {video.title}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-xs text-muted-foreground truncate pr-2">{channelName}</span>
                              <span className="text-xs text-muted-foreground shrink-0">
                                {format(new Date(video.available_at), "MMM d, HH:mm")}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : activeTab === "clips" ? (
              // Clips section
              clipsLoading && clips.length === 0 ? (
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clips.map((clip) => {
                    const thumbnailUrl = buildYouTubeThumbnailUrl(clip.id);
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
              )
            ) : (
              // Playlists section
              selectedPlaylistId === null ? (
                // Playlist grid
                playlists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                    <ListMusic className="w-10 h-10 opacity-40" />
                    <p className="text-sm">{labels.playlistsTab || "播放清單"}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {playlists.map((pl) => {
                      const thumb = pl.videoIds.length > 0
                        ? buildYouTubeThumbnailUrl(pl.videoIds[0])
                        : null;
                      return (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => setSelectedPlaylistId(pl.id)}
                          className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                        >
                          <div className="relative aspect-video bg-muted">
                            {thumb ? (
                              <img src={thumb} alt={pl.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ListMusic className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-2 pt-4 pb-1.5 flex items-end justify-between gap-1">
                              <span className="text-xs font-semibold text-white line-clamp-1">{pl.name}</span>
                              <span className="text-[10px] text-white/70 shrink-0">{pl.videoIds.length}本</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (() => {
                // Video list inside selected playlist
                const pl = playlists.find((p) => p.id === selectedPlaylistId);
                if (!pl) { setSelectedPlaylistId(null); return null; }
                return (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setSelectedPlaylistId(null)}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {pl.name}
                    </button>
                    {pl.videoIds.length === 0 ? (
                      <div className="flex justify-center py-12 text-muted-foreground text-sm">尚無影片</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pl.videoIds.map((videoId) => {
                          const meta = getVideoMeta(videoId);
                          const thumb = buildYouTubeThumbnailUrl(videoId);
                          const title = meta?.title || videoId;
                          const channel = meta?.channelName || "";
                          return (
                            <button
                              key={videoId}
                              type="button"
                              onClick={() => onSelectClip(videoId, title)}
                              className="group block rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                            >
                              <div className="relative aspect-video">
                                <img src={thumb} alt={title} className="w-full h-full object-cover" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-3">
                                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{title}</p>
                                  {channel && <p className="text-xs text-muted-foreground truncate mt-0.5">{channel}</p>}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* Load more button */}
            {activeTab === "clips" && clipsHasMore && clips.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMoreClips}
                  disabled={clipsLoading}
                  className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {clipsLoading ? (
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

            {activeTab === "archives" && archivesHasMore && archives.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMoreArchives}
                  disabled={archivesLoading}
                  className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {archivesLoading ? (
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
          👉 {activeTab === "clips"
            ? labels.selectClipToAdd
            : activeTab === "archives"
              ? (labels.selectArchiveToAdd || labels.selectClipToAdd)
              : activeTab === "playlists"
                ? labels.selectClipToAdd
                : (labels.selectLiveToAdd || labels.selectClipToAdd)}
        </div>
      </div>
    </div>
  );
}
