/**
 * @file src/lib/styles.ts
 * @description 集中管理整個專案共用的 Tailwind CSS 樣板 (Constants)，
 * 避免在各個組件內重複宣告落落長的字串，實踐 DRY (Don't Repeat Yourself) 原理。
 */

/**
 * --- 共用卡片樣式變體 ---
 */
export const CARD_STYLES = {
  /** 基礎的圓角對齊卡片 (包含外框與過渡動畫) */
  base: "group block rounded-lg overflow-hidden bg-card border transition-colors",
  /** 實況中：紅色高光外框 */
  live: "border-live/40 hover:border-live/70",
  /** 即將開台：主題色外框 */
  upcoming: "border-primary/30 hover:border-primary/60",
  /** 預設/存檔：一般微明外框 */
  default: "border-border hover:border-primary/50",
} as const;

/**
 * --- 共用互動按鈕樣式 ---
 */
export const BUTTON_STYLES = {
  /** 懸浮顯示的圖示按鈕 (例如加到播放清單、設定提醒) */
  hoverIconBase: "min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100",
  /** 啟動狀態的懸浮圖示按鈕 */
  hoverIconActive: "bg-primary text-primary-foreground",
  /** 停用狀態的懸浮圖示按鈕 */
  hoverIconInactive: "bg-background/60 text-muted-foreground hover:text-primary hover:bg-background/80",
} as const;

/**
 * --- 共用排版區塊樣式 ---
 */
export const LAYOUT_STYLES = {
  /** 影像卡片的格線排列佈局 */
  cardGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
} as const;
