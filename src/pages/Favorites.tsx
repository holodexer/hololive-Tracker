import { useState, useCallback, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useHolodexStreams } from "@/hooks/useHolodex";
import { fetchChannelVideos, fetchChannelClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { StreamCard } from "@/components/StreamCard";
import { LoadTransition } from "@/components/LoadTransition";
import { StaggerList } from "@/components/StaggerList";
import { Heart, Loader2, Radio, Archive, Film, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { addDays, isAfter, isBefore } from "date-fns";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";

const PAGE_SIZE = 48;

export default function Favorites() {
  const { favorites, clipLanguages, hidePrivateVideos, locale, t } = useSettings();
  const { data: liveData, isLoading: liveLoading } = useHolodexStreams();
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips">("live");

  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");
  const favSet = new Set(favorites);

  // Archives state
  const [archiveVideos, setArchiveVideos] = useState<HolodexVideo[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveHasMore, setArchiveHasMore] = useState(true);
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false);

  // Clips state
  const [clipVideos, setClipVideos] = useState<HolodexVideo[]>([]);
  const [clipsPage, setClipsPage] = useState(0);
  const [clipsHasMore, setClipsHasMore] = useState(true);
  const [clipsLoadingMore, setClipsLoadingMore] = useState(false);

  // Reset clips when language changes
  useEffect(() => {
    setClipVideos([]);
    setClipsPage(0);
    setClipsHasMore(true);
  }, [locale, clipLangKey, hidePrivateVideos]);

  useEffect(() => {
    setArchiveVideos([]);
    setArchivePage(0);
    setArchiveHasMore(true);
  }, [hidePrivateVideos]);

  // Initial archives fetch (per-member, merged)
  const { isLoading: archiveInitLoading } = useQuery({
    queryKey: ["favorites-archives-init", favorites.join(","), hidePrivateVideos],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const results = await Promise.all(
        favorites.map((chId) => fetchChannelVideos(chId, "stream", "past", PAGE_SIZE, 0))
      );
      const mergedRaw = results
        .flat()
        .sort((a, b) => new Date(b.available_at).getTime() - new Date(a.available_at).getTime());
      const merged = filterUnavailableVideos(mergedRaw, hidePrivateVideos);
      setArchiveVideos(merged);
      setArchivePage(1);
      setArchiveHasMore(results.some((r) => r.length >= PAGE_SIZE));
      return merged;
    },
    enabled: favorites.length > 0,
  });

  // Initial clips fetch (per-member, merged)
  const { isLoading: clipsInitLoading } = useQuery({
    queryKey: ["favorites-clips-init", favorites.join(","), clipLangKey, locale, hidePrivateVideos],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => {
          const byChannel = await Promise.all(
            favorites.map((chId) => fetchChannelClips(chId, PAGE_SIZE, 0, lang))
          );
          return {
            lang,
            videos: byChannel.flat(),
            hasMore: byChannel.some((items) => items.length >= PAGE_SIZE),
          };
        })
      );
      const mixed = mixClipsByLanguage(results.map(({ lang, videos }) => ({ lang, videos })));
      const merged = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos(merged);
      setClipsPage(1);
      setClipsHasMore(results.some((result) => result.hasMore));
      return merged;
    },
    enabled: favorites.length > 0,
  });

  const handleLoadMoreArchives = useCallback(async () => {
    setArchiveLoadingMore(true);
    try {
      const offset = archivePage * PAGE_SIZE;
      const results = await Promise.all(
        favorites.map((chId) => fetchChannelVideos(chId, "stream", "past", PAGE_SIZE, offset))
      );
      const mergedRaw = results
        .flat()
        .sort((a, b) => new Date(b.available_at).getTime() - new Date(a.available_at).getTime());
      const merged = filterUnavailableVideos(mergedRaw, hidePrivateVideos);
      setArchiveVideos((prev) => [...prev, ...merged]);
      setArchivePage((p) => p + 1);
      if (results.every((r) => r.length < PAGE_SIZE)) setArchiveHasMore(false);
    } finally {
      setArchiveLoadingMore(false);
    }
  }, [favorites, archivePage, hidePrivateVideos]);

  const handleLoadMoreClips = useCallback(async () => {
    setClipsLoadingMore(true);
    try {
      const offset = clipsPage * PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => {
          const byChannel = await Promise.all(
            favorites.map((chId) => fetchChannelClips(chId, PAGE_SIZE, offset, lang))
          );
          return {
            lang,
            videos: byChannel.flat(),
            hasMore: byChannel.some((items) => items.length >= PAGE_SIZE),
          };
        })
      );
      const mixed = mixClipsByLanguage(results.map(({ lang, videos }) => ({ lang, videos })));
      const merged = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos((prev) => [...prev, ...merged]);
      setClipsPage((p) => p + 1);
      if (!results.some((result) => result.hasMore)) setClipsHasMore(false);
    } finally {
      setClipsLoadingMore(false);
    }
  }, [favorites, clipsPage, clipLangKey, hidePrivateVideos]);

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Heart className="w-16 h-16" />
        <p className="text-lg">{t.favorites.noFavorites}</p>
      </div>
    );
  }

  // Live + Upcoming from favorites
  const favLiveRaw = (liveData?.live ?? []).filter((v) => favSet.has(v.channel.id));
  const favUpcomingRaw = (liveData?.upcoming ?? []).filter((v) => favSet.has(v.channel.id));
  const favLive = filterUnavailableVideos(favLiveRaw, hidePrivateVideos);
  const favUpcoming = filterUnavailableVideos(favUpcomingRaw, hidePrivateVideos);

  // Sort live by viewers desc
  const sortedFavLive = [...favLive].sort((a, b) => (b.live_viewers ?? 0) - (a.live_viewers ?? 0));

  // Group upcoming by date (same as Index page)
  const upcomingByDate = new Map<string, typeof favUpcoming>();
  favUpcoming.forEach((s) => {
    const dateKey = format(new Date(s.available_at), "yyyy-MM-dd");
    if (!upcomingByDate.has(dateKey)) upcomingByDate.set(dateKey, []);
    upcomingByDate.get(dateKey)!.push(s);
  });
  const sortedDates = Array.from(upcomingByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  const tabs = [
    { key: "live" as const, label: t.favorites.live, icon: Radio, count: favLive.length },
    { key: "archives" as const, label: t.favorites.archives, icon: Archive },
    { key: "clips" as const, label: t.favorites.clips, icon: Film },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.key === "live" && tab.count !== undefined && tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-live/20 text-live text-[10px] font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Live + Upcoming Tab */}
      {activeTab === "live" && (
        <div key="tab-live" className={`space-y-10 ${TAB_PANEL_TRANSITION_CLASS}`}>
          {liveLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-20">null</LoadTransition>
          ) : (
            <>
              {/* Live Now */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-foreground">{t.home.liveNow}</h2>
                  {sortedFavLive.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-live/20 text-live text-sm font-semibold flex items-center gap-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
                      </span>
                      {sortedFavLive.length} {t.home.live}
                    </span>
                  )}
                </div>
                {sortedFavLive.length === 0 ? (
                  <p className="text-muted-foreground">{t.favorites.noLive}</p>
                ) : (
                  <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedFavLive.map((s) => (
                      <StreamCard key={s.id} stream={s} />
                    ))}
                  </StaggerList>
                )}
              </section>

              {/* Upcoming */}
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl font-bold text-foreground">{t.home.upcomingStreams}</h2>
                  {favUpcoming.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-sm font-semibold">
                      {favUpcoming.length}
                    </span>
                  )}
                </div>
                {favUpcoming.length === 0 ? (
                  <p className="text-muted-foreground">{t.home.noUpcoming}</p>
                ) : (
                  <div className="space-y-8">
                    {sortedDates.map(([dateKey, streams]) => {
                      const byTime = new Map<string, typeof streams>();
                      streams!.forEach((s) => {
                        const timeKey = format(new Date(s.available_at), "HH:mm");
                        if (!byTime.has(timeKey)) byTime.set(timeKey, []);
                        byTime.get(timeKey)!.push(s);
                      });
                      const sortedTimes = Array.from(byTime.entries()).sort(([a], [b]) => a.localeCompare(b));

                      return (
                        <div key={dateKey}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-3 h-3 rounded-full bg-primary shrink-0" />
                            <h3 className="text-lg font-semibold text-foreground">
                              {format(new Date(dateKey + "T00:00:00"), "EEEE, MMM d")}
                            </h3>
                            <div className="flex-1 h-px bg-border" />
                          </div>
                          <div className="ml-6 border-l-2 border-primary/30 pl-6 space-y-4">
                            {sortedTimes.map(([timeKey, timeStreams]) => (
                              <div key={timeKey} className="flex gap-4 items-start">
                                <span className="text-sm font-mono text-primary shrink-0 mt-1 w-14">
                                  {timeKey}
                                </span>
                                <StaggerList
                                  className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                                  itemClassName="max-w-md"
                                >
                                  {timeStreams!.map((s) => (
                                    <StreamCard key={s.id} stream={s} />
                                  ))}
                                </StaggerList>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* Archives Tab */}
      {activeTab === "archives" && (
        <div key="tab-archives" className={TAB_PANEL_TRANSITION_CLASS}>
          {archiveInitLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
          ) : archiveVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noArchives}</p>
          ) : (
            <>
              <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {archiveVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </StaggerList>
              {archiveHasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleLoadMoreArchives(); }}
                    disabled={archiveLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {archiveLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                    {t.common.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Clips Tab */}
      {activeTab === "clips" && (
        <div key="tab-clips" className={TAB_PANEL_TRANSITION_CLASS}>
          {clipsInitLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
          ) : clipVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noClips}</p>
          ) : (
            <>
              <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {clipVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </StaggerList>
              {clipsHasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleLoadMoreClips(); }}
                    disabled={clipsLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {clipsLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                    {t.common.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
