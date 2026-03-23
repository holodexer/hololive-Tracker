import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Room } from '@/types/rooms';

export function useRoomsList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchRooms = useCallback(async () => {
    // Remove rooms whose heartbeat went stale (host closed tab without leaving)
    await supabase
      .from('rooms')
      .delete()
      .lt('updated_at', new Date(Date.now() - 2 * 60 * 1000).toISOString());

    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setRooms(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRooms();

    channelRef.current = supabase
      .channel('rooms-lobby')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRooms((prev) => [payload.new as Room, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Room;
            setRooms((prev) =>
              updated.status === 'inactive'
                ? prev.filter((r) => r.id !== updated.id)
                : prev.map((r) => (r.id === updated.id ? updated : r))
            );
          } else if (payload.eventType === 'DELETE') {
            setRooms((prev) => prev.filter((r) => r.id !== (payload.old as Room).id));
          }
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchRooms]);

  return { rooms, isLoading };
}

// Upsert room when host creates/enters
export async function upsertRoom(room: Omit<Room, 'created_at' | 'updated_at'>) {
  await supabase.from('rooms').upsert(room, { onConflict: 'id' });
}

// Update member count and/or host info in place (used by the current host)
export async function updateRoomInfo(id: string, patch: Partial<Pick<Room, 'host_nickname' | 'host_avatar' | 'member_count'>>) {
  await supabase.from('rooms').update(patch).eq('id', id);
}

// Hard-delete the room row when host leaves
export async function deactivateRoom(id: string) {
  await supabase.from('rooms').delete().eq('id', id);
}

// Touch updated_at so the room doesn't get pruned as stale
export async function heartbeatRoom(id: string) {
  await supabase.from('rooms').update({ updated_at: new Date().toISOString() }).eq('id', id);
}

// Increment member count when someone joins
export async function incrementRoomMembers(id: string) {
  await supabase.rpc('increment_room_members', { room_id: id });
}

// Decrement member count when someone leaves
export async function decrementRoomMembers(id: string) {
  await supabase.rpc('decrement_room_members', { room_id: id });
}
