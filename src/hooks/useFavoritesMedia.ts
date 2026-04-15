/**
 * @file src/hooks/useFavoritesMedia.ts
 * @description 統一封裝對於「我的最愛 (Favorites)」頻道的非同步資料選取邏輯，包含存檔影片與精華剪輯的分頁加載。
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchChannelVideos, fetchChannelClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { useSettings } from "@/contexts/SettingsContext";

const PAGE_SIZE = 48;

/**
 * --- 封裝 Hook 介面 ---
 */
export function useFavoritesMedia() {
  const { favorites, clipLanguages, hidePrivateVideos, locale } = useSettings();

  // --- 狀態定義 ---
  const [archiveVideos, setArchiveVideos] = useState<HolodexVideo[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [hasMoreArchives, setHasMoreArchives] = useState(true);
  const [isArchivingLoadingMore, setIsArchivingLoadingMore] = useState(false);

  const [clipVideos, setClipVideos] = useState<HolodexVideo[]>([]);
  const [clipsPage, setClipsPage] = useState(0);
  const [hasMoreClips, setHasMoreClips] = useState(true);
  const [isClipsLoadingMore, setIsClipsLoadingMore] = useState(false);

  // 計算主要的剪輯語言
  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");

  // --- 重置邏輯 ---
  // 當觀看隱私設定或語系切換時，清空當前資料快取
  useEffect(() => {
    setClipVideos([]);
    setClipsPage(0);
    setHasMoreClips(true);
  }, [locale, clipLangKey, hidePrivateVideos]);

  useEffect(() => {
    setArchiveVideos([]);
    setArchivePage(0);
    setHasMoreArchives(true);
  }, [hidePrivateVideos]);

  // --- 初始載入：存檔影片 ---
  const { isLoading: isArchiveInitLoading } = useQuery({
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
      setHasMoreArchives(results.some((r) => r.length >= PAGE_SIZE));
      return merged;
    },
    enabled: favorites.length > 0,
  });

  // --- 初始載入：剪輯影片 ---
  const { isLoading: isClipsInitLoading } = useQuery({
    queryKey: ["favorites-clips-init", favorites.join(","), clipLangKey, locale, hidePrivateVideos],
    queryFn: async () => {
      if (favorites.length === 0) return [];
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => {
          const byChannel = await Promise.all(
            favorites.map((chId) => fetchChannelClips(chId, PAGE_SIZE, 0, lang))
          );
          return { lang, videos: byChannel.flat(), hasMore: byChannel.some((items) => items.length >= PAGE_SIZE) };
        })
      );
      
      const mixed = mixClipsByLanguage(results);
      const merged = filterUnavailableVideos(mixed, hidePrivateVideos);
      
      setClipVideos(merged);
      setClipsPage(1);
      setHasMoreClips(results.some((result) => result.hasMore));
      return merged;
    },
    enabled: favorites.length > 0,
  });

  // --- 分頁加載：存檔影片 ---
  const loadMoreArchives = useCallback(async () => {
    setIsArchivingLoadingMore(true);
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
      
      if (results.every((r) => r.length < PAGE_SIZE)) setHasMoreArchives(false);
    } finally {
      setIsArchivingLoadingMore(false);
    }
  }, [favorites, archivePage, hidePrivateVideos]);

  // --- 分頁加載：剪輯影片 ---
  const loadMoreClips = useCallback(async () => {
    setIsClipsLoadingMore(true);
    try {
      const offset = clipsPage * PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => {
          const byChannel = await Promise.all(
            favorites.map((chId) => fetchChannelClips(chId, PAGE_SIZE, offset, lang))
          );
          return { lang, videos: byChannel.flat(), hasMore: byChannel.some((items) => items.length >= PAGE_SIZE) };
        })
      );
      
      const mixed = mixClipsByLanguage(results);
      const merged = filterUnavailableVideos(mixed, hidePrivateVideos);
      
      setClipVideos((prev) => [...prev, ...merged]);
      setClipsPage((p) => p + 1);
      
      if (!results.some((result) => result.hasMore)) setHasMoreClips(false);
    } finally {
      setIsClipsLoadingMore(false);
    }
  }, [favorites, clipsPage, clipLangKey, activeClipLangs, hidePrivateVideos]);

  return {
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
  };
}
