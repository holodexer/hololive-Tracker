import { useEffect, useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSettings } from "@/contexts/SettingsContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { buildYouTubeEmbedUrl, buildYouTubeLiveChatUrl } from "@/lib/urls";

const CINEMA_CHAT_PREF_KEY = "cinema-overlay-show-chat";

interface CinemaOverlayProps {
  videoId: string;
  onClose: () => void;
  rememberChatPreference?: boolean;
}

function getEmbedDomain() {
  return window.location.hostname;
}

function loadSavedChatPreference() {
  try {
    return localStorage.getItem(CINEMA_CHAT_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function CinemaOverlay({ videoId, onClose, rememberChatPreference = true }: CinemaOverlayProps) {
  const [showChat, setShowChat] = useState(() => {
    if (!rememberChatPreference) return false;
    return loadSavedChatPreference();
  });
  const { t } = useSettings();
  const isMobile = useIsMobile();
  const embedDomain = getEmbedDomain();
  const chatUrl = buildYouTubeLiveChatUrl(videoId, embedDomain);

  useEffect(() => {
    setShowChat(rememberChatPreference ? loadSavedChatPreference() : false);
  }, [videoId, rememberChatPreference]);

  const handleToggleChat = (checked: boolean) => {
    setShowChat(checked);
    if (!rememberChatPreference) return;
    try {
      localStorage.setItem(CINEMA_CHAT_PREF_KEY, checked ? "1" : "0");
    } catch {
      // Ignore storage errors and keep in-memory state.
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full mx-4 transition-all duration-300 ease-in-out",
          isMobile ? "max-w-[1380px]" : showChat ? "max-w-[1680px]" : "max-w-[1380px]"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating controls — absolute on top of content, no layout impact */}
        <div className="absolute -top-10 inset-x-0 flex items-center justify-between z-10 pointer-events-none">
          <div className="flex items-center gap-3 pointer-events-auto">
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
              onCheckedChange={handleToggleChat}
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors pointer-events-auto"
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
              src={buildYouTubeEmbedUrl(videoId, true)}
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
                  : "w-[300px] shrink-0 opacity-100 ml-3 border border-border/50"
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

interface CinemaPayload {
  videoId: string;
  rememberChatPreference?: boolean;
}

// Global cinema state
let openCinema: ((payload: CinemaPayload) => void) | null = null;

export function useCinema() {
  const [payload, setPayload] = useState<CinemaPayload | null>(null);

  openCinema = (nextPayload: CinemaPayload) => setPayload(nextPayload);

  return {
    payload,
    close: () => setPayload(null),
  };
}

export function triggerCinema(videoId: string, options?: { rememberChatPreference?: boolean }) {
  openCinema?.({ videoId, rememberChatPreference: options?.rememberChatPreference });
}
