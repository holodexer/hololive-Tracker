import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatTime } from "@/lib/format";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface SyncState {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  timestamp: number;
  sentAt?: number;
  eventId?: string;
}

export interface QueueItem {
  id: string;
  videoId: string;
  title?: string;
}

export interface Peer {
  odataId: string;
  nickname: string;
  avatar?: string;
  isHost: boolean;
  joinedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: number;
}

export interface SystemMessage {
  id: string;
  text: string;
  timestamp: number;
}

export type SyncConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "error";

interface UseSyncWatchOptions {
  roomId: string | null;
  nickname: string;
  avatar?: string;
  isHost: boolean;
}

const SYNC_THRESHOLD = 2; // seconds

export function generateRoomId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const seg1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  const seg2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${seg1}-${seg2}`;
}

function generatePeerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useSyncWatch({ roomId, nickname, avatar, isHost }: UseSyncWatchOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peerIdRef = useRef(generatePeerId());

  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [rawPeers, setRawPeers] = useState<Peer[]>([]);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [guestControlEnabled, setGuestControlEnabled] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [playerReadyTick, setPlayerReadyTick] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>("idle");

  // Callback ref so the host can respond to REQUEST_SYNC
  const onSyncRequestRef = useRef<(() => void) | null>(null);
  const lastSyncRequestAtRef = useRef(0);
  const lastAppliedSyncSentAtRef = useRef(0);
  const lastAuthoritativeSwitchSentAtRef = useRef(0);
  const latestVideoIdRef = useRef<string | null>(null);
  const normalizeSyncState = useCallback((state: SyncState, fallbackSentAt: number): SyncState => {
    const sentAt = state.sentAt ?? fallbackSentAt;
    const eventId = state.eventId ?? `${state.videoId}:${sentAt}:${Math.random().toString(36).slice(2, 8)}`;
    return {
      ...state,
      sentAt,
      eventId,
    };
  }, []);

  const applyIncomingSyncState = useCallback((
    state: SyncState,
    fallbackSentAt: number,
    source: "sync" | "video_change" | "host_state"
  ): boolean => {
    const normalized = normalizeSyncState(state, fallbackSentAt);
    const sentAt = normalized.sentAt ?? 0;

    // Media switch lanes are authoritative and must not be blocked by plain sync packets.
    if (source === "video_change" || source === "host_state") {
      if (sentAt < lastAuthoritativeSwitchSentAtRef.current) {
        return false;
      }
      lastAuthoritativeSwitchSentAtRef.current = sentAt;
      latestVideoIdRef.current = normalized.videoId;
      // Lift sync floor so older sync events from previous media are ignored.
      if (sentAt > lastAppliedSyncSentAtRef.current) {
        lastAppliedSyncSentAtRef.current = sentAt;
      }
      setSyncState(normalized);
      return true;
    }

    // Only video_change (or explicit host snapshot) is allowed to switch media id.
    // Plain sync packets should only adjust play/pause/time for the current media.
    if (
      source === "sync" &&
      latestVideoIdRef.current &&
      normalized.videoId !== latestVideoIdRef.current
    ) {
      return false;
    }

    if (sentAt < lastAppliedSyncSentAtRef.current) {
      return false;
    }

    latestVideoIdRef.current = normalized.videoId;
    lastAppliedSyncSentAtRef.current = sentAt;
    setSyncState(normalized);
    return true;
  }, [normalizeSyncState]);


  const isHostRef = useRef(isHost);
  const guestControlRef = useRef(false);
  const hostIdRef = useRef<string | null>(null);

  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  useEffect(() => { guestControlRef.current = guestControlEnabled; }, [guestControlEnabled]);
  useEffect(() => { hostIdRef.current = hostId; }, [hostId]);

  const addSystemMessage = useCallback((text: string) => {
    const msg: SystemMessage = { id: Math.random().toString(36).slice(2), text, timestamp: Date.now() };
    setSystemMessages(prev => [...prev.slice(-49), msg]);
  }, []);

  const showEvent = useCallback((text: string) => {
    setLastEvent(text);
    setTimeout(() => setLastEvent(null), 3000);
  }, []);

  // Derive host deterministically from presence: oldest member
  const computedHostId = useMemo(() => {
    if (rawPeers.length === 0) return hostId;

    // Keep current host sticky while they are still present.
    if (hostId && rawPeers.some((peer) => peer.odataId === hostId)) {
      return hostId;
    }

    const sorted = [...rawPeers].sort((a, b) => a.joinedAt - b.joinedAt);
    return sorted[0].odataId;
  }, [rawPeers, hostId]);

  // Keep hostId in sync with computed value
  useEffect(() => {
    if (computedHostId && computedHostId !== hostId) {
      setHostId(computedHostId);
    }
  }, [computedHostId]);

  // Reactive peers with isHost derived from computedHostId
  const peers = useMemo(() => {
    if (!computedHostId) return rawPeers;
    return rawPeers.map(p => ({
      ...p,
      isHost: p.odataId === computedHostId,
    }));
  }, [rawPeers, computedHostId]);

  const myPeerId = peerIdRef.current;
  const amIHost = computedHostId === myPeerId;
  const peerCountRef = useRef(1);
  useEffect(() => {
    peerCountRef.current = Math.max(peers.length, 1);
  }, [peers.length]);



  // Notify player ready — triggers sync request after YT player is initialized
  const notifyPlayerReady = useCallback(() => {
    setPlayerReadyTick((tick) => tick + 1);
  }, []);

  const sendRequestSync = useCallback((cooldownMs = 500) => {
    if (!channelRef.current) return;
    const now = Date.now();
    if (now - lastSyncRequestAtRef.current < cooldownMs) return;
    lastSyncRequestAtRef.current = now;
    channelRef.current.send({
      type: "broadcast",
      event: "request_sync",
      payload: { from: nickname, timestamp: now },
    });
  }, [nickname]);

  // When player becomes ready and we're not host, request sync again (for seek accuracy)
  useEffect(() => {
    if (playerReadyTick === 0 || !channelRef.current) return;
    if (amIHost) return;
    sendRequestSync(300);
  }, [playerReadyTick, amIHost, sendRequestSync]);

  useEffect(() => {
    if (!roomId || !nickname) return;

    setConnectionStatus("connecting");

    const peerId = peerIdRef.current;
    let isActive = true;
    const connectTimeout = window.setTimeout(() => {
      if (!isActive) return;
      setConnectionStatus("error");
      addSystemMessage("Unable to establish connection. Please retry joining the room.");
    }, 10000);

    const channel = supabase.channel(`sync-watch:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "sync" }, ({ payload }) => {
        const amCurrentHost = hostIdRef.current === peerId;
        if (!amCurrentHost || guestControlRef.current) {
          const state = payload as SyncState;
          const applied = applyIncomingSyncState(
            state,
            payload.sentAt ?? payload.timestamp ?? Date.now(),
            "sync"
          );
          if (applied) {
            showEvent(`${payload.from ?? "Host"} synced to ${formatTime(state.currentTime)}`);
          }
        }
      })
      .on("broadcast", { event: "video_change" }, ({ payload }) => {
        const applied = applyIncomingSyncState(
          payload.state as SyncState,
          payload.state?.sentAt ?? payload.state?.timestamp ?? Date.now(),
          "video_change"
        );
        if (applied) {
          showEvent(`${payload.from ?? "Host"} changed video`);
          addSystemMessage(`${payload.from ?? "Host"} changed video`);
        }
      })
      .on("broadcast", { event: "guest_control_toggle" }, ({ payload }) => {
        setGuestControlEnabled(payload.enabled);
        addSystemMessage(payload.enabled ? "Host enabled guest control" : "Host disabled guest control");
        if (!payload.enabled && payload.hostState) {
          const applied = applyIncomingSyncState(
            payload.hostState as SyncState,
            payload.hostState?.sentAt ?? payload.hostState?.timestamp ?? Date.now(),
            "host_state"
          );
          if (applied) {
            showEvent("Re-syncing to Host...");
          }
        }
      })
      .on("broadcast", { event: "host_transfer" }, ({ payload }) => {
        setHostId(payload.newHostId);
        addSystemMessage(`Host transferred to ${payload.newHostNickname}`);
        showEvent(`${payload.newHostNickname} is now the Host`);
      })
      .on("broadcast", { event: "request_sync" }, () => {
        const amCurrentHost = hostIdRef.current ? hostIdRef.current === peerId : isHostRef.current;
        if (amCurrentHost) {
          channel.send({
            type: "broadcast",
            event: "guest_control_toggle",
            payload: { enabled: guestControlRef.current },
          });
          if (onSyncRequestRef.current) {
            onSyncRequestRef.current();
          }
        }
      })
      .on("broadcast", { event: "chat_message" }, ({ payload }) => {
        const msg: ChatMessage = {
          id: Math.random().toString(36).slice(2),
          sender: payload.sender,
          text: payload.text,
          timestamp: payload.timestamp,
        };
        setChatMessages(prev => [...prev.slice(-99), msg]);
      })
      .on("broadcast", { event: "system_message" }, ({ payload }) => {
        addSystemMessage(payload.text);
      })
      .on("broadcast", { event: "queue_update" }, ({ payload }) => {
        setQueue(payload.queue as QueueItem[]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const peerList: Peer[] = [];
        for (const key of Object.keys(state)) {
          const entries = state[key] as any[];
          for (const entry of entries) {
            peerList.push({
              odataId: entry.peerId,
              nickname: entry.nickname,
              avatar: typeof entry.avatar === "string" ? entry.avatar : undefined,
              isHost: entry.isHost,
              joinedAt: entry.joinedAt,
            });
          }
        }
        setRawPeers(peerList);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        let hasRemoteJoin = false;
        for (const p of newPresences as any[]) {
          if (p.peerId !== peerId) {
            hasRemoteJoin = true;
            addSystemMessage(`${p.nickname} joined the room`);
          }
        }

        const amCurrentHost = hostIdRef.current ? hostIdRef.current === peerId : isHostRef.current;
        if (hasRemoteJoin && amCurrentHost && onSyncRequestRef.current) {
          // Give the newcomer time to initialize, then push one authoritative snapshot.
          window.setTimeout(() => {
            if (onSyncRequestRef.current) {
              onSyncRequestRef.current();
            }
          }, 900);
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        for (const p of leftPresences as any[]) {
          addSystemMessage(`${p.nickname} left the room`);
        }
        // Host succession is handled reactively via computedHostId
      })
      .subscribe(async (status) => {
        if (!isActive) return;

        if (status === "SUBSCRIBED") {
          window.clearTimeout(connectTimeout);
          setConnectionStatus("connected");
          await channel.track({
            peerId,
            nickname,
            avatar,
            isHost,
            joinedAt: Date.now(),
          });
          if (isHost) {
            setHostId(peerId);
          } else {
            // Immediately request sync so new joiners get the current video + state
            sendRequestSync(0);
          }
          return;
        }

        if (status === "TIMED_OUT") {
          window.clearTimeout(connectTimeout);
          setConnectionStatus("reconnecting");
          addSystemMessage("Connection timed out. Reconnecting...");
          return;
        }

        if (status === "CLOSED") {
          window.clearTimeout(connectTimeout);
          setConnectionStatus("reconnecting");
          return;
        }

        if (status === "CHANNEL_ERROR") {
          window.clearTimeout(connectTimeout);
          setConnectionStatus("error");
          addSystemMessage("Connection error. Try re-syncing in a moment.");
        }
      });

    channelRef.current = channel;

    return () => {
      isActive = false;
      window.clearTimeout(connectTimeout);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [roomId, nickname, avatar, sendRequestSync]);

  const broadcast = useCallback(
    (event: string, payload: any) => {
      if (!channelRef.current) return;
      channelRef.current.send({ type: "broadcast", event, payload });
    },
    []
  );

  const broadcastSync = useCallback(
    (state: SyncState) => {
      const sentAt = Date.now();
      const payload = normalizeSyncState(state, sentAt);
      broadcast("sync", { ...payload, from: nickname });
    },
    [broadcast, nickname, normalizeSyncState]
  );

  const broadcastVideoChange = useCallback(
    (state: SyncState) => {
      const sentAt = Date.now();
      const payload = normalizeSyncState(state, sentAt);
      broadcast("video_change", { state: payload, from: nickname });
    },
    [broadcast, nickname, normalizeSyncState]
  );

  const toggleGuestControl = useCallback(
    (enabled: boolean, currentHostState?: SyncState | null) => {
      guestControlRef.current = enabled;
      setGuestControlEnabled(enabled);
      broadcast("guest_control_toggle", {
        enabled,
        hostState: !enabled ? currentHostState : undefined,
      });
    },
    [broadcast]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      const payload = { sender: nickname, text, timestamp: Date.now() };
      broadcast("chat_message", payload);
      setChatMessages(prev => [...prev.slice(-99), {
        id: Math.random().toString(36).slice(2),
        ...payload,
      }]);
    },
    [broadcast, nickname]
  );

  const requestSync = useCallback(() => {
    sendRequestSync(350);
  }, [sendRequestSync]);

  const canControl = amIHost || guestControlEnabled;

  const broadcastQueue = useCallback(
    (newQueue: QueueItem[]) => {
      setQueue(newQueue);
      broadcast("queue_update", { queue: newQueue });
    },
    [broadcast]
  );

  const addToQueue = useCallback(
    (videoId: string, title?: string) => {
      const item: QueueItem = { id: Math.random().toString(36).slice(2, 8), videoId, title };
      const newQueue = [...queue, item];
      broadcastQueue(newQueue);
      addSystemMessage(`Added to queue: ${title || videoId}`);
    },
    [queue, broadcastQueue, addSystemMessage]
  );

  const removeFromQueue = useCallback(
    (itemId: string) => {
      broadcastQueue(queue.filter(q => q.id !== itemId));
    },
    [queue, broadcastQueue]
  );

  const moveInQueue = useCallback(
    (fromIndex: number, toIndex: number) => {
      const newQueue = [...queue];
      const [moved] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, moved);
      broadcastQueue(newQueue);
    },
    [queue, broadcastQueue]
  );

  const playFromQueue = useCallback(
    (itemId: string): QueueItem | undefined => {
      const item = queue.find(q => q.id === itemId);
      if (item) {
        broadcastQueue(queue.filter(q => q.id !== itemId));
      }
      return item;
    },
    [queue, broadcastQueue]
  );

  const playNextFromQueue = useCallback(
    (): QueueItem | undefined => {
      if (queue.length === 0) return undefined;
      const [next, ...rest] = queue;
      broadcastQueue(rest);
      return next;
    },
    [queue, broadcastQueue]
  );

  // Reset all state (called externally on leave)
  const resetState = useCallback(() => {
    setSyncState(null);
    setRawPeers([]);
    setLastEvent(null);
    setGuestControlEnabled(false);
    setChatMessages([]);
    setSystemMessages([]);
    setHostId(null);
    setPlayerReadyTick(0);
    setQueue([]);
    setConnectionStatus("idle");
    lastAppliedSyncSentAtRef.current = 0;
    lastAuthoritativeSwitchSentAtRef.current = 0;
    latestVideoIdRef.current = null;
  }, []);

  return {
    syncState,
    peers,
    peerCount: peers.length,
    lastEvent,
    guestControlEnabled,
    chatMessages,
    systemMessages,
    canControl,
    amIHost,
    myPeerId,
    hostId: computedHostId,
    queue,
    connectionStatus,
    broadcast,
    broadcastSync,
    broadcastVideoChange,
    toggleGuestControl,
    sendChatMessage,
    requestSync,
    onSyncRequestRef,
    notifyPlayerReady,
    resetState,
    addToQueue,
    removeFromQueue,
    moveInQueue,
    playFromQueue,
    playNextFromQueue,
    SYNC_THRESHOLD,
  };
}


