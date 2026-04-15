/**
 * @file src/lib/utils.ts
 * @description 全域工具函式庫，負責處理純文字、樣式合併、基礎數學運算等不涉及 React 狀態的邏輯。
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Locale } from "./i18n";

/**
 * --- 樣式處理 ---
 */

/**
 * 組合與合併 Tailwind 樣式。
 * @param inputs - 傳入的不定數量 className 字串或條件判斷
 * @returns 經過字串無效屬性剔除 (clsx) 與衝突覆蓋消除 (twMerge) 後的最終 CSS 字串
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * --- 領域模型輔助 (Domain Helpers) ---
 */

/**
 * 根據使用者目前的應用程式語系，來決定要顯示哪個頻道的名稱。
 * @param channel - 包含日文原名與可能包含英文名稱的資料物件
 * @param locale - 使用者目前的設定語系 (例如: "ja", "en", "zh-TW")
 * @returns 適合當前語系的顯示名稱字串
 */
export function getDisplayName(
  channel: { name: string; english_name?: string },
  locale: Locale
): string {
  if (locale === "ja") return channel.name;
  return channel.english_name || channel.name;
}

/**
 * 正規化頻道大頭貼 URL，確保通訊協定為 HTTPS 且不會破圖。
 * @param photo - 來自 API 伺服器回傳的圖片相對或絕對路徑
 * @returns 完整的 https 圖片網址，若無給定則回傳預設佔位圖
 */
export function getChannelPhotoUrl(photo?: string): string {
  if (!photo) return "/channel-placeholder.svg";
  if (photo.startsWith("//")) return `https:${photo}`;
  if (photo.startsWith("http://")) return `https://${photo.slice(7)}`;
  return photo;
}
