import { useMultiView } from "@/contexts/MultiViewContext";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X, Grid2x2, Columns2, VolumeX, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useSettings } from "@/contexts/SettingsContext";
import { useHolodexStreams, useHololiveChannels } from "@/hooks/useHolodex";
import { getDisplayName, getChannelPhotoUrl } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Layout = "2x2" | "1x2";

export default function MultiView() {
  const { selectedIds, toggle, clear } = useMultiView();
  const navigate = useNavigate();
  const { locale, t } = useSettings();
  const { data } = useHolodexStreams();
  const { data: channels } = useHololiveChannels();
  const [layout, setLayout] = useState<Layout>(selectedIds.length <= 2 ? "1x2" : "2x2");
  const [allMuted, setAllMuted] = useState(false);
  const iframeRefs = useRef<Map<string, HTMLIFrameElement>>(new Map());

  const liveStreams = data?.live ?? [];

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
      toggle(stream.id, {
        channelId: stream.channel.id,
        channelName: stream.channel.name,
        viewers: stream.live_viewers,
      });
    }
  };

  const handleRemoveStream = (videoId: string) => {
    toggle(videoId);
  };

  const handleToggleMuteAll = () => {
    setAllMuted((v) => !v);
  };

  const gridClass =
    layout === "2x2"
      ? "grid-cols-1 sm:grid-cols-2 grid-rows-[1fr_1fr]"
      : "grid-cols-1 sm:grid-cols-2 grid-rows-1";

  return (
    <div className="flex flex-col h-[calc(100vh-3rem)] gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-3 shrink-0 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-bold text-foreground">{t.multiView.title}</h1>
        <span className="text-xs text-muted-foreground">
          {selectedIds.length}/4 {t.multiView.streams}
        </span>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleMuteAll}
        >
          {allMuted ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
          {allMuted ? t.multiView.unmute : t.multiView.muteAll}
        </Button>
        <Button
          variant={layout === "1x2" ? "default" : "outline"}
          size="sm"
          onClick={() => setLayout("1x2")}
        >
          <Columns2 className="w-4 h-4 mr-1" />
          1×2
        </Button>
        <Button
          variant={layout === "2x2" ? "default" : "outline"}
          size="sm"
          onClick={() => setLayout("2x2")}
        >
          <Grid2x2 className="w-4 h-4 mr-1" />
          2×2
        </Button>
        {selectedIds.length > 0 && (
          <Button variant="destructive" size="sm" onClick={clear}>
            {t.multiView.clearAll}
          </Button>
        )}
      </div>

      {/* Live Avatars Row */}
      {liveChannels.length > 0 && selectedIds.length < 4 && (
        <div className="shrink-0 flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
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

      {liveChannels.length === 0 && (
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
          {selectedIds.map((videoId) => (
            <div
              key={videoId}
              className="relative rounded-lg overflow-hidden bg-card border border-border"
            >
              <button
                onClick={() => handleRemoveStream(videoId)}
                className="absolute top-2 right-2 z-10 p-1 rounded-full bg-background/70 backdrop-blur-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <iframe
                ref={(el) => {
                  if (el) iframeRefs.current.set(videoId, el);
                }}
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${allMuted ? 1 : 0}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
