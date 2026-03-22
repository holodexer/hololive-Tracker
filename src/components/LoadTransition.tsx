import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { LOAD_REVEAL_CLASS } from "@/lib/transitions";

interface LoadTransitionProps {
  loading: boolean;
  children: ReactNode;
  minHeightClassName?: string;
  className?: string;
  loaderClassName?: string;
}

export function LoadTransition({
  loading,
  children,
  minHeightClassName = "min-h-[60vh]",
  className,
  loaderClassName = "w-8 h-8",
}: LoadTransitionProps) {
  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", minHeightClassName)}>
        <Loader2 className={cn(loaderClassName, "animate-spin text-primary")} />
      </div>
    );
  }

  return <div className={cn(LOAD_REVEAL_CLASS, className)}>{children}</div>;
}