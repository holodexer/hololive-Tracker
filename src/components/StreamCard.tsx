/**
 * @file src/components/StreamCard.tsx
 * @description 顯示單一直播或排程影片卡片的核心重用元件。
 * 負責處理封面圖片、狀態(Live/Upcoming)、以及快捷按鈕(加到播放清單/設定提醒)。
 */

import type { HolodexVideo } from "@/lib/holodex";
import { format } from "date-fns";
import { buildYouTubeThumbnailUrl, buildYouTubeWatchUrl } from "@/lib/urls";
import { Eye, Clock, ListPlus, Check, Bell, BellRing } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerCinema } from "@/components/CinemaOverlay";
import { getDisplayName, cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { showSuccess } from "@/lib/errors";
import { CARD_STYLES, BUTTON_STYLES } from "@/lib/styles";

export interface StreamCardProps {
  /** 由 Holodex API 取得的標準化影片資料模型 */
  stream: HolodexVideo;
}

export function StreamCard({ stream }: StreamCardProps) {
  // --- 全域狀態取得 ---
  const { directYoutube, locale, playlists, addToPlaylist, recordRecentVideo, toggleReminder, hasReminder, t } = useSettings();
  
  // --- 語意化衍生狀態 (Semantic States) ---
  const isLiveStream = stream.status === "live";
  const isUpcomingStream = stream.status === "upcoming";
  const channelName = getDisplayName(stream.channel, locale);
  const thumbnailUrl = buildYouTubeThumbnailUrl(stream.id, "hq720");
  const hasActiveReminder = hasReminder(stream.id);

  // --- 交互元件狀態 ---
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 處理點擊外部關閉小選單
  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isMenuOpen]);

  // --- 事件處理常式 ---

  /** 點擊卡片主體，開啟影院模式或跳轉 YouTube */
  const handleCardClick = (e: React.MouseEvent) => {
    recordRecentVideo({
      id: stream.id,
      title: stream.title,
      channelName,
      thumbnail: thumbnailUrl,
      status: stream.status,
    });

    if (!directYoutube) {
      e.preventDefault();
      triggerCinema(stream.id, { rememberChatPreference: isLiveStream || isUpcomingStream });
    }
  };

  /** 開啟「加到播放清單」下拉選單 */
  const handleTogglePlaylistMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsMenuOpen((v) => !v);
  };

  /** 實際執行影片加入指定播放清單 */
  const handleAddVideoToPlaylist = (playlistId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToPlaylist(playlistId, stream.id, {
      title: stream.title,
      channelName,
    });
    setIsMenuOpen(false);
  };

  /** 觸發瀏覽器原生的行程提醒通知要求 */
  const handleToggleReminder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 尚未啟動提醒且瀏覽器未授權時，嘗試請求權限
    if (!hasActiveReminder && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // 忽略請求失敗，依然把資料存進本地端狀態
      }
    }

    toggleReminder({
      videoId: stream.id,
      title: stream.title,
      channelName,
      scheduledFor: stream.available_at,
    });

    showSuccess(hasActiveReminder ? t.reminders.removed : t.reminders.added, { description: stream.title });
  };

  // --- 畫面渲染 ---
  return (
    <a
      href={buildYouTubeWatchUrl(stream.id)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleCardClick}
      className={cn(CARD_STYLES.base, {
        [CARD_STYLES.live]: isLiveStream,
        [CARD_STYLES.upcoming]: isUpcomingStream,
        [CARD_STYLES.default]: !isLiveStream && !isUpcomingStream,
      })}
    >
      <div className="relative aspect-video">
        <img
          src={thumbnailUrl}
          alt={stream.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {/* --- 狀態徽章 (Live / Upcoming) --- */}
        {isLiveStream && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-live px-2 py-0.5 rounded text-xs font-semibold text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
            </span>
            LIVE
          </div>
        )}

        {isUpcomingStream && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-primary/90 px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
            <Clock className="w-3 h-3" />
            UPCOMING
          </div>
        )}

        {/* --- 懸浮操作按鈕區域 --- */}
        {(playlists.length > 0 || isUpcomingStream) && (
          <div className="absolute top-2 right-2 flex items-center gap-2" ref={menuRef}>
            
            {/* 提醒鈴鐺按鈕 */}
            {isUpcomingStream && (
              <button
                onClick={handleToggleReminder}
                className={cn(BUTTON_STYLES.hoverIconBase, 
                  hasActiveReminder ? BUTTON_STYLES.hoverIconActive : BUTTON_STYLES.hoverIconInactive
                )}
                title={t.reminders.toggle}
              >
                {hasActiveReminder ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>
            )}

            {/* 加入自訂清單按鈕 */}
            {playlists.length > 0 && (
              <button
                onClick={handleTogglePlaylistMenu}
                className={cn(BUTTON_STYLES.hoverIconBase, BUTTON_STYLES.hoverIconInactive)}
                title={t.playlists.addTo}
              >
                <ListPlus className="w-4 h-4" />
              </button>
            )}

            {/* 清單選項下拉框 */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-popover shadow-lg z-50 py-1">
                {playlists.map((pl) => {
                  const isAlreadyAdded = pl.videoIds.includes(stream.id);
                  return (
                    <button
                      key={pl.id}
                      onClick={(e) => handleAddVideoToPlaylist(pl.id, e)}
                      disabled={isAlreadyAdded}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-popover-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                      {isAlreadyAdded ? <Check className="w-3 h-3 text-primary" /> : <ListPlus className="w-3 h-3" />}
                      <span className="truncate">{pl.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- 底部標題與時間屬性 --- */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {stream.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">{channelName}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {isLiveStream ? (
                <>
                  <Eye className="w-3 h-3" />
                  {(stream.live_viewers ?? 0).toLocaleString()}
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  {format(new Date(stream.available_at), "MMM d, HH:mm")}
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
