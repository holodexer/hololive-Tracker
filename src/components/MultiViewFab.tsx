import { useMultiView } from "@/contexts/MultiViewContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate, useLocation } from "react-router-dom";
import { MonitorPlay, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function MultiViewFab() {
  const { selectedIds, selectedStreams, toggle } = useMultiView();
  const { t } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  if (selectedIds.length === 0 || location.pathname === "/multi-view") return null;

  const handleRemove = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation();
    toggle(videoId);
  };

  return (
    <button
      onClick={() => navigate("/multi-view")}
      className="fixed bottom-24 right-4 z-50 flex flex-col gap-2 rounded-lg bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 animate-in slide-in-from-bottom-4 md:bottom-6 md:right-6 max-w-xs"
    >
      <div className="flex items-center gap-2">
        <MonitorPlay className="w-5 h-5" />
        <span className="text-sm font-semibold">
          {t.multiView.open} ({selectedIds.length}/4)
        </span>
      </div>
      {selectedStreams.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedStreams.map((stream) => (
            <div key={stream.videoId} className="flex items-center gap-1">
              <Badge
                variant="secondary"
                className="text-xs px-2 py-0.5 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground flex items-center gap-1"
              >
                <span className="truncate">{stream.channelName}</span>
                {stream.viewers && (
                  <span className="text-[10px] opacity-75">
                    ({(stream.viewers / 1000).toFixed(1)}K)
                  </span>
                )}
                <button
                  onClick={(e) => handleRemove(e, stream.videoId)}
                  className="ml-1 hover:opacity-75 transition-opacity"
                  aria-label={`Remove ${stream.channelName}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
