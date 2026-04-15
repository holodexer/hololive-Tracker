/**
 * @file src/components/ui/input.tsx
 * @description 系統通用的純文字輸入框組件 (Input)。
 * 負責處理標準的單行文字輸入，並實作跨瀏覽器的一致性 Focus、禁用狀態(Disabled)與邊框發光效果。
 */

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * --- 純文字輸入框組件 ---
 * 直接繼承 HTMLInputElement 的所有原生屬性。
 * @param className - 允許自訂擴充或覆蓋預設的文字與佈局樣式。
 * @param type - 定義輸入框類型 (如: text, password, email 等)。
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
