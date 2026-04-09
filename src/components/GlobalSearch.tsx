import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock3, Command, Heart, Home, ListMusic, Radio, Search, Users, VideoIcon } from "lucide-react";
import { useHolodexStreams, useHololiveChannels } from "@/hooks/useHolodex";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerCinema } from "@/components/CinemaOverlay";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { getChannelPhotoUrl, getDisplayName } from "@/lib/utils";
import { buildYouTubeThumbnailUrl, buildYouTubeWatchUrl } from "@/lib/urls";

const OPEN_SEARCH_EVENT = "holodexer:open-search";

export function openGlobalSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const { data } = useHolodexStreams();
  const { data: channels } = useHololiveChannels();
  const {
    directYoutube,
    favorites,
    locale,
    playlists,
    recentVideos,
    recordRecentVideo,
    t,
  } = useSettings();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? "Cmd+K" : "Ctrl+K";
  const liveAndUpcoming = useMemo(() => [...(data?.live ?? []), ...(data?.upcoming ?? [])], [data]);
  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener(OPEN_SEARCH_EVENT, handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener(OPEN_SEARCH_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const videoResults = useMemo(() => {
    if (!deferredQuery) {
      return liveAndUpcoming.slice(0, 6);
    }

    return liveAndUpcoming
      .filter((video) => {
        const channelName = getDisplayName(video.channel, locale).toLowerCase();
        return (
          video.title.toLowerCase().includes(deferredQuery) ||
          channelName.includes(deferredQuery)
        );
      })
      .slice(0, 8);
  }, [deferredQuery, liveAndUpcoming, locale]);

  const memberResults = useMemo(() => {
    const sortedChannels = [...(channels ?? [])].sort((a, b) => {
      const aFavorite = favoriteSet.has(a.id) ? 0 : 1;
      const bFavorite = favoriteSet.has(b.id) ? 0 : 1;
      return aFavorite - bFavorite;
    });

    if (!deferredQuery) {
      return sortedChannels.slice(0, 6);
    }

    return sortedChannels
      .filter((channel) => {
        const names = [
          channel.name,
          channel.english_name,
          channel.group,
          channel.org,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return names.includes(deferredQuery);
      })
      .slice(0, 8);
  }, [channels, deferredQuery, favoriteSet]);

  const playlistResults = useMemo(() => {
    if (!deferredQuery) {
      return playlists.slice(0, 6);
    }

    return playlists
      .filter((playlist) => playlist.name.toLowerCase().includes(deferredQuery))
      .slice(0, 8);
  }, [deferredQuery, playlists]);

  const recentResults = useMemo(() => {
    if (!deferredQuery) {
      return recentVideos.slice(0, 6);
    }

    return recentVideos
      .filter((video) => {
        const haystack = `${video.title} ${video.channelName}`.toLowerCase();
        return haystack.includes(deferredQuery);
      })
      .slice(0, 8);
  }, [deferredQuery, recentVideos]);

  const quickLinks = [
    { icon: Home, label: t.nav.home, url: "/" },
    { icon: Heart, label: t.nav.favorites, url: "/favorites" },
    { icon: Users, label: t.nav.members, url: "/members" },
    { icon: VideoIcon, label: t.nav.jellyfin, url: "/k-hub" },
    { icon: ListMusic, label: t.nav.playlists, url: "/playlists" },
    { icon: Radio, label: t.nav.syncWatch, url: "/sync" },
  ];

  const openVideo = (video: {
    id: string;
    title: string;
    channelName: string;
    thumbnail?: string;
    status?: "live" | "upcoming" | "past";
  }) => {
    recordRecentVideo(video);
    setOpen(false);

    if (directYoutube) {
      window.open(buildYouTubeWatchUrl(video.id), "_blank", "noopener,noreferrer");
      return;
    }

    triggerCinema(video.id, {
      rememberChatPreference: video.status === "live" || video.status === "upcoming",
    });
  };

  const goTo = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/70 bg-card/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Search className="h-4 w-4 text-primary" />
            {t.search.title}
          </div>
          <span>{shortcutLabel}</span>
        </div>
      </div>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t.search.placeholder} />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>{t.search.empty}</CommandEmpty>

        {!deferredQuery && quickLinks.length > 0 && (
          <CommandGroup heading={t.search.quickLinks}>
            {quickLinks.map((item) => (
              <CommandItem key={item.url} value={`nav-${item.url}`} onSelect={() => goTo(item.url)}>
                <item.icon className="mr-2 h-4 w-4 text-primary" />
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {recentResults.length > 0 && (
          <>
            {!deferredQuery && <CommandSeparator />}
            <CommandGroup heading={t.search.recent}>
              {recentResults.map((video) => (
                <CommandItem key={`recent-${video.id}`} value={`recent-${video.id}-${video.title}`} onSelect={() => openVideo(video)}>
                  <img
                    src={video.thumbnail ?? buildYouTubeThumbnailUrl(video.id, "hq720")}
                    alt={video.title}
                    className="mr-3 h-10 w-16 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{video.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{video.channelName || video.id}</div>
                  </div>
                  <CommandShortcut>
                    {new Date(video.watchedAt).toLocaleDateString()}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {videoResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.search.live}>
              {videoResults.map((video) => {
                const channelName = getDisplayName(video.channel, locale);
                return (
                  <CommandItem
                    key={`video-${video.id}`}
                    value={`video-${video.id}-${video.title}`}
                    onSelect={() =>
                      openVideo({
                        id: video.id,
                        title: video.title,
                        channelName,
                        thumbnail: buildYouTubeThumbnailUrl(video.id, "hq720"),
                        status: video.status,
                      })
                    }
                  >
                    <img
                      src={buildYouTubeThumbnailUrl(video.id, "hq720")}
                      alt={video.title}
                      className="mr-3 h-10 w-16 rounded object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{video.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{channelName}</div>
                    </div>
                    <CommandShortcut>{video.status}</CommandShortcut>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {memberResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.search.members}>
              {memberResults.map((channel) => {
                const displayName = getDisplayName(channel, locale);
                return (
                  <CommandItem
                    key={`channel-${channel.id}`}
                    value={`channel-${channel.id}-${displayName}`}
                    onSelect={() => goTo(`/member/${channel.id}`)}
                  >
                    <img
                      src={getChannelPhotoUrl(channel.photo)}
                      alt={displayName}
                      className="mr-3 h-10 w-10 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{displayName}</div>
                      <div className="truncate text-xs text-muted-foreground">{channel.group || channel.org || channel.id}</div>
                    </div>
                    {favoriteSet.has(channel.id) && <Heart className="h-4 w-4 fill-current text-pink-400" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {playlistResults.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.search.playlists}>
              {playlistResults.map((playlist) => (
                <CommandItem
                  key={`playlist-${playlist.id}`}
                  value={`playlist-${playlist.id}-${playlist.name}`}
                  onSelect={() => goTo(`/playlist/${playlist.id}`)}
                >
                  <ListMusic className="mr-3 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{playlist.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {playlist.videoIds.length} {t.playlists.videos}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {!deferredQuery && recentResults.length === 0 && playlists.length === 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.search.navigation}>
              <CommandItem value="search-hint" disabled>
                <Clock3 className="mr-2 h-4 w-4" />
                <span>{t.search.placeholder}</span>
                <CommandShortcut>{shortcutLabel}</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}