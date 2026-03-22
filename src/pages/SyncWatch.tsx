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
import { translations } from "@/lib/i18n";
import { toast } from "sonner";
import { NicknameModal } from "@/components/sync/NicknameModal";
import { UserList } from "@/components/sync/UserList";
import { ChatPanel } from "@/components/sync/ChatPanel";
import { SystemMessages } from "@/components/sync/SystemMessages";
import { QueueCountdown } from "@/components/sync/QueueCountdown";
import { deserializeMedia, parseMediaInput, serializeMedia } from "@/lib/mediaSource";

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
  nickname: string;
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

/** Auto-detect locale from navigator.language */
function detectLocale(): "en" | "zh-TW" | "ja" {
  const lang = navigator.language || "en";
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("zh")) return "zh-TW";
  return "en";
}

const labels = {
  en: {
    syncWatch: "Sync Watch",
    createRoom: "Create a Watch Room",
    orJoin: "or join",
    enterRoom: "Enter room ID (e.g. abcd-123)",
    join: "Join",
    room: "Room",
    host: "HOST",
    guest: "GUEST",
    copyInvite: "Copy Invite",
    leave: "Leave",
    loadVideo: "Load Video",
    pasteUrl: "Paste YouTube URL, video ID, or direct video URL...",
    syncing: "Syncing...",
    members: "Members",
    chat: "Chat",
    log: "Log",
    hostWaiting: "Paste a video link above to start watching",
    guestWaiting: "Waiting for host to load a video...",
    createDesc: "Create or join a watch room to sync playback with friends",
    showChat: "Show Chat",
    setNickname: "Set Nickname",
    nicknamePlaceholder: "Your nickname...",
    joinRoom: "Join Room",
    enterNickname: "Enter a nickname to join the watch room.",
    allowGuest: "Allow Guest Control",
    hostLabel: "Host",
    guestLabel: "Guest",
    hostOnlyVideo: "Only the Host can change the video",
    queue: "Queue",
    hostMode: "Host Mode",
    freeControl: "Free Control",
  },
  "zh-TW": {
    syncWatch: "同步觀看",
    createRoom: "建立觀看房間",
    orJoin: "或加入",
    enterRoom: "輸入房間 ID（例如 abcd-123）",
    join: "加入",
    room: "房間",
    host: "房主",
    guest: "訪客",
    copyInvite: "複製邀請連結",
    leave: "離開",
    loadVideo: "載入影片",
    pasteUrl: "貼上 YouTube 網址、影片 ID 或直連影片網址...",
    syncing: "同步中...",
    members: "成員",
    chat: "聊天",
    log: "紀錄",
    hostWaiting: "在上方貼上影片連結開始觀看",
    guestWaiting: "等待房主載入影片...",
    createDesc: "建立或加入觀看房間，與朋友同步播放",
    showChat: "顯示聊天室",
    setNickname: "設定暱稱",
    nicknamePlaceholder: "你的暱稱...",
    joinRoom: "加入房間",
    enterNickname: "輸入暱稱以加入觀看房間。",
    allowGuest: "允許訪客控制",
    hostLabel: "房主",
    guestLabel: "訪客",
    hostOnlyVideo: "只有房主可以更換影片",
    queue: "待播",
    hostMode: "房主模式",
    freeControl: "自由控制",
  },
  ja: {
    syncWatch: "同時視聴",
    createRoom: "視聴ルームを作成",
    orJoin: "または参加",
    enterRoom: "ルームIDを入力",
    join: "参加",
    room: "ルーム",
    host: "ホスト",
    guest: "ゲスト",
    copyInvite: "招待リンクをコピー",
    leave: "退出",
    loadVideo: "動画を読み込む",
    pasteUrl: "YouTube URL、動画ID、または直接動画URLを貼り付け...",
    syncing: "同期中...",
    members: "メンバー",
    chat: "チャット",
    log: "ログ",
    hostWaiting: "上に動画リンクを貼り付けて視聴開始",
    guestWaiting: "ホストが動画を読み込むのを待っています...",
    createDesc: "視聴ルームを作成または参加して、友達と再生を同期",
    showChat: "チャットを表示",
    setNickname: "ニックネームを設定",
    nicknamePlaceholder: "あなたのニックネーム...",
    joinRoom: "ルームに参加",
    enterNickname: "ニックネームを入力してルームに参加してください。",
    allowGuest: "ゲスト操作を許可",
    hostLabel: "ホスト",
    guestLabel: "ゲスト",
    hostOnlyVideo: "ホストのみが動画を変更できます",
    queue: "キュー",
    hostMode: "ホストモード",
    freeControl: "フリー操作",
  },
} as const;

export default function SyncWatch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const locale = useMemo(detectLocale, []);
  const l = labels[locale];

  const roomParam = searchParams.get("room");
  const savedSession = useRef(loadSession()).current;

  const initialRoom = roomParam ?? savedSession?.roomId ?? null;
  // Don't restore host from session — it's calculated dynamically from presence
  const initialHost = roomParam ? false : !savedSession;
  const initialNickname = savedSession?.nickname ?? "";

  const [roomId, setRoomId] = useState<string | null>(initialRoom);
  const [isHost, setIsHost] = useState(initialHost);
  const [nickname, setNickname] = useState(initialNickname);
  const [needsNickname, setNeedsNickname] = useState(!initialNickname && !!initialRoom);
  const [videoInput, setVideoInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"members" | "chat" | "log" | "queue">("members");
  const [countdown, setCountdown] = useState<{ videoId: string; title?: string } | null>(null);
  const [mobileSection, setMobileSection] = useState<"sidebar" | "collapsed">("sidebar");
  const [showClips, setShowClips] = useState(false);

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

  const {
    syncState, peers, peerCount, lastEvent, guestControlEnabled,
    chatMessages, systemMessages, canControl, amIHost, myPeerId,
    broadcastSync, broadcastVideoChange, toggleGuestControl,
    sendChatMessage, onSyncRequestRef, notifyPlayerReady, resetState,
    queue, addToQueue, removeFromQueue, moveInQueue, playFromQueue, playNextFromQueue,
    SYNC_THRESHOLD,
  } = useSyncWatch({ roomId: needsNickname ? null : roomId, nickname, isHost });

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
    if (roomId && nickname) {
      saveSession({ roomId, nickname });
    }
  }, [roomId, nickname]);

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
    if (!nickname) {
      setNeedsNickname(true);
      return;
    }
    const id = generateRoomId();
    setRoomId(id);
    setIsHost(true);
    setSearchParams({ room: id });
  }, [setSearchParams, nickname]);

  const handleJoinRoom = useCallback(() => {
    const id = joinInput.trim();
    if (!id) return;
    setRoomId(id);
    setIsHost(false);
    setSearchParams({ room: id });
    if (!nickname) setNeedsNickname(true);
  }, [joinInput, setSearchParams, nickname]);

  const handleNicknameConfirm = useCallback((name: string) => {
    setNickname(name);
    setNeedsNickname(false);
    if (!roomId) {
      const id = generateRoomId();
      setRoomId(id);
      setIsHost(true);
      setSearchParams({ room: id });
    }
  }, [roomId, setSearchParams]);

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
    const url = `${window.location.origin}/sync?room=${roomId}`;
    navigator.clipboard.writeText(url);
    toast.success(locale === "zh-TW" ? "已複製邀請連結！" : locale === "ja" ? "招待リンクをコピーしました！" : "Invite link copied!");
  }, [roomId, locale]);

  const handleLeaveRoom = useCallback(() => {
    clearSession();
    resetState();
    setRoomId(null);
    setIsHost(true);
    setNickname("");
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
    if (roomId && !nickname) {
      setRoomId(null);
      setSearchParams({});
    }
  }, [roomId, nickname, setSearchParams]);

  // Track player area height for sidebar max-height
  useEffect(() => {
    if (isMobile || !playerAreaRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setPlayerHeight(entry.contentRect.height);
    });
    ro.observe(playerAreaRef.current);
    return () => ro.disconnect();
  }, [isMobile, currentVideoId]);

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
            <h1 className="text-3xl font-bold text-foreground">{l.syncWatch}</h1>
            <p className="text-muted-foreground text-sm">{l.createDesc}</p>
          </div>

          <div className="space-y-4">
            <Button onClick={() => { setNeedsNickname(true); setIsHost(true); }} className="w-full gap-2" size="lg">
              <Plus className="w-5 h-5" />
              {l.createRoom}
            </Button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">{l.orJoin}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={l.enterRoom}
                value={joinInput}
                onChange={(e) => setJoinInput(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleJoinRoom} variant="secondary">
                {l.join}
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

      <div className="flex border-b border-border/30 bg-card/60">
        {(["members", "chat", "queue", "log"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setSidebarTab(tab);
              if (isMobile) setMobileSection("sidebar");
            }}
            className={cn(
              "flex-1 text-xs min-h-[44px] font-medium transition-colors",
              sidebarTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "members" ? `${l.members} (${peerCount})`
              : tab === "chat" ? l.chat
              : tab === "queue" ? `${l.queue}${queue.length > 0 ? ` (${queue.length})` : ""}`
              : l.log}
          </button>
        ))}
      </div>

      {(!isMobile || mobileSection !== "collapsed") && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {sidebarTab === "members" && (
            <div className="p-3 overflow-y-auto h-full">
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
            <ChatPanel
              messages={chatMessages}
              onSend={sendChatMessage}
              myNickname={nickname}
            />
          )}
          {sidebarTab === "queue" && (
            <VideoQueue
              queue={queue}
              isHost={effectiveHost || (guestControlEnabled && !!roomId)}
              onAdd={addToQueue}
              onRemove={removeFromQueue}
              onMove={moveInQueue}
              onPlay={handlePlayFromQueue}
              locale={locale}
            />
          )}
          {sidebarTab === "log" && (
            <div className="h-full min-h-0">
              <SystemMessages messages={systemMessages} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Active room
  return (
    <div className={cn("space-y-3", isMobile && "h-[calc(100dvh-4rem)] flex flex-col overflow-hidden")}>
      {/* Room header */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">{l.syncWatch}</h1>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
          <span className="text-xs text-muted-foreground font-mono">{l.room}: {roomId}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded font-semibold",
            effectiveHost ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
          )}>
            {effectiveHost ? l.host : l.guest}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{peerCount}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" variant="outline" className="gap-1.5 min-h-[44px] md:min-h-0" onClick={copyInviteLink}>
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{l.copyInvite}</span>
          </Button>
          <Button size="sm" variant="ghost" className="gap-1.5 min-h-[44px] md:min-h-0 text-destructive" onClick={handleLeaveRoom}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{l.leave}</span>
          </Button>
        </div>
      </div>

      {/* Video input bar */}
      {(effectiveHost || guestControlEnabled) ? (
        <div className="flex gap-2 items-center shrink-0">
          <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0 hidden sm:block",
            guestControlEnabled
              ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
              : "bg-primary/15 text-primary border border-primary/25"
          )}>
            {guestControlEnabled ? l.freeControl : l.hostMode}
          </span>
          <Input
            placeholder={l.pasteUrl}
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            className="flex-1 min-h-[44px] md:min-h-0"
            onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
          />
          <Button onClick={handleLoadVideo} className="gap-1.5 shrink-0 min-h-[44px] md:min-h-0">
            {l.loadVideo}
          </Button>
          <Button
            onClick={() => setShowClips(true)}
            variant="outline"
            className="gap-1.5 shrink-0 min-h-[44px] md:min-h-0"
          >
            <Film className="w-4 h-4" />
            {translations[locale].sync.openClips}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border/40 bg-muted/30 text-muted-foreground text-sm select-none shrink-0">
          <Radio className="w-4 h-4 opacity-50 shrink-0" />
          <span>{l.hostOnlyVideo}</span>
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
        locale={locale}
        labels={{
          clipsTitle: translations[locale].sync.clipsTitle,
          selectClipToAdd: translations[locale].sync.selectClipToAdd,
          noClipsFound: translations[locale].sync.noClipsFound,
          clipsLoading: translations[locale].sync.clipsLoading,
          loadMore: translations[locale].common.loadMore,
          loading: translations[locale].common.loading,
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
                  {effectiveHost ? l.hostWaiting : l.guestWaiting}
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
