import { useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/contexts/SettingsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface CinemaOverlayProps {
  videoId: string;
  onClose: () => void;
}

function getEmbedDomain() {
  return window.location.hostname;
}

export function CinemaOverlay({ videoId, onClose }: CinemaOverlayProps) {
  const [showChat, setShowChat] = useState(false);
  const { t } = useSettings();
  const isMobile = useIsMobile();
  const embedDomain = getEmbedDomain();
  const chatUrl = `https://www.youtube.com/live_chat?v=${videoId}&embed_domain=${embedDomain}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-6xl mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
            <label
              htmlFor="chat-toggle"
              className="text-sm text-muted-foreground select-none cursor-pointer"
            >
              {t.cinema.showChat}
            </label>
            <Switch
              id="chat-toggle"
              checked={showChat}
              onCheckedChange={setShowChat}
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
        <div
          className={cn(
            "flex w-full",
            isMobile ? "flex-col gap-3" : "flex-row"
          )}
        >
          {/* Video player */}
          <div
            className="aspect-video rounded-lg overflow-hidden flex-1 min-w-0 transition-all duration-300 ease-in-out"
          >
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>

          {/* Live Chat panel - always mounted, hidden via CSS */}
          <div
            className={cn(
              "rounded-lg overflow-hidden transition-all duration-300 ease-in-out",
              "bg-card/60 backdrop-blur-md shadow-lg",
              showChat
                ? isMobile
                  ? "w-full h-[300px] opacity-100 mt-3 border border-border/50"
                  : "w-[370px] shrink-0 opacity-100 ml-3 border border-border/50"
                : isMobile
                  ? "w-full h-0 opacity-0 overflow-hidden"
                  : "w-0 opacity-0 overflow-hidden"
            )}
          >
            <iframe
              src={chatUrl}
              className="w-full h-full"
              allow="accelerometer; clipboard-write; encrypted-media"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Global cinema state
let openCinema: ((videoId: string) => void) | null = null;

export function useCinema() {
  const [videoId, setVideoId] = useState<string | null>(null);

  openCinema = (id: string) => setVideoId(id);

  return {
    videoId,
    close: () => setVideoId(null),
  };
}

export function triggerCinema(videoId: string) {
  openCinema?.(videoId);
}
