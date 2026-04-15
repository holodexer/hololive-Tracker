/**
 * @file src/components/ui/button.tsx
 * @description 系統通用的按鈕元件 (Button)，基於 Radix UI 的 Slot 以及 class-variance-authority。
 * 負責處理應用程式中所有按鈕的樣式、尺寸與各種語意化狀態 (如禁用、不同優先級外觀)。
 */

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * --- 定義按鈕外觀變體 (Variants) ---
 * 使用 CVA 統籌管理所有可能的 Tailwind 按鈕樣式組合。
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * --- 按鈕屬性定義 (Props) ---
 * 繼承原生按鈕的所有屬性 (包含原生 disabled / onClick 等)。
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * 是否將此元件渲染為其子元件 (Render Delegation)。
   * 若設為 true，此元件將轉變為外層容器，把 className 與變數傳遞給內部的子標籤 (如 <Link>)。
   */
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // 若為 asChild 則利用 Radix 的 Slot 把屬性灌入第一層子元件，否則回傳原生 button
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
