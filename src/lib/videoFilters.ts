import type { HolodexVideo } from "@/lib/holodex";

function normalizeText(value: string | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[\[\]【】()（）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const unavailableTitlePatterns: RegExp[] = [
  /\bprivate video\b/i,
  /\bdeleted video\b/i,
  /\bvideo unavailable\b/i,
  /\bthis video is unavailable\b/i,
  /\bremoved video\b/i,
  /\bnon[-\s]?public\b/i,
  /\bunavailable\b/i,
  /\u5df2\u522a\u9664/, // 已刪除
  /\u79c1\u4eba\u5f71\u7247|\u79c1\u5bc6\u89c6\u9891/, // 私人影片 / 私密视频
  /\u5f71\u7247\u4e0d\u53ef\u7528|\u89c6\u9891\u4e0d\u53ef\u7528/, // 影片不可用 / 视频不可用
  /\u975e\u516c\u958b|\u975e\u516c\u5f00/, // 非公開 / 非公开
  /\u524a\u9664\u6e08\u307f|\u5229\u7528\u4e0d\u53ef/, // 削除済み / 利用不可
];

const unavailableChannelPatterns: RegExp[] = [
  /\bdeleted channel\b/i,
  /\bchannel unavailable\b/i,
  /\u5df2\u522a\u9664\u983b\u9053|\u5df2\u5220\u9664\u9891\u9053/, // 已刪除頻道 / 已删除频道
  /\u524a\u9664\u6e08\u307f\u30c1\u30e3\u30f3\u30cd\u30eb/, // 削除済みチャンネル
];

export function isUnavailableVideo(video: HolodexVideo) {
  const title = normalizeText(video.title);
  if (unavailableTitlePatterns.some((pattern) => pattern.test(title))) return true;

  const channelName = normalizeText(video.channel?.name);
  const channelEnglishName = normalizeText(video.channel?.english_name);
  const channelCombined = `${channelName} ${channelEnglishName}`.trim();

  return unavailableChannelPatterns.some((pattern) => pattern.test(channelCombined));
}

export function filterUnavailableVideos(videos: HolodexVideo[], hidePrivateVideos: boolean) {
  if (!hidePrivateVideos) return videos;
  return videos.filter((video) => !isUnavailableVideo(video));
}
