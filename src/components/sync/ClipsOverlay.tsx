import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, Film, Radio, Archive, Loader2, Eye, Clock, ListMusic, ChevronLeft, ChevronRight, Server, Play, Plus } from "lucide-react";
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
import { buildJellyfinMasterUrl } from "@/lib/jellyfin";

interface ClipsOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectClip: (videoId: string, title: string) => void;
  onAddToQueue?: (videoId: string, title?: string) => void;
  onTabChange?: (tab: "live" | "archives" | "clips" | "playlists" | "jellyfin") => void;
  activeTab?: "live" | "archives" | "clips" | "playlists" | "jellyfin";
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

interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  CollectionType?: string;
  RunTimeTicks?: number;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  ChildCount?: number;
  ImageTags?: { Primary?: string };
  Overview?: string;
  PrimaryImageAspectRatio?: number;
}

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
  onAddToQueue,
  onTabChange,
  activeTab: externalActiveTab = "live",
  locale = "en",
  labels,
}: ClipsOverlayProps) {
  const { hidePrivateVideos, clipLanguages, favorites, playlists, getVideoMeta, jellyfinUrl, jellyfinToken } = useSettings();
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips" | "playlists" | "jellyfin">(externalActiveTab);
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

  // Jellyfin tab state
  const [jellyfinLibraries, setJellyfinLibraries] = useState<JellyfinItem[]>([]);
  const [jellyfinLibsLoading, setJellyfinLibsLoading] = useState(false);
  const [jellyfinNavStack, setJellyfinNavStack] = useState<{ id: string; name: string; type: string }[]>([]);
  const [jellyfinContent, setJellyfinContent] = useState<JellyfinItem[]>([]);
  const [jellyfinContentLoading, setJellyfinContentLoading] = useState(false);
  const [jellyfinContentHasMore, setJellyfinContentHasMore] = useState(false);
  const [jellyfinContentPage, setJellyfinContentPage] = useState(0);
  const [jellyfinError, setJellyfinError] = useState<string | null>(null);

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
  const jellyfinCurrentId = useMemo(
    () => jellyfinNavStack.length > 0 ? jellyfinNavStack[jellyfinNavStack.length - 1].id : null,
    [jellyfinNavStack]
  );

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
    (tab: "live" | "archives" | "clips" | "playlists" | "jellyfin") => {
      if (tab === "jellyfin") return "Jellyfin";
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

  // Load Jellyfin libraries
  useEffect(() => {
    if (!open || activeTab !== "jellyfin") return;
    if (!jellyfinUrl || !jellyfinToken) return;
    if (jellyfinLibraries.length > 0) return;
    const base = jellyfinUrl.replace(/\/+$/, "");
    setJellyfinLibsLoading(true);
    setJellyfinError(null);
    fetch(`${base}/Library/MediaFolders?api_key=${jellyfinToken}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Jellyfin API error: ${res.status}`);
        return res.json() as Promise<{ Items: JellyfinItem[] }>;
      })
      .then(({ Items }) => {
        const HIDDEN_TYPES = new Set(["music", "playlists", "musicvideos"]);
        const filtered = Items.filter(
          (lib) =>
            !HIDDEN_TYPES.has((lib.CollectionType ?? "").toLowerCase()) &&
            !/recording/i.test(lib.Name)
        );
        setJellyfinLibraries(filtered);
        setJellyfinLibsLoading(false);
      })
      .catch((err: unknown) => {
        setJellyfinError(err instanceof Error ? err.message : "無法連接 Jellyfin 伺服器");
        setJellyfinLibsLoading(false);
      });
  }, [open, activeTab, jellyfinUrl, jellyfinToken, jellyfinLibraries.length]);

  // Load Jellyfin folder content when nav changes
  useEffect(() => {
    if (!open || activeTab !== "jellyfin") return;
    if (!jellyfinUrl || !jellyfinToken || !jellyfinCurrentId) return;
    const base = jellyfinUrl.replace(/\/+$/, "");
    setJellyfinContentLoading(true);
    setJellyfinContent([]);
    setJellyfinContentPage(0);
    setJellyfinContentHasMore(false);
    setJellyfinError(null);
    fetch(`${base}/Items?ParentId=${jellyfinCurrentId}&api_key=${jellyfinToken}&SortBy=SortName,ProductionYear&SortOrder=Ascending&Limit=48&StartIndex=0&Fields=BasicSyncInfo,PrimaryImageAspectRatio,Overview`)
      .then((res) => {
        if (!res.ok) throw new Error(`Jellyfin API error: ${res.status}`);
        return res.json() as Promise<{ Items: JellyfinItem[]; TotalRecordCount: number }>;
      })
      .then(({ Items, TotalRecordCount }) => {
        setJellyfinContent(Items);
        setJellyfinContentPage(1);
        setJellyfinContentHasMore(TotalRecordCount > 48);
        setJellyfinContentLoading(false);
      })
      .catch((err: unknown) => {
        setJellyfinError(err instanceof Error ? err.message : "無法連接 Jellyfin 伺服器");
        setJellyfinContentLoading(false);
      });
  }, [open, activeTab, jellyfinUrl, jellyfinToken, jellyfinCurrentId]);

  // Reset Jellyfin state when URL/token changes
  useEffect(() => {
    setJellyfinLibraries([]);
    setJellyfinNavStack([]);
    setJellyfinContent([]);
    setJellyfinContentPage(0);
    setJellyfinContentHasMore(false);
    setJellyfinError(null);
  }, [jellyfinUrl, jellyfinToken]);

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

  const handleLoadMoreJellyfinContent = async () => {
    if (!jellyfinUrl || !jellyfinToken || !jellyfinCurrentId) return;
    const base = jellyfinUrl.replace(/\/+$/, "");
    setJellyfinContentLoading(true);
    try {
      const res = await fetch(`${base}/Items?ParentId=${jellyfinCurrentId}&api_key=${jellyfinToken}&SortBy=SortName,ProductionYear&SortOrder=Ascending&Limit=48&StartIndex=${jellyfinContentPage * 48}&Fields=BasicSyncInfo,PrimaryImageAspectRatio,Overview`);
      if (!res.ok) throw new Error(`Jellyfin API error: ${res.status}`);
      const { Items, TotalRecordCount } = await res.json() as { Items: JellyfinItem[]; TotalRecordCount: number };
      setJellyfinContent((prev) => [...prev, ...Items]);
      const nextPage = jellyfinContentPage + 1;
      setJellyfinContentPage(nextPage);
      setJellyfinContentHasMore(nextPage * 48 < TotalRecordCount);
    } finally {
      setJellyfinContentLoading(false);
    }
  };

  const handleJellyfinNavTo = (item: JellyfinItem) => {
    const playableTypes = ["Movie", "Episode", "Video", "Audio", "MusicVideo"];
    if (playableTypes.includes(item.Type)) {
      const base = jellyfinUrl.replace(/\/+$/, "");
      const streamUrl = buildJellyfinMasterUrl({
        baseUrl: base,
        itemId: item.Id,
        apiKey: jellyfinToken,
      });
      onSelectClip(streamUrl, item.Name);
      return;
    }
    setJellyfinNavStack((prev) => [...prev, { id: item.Id, name: item.Name, type: item.Type }]);
  };

  const handleJellyfinQueueItem = (item: JellyfinItem) => {
    if (!onAddToQueue || !jellyfinUrl || !jellyfinToken) return;
    const base = jellyfinUrl.replace(/\/+$/, "");
    onAddToQueue(
      buildJellyfinMasterUrl({
        baseUrl: base,
        itemId: item.Id,
        apiKey: jellyfinToken,
      }),
      item.Name
    );
  };

  const handleJellyfinSelectLib = (lib: JellyfinItem) => {
    if (jellyfinNavStack[0]?.id === lib.Id) return;
    setJellyfinNavStack([{ id: lib.Id, name: lib.Name, type: lib.Type }]);
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
            ) : activeTab === "jellyfin" ? (
              <Server className="w-5 h-5 text-primary" />
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
                    : activeTab === "jellyfin"
                      ? "Jellyfin"
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
                {(["live", "archives", "clips", "playlists", "jellyfin"] as const).map((tab) => (
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
                          : tab === "jellyfin"
                            ? "Jellyfin"
                            : labels.clipsTab}
                  >
                    {tab === "live" ? <Radio className="w-4 h-4" />
                      : tab === "archives" ? <Archive className="w-4 h-4" />
                      : tab === "playlists" ? <ListMusic className="w-4 h-4" />
                      : tab === "jellyfin" ? <Server className="w-4 h-4" />
                      : <Film className="w-4 h-4" />}
                    <span className="md:hidden">{getTabShortLabel(tab)}</span>
                    <span className="hidden md:inline">
                      {tab === "live"
                        ? (labels.liveNow || "直播中")
                        : tab === "archives"
                          ? labels.archivesTab
                          : tab === "playlists"
                            ? (labels.playlistsTab || "播放清單")
                            : tab === "jellyfin"
                              ? "Jellyfin"
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
            ) : activeTab === "jellyfin" ? (
              // Jellyfin section
              !jellyfinUrl || !jellyfinToken ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Server className="w-10 h-10 opacity-40" />
                  <p className="text-sm text-center">請在設定中配置 Jellyfin 伺服器 URL 及 API Token</p>
                </div>
              ) : (
                <div className="flex gap-4 min-h-[300px]">
                  {/* Left nav — desktop vertical list */}
                  <div className="hidden md:flex flex-col gap-0.5 w-44 shrink-0">
                    {jellyfinLibsLoading ? (
                      <div className="flex justify-center pt-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
                    ) : jellyfinLibraries.length === 0 && jellyfinError ? (
                      <p className="text-xs text-muted-foreground px-2 py-2">{jellyfinError}</p>
                    ) : (
                      jellyfinLibraries.map((lib) => {
                        const isSelected = jellyfinNavStack[0]?.id === lib.Id;
                        return (
                          <button
                            key={lib.Id}
                            type="button"
                            onClick={() => handleJellyfinSelectLib(lib)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm text-left transition-colors w-full ${
                              isSelected
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <Server className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{lib.Name}</span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Right content area */}
                  <div className="flex-1 min-w-0 space-y-3">
                    {/* Mobile: horizontal library pills */}
                    <div className="flex md:hidden flex-wrap gap-2 pb-1">
                      {jellyfinLibsLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        jellyfinLibraries.map((lib) => {
                          const isSelected = jellyfinNavStack[0]?.id === lib.Id;
                          return (
                            <button
                              key={lib.Id}
                              type="button"
                              onClick={() => handleJellyfinSelectLib(lib)}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                isSelected
                                  ? "border-primary/50 bg-primary/15 text-primary"
                                  : "border-border/60 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <Server className="w-3 h-3" />
                              {lib.Name}
                            </button>
                          );
                        })
                      )}
                    </div>

                    {/* Breadcrumb */}
                    {jellyfinNavStack.length > 0 && (
                      <nav className="flex items-center gap-0.5 text-xs text-muted-foreground flex-wrap">
                        {jellyfinNavStack.map((entry, i) => (
                          <span key={entry.id} className="flex items-center gap-0.5">
                            {i > 0 && <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />}
                            <button
                              type="button"
                              onClick={() => setJellyfinNavStack((prev) => prev.slice(0, i + 1))}
                              className={`hover:text-foreground transition-colors ${
                                i === jellyfinNavStack.length - 1 ? "text-foreground font-medium" : ""
                              }`}
                            >
                              {entry.name}
                            </button>
                          </span>
                        ))}
                      </nav>
                    )}

                    {/* No library selected */}
                    {!jellyfinCurrentId && !jellyfinLibsLoading && !jellyfinError && (
                      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                        <Server className="w-10 h-10 opacity-30" />
                        <p className="text-sm">請選擇左側媒體庫</p>
                      </div>
                    )}

                    {/* Error */}
                    {jellyfinError && jellyfinContent.length === 0 && (
                      <div className="flex justify-center py-8">
                        <p className="text-sm text-muted-foreground">{jellyfinError}</p>
                      </div>
                    )}

                    {/* Content loading */}
                    {jellyfinContentLoading && jellyfinContent.length === 0 && (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}

                    {/* Content grid / episode list */}
                    {jellyfinContent.length > 0 && (() => {
                      const base = jellyfinUrl.replace(/\/+$/, "");
                      const isEpisodeList = jellyfinContent.every((i) => i.Type === "Episode");

                      const calcDuration = (ticks?: number) => {
                        if (!ticks) return null;
                        const total = Math.floor(ticks / 10_000_000);
                        const h = Math.floor(total / 3600);
                        const m = Math.floor((total % 3600) / 60);
                        const s = total % 60;
                        return h > 0
                          ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
                          : `${m}:${String(s).padStart(2, "0")}`;
                      };

                      if (isEpisodeList) {
                        return (
                          <div className="space-y-2">
                            {/* Episode list header */}
                            <div className="flex items-center pb-1">
                              <span className="text-xs text-muted-foreground">{jellyfinContent.length} 集</span>
                            </div>

                            {/* Vertical episode cards */}
                            {jellyfinContent.map((item) => {
                              const thumbUrl = item.ImageTags?.Primary
                                ? `${base}/Items/${item.Id}/Images/Primary?api_key=${jellyfinToken}&maxWidth=300`
                                : null;
                              const duration = calcDuration(item.RunTimeTicks);
                              const epLabel = [
                                item.ParentIndexNumber != null ? `S${item.ParentIndexNumber}` : null,
                                item.IndexNumber != null ? `E${item.IndexNumber}` : null,
                              ].filter(Boolean).join("");
                              const epPrefix = item.IndexNumber != null ? `第 ${item.IndexNumber} 集` : null;
                              const displayTitle = epPrefix ? `${epPrefix}　${item.Name}` : item.Name;
                              return (
                                <div
                                  key={item.Id}
                                  className="flex gap-3 rounded-md border border-border bg-card hover:border-primary/40 transition-colors p-2"
                                >
                                  {/* Thumbnail */}
                                  <div className="relative shrink-0 w-36 md:w-44 aspect-video rounded overflow-hidden bg-muted">
                                    {thumbUrl ? (
                                      <img src={thumbUrl} alt={item.Name} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Film className="w-6 h-6 text-muted-foreground opacity-50" />
                                      </div>
                                    )}
                                    {epLabel && (
                                      <span className="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] px-1 py-0.5 rounded font-mono">
                                        {epLabel}
                                      </span>
                                    )}
                                    {duration && (
                                      <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1 py-0.5 rounded">
                                        {duration}
                                      </span>
                                    )}
                                  </div>

                                  {/* Info + actions */}
                                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                    <div>
                                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{displayTitle}</p>
                                      {item.Overview ? (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{item.Overview}</p>
                                      ) : item.SeriesName ? (
                                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.SeriesName}</p>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2 mt-2">
                                      <button
                                        type="button"
                                        onClick={() => handleJellyfinNavTo(item)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                                      >
                                        <Play className="w-3 h-3" />
                                        播放
                                      </button>
                                      {onAddToQueue && (
                                        <button
                                          type="button"
                                          onClick={() => handleJellyfinQueueItem(item)}
                                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border/70 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                        >
                                          <Plus className="w-3 h-3" />
                                          待播
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      }

                      // Non-episode grid (libraries / series / seasons / movies)
                      // Detect if items have portrait covers (ratio < 1 = anime/movie posters)
                      const hasPortraitItems = jellyfinContent.some(
                        (i) => i.PrimaryImageAspectRatio !== undefined && i.PrimaryImageAspectRatio < 1
                      );
                      return (
                        <div className={hasPortraitItems
                          ? "grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
                          : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
                        }>
                          {jellyfinContent.map((item) => {
                            const isPlayable = ["Movie", "Episode", "Video", "Audio", "MusicVideo"].includes(item.Type);
                            const isPortrait = item.PrimaryImageAspectRatio !== undefined && item.PrimaryImageAspectRatio < 1;
                            const thumbUrl = item.ImageTags?.Primary
                              ? `${base}/Items/${item.Id}/Images/Primary?api_key=${jellyfinToken}&maxWidth=300`
                              : null;
                            const duration = isPlayable ? calcDuration(item.RunTimeTicks) : null;
                            const subtitle = item.Type === "Episode" && item.SeriesName
                              ? `${item.SeriesName}${item.ParentIndexNumber != null ? ` S${item.ParentIndexNumber}` : ""}${item.IndexNumber != null ? `E${item.IndexNumber}` : ""}`
                              : item.ChildCount != null
                                ? `${item.ChildCount} 項目`
                                : item.Type;
                            return (
                              <div key={item.Id} className="relative group">
                                <button
                                  type="button"
                                  onClick={() => handleJellyfinNavTo(item)}
                                  className="block w-full rounded-lg overflow-hidden bg-card border border-border hover:border-primary/50 transition-colors text-left"
                                >
                                  {isPortrait ? (
                                    <div className="relative bg-muted">
                                        {thumbUrl ? (
                                          <img src={thumbUrl} alt={item.Name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center">
                                            <Film className="w-8 h-8 text-muted-foreground opacity-50" />
                                          </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent" />
                                        {item.ChildCount != null && item.ChildCount > 0 && (
                                          <div className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-semibold rounded px-1.5 py-0.5 leading-tight">
                                            {item.ChildCount}
                                          </div>
                                        )}
                                        {!isPlayable && (
                                          <div className="absolute top-2 right-2 rounded-full bg-black/45 p-1 text-white/80 backdrop-blur-sm">
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 p-3">
                                          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                                            {item.Name}
                                          </p>
                                          <div className="mt-1 flex items-center justify-between gap-2">
                                            <span className="text-xs text-muted-foreground line-clamp-1">{subtitle}</span>
                                            {duration && <span className="text-[10px] text-muted-foreground shrink-0">{duration}</span>}
                                          </div>
                                        </div>
                                      </div>
                                  ) : (
                                    <div className="relative aspect-video bg-muted">
                                      {thumbUrl ? (
                                        <img src={thumbUrl} alt={item.Name} className="w-full h-full object-cover" loading="lazy" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          {isPlayable
                                            ? <Film className="w-8 h-8 text-muted-foreground opacity-50" />
                                            : <Server className="w-8 h-8 text-muted-foreground opacity-50" />}
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
                                      {!isPlayable && (
                                        <div className="absolute top-2 right-2">
                                          <ChevronRight className="w-4 h-4 text-white/70" />
                                        </div>
                                      )}
                                      <div className="absolute bottom-0 left-0 right-0 p-2">
                                        <p className="text-xs font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                                          {item.Name}
                                        </p>
                                        <div className="flex items-center justify-between mt-0.5">
                                          <span className="text-[10px] text-muted-foreground truncate pr-1">{subtitle}</span>
                                          {duration && <span className="text-[10px] text-muted-foreground shrink-0">{duration}</span>}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Empty content */}
                    {!jellyfinContentLoading && jellyfinCurrentId && jellyfinContent.length === 0 && !jellyfinError && (
                      <div className="flex justify-center py-8">
                        <p className="text-sm text-muted-foreground">{labels.noClipsFound}</p>
                      </div>
                    )}
                  </div>
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
            {activeTab === "jellyfin" && jellyfinContentHasMore && jellyfinContent.length > 0 && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleLoadMoreJellyfinContent}
                  disabled={jellyfinContentLoading}
                  className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {jellyfinContentLoading ? (
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
                : activeTab === "jellyfin"
                  ? labels.selectClipToAdd
                  : (labels.selectLiveToAdd || labels.selectClipToAdd)}
        </div>
      </div>
    </div>
  );
}
