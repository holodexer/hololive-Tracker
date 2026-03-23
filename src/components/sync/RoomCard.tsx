import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/rooms';

interface RoomCardProps {
  room: Room;
  onJoin: (roomId: string) => void;
  isJoining: boolean;
}

function AvatarFallback({ nickname }: { nickname: string }) {
  const initials = nickname
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span className="text-sm font-semibold text-primary-foreground select-none">
      {initials || '?'}
    </span>
  );
}

export function RoomCard({ room, onJoin, isJoining }: RoomCardProps) {
  const prevHostNicknameRef = useRef(room.host_nickname);
  const [hostFlash, setHostFlash] = useState(false);

  // Flash animation when host nickname changes (i.e. host changed)
  useEffect(() => {
    if (prevHostNicknameRef.current !== room.host_nickname) {
      prevHostNicknameRef.current = room.host_nickname;
      setHostFlash(true);
      const t = window.setTimeout(() => setHostFlash(false), 1800);
      return () => window.clearTimeout(t);
    }
  }, [room.host_nickname]);

  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:bg-card/80 hover:shadow-md">
      {/* Top row: avatar + host info + member count */}
      <div className="flex items-center gap-3">
        {/* Host avatar */}
        <div
          className={cn(
            'h-10 w-10 shrink-0 rounded-full bg-primary flex items-center justify-center overflow-hidden ring-2 ring-primary/20 transition-all duration-500',
            hostFlash && 'ring-primary ring-4 scale-105'
          )}
        >
          {room.host_avatar ? (
            <img
              src={room.host_avatar}
              alt={room.host_nickname}
              className="h-full w-full object-cover"
            />
          ) : (
            <AvatarFallback nickname={room.host_nickname} />
          )}
        </div>

        {/* Host name + room ID */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'truncate text-sm font-semibold text-foreground transition-colors duration-300',
              hostFlash && 'text-primary'
            )}
          >
            {room.host_nickname}
          </p>
          <p className="truncate text-xs text-muted-foreground font-mono">{room.id}</p>
        </div>

        {/* Member count */}
        <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Users className="h-3 w-3" />
          <span>{room.member_count}</span>
        </div>
      </div>

      {/* Join button */}
      <button
        onClick={() => onJoin(room.id)}
        disabled={isJoining}
        className={cn(
          'w-full rounded-xl border border-primary/30 bg-primary/10 py-2 text-sm font-medium text-primary transition-all duration-150',
          'hover:bg-primary/20 hover:border-primary/50 hover:shadow-sm active:scale-[0.98]',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isJoining ? '加入中…' : '加入房間'}
      </button>
    </div>
  );
}
