const API_KEY = "038e349b-d8b9-431b-b25e-7991e6779063";
const BASE_URL = "https://holodex.net/api/v2";

export interface HolodexChannel {
  id: string;
  name: string;
  english_name?: string;
  photo?: string;
  org?: string;
  group?: string;
  subscriber_count?: number;
  video_count?: number;
  description?: string;
  banner?: string;
  twitter?: string;
  type: string;
  inactive?: boolean;
}

export interface HolodexVideo {
  id: string;
  title: string;
  type: string;
  topic_id?: string;
  published_at?: string;
  available_at: string;
  duration?: number;
  status: "live" | "upcoming" | "past";
  live_viewers?: number;
  channel: {
    id: string;
    name: string;
    english_name?: string;
    photo?: string;
    org?: string;
  };
}

export async function fetchHololiveLive(): Promise<HolodexVideo[]> {
  const res = await fetch(`${BASE_URL}/live?org=Hololive&limit=50`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchHololiveChannels(): Promise<HolodexChannel[]> {
  const all: HolodexChannel[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(
      `${BASE_URL}/channels?org=Hololive&limit=${limit}&offset=${offset}&sort=group&order=asc`,
      { headers: { "X-APIKEY": API_KEY } }
    );
    if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
    const batch: HolodexChannel[] = await res.json();
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

export async function fetchChannelDetails(channelId: string): Promise<HolodexChannel> {
  const res = await fetch(`${BASE_URL}/channels/${channelId}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchVideoDetails(videoId: string): Promise<HolodexVideo> {
  const res = await fetch(`${BASE_URL}/videos/${videoId}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchChannelVideos(
  channelId: string,
  type: "stream" | "clip" = "stream",
  status: "past" | "live" | "upcoming" = "past",
  limit = 50,
  offset = 0
): Promise<HolodexVideo[]> {
  const params = new URLSearchParams({
    channel_id: channelId,
    type,
    status,
    limit: String(limit),
    offset: String(offset),
    sort: "available_at",
    order: "desc",
  });
  const res = await fetch(`${BASE_URL}/videos?${params}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchChannelLiveAndUpcoming(channelId: string): Promise<HolodexVideo[]> {
  const res = await fetch(`${BASE_URL}/live?channel_id=${channelId}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchChannelClips(
  channelId: string,
  limit = 50,
  offset = 0,
  lang = "en"
): Promise<HolodexVideo[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    lang,
  });
  const res = await fetch(`${BASE_URL}/channels/${channelId}/clips?${params}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchHololiveClips(
  limit = 50,
  offset = 0,
  lang = "en"
): Promise<HolodexVideo[]> {
  const params = new URLSearchParams({
    org: "Hololive",
    type: "clip",
    lang,
    limit: String(limit),
    offset: String(offset),
    sort: "available_at",
    order: "desc",
  });
  const res = await fetch(`${BASE_URL}/videos?${params}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}

export async function fetchHololivePastStreams(
  limit = 50,
  offset = 0
): Promise<HolodexVideo[]> {
  const params = new URLSearchParams({
    org: "Hololive",
    type: "stream",
    status: "past",
    limit: String(limit),
    offset: String(offset),
    sort: "available_at",
    order: "desc",
  });
  const res = await fetch(`${BASE_URL}/videos?${params}`, {
    headers: { "X-APIKEY": API_KEY },
  });
  if (!res.ok) throw new Error(`Holodex API error: ${res.status}`);
  return res.json();
}
