/**
 * @file src/components/ui/switch.tsx
 * @description 系統通用的滑動開關組件 (Switch/Toggle)。基於 Radix UI 提供全螢幕閱讀器與鍵盤友善性。
 * 用於二元設定選項 (如：顯示/隱藏、開啟/關閉功能)。
 */

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/**
 * --- 滑動開關組件 ---
 * @param className - 控制開關底色與圓角的對齊，預設開啟時會帶入背景主色 (bg-primary)。
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  // 根元件：控制灰色/高亮底圖的過渡變化
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    {/* 內部圓球：利用 translateX 製造滑動撥桿效果 */}
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
