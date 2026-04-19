/**
 * @file src/pages/SyncWatch.tsx
 * @description 核心的影音同步房間 (SyncWatch 系統)。
 * 啟動與管理 YouTube 或直接媒體的播放器，處理 WebSocket 狀態廣播、會員進出管理以及播放列的同步。
 * 這是專案內最複雜的頁面，所有的副作用 (useEffect) 都牽涉到時序校準 (Time Drift)。
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Hls from "hls.js";
import { useSearchParams } from "react-router-dom";
import { Radio, Copy, Plus, Users, RefreshCw, ArrowLeft, Wifi, WifiOff, RotateCcw, VolumeX, Play, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSyncWatch, generateRoomId, type SyncState } from "@/hooks/useSyncWatch";
import { VideoQueue } from "@/components/sync/VideoQueue";
import { ClipsOverlay } from "@/components/sync/ClipsOverlay";
import { RoomCard } from "@/components/sync/RoomCard";
import { useRoomsList, upsertRoom, deactivateRoom, heartbeatRoom, updateRoomInfo } from "@/hooks/useRoomsList";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { getYouTubeIframeApiUrl, buildYouTubeLiveChatUrl } from "@/lib/urls";
import { showSuccess, showValidationError } from "@/lib/errors";
import { NicknameModal } from "@/components/sync/NicknameModal";
import { UserList } from "@/components/sync/UserList";

import { SystemMessages } from "@/components/sync/SystemMessages";
import { QueueCountdown } from "@/components/sync/QueueCountdown";
import { deserializeMedia, parseMediaInput, serializeMedia } from "@/lib/mediaSource";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";
import {
  buildJellyfinMasterUrl,
  buildJellyfinMp4FallbackUrl,
  isJellyfinDownloadUrl,
  parseJellyfinUrl,
} from "@/lib/jellyfin";

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
    tag.src = getYouTubeIframeApiUrl();
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
  const initialRoomValidationDoneRef = useRef(false);

  const initialRoom = initialRoomCandidate;
  // Re-entering an existing room should not reclaim host automatically.
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
  const [clipsActiveTab, setClipsActiveTab] = useState<"live" | "archives" | "clips" | "playlists" | "jellyfin">("live");
  const [directPausedFrame, setDirectPausedFrame] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [browserUnsupported, setBrowserUnsupported] = useState(false);
  const [showSafariHlsWarning, setShowSafariHlsWarning] = useState(false);
  const hlsFallbackUrlRef = useRef<string | null>(null);

  const playerRef = useRef<any>(null);
  const directVideoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerAreaRef = useRef<HTMLDivElement>(null);
  const suppressSyncRef = useRef(false);
  const suppressTimeoutRef = useRef<number | null>(null);
  const videoChangeLockTimeoutRef = useRef<number | null>(null);
  const localSwitchSuppressTimeoutRef = useRef<number | null>(null);
  const ignoreDirectPauseUntilRef = useRef(0);
  const directWasPlayingBeforeSeekRef = useRef(false);
  const effectiveHostRef = useRef(false);
  const guestControlEnabledRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const videoChangeLockRef = useRef(false);
  const lastAppliedSyncSentAtRef = useRef(0);
  const lastAppliedVideoSwitchSentAtRef = useRef(0);
  const lastLocalVideoChangeAtRef = useRef(0);
  const playNextRef = useRef<() => void>(() => { });
  const lastGuestApplyAtRef = useRef(0);
  const guestAutoplayKickDoneForRef = useRef<string | null>(null);
  const jellyfinTranscodeAttemptedRef = useRef<string | null>(null);
  const [needsGuestUnmute, setNeedsGuestUnmute] = useState(false);
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
    SYNC_THRESHOLD, requestSync, connectionStatus,
  } = useSyncWatch({ roomId: needsNickname || isValidatingInitialRoom ? null : roomId, nickname: username, avatar, isHost });

  const effectiveHost = amIHost || (isHost && peerCount <= 1);
  const connectionBadge = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return {
          icon: Wifi,
          label: t.sync.connected,
          className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
        };
      case "reconnecting":
        return {
          icon: RefreshCw,
          label: t.sync.reconnecting,
          className: "border-amber-500/25 bg-amber-500/10 text-amber-500",
        };
      case "error":
        return {
          icon: WifiOff,
          label: t.sync.connectionError,
          className: "border-destructive/25 bg-destructive/10 text-destructive",
        };
      case "connecting":
      default:
        return {
          icon: RefreshCw,
          label: t.sync.connecting,
          className: "border-primary/25 bg-primary/10 text-primary",
        };
    }
  }, [connectionStatus, t.sync.connected, t.sync.reconnecting, t.sync.connectionError, t.sync.connecting]);
  const canControlVideo = effectiveHost || guestControlEnabled;
  useEffect(() => { effectiveHostRef.current = effectiveHost; }, [effectiveHost]);
  useEffect(() => { guestControlEnabledRef.current = guestControlEnabled; }, [guestControlEnabled]);
  useEffect(() => { currentVideoIdRef.current = currentVideoId; }, [currentVideoId]);

  // Heartbeat: refresh updated_at every 30s so stale-room cleanup won't remove active rooms
  useEffect(() => {
    if (!roomId || !isHost) return;
    const timerId = setInterval(() => heartbeatRoom(roomId), 30 * 1000);
    return () => clearInterval(timerId);
  }, [roomId, isHost]);

  // Best-effort cleanup when the tab/window is closed directly
  useEffect(() => {
    if (!roomId || !isHost) return;
    const handleBeforeUnload = () => {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return;
      // fetch with keepalive is guaranteed to be sent even after the page is closed
      fetch(`${url}/rest/v1/rooms?id=eq.${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        keepalive: true,
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [roomId, isHost]);

  // Sync member count + host info whenever we are host or become new host
  useEffect(() => {
    if (!roomId || !amIHost) return;
    updateRoomInfo(roomId, {
      host_nickname: username,
      host_avatar: avatar || null,
      member_count: Math.max(peerCount, 1),
    });
  }, [roomId, amIHost, peerCount, username, avatar]);

  // Keep playNextRef current for YT callback
  const runVideoChangeLock = useCallback((durationMs = 1400) => {
    videoChangeLockRef.current = true;
    if (videoChangeLockTimeoutRef.current) {
      window.clearTimeout(videoChangeLockTimeoutRef.current);
    }
    videoChangeLockTimeoutRef.current = window.setTimeout(() => {
      videoChangeLockRef.current = false;
      videoChangeLockTimeoutRef.current = null;
    }, durationMs);
  }, []);

  const applyLocalVideoChange = useCallback((videoId: string) => {
    // Block transient play/pause events from previous media instances.
    suppressSyncRef.current = true;
    if (localSwitchSuppressTimeoutRef.current) {
      window.clearTimeout(localSwitchSuppressTimeoutRef.current);
    }
    localSwitchSuppressTimeoutRef.current = window.setTimeout(() => {
      suppressSyncRef.current = false;
      localSwitchSuppressTimeoutRef.current = null;
    }, 900);

    lastLocalVideoChangeAtRef.current = Date.now();
    currentVideoIdRef.current = videoId;
    setCurrentVideoId(videoId);
    guestAutoplayKickDoneForRef.current = null;
    setNeedsGuestUnmute(false);
    setDirectPausedFrame(null);
    runVideoChangeLock();
  }, [runVideoChangeLock]);

  const buildSyncState = useCallback((videoId: string, isPlaying: boolean, currentTime: number): SyncState => {
    return {
      videoId,
      isPlaying,
      currentTime,
      timestamp: Date.now(),
      sentAt: Date.now(),
    };
  }, []);

  const doPlayNext = useCallback(() => {
    const next = playNextFromQueue();
    if (next) {
      setCountdown(null);
      applyLocalVideoChange(next.videoId);
      const state = buildSyncState(next.videoId, true, 0);
      broadcastVideoChange(state);
    }
  }, [playNextFromQueue, applyLocalVideoChange, buildSyncState, broadcastVideoChange]);

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
      const ytState = playerRef.current.getPlayerState?.();
      return {
        ...buildSyncState(
          currentVideoIdRef.current,
          ytState === window.YT?.PlayerState?.PLAYING ||
            ytState === window.YT?.PlayerState?.BUFFERING,
          playerRef.current.getCurrentTime()
        ),
      };
    }

    if (!directVideoRef.current) return null;
    return buildSyncState(
      currentVideoIdRef.current,
      !directVideoRef.current.paused,
      directVideoRef.current.currentTime ?? 0
    );
  }, [buildSyncState]);

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
    if (initialRoomValidationDoneRef.current) {
      setIsValidatingInitialRoom(false);
      return;
    }

    if (!initialRoomCandidate || initialHost) {
      initialRoomValidationDoneRef.current = true;
      setIsValidatingInitialRoom(false);
      return;
    }

    if (isHost || roomId !== initialRoomCandidate) {
      initialRoomValidationDoneRef.current = true;
      setIsValidatingInitialRoom(false);
      return;
    }

    let cancelled = false;
    initialRoomValidationDoneRef.current = true;
    setIsValidatingInitialRoom(true);

    validateRoomExists(initialRoomCandidate)
      .then((exists) => {
        if (cancelled) return;
        if (!exists) {
          showValidationError(t.sync.roomNotFound);
          clearSession();
          setNeedsNickname(false);
          setRoomId(null);
          setSearchParams({});
        }
      })
      .catch(() => {
        if (cancelled) return;
        showValidationError(t.sync.roomValidationError);
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

  // --- 事件處理與副作用：直接影音/HLS 播放器初始化 ---
  // 自動將 Jellyfin 的 URL 替換成 master.m3u8，並使用 hls.js 接管播放，完美解決轉碼崩潰問題
  useEffect(() => {
    const el = directVideoRef.current;
    if (!el) return;
    jellyfinTranscodeAttemptedRef.current = null;
    setDirectPausedFrame(null);

    // 清理先前的 HLS 實例以釋放記憶體
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 每次切換影片時重設錯誤狀態
    setPlaybackError(null);

    if (currentMedia?.source === "direct") {
      let finalUrl = currentMedia.value;

      // 針對 Safari 黑魔法的最終解：
      // 由於 Chrome 環境下 HLS 完美運作，但 Safari 會鎖定 234p 以及遭受 10-bit Washed Out 色偏。
      // 我們專門針對 Safari 放棄使用切片 HLS，改用 Jellyfin 的「即時漸進式 MP4 轉檔 (Progressive MP4)」接口！
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      // /Download 端點是直接輸出原始檔案，瀏覽器通常可以直接播放
      // 不應將其轉換為串流 URL，否則若轉碼失敗反而無法播放
      const jellyfinParts = parseJellyfinUrl(finalUrl);
      const isDownloadEndpoint = isJellyfinDownloadUrl(finalUrl);

      // 每次載入新影片都產生獨立的 PlaySessionId，避免 Jellyfin server 把同一 DeviceId
      // 的新請求誤認為舊轉碼 session 而產生衝突（DeviceId 固定代表裝置，PlaySessionId 代表單次播放）
      const playSessionId = `${myPeerId}_${Date.now()}`;

      if (jellyfinParts && !currentMedia.value.includes('youtube') && !isDownloadEndpoint) {
        // 所有瀏覽器（包含 Safari）統一使用 master.m3u8：
        // 加入 DeviceId 與 PlaySessionId 隔離雙端獨立轉碼，避免 FFmpeg 切片時間軸互相覆蓋或漂移
        finalUrl = buildJellyfinMasterUrl({
          ...jellyfinParts,
          deviceId: myPeerId,
          playSessionId,
        });
      }

      const isM3u8 = finalUrl.toLowerCase().includes('.m3u8');

      // 預先記住對應的 MP4 fallback URL，供 HLS 不可恢復錯誤或 Safari 畫質/色偏異常時切換
      const jellyfinFallbackParts = parseJellyfinUrl(finalUrl);
      if (jellyfinFallbackParts && isM3u8) {
        hlsFallbackUrlRef.current = buildJellyfinMp4FallbackUrl({
          ...jellyfinFallbackParts,
          deviceId: myPeerId,
          playSessionId,
        });
      } else {
        hlsFallbackUrlRef.current = null;
      }

      if (isM3u8 && !isSafari && Hls.isSupported()) {
        // Chrome 等非 Safari 瀏覽器使用 hls.js 解析 M3U8

        const hls = new Hls({
          maxBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.loadSource(finalUrl);
        hls.attachMedia(el);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // 強制鎖定在最高畫質，防止載入初期網路抖動導致畫質降低
          hls.currentLevel = hls.levels.length - 1;
          el.play().catch(() => { });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                // 不可恢復的錯誤 → 嘗試降級到 MP4
                hls.destroy();
                hlsRef.current = null;
                if (hlsFallbackUrlRef.current) {
                  el.src = hlsFallbackUrlRef.current;
                  el.load();
                  el.play().catch(() => { });
                  hlsFallbackUrlRef.current = null;
                } else {
                  setPlaybackError('unsupported');
                }
                break;
            }
          }
        });
      } else if (isM3u8 && !isSafari && !Hls.isSupported()) {
        // 瀏覽器既不是 Safari 也不支援 HLS.js → 直接顯示不支援提示
        setBrowserUnsupported(true);
        setPlaybackError('unsupported');
      } else {
        // 此分支涵蓋以下情況：
        // 1. Safari + m3u8：Safari 原生 HLS 引擎直接播放（不透過 hls.js）
        //    若 HLS 失敗（code 4），error handler 會降級至 stream.mp4
        // 2. 所有瀏覽器 + 非 m3u8（MP4、Download 直連等）：原生 <video> 直出
        setBrowserUnsupported(false);

        // 若為 Safari 原生 HLS，顯示軟性提示，建議使用者切換瀏覽器
        if (isSafari && isM3u8) {
          setShowSafariHlsWarning(true);
        } else {
          setShowSafariHlsWarning(false);
        }

        el.src = finalUrl;
        el.load();
        el.play().catch(() => { });
      }
    } else {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }

    // 當關閉影片時重置警告
    if (currentMedia?.source !== "direct") {
      setShowSafariHlsWarning(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [currentMedia, myPeerId]);

  // --- 事件處理與副作用：YouTube 播放器初始化 ---
  // YouTube API 使用獨立的內部 div 作為掛載點，這樣 playerContainerRef 才能穩定的被 React 持有。
  // 若直接讓 YouTube 覆寫 React 的 Element，未來卸載元件時會造成 Detached DOM 內存洩漏。
  useEffect(() => {
    if (!currentVideoId || !playerContainerRef.current || currentMedia?.source !== "youtube") return;

    let cancelled = false;

    loadYouTubeAPI().then(() => {
      if (cancelled) return;

      if (playerRef.current) {
        playerRef.current.loadVideoById(currentMedia.value);
        return;
      }

      // 建立一個臨時內部容器，YouTube 掛載後會將其置換成 iframe。
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
            // Ignore transient state churn right after switching media.
            if (videoChangeLockRef.current) return;
            // Ignore transient states to avoid broadcasting pause/play flapping.
            if (
              event.data !== window.YT.PlayerState.PLAYING &&
              event.data !== window.YT.PlayerState.PAUSED
            ) {
              return;
            }
            if (suppressSyncRef.current) return;
            if (!effectiveHostRef.current && !guestControlEnabledRef.current) return;
            const vid = currentVideoIdRef.current;
            if (!vid) return;
            const state = buildSyncState(
              vid,
              event.data === window.YT.PlayerState.PLAYING,
              event.target.getCurrentTime()
            );
            broadcastSync(state);
          },
        },
      });
    });

    return () => { cancelled = true; };
  }, [currentVideoId, currentMedia, buildSyncState, broadcastSync, notifyPlayerReady]);

  // --- 狀態廣播與同步處理 (State Sync Engine) ---
  // 將房間房主的播放狀態、進度套用到全體成員本地播放器的核心邏輯。
  useEffect(() => {
    if (!syncState) return;

    const incomingSentAt = syncState.sentAt ?? syncState.timestamp ?? 0;

    // 若為房主，除非開放了「訪客控制(guestControlEnabled)」，否則不理會其他人的廣播
    if (effectiveHost && !guestControlEnabled) return;

    // 在切片鎖期間只忽略同片的抖動同步，跨片切換不可被鎖擋下。
    if (videoChangeLockRef.current && syncState.videoId === currentVideoIdRef.current) return;

    // If different video, load it (from host's video_change broadcast)
    if (syncState.videoId !== currentVideoId) {
      if (incomingSentAt > 0 && incomingSentAt < lastLocalVideoChangeAtRef.current) {
        return;
      }

      if (incomingSentAt > 0) {
        if (incomingSentAt < lastAppliedVideoSwitchSentAtRef.current) {
          return;
        }
        lastAppliedVideoSwitchSentAtRef.current = incomingSentAt;
        if (incomingSentAt > lastAppliedSyncSentAtRef.current) {
          lastAppliedSyncSentAtRef.current = incomingSentAt;
        }
      }

      runVideoChangeLock();
      currentVideoIdRef.current = syncState.videoId;
      setCurrentVideoId(syncState.videoId);
      guestAutoplayKickDoneForRef.current = null;
      setNeedsGuestUnmute(false);
      setDirectPausedFrame(null);

      if (!effectiveHost) {
        // Ask one follow-up sync after media switch once local player is likely ready.
        window.setTimeout(() => requestSync(), 1200);
      }
      return;
    }

    const media = deserializeMedia(syncState.videoId);
    if (!media) return;

    // Guard against race conditions where sync arrives before local player is ready.
    if (media.source === "youtube" && !playerRef.current?.playVideo) {
      return;
    }

    if (media.source === "direct" && !directVideoRef.current) {
      return;
    }

    if (!effectiveHost) {
      const now = Date.now();
      if (now - lastGuestApplyAtRef.current < 420) {
        return;
      }
      lastGuestApplyAtRef.current = now;
    }

    if (incomingSentAt > 0 && incomingSentAt < lastAppliedSyncSentAtRef.current) {
      return;
    }

    if (incomingSentAt > 0) {
      lastAppliedSyncSentAtRef.current = incomingSentAt;
    }

    // 開始進行同步應用，鎖定廣播防止無窮迴圈
    suppressSyncRef.current = true;
    if (suppressTimeoutRef.current) window.clearTimeout(suppressTimeoutRef.current);
    let expectsSeek = false;

    // 若為暫停狀態，不應計算網路漂移或延遲補償（因為畫面是靜止的）
    const timeDrift = syncState.isPlaying ? (Date.now() - syncState.timestamp) / 1000 : 0;
    const latencyCompensation = syncState.isPlaying ? Math.min(0.22, Math.max(0.04, timeDrift * 0.22)) : 0;
    const targetTime = syncState.currentTime + timeDrift + latencyCompensation;
    const syncThreshold = effectiveHost ? Math.max(0.95, SYNC_THRESHOLD - 0.35) : 0.85;
    const currentPlayerTime = media.source === "youtube"
      ? (playerRef.current?.getCurrentTime?.() ?? 0)
      : (directVideoRef.current?.currentTime ?? 0);

    // 處理進度跳轉 (Seek)
    if (Math.abs(currentPlayerTime - targetTime) > syncThreshold) {
      if (media.source === "youtube") {
        if (playerRef.current?.seekTo) {
          playerRef.current.seekTo(targetTime, true);
        }
      } else if (directVideoRef.current) {
        expectsSeek = true;
        const el = directVideoRef.current;
        // 綁定單次監聽器：直到真的緩衝完畢觸發 seeked 或發生 error 時，才解除 suppressSync
        const cleanup = () => {
          el.removeEventListener('seeked', cleanup);
          el.removeEventListener('error', cleanup);
          suppressSyncRef.current = false;
        };
        el.addEventListener('seeked', cleanup);
        el.addEventListener('error', cleanup);
        
        el.currentTime = targetTime;
      }
    }

    // 處理播放器狀態 (Play/Pause)
    if (syncState.isPlaying) {
      if (media.source === "youtube") {
        setTimeout(() => {
          playerRef.current?.playVideo();
          if (!effectiveHost) {
            window.setTimeout(() => {
              const yt = window.YT?.PlayerState;
              const playerState = playerRef.current?.getPlayerState?.();
              const isRunning = playerState === yt?.PLAYING || playerState === yt?.BUFFERING;
              if (!isRunning && guestAutoplayKickDoneForRef.current !== syncState.videoId) {
                playerRef.current?.mute?.();
                playerRef.current?.playVideo?.();
                guestAutoplayKickDoneForRef.current = syncState.videoId;
                setNeedsGuestUnmute(true);
              }
            }, 650);
          }
        }, 150);
      } else if (directVideoRef.current) {
         // HLS/HTML5: 安全地指令播放，無須不相干的 timeout 與 pause。如果正在緩衝，瀏覽器原生會等
         if (directVideoRef.current.paused) {
             directVideoRef.current.play().catch(() => {});
         }
      }
    } else {
      if (media.source === "youtube") {
        playerRef.current?.pauseVideo();
      } else if (directVideoRef.current) {
        directVideoRef.current.pause();
      }
    }

    // 若沒有進度跳轉事件 (通常是單純的點擊暫停/繼續)，給予一小段固定 Timeout 來覆蓋狀態變化期
    if (!expectsSeek) {
      suppressTimeoutRef.current = window.setTimeout(() => {
        suppressSyncRef.current = false;
      }, 500);
    }
  }, [syncState, effectiveHost, currentVideoId, guestControlEnabled, requestSync, runVideoChangeLock]);

  const handleCreateRoom = useCallback(() => {
    if (!username.trim()) {
      setNeedsNickname(true);
      return;
    }
    const id = generateRoomId();
    // Persist room to Supabase so it appears in the lobby list
    upsertRoom({ id, host_nickname: username, host_avatar: avatar || null, member_count: 1, status: 'active' });
    setRoomId(id);
    setIsHost(true);
    setSearchParams({ room: id });
  }, [setSearchParams, username, avatar]);

  const joinRoomById = useCallback((rawRoomId: string) => {
    const id = rawRoomId.trim().toLowerCase();
    if (!id || isJoiningRoom) return;

    // Only allow room IDs matching the generateRoomId() format: [a-z0-9]+-[a-z0-9]+
    if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(id)) {
      showValidationError(t.sync.invalidRoomId);
      return;
    }

    setIsJoiningRoom(true);

    validateRoomExists(id)
      .then((exists) => {
        if (!exists) {
          showValidationError(t.sync.roomNotFound);
          return;
        }

        setRoomId(id);
        setIsHost(false);
        setSearchParams({ room: id });
        if (!username.trim()) setNeedsNickname(true);
      })
      .catch(() => {
        showValidationError(t.sync.roomValidationError);
      })
      .finally(() => {
        setIsJoiningRoom(false);
      });
  }, [isJoiningRoom, setSearchParams, t.sync.roomNotFound, t.sync.roomValidationError, t.sync.invalidRoomId, username]);

  const handleJoinRoom = useCallback(() => {
    const id = joinInput.trim();
    if (!id) return;
    joinRoomById(id);
  }, [joinInput, joinRoomById]);

  const handleNicknameConfirm = useCallback((name: string) => {
    setUsername(name);
    setNeedsNickname(false);
    if (!roomId) {
      const id = generateRoomId();
      // upsertRoom here because handleCreateRoom was bypassed via NicknameModal
      upsertRoom({ id, host_nickname: name, host_avatar: avatar || null, member_count: 1, status: 'active' });
      setRoomId(id);
      setIsHost(true);
      setSearchParams({ room: id });
    }
  }, [roomId, setSearchParams, setUsername, avatar]);

  const handleLoadVideo = useCallback(() => {
    if (!effectiveHost && !guestControlEnabled) return;
    const media = parseMediaInput(videoInput);
    if (!media) return;
    const serialized = serializeMedia(media);
    applyLocalVideoChange(serialized);
    const state = buildSyncState(serialized, true, 0);
    broadcastVideoChange(state);
    setVideoInput("");
  }, [videoInput, broadcastVideoChange, effectiveHost, guestControlEnabled, applyLocalVideoChange, buildSyncState]);

  const handleSelectClip = useCallback((videoId: string, _title: string) => {
    if (!effectiveHost && !guestControlEnabled) return;
    const serialized = videoId.startsWith("http")
      ? serializeMedia({ source: "direct", value: videoId })
      : serializeMedia({ source: "youtube", value: videoId });
    applyLocalVideoChange(serialized);
    const state = buildSyncState(serialized, true, 0);
    broadcastVideoChange(state);
    setShowClips(false);
  }, [broadcastVideoChange, effectiveHost, guestControlEnabled, applyLocalVideoChange, buildSyncState]);

  const handleAddToQueue = useCallback((videoId: string, title?: string) => {
    const serialized = videoId.startsWith("http")
      ? serializeMedia({ source: "direct", value: videoId })
      : serializeMedia({ source: "youtube", value: videoId });
    addToQueue(serialized, title);
  }, [addToQueue]);

  const handlePlayFromQueue = useCallback((itemId: string) => {
    if (!effectiveHost && !guestControlEnabled) return;
    const item = playFromQueue(itemId);
    if (!item) return;
    applyLocalVideoChange(item.videoId);
    const state = buildSyncState(item.videoId, true, 0);
    broadcastVideoChange(state);
  }, [effectiveHost, guestControlEnabled, playFromQueue, broadcastVideoChange, applyLocalVideoChange, buildSyncState]);

  const copyInviteLink = useCallback(() => {
    const basePath = import.meta.env.BASE_URL || "/";
    const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
    const url = `${window.location.origin}${normalizedBase}#/sync?room=${roomId}`;
    navigator.clipboard.writeText(url);
    showSuccess(t.sync.inviteCopied);
  }, [roomId, t.sync.inviteCopied]);

  const handleLeaveRoom = useCallback(() => {
    // Only delete the room row if we are the last person in it.
    // If there are other members, the new host (oldest remaining peer) will
    // update host_nickname/host_avatar via the amIHost effect above.
    if (roomId && peerCount <= 1 && (amIHost || isHost)) {
      deactivateRoom(roomId);
    }
    clearSession();
    resetState();
    setRoomId(null);
    setIsHost(true);
    setCurrentVideoId(null);
    setVideoInput("");
    setJoinInput("");
    lastAppliedSyncSentAtRef.current = 0;
    lastAppliedVideoSwitchSentAtRef.current = 0;
    lastLocalVideoChangeAtRef.current = 0;
    if (suppressTimeoutRef.current) {
      window.clearTimeout(suppressTimeoutRef.current);
      suppressTimeoutRef.current = null;
    }
    if (videoChangeLockTimeoutRef.current) {
      window.clearTimeout(videoChangeLockTimeoutRef.current);
      videoChangeLockTimeoutRef.current = null;
    }
    if (localSwitchSuppressTimeoutRef.current) {
      window.clearTimeout(localSwitchSuppressTimeoutRef.current);
      localSwitchSuppressTimeoutRef.current = null;
    }
    videoChangeLockRef.current = false;
    suppressSyncRef.current = false;
    if (playerRef.current?.destroy) {
      playerRef.current.destroy();
      playerRef.current = null;
    }
    setSearchParams({});
  }, [setSearchParams, resetState, amIHost, isHost, roomId, peerCount]);

  const handleToggleGuestControl = useCallback((enabled: boolean) => {
    toggleGuestControl(enabled, enabled ? null : getHostState());
  }, [toggleGuestControl, getHostState]);

  const handleRequestResync = useCallback(() => {
    requestSync();
    showSuccess(t.sync.resyncRequested);
  }, [requestSync, t.sync.resyncRequested]);

  const handleGuestUnmute = useCallback(() => {
    playerRef.current?.unMute?.();
    setNeedsGuestUnmute(false);
  }, []);

  const handleDirectVideoSync = useCallback(() => {
    if (suppressSyncRef.current) return;
    if (!effectiveHostRef.current && !guestControlEnabledRef.current) return;
    const vid = currentVideoIdRef.current;
    if (!vid || !directVideoRef.current) return;
    const state = buildSyncState(
      vid,
      !directVideoRef.current.paused,
      directVideoRef.current.currentTime ?? 0
    );
    broadcastSync(state);
  }, [broadcastSync, buildSyncState]);

  const captureDirectPausedFrame = useCallback(() => {
    const el = directVideoRef.current;
    if (!el || el.readyState < 2 || el.videoWidth === 0 || el.videoHeight === 0) {
      setDirectPausedFrame(null);
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = el.videoWidth;
      canvas.height = el.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setDirectPausedFrame(null);
        return;
      }
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      setDirectPausedFrame(canvas.toDataURL("image/jpeg", 0.82));
    } catch {
      // Cross-origin videos may block canvas export; keep default fallback behavior.
      setDirectPausedFrame(null);
    }
  }, []);

  const handleDirectVideoPause = useCallback(() => {
    if (Date.now() < ignoreDirectPauseUntilRef.current) {
      return;
    }
    captureDirectPausedFrame();
    handleDirectVideoSync();
  }, [captureDirectPausedFrame, handleDirectVideoSync]);

  const handleDirectVideoPlay = useCallback(() => {
    setDirectPausedFrame(null);
    handleDirectVideoSync();
  }, [handleDirectVideoSync]);

  const handleDirectVideoReady = useCallback(() => {
    notifyPlayerReady();
  }, [notifyPlayerReady]);

  const handleDirectVideoSeeking = useCallback(() => {
    const el = directVideoRef.current;
    if (!el) return;
    directWasPlayingBeforeSeekRef.current = !el.paused;
    if (directWasPlayingBeforeSeekRef.current) {
      // Browsers may emit a transient pause while dragging seekbar.
      ignoreDirectPauseUntilRef.current = Date.now() + 1100;
    }
  }, []);

  const handleDirectVideoEnded = useCallback(() => {
    if (!effectiveHostRef.current) return;
    playNextRef.current();
  }, []);

  // 錯誤處理策略（三階段降級）：
  // 第一階段：HLS (m3u8) 或 Safari 的 stream.mp4 是我們的主要嘗試。
  // 第二階段：格式確認不支援 (code 4) 時，對 Jellyfin 切換至 MP4 降級。
  // 第三階段：MP4 降級仍失敗，或非 Jellyfin 連結 → 顯示不支援提示。
  //
  // ⚠️ 核心守衛：任何不是 MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) 的錯誤
  //    都屬於暫時性問題（網路、解碼、中止、未知），一律靜默忽略。
  //    Safari 播 MP4 時尤其容易遭到 code 0/2/3 誤觸，絕對不可在這裡顯示不支援提示。
  const handleDirectVideoError = useCallback(() => {
    const el = directVideoRef.current;
    if (!el) return;
    const url = el.src;
    if (!url) return;

    // HLS.js 使用 blob: URL 作為 MediaSource；這些 URL 的錯誤由 HLS.js 的 Hls.Events.ERROR 自行處理。
    // 若我們攔截這些 blob 錯誤，切換影片時舊 HLS 的 blob 被撤銷後會觸發 stale error event，
    // 誤呼叫 setPlaybackError 把 <video> 元素隱藏，導致新影片無法顯示。
    if (url.startsWith("blob:")) return;

    // 若 HLS 實例當前活躍，由它的 error handler 負責，此處靜默
    if (hlsRef.current) return;

    const errorCode = el.error?.code ?? 0;

    // 只有 code 4 才是真正的瀏覽器格式不支援；其他全部靜默
    if (errorCode !== MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
      return;
    }

    // 以下確定是 code 4 — 瀏覽器無法處理此格式
    const jellyfinParts = parseJellyfinUrl(url);
    const isAlreadyMp4Fallback = url.includes('stream.mp4') && url.includes('Container=mp4');

    if (jellyfinParts && !isAlreadyMp4Fallback) {
      // 非 MP4 Jellyfin URL（例如 m3u8）格式不支援 → 切換至漸進式 MP4 作為保底
      jellyfinTranscodeAttemptedRef.current = url;
      el.src = buildJellyfinMp4FallbackUrl({
        ...jellyfinParts,
        deviceId: myPeerId,
        playSessionId: myPeerId,
      });
      el.load();
      el.play().catch(() => { });
      return;
    }

    // MP4 降級 URL 也無法播放，或非 Jellyfin 連結 → 顯示對應錯誤提示
    setPlaybackError(isAlreadyMp4Fallback ? 'mp4_failed' : 'unsupported');
  }, [myPeerId]);

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
      <div className="flex items-center justify-center min-h-[calc(100dvh-9rem)]">
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
    return <LobbyView
      t={t}
      isMobile={isMobile}
      joinInput={joinInput}
      setJoinInput={setJoinInput}
      isJoiningRoom={isJoiningRoom}
      handleCreateRoom={handleCreateRoom}
      handleJoinRoom={handleJoinRoom}
      joinRoomById={joinRoomById}
    />;
  }



  // Sidebar component (always rendered in room)
  const sidebar = (
    <div
      className={cn(
        "overflow-hidden flex flex-col",
        isMobile
          ? "w-full flex-1 min-h-0 rounded-2xl border border-border/60 bg-card/60"
          : "w-[300px] shrink-0 rounded-lg border border-border/50 bg-card/40"
      )}
      style={{
        ...(isMobile
          ? (mobileSection === "collapsed" ? { height: "auto" } : { minHeight: 0, flex: 1 })
          : playerHeight ? { maxHeight: playerHeight } : {}
        ),
      }}
    >

      <div className={cn(
        "border-b border-border/30",
        isMobile ? "flex bg-card/60" : "flex bg-card/60"
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
                ? "flex-1 text-xs min-h-[44px] font-medium transition-colors"
                : "flex-1 text-xs min-h-[44px] font-medium transition-colors",
              sidebarTab === tab
                ? isMobile
                  ? "text-primary border-b-2 border-primary"
                  : "text-primary border-b-2 border-primary"
                : isMobile
                  ? "text-muted-foreground hover:text-foreground"
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
                  src={buildYouTubeLiveChatUrl(currentMedia.value, window.location.hostname)}
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
      className={cn(
        "space-y-3",
        isMobile && "flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/95 p-2"
      )}
      style={mobileViewportStyle}
    >
      {/* Room header */}
      {isMobile ? (
        <div className="shrink-0 rounded-3xl border border-border/60 bg-card/40 px-3 py-2 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-5 h-5 text-primary" />
              <h1 className="text-base font-bold text-foreground truncate">{t.sync.syncWatch}</h1>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className={cn(
                "inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md border text-[10px] font-medium",
                effectiveHost ? "border-primary/35 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"
              )}>
                {effectiveHost ? t.sync.host : t.sync.guest}
              </span>
              <span className="inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md border border-border bg-card text-[10px] text-muted-foreground">
                <Users className="w-3 h-3 mr-1" />
                {peerCount}
              </span>
              <span className={cn("inline-flex items-center justify-center h-7 w-7 rounded-md border", connectionBadge.className)}>
                <connectionBadge.icon className={cn("w-3 h-3", (connectionStatus === "connecting" || connectionStatus === "reconnecting") && "animate-spin")} />
              </span>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={handleRequestResync}>
                <RotateCcw className="w-3 h-3" />
                <span className="sr-only">{t.sync.resyncNow}</span>
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7" onClick={copyInviteLink}>
                <Copy className="w-3 h-3" />
                <span className="sr-only">{t.sync.copyInvite}</span>
              </Button>
              <Button size="icon" variant="outline" className="h-7 w-7 text-destructive" onClick={handleLeaveRoom}>
                <ArrowLeft className="w-3 h-3" />
                <span className="sr-only">{t.sync.leave}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="shrink-0 gap-2 md:gap-3 flex flex-wrap items-center">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{t.sync.syncWatch}</h1>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground font-mono">{t.sync.room}: {roomId}</span>
            <span className={cn(
              "text-xs px-1.5 py-0.5 rounded font-semibold",
              effectiveHost ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
            )}>
              {effectiveHost ? t.sync.host : t.sync.guest}
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-2xl border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{peerCount}</span>
          </div>

          <div className={cn(
            "flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium",
            connectionBadge.className
          )}>
            <connectionBadge.icon
              className={cn(
                "w-3.5 h-3.5",
                (connectionStatus === "connecting" || connectionStatus === "reconnecting") && "animate-spin"
              )}
            />
            <span>{connectionBadge.label}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="secondary" className="gap-1.5 min-h-[46px] md:min-h-0" onClick={handleRequestResync}>
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.sync.resyncNow}</span>
            </Button>
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
      )}

      {/* Video input bar */}
      {canControlVideo ? (
        <div className={cn("shrink-0", isMobile ? "flex items-center gap-2" : "flex items-center gap-2")}>
          {!isMobile && (
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded shrink-0 hidden sm:block",
              guestControlEnabled
                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25"
                : "bg-primary/15 text-primary border border-primary/25"
            )}>
              {guestControlEnabled ? t.sync.freeControl : t.sync.hostMode}
            </span>
          )}
          <Input
            placeholder={t.sync.pasteUrl}
            value={videoInput}
            onChange={(e) => setVideoInput(e.target.value)}
            className={cn("flex-1 min-h-[44px] md:min-h-0", isMobile && "bg-background/75 border-primary/25")}
            onKeyDown={(e) => e.key === "Enter" && handleLoadVideo()}
          />
          <Button
            onClick={handleLoadVideo}
            size={isMobile ? "icon" : "default"}
            variant={isMobile ? "outline" : "default"}
            className={cn("shrink-0", isMobile ? "h-11 w-11" : "gap-1.5 min-h-[46px] md:min-h-0")}
          >
            <Play className="w-4 h-4" />
            {!isMobile && t.sync.loadVideo}
          </Button>
          <Button
            onClick={() => setShowClips(true)}
            variant="outline"
            size={isMobile ? "icon" : "default"}
            className={cn("shrink-0", isMobile ? "h-11 w-11" : "gap-1.5 min-h-[46px] md:min-h-0")}
            aria-label={t.sync.openClips}
          >
            <Plus className="w-4 h-4" />
            {!isMobile && t.sync.openClips}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-md border border-border/40 bg-muted/30 text-muted-foreground text-sm select-none shrink-0">
          <Radio className="w-4 h-4 opacity-50 shrink-0" />
          <span>{t.sync.hostOnlyVideo}</span>
        </div>
      )}

      {/* Sync notification */}
      {lastEvent && (
        <div className={cn(
          "flex items-center gap-2 rounded-lg bg-primary/10 border border-primary/20 text-primary animate-in fade-in slide-in-from-top-2 duration-300 shrink-0",
          isMobile ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm"
        )}>
          <RefreshCw className="w-4 h-4 animate-spin" />
          {lastEvent}
        </div>
      )}

      {/* Clips Overlay */}
      <ClipsOverlay
        open={showClips}
        onClose={() => setShowClips(false)}
        onSelectClip={handleSelectClip}
        onAddToQueue={handleAddToQueue}
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
          playlistsTab: t.sidebar.playlists,
        }}
      />

      {/* Main content: always show sidebar */}
      <div className={cn(
        "flex gap-3",
        isMobile ? "flex-col flex-1 min-h-0 overflow-hidden gap-2" : "flex-row items-stretch"
      )}>
        {/* Video player area — sticky on mobile */}
        <div ref={playerAreaRef} className={cn("min-w-0", isMobile ? "w-full shrink-0" : "flex-[3]")}>
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
                style={{ display: currentMedia?.source === "direct" && !playbackError ? "block" : "none" }}
                onLoadedMetadata={handleDirectVideoReady}
                onSeeking={handleDirectVideoSeeking}
                onPlay={handleDirectVideoPlay}
                onPause={handleDirectVideoPause}
                onSeeked={handleDirectVideoSync}
                onEnded={handleDirectVideoEnded}
                onError={handleDirectVideoError}
              />
              {/* 瀏覽器不支援提示覆蓋層 — 當 HLS + MP4 雙重降級均失敗時顯示 */}
              {currentMedia?.source === "direct" && playbackError && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-sm px-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center">
                    <WifiOff className="w-7 h-7 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-foreground">
                      {playbackError === 'mp4_failed'
                        ? '無法播放此影片'
                        : browserUnsupported
                          ? '瀏覽器不支援此串流格式'
                          : '無法播放此格式'}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                      {playbackError === 'mp4_failed'
                        ? 'HLS 與 MP4 串流均無法載入。請嘗試使用 Chrome 或 Firefox，或確認 Jellyfin 伺服器的轉碼設定。'
                        : browserUnsupported
                          ? '您的瀏覽器不支援 HLS (M3U8) 串流格式。請使用 Chrome、Firefox 或 Edge 以獲得最佳相容性。'
                          : '目前的瀏覽器不支援此影片格式。建議使用 Chrome、Firefox 或 Edge 以獲得最佳相容性。'}
                    </p>
                    {browserUnsupported && (
                      <div className="flex items-center justify-center gap-3 pt-1 text-[10px] text-muted-foreground/70">
                        <span className="px-2 py-0.5 rounded bg-secondary/60">Chrome</span>
                        <span className="px-2 py-0.5 rounded bg-secondary/60">Firefox</span>
                        <span className="px-2 py-0.5 rounded bg-secondary/60">Edge</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setPlaybackError(null); setBrowserUnsupported(false); }}
                    className="mt-1 px-4 py-1.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
                  >
                    關閉
                  </button>
                </div>
              )}
              {/* Safari 原生 HLS 軟性提示覆蓋層 */}
              {currentMedia?.source === "direct" && showSafariHlsWarning && !playbackError && (
                <div className="absolute top-0 left-0 right-0 z-30 p-2 pointer-events-none flex justify-center">
                  <div className="pointer-events-auto flex items-center gap-3 bg-card/85 backdrop-blur-md border border-border/60 pl-3 pr-2 py-1.5 rounded-lg shadow-lg max-w-[90%] md:max-w-md">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-xs text-foreground/90 flex-1 truncate">
                      當前使用瀏覽器可能會有畫質與色偏限制，建議使用 Chrome 或 Edge 獲得最佳體驗。
                    </p>
                    <div className="flex items-center shrink-0">
                      <button
                        onClick={() => setShowSafariHlsWarning(false)}
                        className="p-1 rounded text-muted-foreground hover:bg-muted/80 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {currentMedia?.source === "direct" && directPausedFrame && directVideoRef.current?.paused && !playbackError && (
                <img
                  src={directPausedFrame}
                  alt="Paused frame"
                  className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                />
              )}
              {countdown && (
                <QueueCountdown
                  nextTitle={countdown.title}
                  duration={5}
                  onComplete={doPlayNext}
                  onCancel={() => setCountdown(null)}
                />
              )}
              {!effectiveHost && needsGuestUnmute && currentMedia?.source === "youtube" && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
                  <button
                    onClick={handleGuestUnmute}
                    className="pointer-events-auto relative flex items-center gap-2 rounded-lg bg-card/80 backdrop-blur-md border border-border px-5 py-2.5 text-foreground text-sm font-medium shadow-lg hover:bg-card hover:border-primary/50 active:scale-95 transition-all duration-150"
                  >
                    <span className="absolute inset-0 rounded-lg animate-pulse bg-primary/5" />
                    <VolumeX className="w-4 h-4 shrink-0 text-primary" />
                    {t.sync.tapToUnmute}
                  </button>
                </div>
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

// ---------- LobbyView ----------

interface LobbyViewProps {
  t: ReturnType<typeof useSettings>["t"];
  isMobile: boolean;
  joinInput: string;
  setJoinInput: (v: string) => void;
  isJoiningRoom: boolean;
  handleCreateRoom: () => void;
  handleJoinRoom: () => void;
  joinRoomById: (id: string) => void;
}

function LobbyView({
  t, isMobile, joinInput, setJoinInput,
  isJoiningRoom, handleCreateRoom, handleJoinRoom, joinRoomById,
}: LobbyViewProps) {
  const { rooms, isLoading: isLoadingRooms } = useRoomsList();

  return (
    <div className="min-h-[calc(100dvh-9rem)] flex flex-col items-center justify-center px-3 py-8 gap-8">
      {/* Hero / create-join section */}
      <div className="w-full max-w-lg space-y-6">
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
              onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
            />
            <Button
              onClick={handleJoinRoom}
              variant="secondary"
              className="min-h-[48px]"
              disabled={isJoiningRoom || !joinInput.trim()}
            >
              {isJoiningRoom ? t.common.loading : t.sync.join}
            </Button>
          </div>
        </div>
      </div>

      {/* Room list */}
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-border/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest shrink-0">
            {t.sync.roomList}
          </span>
          <div className="flex-1 h-px bg-border/60" />
        </div>
        {isLoadingRooms ? (
          <p className="text-center text-xs text-muted-foreground py-4">{t.common.loading}</p>
        ) : rooms.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">{t.sync.noRooms}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                onJoin={joinRoomById}
                isJoining={isJoiningRoom}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- validateRoomExists ----------

async function validateRoomExists(roomId: string): Promise<boolean> {
  const probe = supabase.channel(`sync-watch:${roomId}`);

  return new Promise((resolve, reject) => {
    let settled = false;
    let presenceTimer: number | undefined;
    const hardTimeout = window.setTimeout(() => {
      void fail();
    }, 5000);

    const clearTimers = () => {
      if (presenceTimer) {
        window.clearTimeout(presenceTimer);
        presenceTimer = undefined;
      }
      window.clearTimeout(hardTimeout);
    };

    const finish = async (result: boolean) => {
      if (settled) return;
      settled = true;
      clearTimers();
      await probe.unsubscribe();
      resolve(result);
    };

    const fail = async () => {
      if (settled) return;
      settled = true;
      clearTimers();
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

          presenceTimer = window.setTimeout(() => {
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
