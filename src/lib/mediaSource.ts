export type MediaSourceType = "youtube" | "direct";

export interface ParsedMedia {
  source: MediaSourceType;
  value: string;
}

const YT_PREFIX = "yt:";
const URL_PREFIX = "url:";

export function extractYouTubeId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/
  );
  if (urlMatch?.[1]) return urlMatch[1];

  // Support plain YouTube video IDs.
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;

  return null;
}

function isLikelyDirectUrl(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function parseMediaInput(input: string): ParsedMedia | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const youtubeId = extractYouTubeId(trimmed);
  if (youtubeId) return { source: "youtube", value: youtubeId };

  if (isLikelyDirectUrl(trimmed)) {
    return { source: "direct", value: trimmed };
  }

  return null;
}

export function serializeMedia(media: ParsedMedia): string {
  if (media.source === "youtube") return `${YT_PREFIX}${media.value}`;
  return `${URL_PREFIX}${encodeURIComponent(media.value)}`;
}

export function deserializeMedia(serialized: string): ParsedMedia | null {
  const value = serialized.trim();
  if (!value) return null;

  if (value.startsWith(YT_PREFIX)) {
    const youtubeId = value.slice(YT_PREFIX.length);
    return youtubeId ? { source: "youtube", value: youtubeId } : null;
  }

  if (value.startsWith(URL_PREFIX)) {
    const raw = value.slice(URL_PREFIX.length);
    if (!raw) return null;
    try {
      return { source: "direct", value: decodeURIComponent(raw) };
    } catch {
      return null;
    }
  }

  // Backward compatibility with old room messages that only sent YouTube IDs.
  const legacyYouTube = extractYouTubeId(value);
  if (legacyYouTube) return { source: "youtube", value: legacyYouTube };

  if (isLikelyDirectUrl(value)) return { source: "direct", value };

  return null;
}