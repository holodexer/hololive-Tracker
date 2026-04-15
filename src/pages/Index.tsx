/**
 * @file src/pages/Index.tsx
 * @description 首頁 (Home)。預設展示 Hololive 全局正在直播、預定排程、精華與歷史歸檔影片。
 * 使用三個分頁切換不同的資料模式。
 */

import { useState } from "react";
import { useHolodexStreams } from "@/hooks/useHolodex";
import { useHomeMedia } from "@/hooks/useHomeMedia";
import { StreamCard } from "@/components/StreamCard";
import { LoadTransition } from "@/components/LoadTransition";
import { StaggerList } from "@/components/StaggerList";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { Loader2, Radio, Archive, Film } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { format } from "date-fns";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";
import { LAYOUT_STYLES } from "@/lib/styles";

/**
 * --- 佔位符組件 ---
 * 初次入站時渲染的 Skeleton 骨架屏
 */
function HomeLoadingState({ loadingLabel }: { loadingLabel: string }) {
  return (
    <div className="space-y-8" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">{loadingLabel}</span>
      </div>

      <section className="space-y-4">
        <div className="h-6 w-44 rounded bg-muted/60 animate-pulse" />
        <div className={LAYOUT_STYLES.cardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card/40 p-3 space-y-3">
              <div className="h-40 w-full rounded-lg bg-muted/60 animate-pulse" />
              <div className="h-4 w-11/12 rounded bg-muted/60 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted/50 animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const Index = () => {
  // --- 全域狀態取得 ---
  const { data: streamsData, isLoading: isStreamsLoading, error: streamsError } = useHolodexStreams();
  const { t, hidePrivateVideos } = useSettings();
  
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
  } = useHomeMedia();

  // --- 本地狀態定義 ---
  const [activeTab, setActiveTab] = useState<"live" | "archives" | "clips">("live");

  // 極端狀況處理
  if (isStreamsLoading) {
    return <HomeLoadingState loadingLabel={t.common.loading} />;
  }
  if (streamsError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-destructive">{t.home.failedToLoad}</p>
      </div>
    );
  }

  // --- 資料處理與衍生狀態 ---
  const { live = [], upcoming = [] } = streamsData ?? {};
  
  // 1. 過濾不可觀看之隱私影片
  const visibleLive = filterUnavailableVideos(live, hidePrivateVideos);
  const visibleUpcoming = filterUnavailableVideos(upcoming, hidePrivateVideos);

  // 2. 排序正在直播的頻道：根據觀看人數由大至小排列
  const sortedLive = [...visibleLive].sort((a, b) => (b.live_viewers ?? 0) - (a.live_viewers ?? 0));

  // 3. 將即將開播的行程表依「日期字串」分組對應
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

  // --- 畫面渲染架構 ---
  return (
    <div className="space-y-6">
      
      {/* 頁籤導航區塊 */}
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
          {/* 進行中直播 */}
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
              <StaggerList className={LAYOUT_STYLES.cardGrid}>
                {sortedLive.map((s) => (
                  <StreamCard key={s.id} stream={s} />
                ))}
              </StaggerList>
            )}
          </section>

          {/* 行程表 */}
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

                  // 使用縮進結構表達日期與時間的階層關係
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
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isArchivingLoadingMore ? (
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
                    className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isClipsLoadingMore ? (
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
