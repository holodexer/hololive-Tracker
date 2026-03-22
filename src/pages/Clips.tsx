import { useState, useCallback, useEffect } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { fetchHololiveClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { StreamCard } from "@/components/StreamCard";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { LoadTransition } from "@/components/LoadTransition";
import { StaggerList } from "@/components/StaggerList";
import { PageHeader } from "@/components/PageHeader";

const PAGE_SIZE = 48;

const Clips = () => {
  const { t, clipLanguages, hidePrivateVideos, locale } = useSettings();
  const [clips, setClips] = useState<HolodexVideo[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");

  // Reset clips when language changes
  useEffect(() => {
    setClips([]);
    setPage(0);
    setHasMore(true);
  }, [locale, clipLangKey, hidePrivateVideos]);

  // Initial fetch
  const { isLoading: initLoading } = useQuery({
    queryKey: ["holodex-clips-init", clipLangKey, locale, hidePrivateVideos],
    queryFn: async () => {
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchHololiveClips(PAGE_SIZE, 0, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClips(filtered);
      setPage(1);
      setHasMore(results.some((result) => result.videos.length >= PAGE_SIZE));
      return filtered;
    },
  });

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const offset = page * PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchHololiveClips(PAGE_SIZE, offset, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClips((prev) => [...prev, ...filtered]);
      setPage((p) => p + 1);
      if (!results.some((result) => result.videos.length >= PAGE_SIZE)) setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [page, clipLangKey, hidePrivateVideos]);

  if (initLoading) {
    return <LoadTransition loading={true}>null</LoadTransition>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.clips.title}
        badge={`${clips.length}`}
        description={clips.length === 0 ? t.clips.noClips : undefined}
      />
      {(clips?.length ?? 0) === 0 ? (
        <p className="text-muted-foreground">{t.clips.noClips}</p>
      ) : (
        <>
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clips!.map((s) => (
              <StreamCard key={s.id} stream={s} />
            ))}
          </StaggerList>
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loadingMore ? (
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
  );
};

export default Clips;
