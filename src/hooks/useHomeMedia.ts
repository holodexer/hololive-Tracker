/**
 * @file src/hooks/useHomeMedia.ts
 * @description 封裝首頁 (Index) 全域 Hololive 的非同步資料選取邏輯，包含存檔影片與精華剪輯的分頁與過濾。
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchHololivePastStreams, fetchHololiveClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { useSettings } from "@/contexts/SettingsContext";

const PAGE_SIZE = 48;

/**
 * --- 封裝 Hook 介面 ---
 */
export function useHomeMedia() {
  const { clipLanguages, hidePrivateVideos, locale } = useSettings();

  // --- 狀態定義 ---
  const [archiveVideos, setArchiveVideos] = useState<HolodexVideo[]>([]);
  const [archivePage, setArchivePage] = useState(0);
  const [hasMoreArchives, setHasMoreArchives] = useState(true);
  const [isArchivingLoadingMore, setIsArchivingLoadingMore] = useState(false);

  const [clipVideos, setClipVideos] = useState<HolodexVideo[]>([]);
  const [clipsPage, setClipsPage] = useState(0);
  const [hasMoreClips, setHasMoreClips] = useState(true);
  const [isClipsLoadingMore, setIsClipsLoadingMore] = useState(false);

  // 決定擷取的剪輯語系
  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");

  // --- 依賴重置邏輯 ---
  useEffect(() => {
    setClipVideos([]);
    setClipsPage(0);
    setHasMoreClips(true);
  }, [clipLangKey, hidePrivateVideos]);

  useEffect(() => {
    setArchiveVideos([]);
    setArchivePage(0);
    setHasMoreArchives(true);
  }, [hidePrivateVideos]);

  // --- 初始載入：存檔影片 ---
  const { isLoading: isArchiveInitLoading } = useQuery({
    queryKey: ["home-archives-init", hidePrivateVideos],
    queryFn: async () => {
      const data = await fetchHololivePastStreams(PAGE_SIZE, 0);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      setArchiveVideos(filtered);
      setArchivePage(1);
      setHasMoreArchives(data.length >= PAGE_SIZE);
      return filtered;
    },
  });

  // --- 初始載入：剪輯影片 ---
  const { isLoading: isClipsInitLoading } = useQuery({
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
      setHasMoreClips(results.some((result) => result.videos.length >= PAGE_SIZE));
      return filtered;
    },
  });

  // --- 分頁加載：存檔影片 ---
  const loadMoreArchives = useCallback(async () => {
    setIsArchivingLoadingMore(true);
    try {
      const offset = archivePage * PAGE_SIZE;
      const data = await fetchHololivePastStreams(PAGE_SIZE, offset);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      
      setArchiveVideos((prev) => [...prev, ...filtered]);
      setArchivePage((p) => p + 1);
      if (data.length < PAGE_SIZE) setHasMoreArchives(false);
    } finally {
      setIsArchivingLoadingMore(false);
    }
  }, [archivePage, hidePrivateVideos]);

  // --- 分頁加載：剪輯影片 ---
  const loadMoreClips = useCallback(async () => {
    setIsClipsLoadingMore(true);
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
      if (!results.some((result) => result.videos.length >= PAGE_SIZE)) setHasMoreClips(false);
    } finally {
      setIsClipsLoadingMore(false);
    }
  }, [clipsPage, clipLangKey, activeClipLangs, hidePrivateVideos]);

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
