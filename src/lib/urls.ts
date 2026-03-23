/**
 * YouTube URL utilities
 * Centralized URL builders to eliminate duplication across the codebase
 */

/**
 * Build YouTube video thumbnail URL
 * @param videoId YouTube video ID
 * @returns Thumbnail URL (mqdefault quality)
 */
export function buildYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

/**
 * Build YouTube watch page URL
 * @param videoId YouTube video ID
 * @returns Watch page URL
 */
export function buildYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Build YouTube embed URL
 * @param videoId YouTube video ID
 * @param autoplay Auto-play setting
 * @param mute Mute setting
 * @returns Embed URL
 */
export function buildYouTubeEmbedUrl(videoId: string, autoplay = true, mute = false): string {
  const params = new URLSearchParams();
  if (autoplay) params.append("autoplay", "1");
  if (mute) params.append("mute", "1");
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Build YouTube live chat URL
 * @param videoId YouTube video ID
 * @param embedDomain Domain for embedding
 * @returns Live chat URL
 */
export function buildYouTubeLiveChatUrl(videoId: string, embedDomain: string): string {
  return `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${embedDomain}`;
}

/**
 * Build YouTube channel URL
 * @param channelId YouTube channel ID
 * @returns Channel page URL
 */
export function buildYouTubeChannelUrl(channelId: string): string {
  return `https://www.youtube.com/channel/${channelId}`;
}

/**
 * Build YouTube iframe API script URL
 * @returns Script URL
 */
export function getYouTubeIframeApiUrl(): string {
  return "https://www.youtube.com/iframe_api";
}
