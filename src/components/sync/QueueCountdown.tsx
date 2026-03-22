import { useState, useEffect, useCallback } from "react";
import { SkipForward, X } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

interface QueueCountdownProps {
  nextTitle?: string;
  duration?: number; // seconds
  onComplete: () => void;
  onCancel: () => void;
}

export function QueueCountdown({
  nextTitle,
  duration = 5,
  onComplete,
  onCancel,
}: QueueCountdownProps) {
  const [remaining, setRemaining] = useState(duration);
  const { t } = useSettings();

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, onComplete]);

  const handleSkip = useCallback(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        {/* Countdown ring */}
        <div className="relative w-20 h-20">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="4"
              opacity="0.3"
            />
            <circle
              cx="40" cy="40" r="34"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={Math.PI * 68}
              strokeDashoffset={Math.PI * 68 * (1 - remaining / duration)}
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground tabular-nums">
            {remaining}
          </span>
        </div>

        {/* Next up label */}
        <div className="space-y-1 max-w-[280px]">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {t.sync.upNext}
          </p>
          {nextTitle && (
            <p className="text-sm text-foreground font-medium line-clamp-2 overflow-wrap-break-word">
              {nextTitle}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSkip}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium",
              "bg-primary text-primary-foreground",
              "hover:bg-primary/90 active:scale-[0.97] transition-all duration-150"
            )}
          >
            <SkipForward className="w-4 h-4" />
            {t.sync.playNow}
          </button>
          <button
            onClick={onCancel}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-muted/50 active:scale-[0.97] transition-all duration-150"
            )}
          >
            <X className="w-4 h-4" />
            {t.common.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}
