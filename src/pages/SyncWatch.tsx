import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Radio, Copy, Plus, Users, RefreshCw, ArrowLeft, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncWatch, generateRoomId, type SyncState } from "@/hooks/useSyncWatch";
import { VideoQueue } from "@/components/sync/VideoQueue";
import { ClipsOverlay } from "@/components/sync/ClipsOverlay";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NicknameModal } from "@/components/sync/NicknameModal";
import { UserList } from "@/components/sync/UserList";

import { SystemMessages } from "@/components/sync/SystemMessages";
import { QueueCountdown } from "@/components/sync/QueueCountdown";
import { deserializeMedia, parseMediaInput, serializeMedia } from "@/lib/mediaSource";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => resolve();
  });
}

const SESSION_KEY = "sync-watch-session";

interface SessionData {
  roomId: string;
}

function saveSession(data: SessionData) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function loadSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export default function SyncWatch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { locale, t, username, avatar, setUsername } = useSettings();

  const roomParam = searchParams.get("room");
  const savedSession = useRef(loadSession()).current;
  const initialRoomCandidate = useRef(roomParam ?? savedSession?.roomId ?? null).current;

  const initialRoom = initialRoomCandidate;
  // Don't restore host from session — it's calculated dynamically from presence
  const initialHost = roomParam ? false : !savedSession;

  const [roomId, setRoomId] = useState<string | null>(initialRoom);
  const [isHost, setIsHost] = useState(initialHost);
  const [needsNickname, setNeedsNickname] = useState(!username && !!initialRoom);
  const [videoInput, setVideoInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [isValidatingInitialRoom, setIsValidatingInitialRoom] = useState(Boolean(initialRoomCandidate && !initialHost));
  const [sidebarTab, setSidebarTab] = useState<"members" | "chat" | "log" | "queue">("members");
  const [countdown, setCountdown] = useState<{ videoId: string; title?: string } | null>(null);
  const [mobileSection, setMobileSection] = useState<"sidebar" | "collapsed">("sidebar");
  const [showClips, setShowClips] = useState(false);
  const [clipsActiveTab, setClipsActiveTab] = useState<"live" | "archives" | "clips">("live");

  const playerRef = useRef<any>(null);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const suppressSyncRef = useRef(false);
  const effectiveHostRef = useRef(false);
  const guestControlEnabledRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const videoChangeLockRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  const [playerHeight, setPlayerHeight] = useState<number | null>(null);
  const currentMedia = useMemo(
    () => (currentVideoId ? deserializeMedia(currentVideoId) : null),
    [currentVideoId]
  );
  const mobileViewportStyle = isMobile
    ? { height: "calc(100dvh - 6.25rem - env(safe-area-inset-bottom, 0px))" }
    : undefined;

  const {
    syncState, peers, peerCount, lastEvent, guestControlEnabled,
    systemMessages, canControl, amIHost, myPeerId,
    broadcastSync, broadcastVideoChange, toggleGuestControl,
    onSyncRequestRef, notifyPlayerReady, resetState,
    queue, addToQueue, removeFromQueue, moveInQueue, playFromQueue, playNextFromQueue,
    SYNC_THRESHOLD,
  } = useSyncWatch({ roomId: needsNickname || isValidatingInitialRoom ? null : roomId, nickname: username, avatar, isHost });

  const effectiveHost = amIHost || (isHost && peerCount <= 1);
  useEffect(() => { effectiveHostRef.current = effectiveHost; }, [effectiveHost]);
  useEffect(() => { guestControlEnabledRef.current = guestControlEnabled; }, [guestControlEnabled]);
  useEffect(() => { currentVideoIdRef.current = currentVideoId; }, [currentVideoId]);

  // Keep playNextRef current for YT callback
  const doPlayNext = useCallback(() => {
    const next = playNextFromQueue();
    if (next) {
      setCountdown(null);
      setCurrentVideoId(next.videoId);
      videoChangeLockRef.current = true;
      setTimeout(() => { videoChangeLockRef.current = false; }, 3000);
      const state: SyncState = {
        videoId: next.videoId, isPlaying: true, currentTime: 0, timestamp: Date.now(),
      };
      broadcastVideoChange(state);
    }
  }, [playNextFromQueue, broadcastVideoChange]);

  // Keep playNextRef current for YT callback
  useEffect(() => {
    playNextRef.current = () => {
      // If there's a next item in queue, show countdown; otherwise do nothing
      if (queue.length > 0) {
        setCountdown({ videoId: queue[0].videoId, title: queue[0].title });
      }
    };
  }, [queue]);

  /** Get current host player state for re-align broadcast */
  const getHostState = useCallback((): SyncState | null => {
    if (!currentVideoIdRef.current) return null;

    const media = deserializeMedia(currentVideoIdRef.current);
    if (!media) return null;

    if (media.source === "youtube") {
      if (!playerRef.current?.getCurrentTime) return null;
      return {
        videoId: currentVideoIdRef.current,
        isPlaying: playerRef.current.getPlayerState?.() === window.YT?.PlayerState?.PLAYING,
        currentTime: playerRef.current.getCurrentTime(),
        timestamp: Date.now(),
      };
    }

    if (!directVideoRef.current) return null;
    return {
      videoId: currentVideoIdRef.current,
      isPlaying: !directVideoRef.current.paused,
      currentTime: directVideoRef.current.currentTime ?? 0,
      timestamp: Date.now(),
    };
  }, []);

  // Register the sync request handler so the host responds to new joiners
  useEffect(() => {
    if (onSyncRequestRef) {
      onSyncRequestRef.current = () => {
        if (!effectiveHostRef.current) return;
        const state = getHostState();
        if (state) broadcastSync(state);
      };
    }
  }, [onSyncRequestRef, getHostState, broadcastSync]);

  // Persist session (no host status stored)
  useEffect(() => {
    if (roomId && username) {
      saveSession({ roomId });
    }
  }, [roomId, username]);

  useEffect(() => {
    if (!initialRoomCandidate || initialHost) {
      setIsValidatingInitialRoom(false);
      return;
    }

    if (isHost || roomId !== initialRoomCandidate) {
      setIsValidatingInitialRoom(false);
      return;
    }

    let cancelled = false;
    setIsValidatingInitialRoom(true);

    validateRoomExists(initialRoomCandidate)
      .then((exists) => {
        if (cancelled) return;
        if (!exists) {
          toast.error(t.sync.roomNotFound);
          clearSession();
          setNeedsNickname(false);
          setRoomId(null);
          setSearchParams({});
        }
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(t.sync.roomValidationError);
        clearSession();
        setNeedsNickname(false);
        setRoomId(null);
        setSearchParams({});
      })
      .finally(() => {
        if (!cancelled) {
          setIsValidatingInitialRoom(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialHost, initialRoomCandidate, isHost, roomId, setSearchParams, t.sync.roomNotFound, t.sync.roomValidationError]);

  // When switching away from YouTube, destroy the player (container stays in DOM).
  useEffect(() => {
    if (!currentMedia || currentMedia.source === "youtube") return;
    if (playerRef.current?.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    // Clear any leftover YT-injected iframe from the stable container.
    if (playerContainerRef.current) {
      playerContainerRef.current.innerHTML = "";
    }
  }, [currentMedia]);

  // Imperatively manage direct video src to avoid React unmount/remount conflicts.
  useEffect(() => {
    const el = directVideoRef.current;
    if (!el) return;
    if (currentMedia?.source === "direct") {
      el.src = currentMedia.value;
      el.load();
      el.play().catch(() => { /* autoplay restriction is fine */ });
    } else {
      el.pause();
      el.removeAttribute("src");
      el.load(); // releases the media resource
    }
  }, [currentMedia]);

  // YouTube player init — YT operates on a freshly-created inner div so that
  // playerContainerRef (managed by React) is never replaced by the YT iframe.
  useEffect(() => {
    if (!currentVideoId || !playerContainerRef.current || currentMedia?.source !== "youtube") return;

    let cancelled = false;

    loadYouTubeAPI().then(() => {
      if (cancelled) return;

      if (playerRef.current) {
        playerRef.current.loadVideoById(currentMedia.value);
        return;
      }

      // Create a fresh inner target — YT will replace this with its iframe.
      // The outer container (playerContainerRef) stays stable so React never
      // operates on a detached node.
      const container = playerContainerRef.current!;
      container.innerHTML = "";
      const inner = document.createElement("div");
      container.appendChild(inner);

      playerRef.current = new window.YT.Player(inner, {
        videoId: currentMedia.value,
        width: "100%",
        height: "100%",
        playerVars: { autoplay: 1, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            notifyPlayerReady();
          },
          onStateChange: (event: any) => {
            // Auto-advance queue on video end (host only)
            if (event.data === window.YT.PlayerState.ENDED && effectiveHostRef.current) {
              playNextRef.current();
              return;
            }
            if (suppressSyncRef.current) return;
            if (!effectiveHostRef.current && !guestControlEnabledRef.current) return;
            const vid = currentVideoIdRef.current;
            if (!vid) return;
            const state: SyncState = {
              videoId: vid,
              isPlaying: event.data === window.YT.PlayerState.PLAYING,
              currentTime: event.target.getCurrentTime(),
              timestamp: Date.now(),
            };
            broadcastSync(state);
          },
        },
      });
    });

    return () => { cancelled = true; };
  }, [currentVideoId, currentMedia]);

  // Apply sync state: check video ID first, then seek
  useEffect(() => {
    if (!syncState) return;

    // Host ignores incoming sync unless guest control is on
    if (effectiveHost && !guestControlEnabled) return;

    // During video change lock, discard stale broadcasts with wrong video ID
    if (videoChangeLockRef.current && syncState.videoId !== currentVideoIdRef.current) return;

    // If different video, load it (from host's video_change broadcast)
    if (syncState.videoId !== currentVideoId) {
      setCurrentVideoId(syncState.videoId);
      return;
    }

    const media = deserializeMedia(syncState.videoId);
    if (!media) return;

    suppressSyncRef.current = true;

    const timeDrift = (Date.now() - syncState.timestamp) / 1000;
    const targetTime = syncState.currentTime + timeDrift + 0.5; // +0.5s latency compensation
    const currentPlayerTime = media.source === "youtube"
      ? (playerRef.current?.getCurrentTime?.() ?? 0)
      : (directVideoRef.current?.currentTime ?? 0);

    if (Math.abs(currentPlayerTime - targetTime) > SYNC_THRESHOLD) {
      if (media.source === "youtube") {
        if (playerRef.current?.seekTo) {
          // Strict sync: pause → seek → play for accuracy
          playerRef.current.pauseVideo();
          playerRef.current.seekTo(targetTime, true);
        }
      } else if (directVideoRef.current) {
        directVideoRef.current.pause();
        directVideoRef.current.currentTime = targetTime;
      }
    }

    if (syncState.isPlaying) {
      // Small delay to let buffer catch up after seek
      setTimeout(() => {
        if (media.source === "youtube") {
          playerRef.current?.playVideo();
        } else {
          directVideoRef.current?.play().catch(() => {
            // Ignore autoplay restriction errors.
          });
        }
      }, 150);
    } else {
      if (media.source === "youtube") {
        playerRef.current?.pauseVideo();
      } else {
        directVideoRef.current?.pause();
      }
    }

    setTimeout(() => { suppressSyncRef.current = false; }, 500);
  }, [syncState, effectiveHost, currentVideoId, guestControlEnabled]);

  const handleCreateRoom = useCallback(() => {
    if (!username.trim()) {
      setNeedsNickname(true);
      return;
    }
    const id = generateRoomId();
    setRoomId(id);
    setIsHost(true);
    setSearchParams({ room: id });
  }, [setSearchParams, username]);

  const handleJoinRoom = useCallback(() => {
    const id = joinInput.trim();
    if (!id || isJoiningRoom) return;

    setIsJoiningRoom(true);

    validateRoomExists(id)
      .then((exists) => {
        if (!exists) {
          toast.error(t.sync.roomNotFound);
          return;
        }

        setRoomId(id);
        setIsHost(false);
        setSearchParams({ room: id });
        if (!username.trim()) setNeedsNickname(true);
      })
      .catch(() => {
        toast.error(t.sync.roomValidationError);
      })
      .finally(() => {
        setIsJoiningRoom(false);
      });
  }, [isJoiningRoom, joinInput, setSearchParams, t.sync.roomNotFound, t.sync.roomValidationError, username]);

  const handleNicknameConfirm = useCallback((name: string) => {
    setUsername(name);
    setNeedsNickname(false);
    if (!roomId) {
      const id = generateRoomId();
      setRoomId(id);
      setIsHost(true);
      setSearchParams({ room: id });
    }
  }, [roomId, setSearchParams, setUsername]);

  const handleLoadVideo = useCallback(() => {
    if (!effectiveHost && !guestControlEnabled) return;
    const media = parseMediaInput(videoInput);
    if (!media) return;
    const serialized = serializeMedia(media);
    setCurrentVideoId(serialized);
    videoChangeLockRef.current = true;
    setTimeout(() => { videoChangeLockRef.current = false; }, 3000);
    const state: SyncState = {
      videoId: serialized, isPlaying: true, currentTime: 0, timestamp: Date.now(),
    };
    broadcastVideoChange(state);
    setVideoInput("");
  }, [videoInput, broadcastVideoChange, effectiveHost, guestControlEnabled]);

  const handleSelectClip = useCallback((videoId: string, _title: string) => {
    if (!effectiveHost && !guestControlEnabled) return;
    const serialized = serializeMedia({ source: "youtube", value: videoId });
    setCurrentVideoId(serialized);
    videoChangeLockRef.current = true;
    setTimeout(() => { videoChangeLockRef.current = false; }, 3000);
    const state: SyncState = {
      videoId: serialized, isPlaying: true, currentTime: 0, timestamp: Date.now(),
    };
    broadcastVideoChange(state);
    setShowClips(false);
  }, [broadcastVideoChange, effectiveHost, guestControlEnabled]);

  const handlePlayFromQueue = useCallback((itemId: string) => {
    if (!effectiveHost && !guestControlEnabled) return;
    const item = playFromQueue(itemId);
    if (!item) return;
    setCurrentVideoId(item.videoId);
    videoChangeLockRef.current = true;
    setTimeout(() => { videoChangeLockRef.current = false; }, 3000);
    const state: SyncState = {
      videoId: item.videoId, isPlaying: true, currentTime: 0, timestamp: Date.now(),
    };
    broadcastVideoChange(state);
  }, [effectiveHost, guestControlEnabled, playFromQueue, broadcastVideoChange]);

  const copyInviteLink = useCallback(() => {
    const basePath = import.meta.env.BASE_URL || "/";
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    const url = `${window.location.origin}${normalizedBase}#/sync?room=${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success(t.sync.inviteCopied);
  }, [roomId, t.sync.inviteCopied]);

  const handleLeaveRoom = useCallback(() => {
    clearSession();
    resetState();
    setRoomId(null);
    setIsHost(true);
    setCurrentVideoId(null);
    setVideoInput("");
    setJoinInput("");
    if (playerRef.current?.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    setSearchParams({});
  }, [setSearchParams, resetState]);

  const handleToggleGuestControl = useCallback((enabled: boolean) => {
    toggleGuestControl(enabled, enabled ? null : getHostState());
  }, [toggleGuestControl, getHostState]);

  const handleDirectVideoSync = useCallback(() => {
    if (suppressSyncRef.current) return;
    if (!effectiveHostRef.current && !guestControlEnabledRef.current) return;
    const vid = currentVideoIdRef.current;
    if (!vid || !directVideoRef.current) return;
    const state: SyncState = {
      videoId: vid,
      isPlaying: !directVideoRef.current.paused,
      currentTime: directVideoRef.current.currentTime ?? 0,
      timestamp: Date.now(),
    };
    broadcastSync(state);
  }, [broadcastSync]);

  const handleDirectVideoReady = useCallback(() => {
    notifyPlayerReady();
  }, [notifyPlayerReady]);

  const handleDirectVideoEnded = useCallback(() => {
    if (!effectiveHostRef.current) return;
    playNextRef.current();
  }, []);

  const handleNicknameCancel = useCallback(() => {
    setNeedsNickname(false);
    setJoinInput("");
    if (roomId && !username.trim()) {
      setRoomId(null);
      setSearchParams({});
    }
  }, [roomId, username, setSearchParams]);

  // Track player area height for sidebar max-height
  useEffect(() => {
    if (isMobile || !playerAreaRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setPlayerHeight(entry.contentRect.height);
    });
    ro.observe(playerAreaRef.current);
    return () => ro.disconnect();
  }, [isMobile, currentVideoId]);

  if (isValidatingInitialRoom) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Radio className="w-10 h-10 text-primary mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">{t.common.loading}</p>
        </div>
      </div>
    );
  }

  // Nickname modal
  if (needsNickname) {
    return <NicknameModal open={true} onConfirm={handleNicknameConfirm} onCancel={handleNicknameCancel} locale={locale} />;
  }

  // Lobby
  if (!roomId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <Radio className="w-12 h-12 text-primary mx-auto" />
            <h1 className="text-3xl font-bold text-foreground">{t.sync.syncWatch}</h1>
            <p className="text-muted-foreground text-sm">{t.sync.createDesc}</p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleCreateRoom}
              className="w-full gap-2 min-h-[48px]"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              {t.sync.createRoom}
            </Button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{t.sync.orJoin}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className={cn("gap-2", isMobile ? "grid grid-cols-1" : "flex")}>
              <Input
                placeholder={t.sync.enterRoom}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="flex-1 min-h-[48px]"
                disabled={isJoiningRoom}
              />
              <Button onClick={handleJoinRoom} variant="secondary" className="min-h-[48px]" disabled={isJoiningRoom || !joinInput.trim()}>
                {isJoiningRoom ? t.common.loading : t.sync.join}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }



  // Sidebar component (always rendered in room)
  const sidebar = (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card/40 overflow-hidden flex flex-col",
        isMobile ? "w-full" : "w-[300px] shrink-0"
      )}
      style={{
        ...(isMobile
          ? { height: mobileSection === "collapsed" ? "auto" : "50dvh", maxHeight: "50dvh" }
          : playerHeight ? { maxHeight: playerHeight } : {}
        ),
      }}
    >

      <div className={cn(
        "border-b border-border/30 bg-card/60",
        isMobile ? "grid grid-cols-4 gap-1 p-1.5" : "flex"
      )}>
        {(["members", "chat", "queue", "log"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setSidebarTab(tab);
              if (isMobile) setMobileSection("sidebar");
            }}
            className={cn(
              isMobile
                ? "min-h-[42px] rounded-md px-1.5 text-[11px] font-medium transition-colors"
                : "flex-1 text-xs min-h-[44px] font-medium transition-colors",
              sidebarTab === tab
                ? isMobile
                  ? "bg-primary/12 text-primary"
                  : "text-primary border-b-2 border-primary"
                : isMobile
                  ? "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "members" ? `${t.sync.members} (${peerCount})`
              : tab === "chat" ? t.sync.chat
              : tab === "queue" ? `${t.sync.queue}${queue.length > 0 ? ` (${queue.length})` : ""}`
              : t.sync.log}
          </button>
        ))}
      </div>

      {(!isMobile || mobileSection !== "collapsed") && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {sidebarTab === "members" && (
            <div className={`p-3 overflow-y-auto h-full ${TAB_PANEL_TRANSITION_CLASS}`}>
              <UserList
                peers={peers}
                myPeerId={myPeerId}
                amIHost={effectiveHost}
                guestControlEnabled={guestControlEnabled}
                onToggleGuestControl={handleToggleGuestControl}
                locale={locale}
              />
            </div>
          )}
          {sidebarTab === "chat" && (
            <div className={`h-full ${TAB_PANEL_TRANSITION_CLASS} flex flex-col`}>
              {currentMedia?.source === "youtube" ? (
                <iframe
                  key={currentMedia.value}
                  src={`https://www.youtube.com/live_chat?v=${currentMedia.value}&embed_domain=${window.location.hostname}`}
                  className="w-full flex-1 border-0"
                  allow="clipboard-write"
                  title="YouTube Live Chat"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground text-xs text-center p-4 opacity-60">
                  <span>播放 YouTube 影片後</span>
                  <span>即可顯示直播聊天室</span>
                </div>
              )}
            </div>
          )}
          {sidebarTab === "queue" && (
            <div className={`h-full ${TAB_PANEL_TRANSITION_CLASS}`}>
              <VideoQueue
                queue={queue}
                isHost={effectiveHost || (guestControlEnabled && !!roomId)}
                onAdd={addToQueue}
                onRemove={removeFromQueue}
                onMove={moveInQueue}
                onPlay={handlePlayFromQueue}
                locale={locale}
              />
            </div>
          )}
          {sidebarTab === "log" && (
            <div className={`h-full min-h-0 ${TAB_PANEL_TRANSITION_CLASS}`}>
              <SystemMessages messages={systemMessages} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Active room
  return (
    <div
      className={cn("space-y-3", isMobile && "flex flex-col overflow-hidden")}
      style={mobileViewportStyle}
    >
      {/* Room header */}
      <div className={cn("shrink-0 gap-2 md:gap-3", isMobile ? "grid grid-cols-2" : "flex flex-wrap items-center")}>
        <div className={cn("flex items-center gap-2", isMobile && "col-span-2") }>
          <Radio className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">{t.sync.syncWatch}</h1>
        </div>

        <div className={cn(
          "flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2",
          isMobile && "min-h-[48px]"
        )}>
          <span className="text-xs text-muted-foreground font-mono">{t.sync.room}: {roomId}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded font-semibold",
            effectiveHost ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
          )}>
            {effectiveHost ? t.sync.host : t.sync.guest}
          </span>
        </div>

        <div className={cn(
          "flex items-center gap-1 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground",
          isMobile && "min-h-[48px] justify-center"
        )}>
          <Users className="w-3.5 h-3.5" />
          <span>{peerCount}</span>
        </div>

        <div className={cn("flex items-center gap-2", isMobile ? "col-span-2 grid grid-cols-2" : "ml-auto") }>
          <Button size="sm" variant="outline" className="gap-1.5 min-h-[46px] md:min-h-0" onClick={copyInviteLink}>
            <Copy className="w-3.5 h-3.5" />
            <span>{t.sync.copyInvite}</span>
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 min-h-[46px] md:min-h-0 text-destructive" onClick={handleLeaveRoom}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.sync.leave}</span>
          </Button>
        </div>
      </div>

      {/* Video input bar */}
      {(effectiveHost || guestControlEnabled) ? (
        <div className={cn("shrink-0", isMobile ? "space-y-2" : "flex items-center gap-2")}>
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0",
            isMobile ? "inline-flex" : "hidden sm:block",
            guestControlEnabled
              ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
              : "bg-primary/15 text-primary border border-primary/25"
          )}>
            {guestControlEnabled ? t.sync.freeControl : t.sync.hostMode}
          </span>
          <div className={cn(isMobile ? "space-y-2" : "flex flex-1 items-center gap-2")}>
            <Input
              placeholder={t.sync.pasteUrl}
              value={videoInput}
              onChange={(e) => setVideoInput(e.target.value)}
              className="flex-1 min-h-[46px] md:min-h-0"
              onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
            />
            <div className={cn(isMobile ? "grid grid-cols-2 gap-2" : "flex items-center gap-2") }>
              <Button onClick={handleLoadVideo} className="gap-1.5 min-h-[46px] shrink-0 md:min-h-0">
                {t.sync.loadVideo}
              </Button>
              <Button
                onClick={() => setShowClips(true)}
                variant="outline"
                className="gap-1.5 min-h-[46px] shrink-0 md:min-h-0"
              >
                <Film className="w-4 h-4" />
                {t.sync.openClips}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border/40 bg-muted/30 text-muted-foreground text-sm select-none shrink-0">
          <Radio className="w-4 h-4 opacity-50 shrink-0" />
          <span>{t.sync.hostOnlyVideo}</span>
        </div>
      )}

      {/* Sync notification */}
      {lastEvent && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary animate-in fade-in slide-in-from-top-2 duration-300 shrink-0">
          <RefreshCw className="w-4 h-4 animate-spin" />
          {lastEvent}
        </div>
      )}

      {/* Clips Overlay */}
      <ClipsOverlay
        open={showClips}
        onClose={() => setShowClips(false)}
        onSelectClip={handleSelectClip}
        onTabChange={setClipsActiveTab}
        activeTab={clipsActiveTab}
        locale={locale}
        labels={{
          clipsTitle: t.sync.clipsTitle,
          clipsTab: t.favorites.clips,
          archivesTab: t.favorites.archives,
          favoriteOnly: t.sync.favoriteOnly,
          selectClipToAdd: t.sync.selectClipToAdd,
          selectLiveToAdd: t.sync.selectLiveToAdd,
          selectArchiveToAdd: t.sync.selectArchiveToAdd,
          noClipsFound: t.sync.noClipsFound,
          noArchivesFound: t.sync.noArchivesFound,
          clipsLoading: t.sync.clipsLoading,
          archivesLoading: t.sync.archivesLoading,
          loadMore: t.common.loadMore,
          loading: t.common.loading,
          liveNow: t.sync.liveNow,
          noLive: t.sync.noLive,
        }}
      />

      {/* Main content: always show sidebar */}
      <div className={cn(
        "flex gap-3",
        isMobile ? "flex-col flex-1 min-h-0 overflow-y-auto" : "flex-row items-stretch"
      )}>
        {/* Video player area — sticky on mobile */}
        <div ref={playerAreaRef} className={cn("min-w-0", isMobile ? "w-full sticky top-0 z-10 shrink-0" : "flex-[3]")}>
          {currentVideoId ? (
            <div className="aspect-video rounded-lg overflow-hidden bg-black relative">
              {/*
               * Both containers are always mounted. Hiding via CSS rather than
               * conditional rendering avoids the YT iframe API operating on a
               * React-unmounted (detached) DOM node, which would corrupt the page.
               */}
              <div
                ref={playerContainerRef}
                className="absolute inset-0"
                style={{ display: currentMedia?.source === "youtube" ? "block" : "none" }}
              />
              <video
                ref={directVideoRef}
                playsInline
                controls
                className="w-full h-full"
                style={{ display: currentMedia?.source === "direct" ? "block" : "none" }}
                onLoadedMetadata={handleDirectVideoReady}
                onPlay={handleDirectVideoSync}
                onPause={handleDirectVideoSync}
                onSeeked={handleDirectVideoSync}
                onEnded={handleDirectVideoEnded}
              />
              {countdown && (
                <QueueCountdown
                  nextTitle={countdown.title}
                  duration={5}
                  onComplete={doPlayNext}
                  onCancel={() => setCountdown(null)}
                />
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-lg border border-dashed border-border bg-card/30 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Radio className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
                <p className="text-muted-foreground text-sm">
                  {effectiveHost ? t.sync.hostWaiting : t.sync.guestWaiting}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar — always visible */}
        {sidebar}
      </div>
    </div>
  );
}

async function validateRoomExists(roomId: string): Promise<boolean> {
  const probe = supabase.channel(`sync-watch:${roomId}`);

  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = async (result: boolean) => {
      if (settled) return;
      settled = true;
      await probe.unsubscribe();
      resolve(result);
    };

    const fail = async () => {
      if (settled) return;
      settled = true;
      await probe.unsubscribe();
      reject(new Error("room_probe_failed"));
    };

    probe
      .on("presence", { event: "sync" }, () => {
        const presence = probe.presenceState();
        const hasPeers = Object.values(presence).some((entries) => Array.isArray(entries) && entries.length > 0);
        if (hasPeers) {
          void finish(true);
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          const presence = probe.presenceState();
          const hasPeers = Object.values(presence).some((entries) => Array.isArray(entries) && entries.length > 0);

          if (hasPeers) {
            void finish(true);
            return;
          }

          window.setTimeout(() => {
            const latestPresence = probe.presenceState();
            const stillHasPeers = Object.values(latestPresence).some((entries) => Array.isArray(entries) && entries.length > 0);
            void finish(stillHasPeers);
          }, 1200);
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          void fail();
        }
      });
  });
}
