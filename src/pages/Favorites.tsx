/**
 * @file src/pages/Favorites.tsx
 * @description 呈現使用者收藏庫 (Favorites) 內所有頻道的相關多媒體。
 * 包含三個主要分頁：即將直播/正在直播、歷史存檔、精華剪輯。
 */

import { useState } from "react";
import { format } from "date-fns";
import { Radio, Archive, Film, Heart, Loader2 } from "lucide-react";

import { useSettings } from "@/contexts/SettingsContext";
import { useHolodexStreams } from "@/hooks/useHolodex";
import { useFavoritesMedia } from "@/hooks/useFavoritesMedia";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";
import { LAYOUT_STYLES } from "@/lib/styles";

import { StreamCard } from "@/components/StreamCard";
import { LoadTransition } from "@/components/LoadTransition";
import { StaggerList } from "@/components/StaggerList";
import { PageHeader } from "@/components/PageHeader";

export default function Favorites() {
  const { favorites, hidePrivateVideos, t } = useSettings();
  const { data: liveData, isLoading: isLiveLoading } = useHolodexStreams();
  
  // --- 自定義 Hook 抽取邏輯 ---
  const {
    archiveVideos,
    hasMoreArchives,
    isArchiveInitLoading,
    isArchivingLoadingMore,
    loadMoreArchives,
    clipVideos,
    hasMoreClips,
    isClipsInitLoading,
    isClipsLoadingMore,
    loadMoreClips,
  } = useFavoritesMedia();

  // --- 狀態定義 ---
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips">("live");

  // 若使用者尚未收藏任何頻道，直接顯示佔位空狀態
  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <Heart className="w-16 h-16" />
        <p className="text-lg">{t.favorites.noFavorites}</p>
      </div>
    );
  }

  // --- 資料處理與衍生狀態 ---
  const favSet = new Set(favorites);

  // 1. 直播資料與預定資料過濾
  const favLiveRaw = (liveData?.live ?? []).filter((v) => favSet.has(v.channel.id));
  const favUpcomingRaw = (liveData?.upcoming ?? []).filter((v) => favSet.has(v.channel.id));
  
  const favLive = filterUnavailableVideos(favLiveRaw, hidePrivateVideos);
  const favUpcoming = filterUnavailableVideos(favUpcomingRaw, hidePrivateVideos);

  // 排序正在直播的頻道：根據觀看人數由大至小排列
  const sortedFavLive = [...favLive].sort((a, b) => (b.live_viewers ?? 0) - (a.live_viewers ?? 0));

  // 2. 結合即將開播的行程表依日期分組
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

  // --- 渲染架構 ---
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.favorites.title}
        badge={`${favorites.length}`}
        description={favorites.length === 0 ? t.favorites.noFavorites : undefined}
      />

      {/* --- 頁籤導航區塊 --- */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isSelected
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
          );
        })}
      </div>

      {/* --- 主要內容區塊 --- */}
      {/* 1. 直播與即將開播 */}
      {activeTab === "live" && (
        <div key="tab-live" className={`space-y-10 ${TAB_PANEL_TRANSITION_CLASS}`}>
          {isLiveLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-20">null</LoadTransition>
          ) : (
            <>
              {/* 進行中直播 */}
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
                  <StaggerList className={LAYOUT_STYLES.cardGrid}>
                    {sortedFavLive.map((s) => (
                      <StreamCard key={s.id} stream={s} />
                    ))}
                  </StaggerList>
                )}
              </section>

              {/* 行程表 */}
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

      {/* 2. 歷史存檔庫 */}
      {activeTab === "archives" && (
        <div key="tab-archives" className={TAB_PANEL_TRANSITION_CLASS}>
          {isArchiveInitLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
          ) : archiveVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noArchives}</p>
          ) : (
            <>
              <StaggerList className={LAYOUT_STYLES.cardGrid}>
                {archiveVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </StaggerList>
              
              {hasMoreArchives && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); loadMoreArchives(); }}
                    disabled={isArchivingLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isArchivingLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                    {t.common.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. 精華剪輯庫 */}
      {activeTab === "clips" && (
        <div key="tab-clips" className={TAB_PANEL_TRANSITION_CLASS}>
          {isClipsInitLoading ? (
            <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
          ) : clipVideos.length === 0 ? (
            <p className="text-muted-foreground">{t.favorites.noClips}</p>
          ) : (
            <>
              <StaggerList className={LAYOUT_STYLES.cardGrid}>
                {clipVideos.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </StaggerList>
              
              {hasMoreClips && (
                <div className="flex justify-center mt-6">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); loadMoreClips(); }}
                    disabled={isClipsLoadingMore}
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {isClipsLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
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
