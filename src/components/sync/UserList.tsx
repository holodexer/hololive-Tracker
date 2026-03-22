import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type { Peer } from "@/hooks/useSyncWatch";

interface UserListProps {
  peers: Peer[];
  myPeerId: string;
  amIHost: boolean;
  guestControlEnabled: boolean;
  onToggleGuestControl: (enabled: boolean) => void;
  locale?: "en" | "zh-TW" | "ja";
}

const localeLabels = {
  en: { allowGuest: "Allow Guest Control", host: "Host", guest: "Guest", youIndicator: "(you)" },
  "zh-TW": { allowGuest: "允許訪客控制", host: "房主", guest: "訪客", youIndicator: "（你）" },
  ja: { allowGuest: "ゲスト操作を許可", host: "ホスト", guest: "ゲスト", youIndicator: "（あなた）" },
};

function getUserAccent(nickname: string) {
  let hash = 0;
  for (let index = 0; index < nickname.length; index += 1) {
    hash = nickname.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return {
    backgroundColor: `hsl(${hue} 70% 45%)`,
    boxShadow: `0 0 0 1px hsl(${hue} 70% 55% / 0.35) inset`,
  };
}

function getInitial(nickname: string) {
  return nickname.trim().charAt(0).toUpperCase() || "?";
}

export function UserList({ peers, myPeerId, amIHost, guestControlEnabled, onToggleGuestControl, locale = "en" }: UserListProps) {
  const l = localeLabels[locale];

  if (peers.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {peers.map((peer) => {
        const isMe = peer.odataId === myPeerId;
        return (
          <div
            key={peer.odataId}
            className="flex items-center gap-2.5 rounded-md border border-border/30 bg-card/50 px-3 py-2.5"
          >
            <div className="relative shrink-0">
              {peer.avatar ? (
                <img
                  src={peer.avatar}
                  alt={peer.nickname}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                  style={getUserAccent(peer.nickname)}
                >
                  {getInitial(peer.nickname)}
                </div>
              )}
              {peer.isHost && (
                <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border border-border/60">
                  <Crown className="w-2.5 h-2.5 text-primary" />
                </div>
              )}
            </div>
            <span className="text-sm text-foreground truncate flex-1">
              {peer.nickname}
              {isMe && <span className="text-muted-foreground ml-1">{l.youIndicator}</span>}
            </span>
            <Badge variant={peer.isHost ? "default" : "secondary"} className="px-1.5 py-0 text-[10px]">
              {peer.isHost ? l.host : l.guest}
            </Badge>
          </div>
        );
      })}

      {amIHost && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-3">
          <label htmlFor="guest-ctrl-sidebar" className="text-xs text-muted-foreground select-none cursor-pointer flex-1">
            {l.allowGuest}
          </label>
          <Switch
            id="guest-ctrl-sidebar"
            checked={guestControlEnabled}
            onCheckedChange={onToggleGuestControl}
          />
        </div>
      )}
    </div>
  );
}
