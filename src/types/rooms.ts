export interface Room {
  id: string;
  host_nickname: string;
  host_avatar: string | null;
  member_count: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}
