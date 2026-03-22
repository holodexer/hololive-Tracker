import { useQuery } from "@tanstack/react-query";
import {
  fetchHololiveLive,
  fetchHololiveChannels,
  fetchChannelDetails,
  fetchChannelLiveAndUpcoming,
  fetchChannelVideos,
  fetchChannelClips,
  fetchHololiveClips,
  fetchHololivePastStreams,
  type HolodexVideo,
} from "@/lib/holodex";
import { addDays, isAfter, isBefore } from "date-fns";

export function useHolodexStreams() {
  return useQuery({
    queryKey: ["holodex-live"],
    queryFn: fetchHololiveLive,
    refetchInterval: 60_000,
    select: (data: HolodexVideo[]) => {
      const now = new Date();
      const fiveDaysOut = addDays(now, 5);
      const live = data.filter((v) => v.status === "live");
      const upcoming = data
        .filter(
          (v) =>
            v.status === "upcoming" &&
            isBefore(new Date(v.available_at), fiveDaysOut) &&
            isAfter(new Date(v.available_at), now)
        )
        .sort((a, b) => new Date(a.available_at).getTime() - new Date(b.available_at).getTime());
      return { live, upcoming };
    },
  });
}

export function useHololiveChannels() {
  return useQuery({
    queryKey: ["holodex-channels"],
    queryFn: fetchHololiveChannels,
    staleTime: 1000 * 60 * 30,
  });
}

export function useChannelDetails(channelId: string) {
  return useQuery({
    queryKey: ["holodex-channel", channelId],
    queryFn: () => fetchChannelDetails(channelId),
    enabled: !!channelId,
    staleTime: 1000 * 60 * 10,
  });
}

export function useChannelLiveUpcoming(channelId: string) {
  return useQuery({
    queryKey: ["holodex-channel-live", channelId],
    queryFn: () => fetchChannelLiveAndUpcoming(channelId),
    enabled: !!channelId,
    refetchInterval: 60_000,
  });
}

export function useChannelPastStreams(channelId: string, limit: number) {
  return useQuery({
    queryKey: ["holodex-channel-past", channelId, limit],
    queryFn: () => fetchChannelVideos(channelId, "stream", "past", limit, 0),
    enabled: !!channelId,
  });
}

export function useChannelClips(channelId: string, limit: number, lang = "en") {
  return useQuery({
    queryKey: ["holodex-channel-clips", channelId, limit, lang],
    queryFn: () => fetchChannelClips(channelId, limit, 0, lang),
    enabled: !!channelId,
  });
}

export function useHololiveClips(limit: number, lang = "en") {
  return useQuery({
    queryKey: ["holodex-org-clips", limit, lang],
    queryFn: () => fetchHololiveClips(limit, 0, lang),
  });
}

export function useHololivePastStreams(limit: number) {
  return useQuery({
    queryKey: ["holodex-org-past", limit],
    queryFn: () => fetchHololivePastStreams(limit, 0),
  });
}
