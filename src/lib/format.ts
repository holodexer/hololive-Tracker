/**
 * Format utilities
 * Centralized formatting functions for time, dates, and other values
 */

/**
 * Format seconds to HH:MM:SS format
 * @param seconds Time in seconds
 * @returns Formatted time string (e.g., "1:23:45" or "23:45")
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

/**
 * Format viewer count (e.g., 1000 → "1K")
 * @param count Viewer count
 * @returns Formatted count string
 */
export function formatViewerCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`;
  }
  return String(count);
}
