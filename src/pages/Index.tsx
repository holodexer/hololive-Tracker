import { useState, useCallback, useEffect } from "react";
import { useHolodexStreams } from "@/hooks/useHolodex";
import { StreamCard } from "@/components/StreamCard";
import { fetchHololivePastStreams, fetchHololiveClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { Loader2, Radio, Archive, Film, Clock } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

const PAGE_SIZE = 50;

const Index = () => {
  const { data, isLoading, error } = useHolodexStreams();
  const { t, clipLanguages, hidePrivateVideos, locale } = useSettings();
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips">("live");

  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");

  const [archiveVideos, setArchiveVideos] = useState<HolodexVideo[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [archiveHasMore, setArchiveHasMore] = useState(true);
  const [archiveLoadingMore, setArchiveLoadingMore] = useState(false);

  const [clipVideos, setClipVideos] = useState<HolodexVideo[]>([]);
  const [clipsPage, setClipsPage] = useState(0);
  const [clipsHasMore, setClipsHasMore] = useState(true);
  const [clipsLoadingMore, setClipsLoadingMore] = useState(false);

  useEffect(() => {
    setClipVideos([]);
    setClipsPage(0);
    setClipsHasMore(true);
  }, [clipLangKey, hidePrivateVideos]);

  useEffect(() => {
    setArchiveVideos([]);
    setArchivePage(0);
    setArchiveHasMore(true);
  }, [hidePrivateVideos]);

  const { isLoading: archiveInitLoading } = useQuery({
    queryKey: ["home-archives-init", hidePrivateVideos],
    queryFn: async () => {
      const data = await fetchHololivePastStreams(PAGE_SIZE, 0);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      setArchiveVideos(filtered);
      setArchivePage(1);
      setArchiveHasMore(data.length >= PAGE_SIZE);
      return filtered;
    },
  });

  const { isLoading: clipsInitLoading } = useQuery({
    queryKey: ["home-clips-init", clipLangKey, hidePrivateVideos],
    queryFn: async () => {
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchHololiveClips(PAGE_SIZE, 0, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos(filtered);
      setClipsPage(1);
      setClipsHasMore(results.some((result) => result.videos.length >= PAGE_SIZE));
      return filtered;
    },
  });

  const handleLoadMoreArchives = useCallback(async () => {
    setArchiveLoadingMore(true);
    try {
      const offset = archivePage * PAGE_SIZE;
      const data = await fetchHololivePastStreams(PAGE_SIZE, offset);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      setArchiveVideos((prev) => [...prev, ...filtered]);
      setArchivePage((p) => p + 1);
      if (data.length < PAGE_SIZE) setArchiveHasMore(false);
    } finally {
      setArchiveLoadingMore(false);
    }
  }, [archivePage, hidePrivateVideos]);

  const handleLoadMoreClips = useCallback(async () => {
    setClipsLoadingMore(true);
    try {
      const offset = clipsPage * PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchHololiveClips(PAGE_SIZE, offset, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos((prev) => [...prev, ...filtered]);
      setClipsPage((p) => p + 1);
      if (!results.some((result) => result.videos.length >= PAGE_SIZE)) setClipsHasMore(false);
    } finally {
      setClipsLoadingMore(false);
    }
  }, [clipsPage, clipLangKey, hidePrivateVideos]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive">{t.home.failedToLoad}</p>
      </div>
    );
  }

  const { live = [], upcoming = [] } = data ?? {};
  const visibleLive = filterUnavailableVideos(live, hidePrivateVideos);
  const visibleUpcoming = filterUnavailableVideos(upcoming, hidePrivateVideos);

  // Sort live by viewer count descending
  const sortedLive = [...visibleLive].sort((a, b) => (b.live_viewers ?? 0) - (a.live_viewers ?? 0));

  // Group upcoming by date
  const upcomingByDate = new Map<string, typeof upcoming>();
  visibleUpcoming.forEach((s) => {
    const dateKey = format(new Date(s.available_at), "yyyy-MM-dd");
    if (!upcomingByDate.has(dateKey)) upcomingByDate.set(dateKey, []);
    upcomingByDate.get(dateKey)!.push(s);
  });
  const sortedDates = Array.from(upcomingByDate.entries()).sort(([a], [b]) => a.localeCompare(b));

  const tabs = [
    { key: "live" as const, label: t.favorites.live, icon: Radio, count: sortedLive.length },
    { key: "archives" as const, label: t.favorites.archives, icon: Archive },
    { key: "clips" as const, label: t.favorites.clips, icon: Film },
  ];

  return (
    <div className="space-y-6">
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

      {activeTab === "live" && (
        <div className="space-y-10">
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-foreground">{t.home.liveNow}</h2>
              {sortedLive.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-live/20 text-live text-sm font-semibold flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
                  </span>
                  {sortedLive.length} {t.home.live}
                </span>
              )}
            </div>
            {sortedLive.length === 0 ? (
              <p className="text-muted-foreground">{t.favorites.noLive}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedLive.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-bold text-foreground">{t.home.upcomingStreams}</h2>
              {visibleUpcoming.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-primary/20 text-primary text-sm font-semibold">
                  {visibleUpcoming.length}
                </span>
              )}
            </div>
            {visibleUpcoming.length === 0 ? (
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
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {timeStreams!.map((s) => (
                                <div key={s.id} className="max-w-md">
                                  <StreamCard stream={s} />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === "archives" && (
        <div>
          {archiveInitLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : archiveVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noArchives}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {archiveVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </div>
              {archiveHasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={handleLoadMoreArchives}
                    disabled={archiveLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {archiveLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.common.loading}
                      </>
                    ) : (
                      t.common.loadMore
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "clips" && (
        <div>
          {clipsInitLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : clipVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noClips}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {clipVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </div>
              {clipsHasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={handleLoadMoreClips}
                    disabled={clipsLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {clipsLoadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t.common.loading}
                      </>
                    ) : (
                      t.common.loadMore
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
