import type { HolodexVideo } from "@/lib/holodex";
import { format } from "date-fns";
import { Eye, Clock, ListPlus, Check } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerCinema } from "@/components/CinemaOverlay";
import { getDisplayName } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";

interface StreamCardProps {
  stream: HolodexVideo;
}

export function StreamCard({ stream }: StreamCardProps) {
  const { directYoutube, locale, playlists, addToPlaylist, t } = useSettings();
  const isLive = stream.status === "live";
  const isUpcoming = stream.status === "upcoming";
  const thumbnail = `https://i.ytimg.com/vi/${stream.id}/mqdefault.jpg`;
  const channelName = getDisplayName(stream.channel, locale);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleClick = (e: React.MouseEvent) => {
    if (!directYoutube) {
      e.preventDefault();
      triggerCinema(stream.id);
    }
  };

  const handlePlaylistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen((v) => !v);
  };

  const handleAddTo = (playlistId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToPlaylist(playlistId, stream.id, {
      title: stream.title,
      channelName,
    });
    setMenuOpen(false);
  };

  return (
    <a
      href={`https://www.youtube.com/watch?v=${stream.id}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`group block rounded-lg overflow-hidden bg-card border transition-colors ${
        isLive
          ? "border-live/40 hover:border-live/70"
          : isUpcoming
          ? "border-primary/30 hover:border-primary/60"
          : "border-border hover:border-primary/50"
      }`}
    >
      <div className="relative aspect-video">
        <img
          src={thumbnail}
          alt={stream.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {isLive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-live px-2 py-0.5 rounded text-xs font-semibold text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground" />
            </span>
            LIVE
          </div>
        )}

        {isUpcoming && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-primary/90 px-2 py-0.5 rounded text-xs font-semibold text-primary-foreground">
            <Clock className="w-3 h-3" />
            UPCOMING
          </div>
        )}

        {/* Add to Playlist button */}
        {playlists.length > 0 && (
          <div className="absolute top-2 right-2" ref={menuRef}>
            <button
              onClick={handlePlaylistClick}
              className="p-1.5 rounded-full bg-background/60 backdrop-blur-sm text-muted-foreground hover:text-primary hover:bg-background/80 transition-colors opacity-0 group-hover:opacity-100"
              title={t.playlists.addTo}
            >
              <ListPlus className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-popover shadow-lg z-50 py-1">
                {playlists.map((pl) => {
                  const alreadyAdded = pl.videoIds.includes(stream.id);
                  return (
                    <button
                      key={pl.id}
                      onClick={(e) => handleAddTo(pl.id, e)}
                      disabled={alreadyAdded}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left text-popover-foreground hover:bg-accent disabled:opacity-50 transition-colors"
                    >
                      {alreadyAdded ? <Check className="w-3 h-3 text-primary" /> : <ListPlus className="w-3 h-3" />}
                      <span className="truncate">{pl.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {stream.title}
          </p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">{channelName}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {isLive ? (
                <>
                  <Eye className="w-3 h-3" />
                  {(stream.live_viewers ?? 0).toLocaleString()}
                </>
              ) : (
                <>
                  <Clock className="w-3 h-3" />
                  {format(new Date(stream.available_at), "MMM d, HH:mm")}
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
}
