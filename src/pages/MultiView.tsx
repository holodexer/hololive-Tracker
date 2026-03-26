import { useMultiView } from "@/contexts/MultiViewContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, X, Grid2x2, VolumeX, Volume2, Plus, Save, Link2, GripVertical, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useHolodexStreams, useHololiveChannels } from "@/hooks/useHolodex";
import { getDisplayName, getChannelPhotoUrl } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildYouTubeEmbedUrl } from "@/lib/urls";
import { showInfo, showSuccess } from "@/lib/errors";
import { ClipsOverlay } from "@/components/sync/ClipsOverlay";

type LayoutMode = "auto" | "grid";

const CONFIG_STORAGE_KEY = "multi-view-config-v1";

interface MultiViewConfig {
  ids: string[];
  layout: LayoutMode;
  mutedIds: string[];
}

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default function MultiView() {
  const { selectedIds, toggle, clear, setSelectedIds, reorder } = useMultiView();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { locale, t } = useSettings();
  const { data } = useHolodexStreams();
  const { data: channels } = useHololiveChannels();
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("auto");
  const [mutedById, setMutedById] = useState<Record<string, boolean>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showClips, setShowClips] = useState(false);
  const [clipsActiveTab, setClipsActiveTab] = useState<"live" | "archives" | "clips" | "playlists" | "jellyfin">("live");
  const [pendingWindowIndex, setPendingWindowIndex] = useState<number | null>(null);
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

  const liveStreams = data?.live ?? [];

  useEffect(() => {
    const idsFromQuery = parseCsv(searchParams.get("mv"));
    const layoutFromQuery = searchParams.get("layout");
    const mutedFromQuery = parseCsv(searchParams.get("mute"));

    if (idsFromQuery.length > 0) {
      setSelectedIds(idsFromQuery);
      setMutedById(Object.fromEntries(idsFromQuery.map((id) => [id, mutedFromQuery.includes(id)])));
    } else {
      try {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MultiViewConfig;
          if (Array.isArray(parsed.ids) && parsed.ids.length > 0) {
            setSelectedIds(parsed.ids);
            const mutedIds = Array.isArray(parsed.mutedIds) ? parsed.mutedIds : [];
            setMutedById(Object.fromEntries(parsed.ids.map((id) => [id, mutedIds.includes(id)])));
          }
          if (parsed.layout === "auto" || parsed.layout === "grid") {
            setLayoutMode(parsed.layout);
          }
        }
      } catch {
        // Ignore corrupted local config.
      }
    }

    if (layoutFromQuery === "auto" || layoutFromQuery === "grid") {
      setLayoutMode(layoutFromQuery);
    }
  }, [searchParams, setSelectedIds]);

  useEffect(() => {
    setMutedById((prev) => {
      const next: Record<string, boolean> = {};
      selectedIds.forEach((id) => {
        next[id] = prev[id] ?? false;
      });
      return next;
    });
  }, [selectedIds]);

  const allMuted = selectedIds.length > 0 && selectedIds.every((id) => mutedById[id]);

  const postPlayerCommand = (videoId: string, func: "mute" | "unMute") => {
    const iframe = iframeRefs.current.get(videoId);
    const win = iframe?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*");
  };

  const applyMuteState = (videoId: string, muted: boolean) => {
    postPlayerCommand(videoId, muted ? "mute" : "unMute");
  };

  // All live channels (not just favorites)
  const liveChannelMap = new Map<string, typeof liveStreams[0]>();
  liveStreams.forEach((v) => {
    if (!liveChannelMap.has(v.channel.id)) {
      liveChannelMap.set(v.channel.id, v);
    }
  });

  // Get channel info for live channels
  const liveChannelIds = [...liveChannelMap.keys()];
  const liveChannels = channels?.filter((ch) => liveChannelIds.includes(ch.id)) ?? [];

  const handleAddStream = (channelId: string) => {
    const stream = liveChannelMap.get(channelId);
    if (stream && !selectedIds.includes(stream.id)) {
      toggle(stream.id);
    }
  };

  const handleAddWindow = () => {
    if (selectedIds.length >= 4) {
      showInfo(t.multiView.maxReached);
      return;
    }

    // Add a placeholder window only - user clicks it to open ClipsOverlay
    const placeholderId = `pending-window-${Date.now()}`;
    const newIds = [...selectedIds, placeholderId];
    setSelectedIds(newIds);
  };

  const handleToggleMuteAll = () => {
    const nextMuted = !allMuted;
    const nextState = Object.fromEntries(selectedIds.map((id) => [id, nextMuted]));
    setMutedById(nextState);
    selectedIds.forEach((id) => applyMuteState(id, nextMuted));
  };

  const handleToggleSingleMute = (videoId: string) => {
    const nextMuted = !mutedById[videoId];
    setMutedById((prev) => ({ ...prev, [videoId]: nextMuted }));
    applyMuteState(videoId, nextMuted);
  };

  const handleSelectClip = (videoId: string, _title: string) => {
    if (pendingWindowIndex === null) return;

    const newIds = [...selectedIds];
    const pendingId = newIds[pendingWindowIndex];
    const existingIndex = newIds.indexOf(videoId);

    // Selecting a video that already exists should move it to this placeholder.
    if (existingIndex !== -1 && existingIndex !== pendingWindowIndex) {
      newIds[pendingWindowIndex] = videoId;
      newIds[existingIndex] = pendingId;
    } else {
      newIds[pendingWindowIndex] = videoId;
    }

    setSelectedIds(newIds);
    setPendingWindowIndex(null);
    setShowClips(false);
  };

  const handleRemoveTile = (index: number) => {
    if (index < 0 || index >= selectedIds.length) return;

    // Keep slot: closing a filled tile turns it back into a placeholder window.
    const nextIds = [...selectedIds];
    nextIds[index] = `pending-window-${Date.now()}-${index}`;
    setSelectedIds(nextIds);
  };

  const handleSaveConfig = () => {
    const config: MultiViewConfig = {
      ids: selectedIds,
      layout: layoutMode,
      mutedIds: selectedIds.filter((id) => mutedById[id]),
    };
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    showSuccess(t.multiView.saved);
  };

  const shareLink = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedIds.length > 0) {
      params.set("mv", selectedIds.join(","));
    }
    params.set("layout", layoutMode);
    const mutedIds = selectedIds.filter((id) => mutedById[id]);
    if (mutedIds.length > 0) {
      params.set("mute", mutedIds.join(","));
    }
    const query = params.toString();
    return `${window.location.origin}${window.location.pathname}#/multi-view${query ? `?${query}` : ""}`;
  }, [layoutMode, mutedById, selectedIds]);

  const handleCopyConfigLink = async () => {
    await navigator.clipboard.writeText(shareLink);
    showSuccess(t.multiView.linkCopied);
  };

  const handleToggleLayout = () => {
    setLayoutMode((prev) => (prev === "auto" ? "grid" : "auto"));
  };

  const handleDragStart = (videoId: string) => {
    setDraggingId(videoId);
  };

  const handleDrop = (targetVideoId: string) => {
    if (!draggingId || draggingId === targetVideoId) return;
    const fromIndex = selectedIds.indexOf(draggingId);
    const toIndex = selectedIds.indexOf(targetVideoId);
    if (fromIndex < 0 || toIndex < 0) return;

    // Dropping onto a placeholder should behave like moving into that slot
    // without shifting all other tiles, to minimize iframe remount/reload.
    if (targetVideoId.startsWith("pending-")) {
      const next = [...selectedIds];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      setSelectedIds(next);
    } else {
      reorder(fromIndex, toIndex);
    }

    setDraggingId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
  };

  const gridClass =
    layoutMode === "grid"
      ? "grid-cols-1 sm:grid-cols-2"
      : selectedIds.length <= 1
      ? "grid-cols-1"
      : selectedIds.length === 2
      ? "grid-cols-1 sm:grid-cols-2 grid-rows-1"
      : "grid-cols-1 sm:grid-cols-2 grid-rows-[1fr_1fr]";

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">{t.multiView.title}</h1>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length}/4 {t.multiView.streams}
        </span>

        {liveChannels.length > 0 && selectedIds.length < 4 && (
          <div className="flex items-center gap-3 flex-wrap overflow-visible py-1 min-w-0">
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
              {t.multiView.pickLive}:
            </span>
            {liveChannels.map((ch) => {
              const stream = liveChannelMap.get(ch.id);
              const alreadyAdded = stream ? selectedIds.includes(stream.id) : false;
              const name = getDisplayName(ch, locale);

              return (
                <Tooltip key={ch.id}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => !alreadyAdded && handleAddStream(ch.id)}
                      disabled={alreadyAdded}
                      className={`shrink-0 transition-all ${
                        alreadyAdded
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:scale-110 cursor-pointer"
                      }`}
                    >
                      <img
                        src={getChannelPhotoUrl(ch.photo)}
                        alt={name}
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (!img.dataset.fallbackTried) {
                            img.dataset.fallbackTried = "1";
                            img.src = `https://unavatar.io/youtube/${ch.id}`;
                            return;
                          }
                          img.onerror = null;
                          img.src = "/channel-placeholder.svg";
                        }}
                        className={`w-10 h-10 rounded-full object-cover ring-2 ring-live animate-pulse-live shadow-[0_0_10px_hsl(var(--live)/0.5)] ${
                          alreadyAdded ? "ring-muted-foreground animate-none shadow-none" : ""
                        }`}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{name} {alreadyAdded ? "✓" : ""}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}

        <div className="flex-1" />
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2 py-1.5 backdrop-blur-sm">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddWindow}
                disabled={selectedIds.length >= 4}
                className="hover:bg-primary/15"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.multiView.addWindow}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleToggleLayout} className="hover:bg-primary/15">
                <Grid2x2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{layoutMode === "grid" ? t.multiView.layoutGrid : t.multiView.layoutAuto}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleToggleMuteAll} className="hover:bg-primary/15">
                {allMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{allMuted ? t.multiView.unmute : t.multiView.muteAll}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleSaveConfig} className="hover:bg-primary/15">
                <Save className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.multiView.saveConfig}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" onClick={handleCopyConfigLink} className="hover:bg-primary/15">
                <Link2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.multiView.copyConfigLink}</TooltipContent>
          </Tooltip>
          {selectedIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clear} className="hover:bg-destructive/15 text-destructive hover:text-destructive">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {liveChannels.length === 0 && selectedIds.length < 4 && (
        <p className="text-xs text-muted-foreground">{t.multiView.noLive}</p>
      )}

      {/* Video Grid */}
      {selectedIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-muted-foreground">
          <Grid2x2 className="w-12 h-12" />
          <p>{t.multiView.empty}</p>
        </div>
      ) : (
        <div className={`grid ${gridClass} gap-2 flex-1 min-h-0`}>
          {selectedIds.map((videoId, index) => {
            const isPending = videoId.startsWith("pending-");

            return (
            <div
              key={videoId}
              draggable={!isPending}
              onDragStart={() => handleDragStart(videoId)}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(videoId)}
              className="relative rounded-lg overflow-hidden bg-card border border-border"
            >
              {isPending ? (
                // Placeholder window - elegant empty state
                <button
                  onClick={() => {
                    if (draggingId) return;
                    setPendingWindowIndex(index);
                    setShowClips(true);
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-muted-foreground hover:text-foreground transition-colors group"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Film className="w-8 h-8 text-primary/60 group-hover:text-primary/80" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-sm text-foreground">{t.multiView.selectVideo}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.multiView.clickToAdd}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(videoId);
                      }}
                      className="p-1.5 rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </button>
              ) : (
                <>
                  <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-background/70 px-1.5 py-1 text-muted-foreground backdrop-blur-sm">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <button
                    onClick={() => handleToggleSingleMute(videoId)}
                    className="absolute top-2 right-12 z-10 p-1 rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-foreground transition-colors"
                    title={mutedById[videoId] ? t.multiView.unmuteTile : t.multiView.muteTile}
                  >
                    {mutedById[videoId] ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleRemoveTile(index)}
                    className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <iframe
                    ref={(el) => {
                      if (el) iframeRefs.current.set(videoId, el);
                    }}
                    onLoad={() => applyMuteState(videoId, Boolean(mutedById[videoId]))}
                    src={buildYouTubeEmbedUrl(videoId, true, false)}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* Clips Overlay for selecting videos for pending window */}
      <ClipsOverlay
        open={showClips}
        onClose={() => {
          setShowClips(false);
          setPendingWindowIndex(null);
        }}
        onSelectClip={handleSelectClip}
        onTabChange={setClipsActiveTab}
        activeTab={clipsActiveTab}
        locale={locale}
        labels={{
          clipsTitle: t.multiView.title,
          clipsTab: t.favorites.clips,
          archivesTab: t.favorites.archives,
          favoriteOnly: t.sync.favoriteOnly,
          selectClipToAdd: locale === "zh-TW" ? "選擇影片加入多視窗" : locale === "ja" ? "動画を選択してマルチビューに追加" : "Select video to add to Multi-View",
          selectLiveToAdd: locale === "zh-TW" ? "選擇直播加入多視窗" : locale === "ja" ? "配信を選択してマルチビューに追加" : "Select live to add to Multi-View",
          selectArchiveToAdd: locale === "zh-TW" ? "選擇存檔加入多視窗" : locale === "ja" ? "アーカイブを選択してマルチビューに追加" : "Select archive to add to Multi-View",
          noClipsFound: t.sync.noClipsFound,
          noArchivesFound: t.sync.noArchivesFound,
          clipsLoading: t.sync.clipsLoading,
          archivesLoading: t.sync.archivesLoading,
          loadMore: t.common.loadMore,
          loading: t.common.loading,
          liveNow: t.sync.liveNow,
          noLive: t.sync.noLive,
          playlistsTab: t.sidebar.playlists,
        }}
      />
    </div>
  );
}
