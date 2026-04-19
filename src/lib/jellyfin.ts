interface JellyfinUrlParts {
  baseUrl: string;
  itemId: string;
  apiKey: string;
}

interface JellyfinStreamUrlOptions {
  baseUrl: string;
  itemId: string;
  apiKey: string;
  deviceId?: string;
  playSessionId?: string;
}

const JELLYFIN_MEDIA_PATH_RE = /^(https?:\/\/.+?)\/(?:Videos|Items)\/([^/?]+)/i;

export function parseJellyfinUrl(url: string): JellyfinUrlParts | null {
  const mediaMatch = url.match(JELLYFIN_MEDIA_PATH_RE);
  const apiKeyMatch = url.match(/[?&]api_key=([^&]+)/);
  if (!mediaMatch || !apiKeyMatch) return null;

  const [, baseUrl, itemId] = mediaMatch;
  return {
    baseUrl,
    itemId,
    apiKey: apiKeyMatch[1],
  };
}

export function isJellyfinDownloadUrl(url: string): boolean {
  return /\/(?:Videos|Items)\/[^/]+\/Download(\?|$)/i.test(url);
}

export function buildJellyfinMasterUrl(options: JellyfinStreamUrlOptions): string {
  const { baseUrl, itemId, apiKey, deviceId, playSessionId } = options;
  const params = new URLSearchParams({
    api_key: apiKey,
    MediaSourceId: itemId,
    VideoCodec: "h264",
    AudioCodec: "aac,mp3",
    VideoBitrate: "139616000",
    AudioBitrate: "384000",
    MaxFramerate: "60",
  });

  if (deviceId) params.set("DeviceId", deviceId);
  if (playSessionId) params.set("PlaySessionId", playSessionId);

  return `${baseUrl}/Videos/${itemId}/master.m3u8?${params.toString()}`;
}

export function buildJellyfinMp4FallbackUrl(options: JellyfinStreamUrlOptions): string {
  const { baseUrl, itemId, apiKey, deviceId, playSessionId } = options;
  const params = new URLSearchParams({
    api_key: apiKey,
    Container: "mp4",
    VideoCodec: "h264",
    AudioCodec: "aac,mp3",
    VideoBitrate: "8000000",
  });

  if (deviceId) params.set("DeviceId", deviceId);
  if (playSessionId) params.set("PlaySessionId", playSessionId);

  return `${baseUrl}/Videos/${itemId}/stream.mp4?${params.toString()}`;
}
