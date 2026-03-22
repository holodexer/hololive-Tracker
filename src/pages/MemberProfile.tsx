import { useParams } from "react-router-dom";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  useChannelDetails,
  useChannelLiveUpcoming,
} from "@/hooks/useHolodex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChannelVideos, fetchChannelClips, type HolodexVideo } from "@/lib/holodex";
import { filterUnavailableVideos } from "@/lib/videoFilters";
import { mixClipsByLanguage } from "@/lib/clipMixing";
import { useSettings } from "@/contexts/SettingsContext";
import { StreamCard } from "@/components/StreamCard";
import { LoadTransition } from "@/components/LoadTransition";
import { StaggerList } from "@/components/StaggerList";
import { Loader2, Heart, ExternalLink } from "lucide-react";
import { getDisplayName, getChannelPhotoUrl } from "@/lib/utils";
import { TAB_PANEL_TRANSITION_CLASS } from "@/lib/transitions";

const PAGE_SIZE = 50;

const MemberProfile = () => {
  const { channelId } = useParams<{ channelId: string }>();
  const { data: channel, isLoading } = useChannelDetails(channelId!);
  const { data: liveUpcoming } = useChannelLiveUpcoming(channelId!);
  const { toggleFavorite, isFavorite, locale, clipLanguages, hidePrivateVideos, t } = useSettings();

  const [activeTab, setActiveTab] = useState<"past" | "clips">("past");

  // Accumulated video lists
  const [pastVideos, setPastVideos] = useState<HolodexVideo[]>([]);
  const [clipVideos, setClipVideos] = useState<HolodexVideo[]>([]);
  const [pastPage, setPastPage] = useState(0);
  const [clipsPage, setClipsPage] = useState(0);
  const [pastHasMore, setPastHasMore] = useState(true);
  const [clipsHasMore, setClipsHasMore] = useState(true);
  const [pastLoadingMore, setPastLoadingMore] = useState(false);
  const [clipsLoadingMore, setClipsLoadingMore] = useState(false);

  const fallbackClipLang = locale === "ja" ? "ja" : locale === "zh-TW" ? "zh" : "en";
  const activeClipLangs = clipLanguages.length > 0 ? clipLanguages : [fallbackClipLang];
  const clipLangKey = activeClipLangs.join("|");

  // Reset clips when language changes
  useEffect(() => {
    setClipVideos([]);
    setClipsPage(0);
    setClipsHasMore(true);
  }, [locale, clipLangKey, hidePrivateVideos]);

  useEffect(() => {
    setPastVideos([]);
    setPastPage(0);
    setPastHasMore(true);
  }, [hidePrivateVideos]);

  // Initial data fetch (page 0)
  const { isLoading: pastInitLoading } = useQuery({
    queryKey: ["holodex-channel-past", channelId, clipLangKey, "init", hidePrivateVideos],
    queryFn: async () => {
      const data = await fetchChannelVideos(channelId!, "stream", "past", PAGE_SIZE, 0);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      setPastVideos(filtered);
      setPastPage(1);
      setPastHasMore(data.length >= PAGE_SIZE);
      return filtered;
    },
    enabled: !!channelId,
  });

  const { isLoading: clipsInitLoading } = useQuery({
    queryKey: ["holodex-channel-clips", channelId, clipLangKey, "init", locale, hidePrivateVideos],
    queryFn: async () => {
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchChannelClips(channelId!, PAGE_SIZE, 0, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos(filtered);
      setClipsPage(1);
      setClipsHasMore(results.some((result) => result.videos.length >= PAGE_SIZE));
      return filtered;
    },
    enabled: !!channelId,
  });

  const handleLoadMorePast = useCallback(async () => {
    setPastLoadingMore(true);
    try {
      const offset = pastPage * PAGE_SIZE;
      const data = await fetchChannelVideos(channelId!, "stream", "past", PAGE_SIZE, offset);
      const filtered = filterUnavailableVideos(data, hidePrivateVideos);
      setPastVideos((prev) => [...prev, ...filtered]);
      setPastPage((p) => p + 1);
      if (data.length < PAGE_SIZE) setPastHasMore(false);
    } finally {
      setPastLoadingMore(false);
    }
  }, [channelId, pastPage, hidePrivateVideos]);

  const handleLoadMoreClips = useCallback(async () => {
    setClipsLoadingMore(true);
    try {
      const offset = clipsPage * PAGE_SIZE;
      const results = await Promise.all(
        activeClipLangs.map(async (lang) => ({
          lang,
          videos: await fetchChannelClips(channelId!, PAGE_SIZE, offset, lang),
        }))
      );
      const mixed = mixClipsByLanguage(results);
      const filtered = filterUnavailableVideos(mixed, hidePrivateVideos);
      setClipVideos((prev) => [...prev, ...filtered]);
      setClipsPage((p) => p + 1);
      if (!results.some((result) => result.videos.length >= PAGE_SIZE)) setClipsHasMore(false);
    } finally {
      setClipsLoadingMore(false);
    }
  }, [channelId, clipsPage, clipLangKey, hidePrivateVideos]);

  if (isLoading || !channel) {
    return <LoadTransition loading={true}>null</LoadTransition>;
  }

  const displayName = getDisplayName(channel, locale);
  const isFav = isFavorite(channel.id);

  const live = filterUnavailableVideos(liveUpcoming?.filter((v) => v.status === "live") ?? [], hidePrivateVideos);
  const upcoming = filterUnavailableVideos(liveUpcoming?.filter((v) => v.status === "upcoming") ?? [], hidePrivateVideos);

  const tabs = [
    { key: "past" as const, label: t.profile.pastStreams },
    { key: "clips" as const, label: t.profile.clips },
  ];

  const bannerUrl = channel.banner
    ? channel.banner.includes("yt3.googleusercontent.com")
      ? `${channel.banner}=w2560`
      : channel.banner
    : null;

  return (
    <div className="space-y-8">
      {/* Hero Profile Card */}
      <div className="relative rounded-xl overflow-hidden bg-card border border-border">
        {bannerUrl ? (
          <div
            className="h-40 sm:h-48 bg-cover bg-center relative"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-card/80 to-transparent" />
          </div>
        ) : (
          <div className="h-40 sm:h-48 bg-gradient-to-r from-primary/30 via-primary/10 to-card" />
        )}
        <div className="px-6 pb-6 -mt-12 relative z-10">
          <div className="flex items-end gap-4">
            <img
              src={getChannelPhotoUrl(channel.photo)}
              alt={displayName}
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fallbackTried) {
                  img.dataset.fallbackTried = "1";
                  img.src = `https://unavatar.io/youtube/${channel.id}`;
                  return;
                }
                img.onerror = null;
                img.src = "/channel-placeholder.svg";
              }}
              className="w-24 h-24 rounded-full object-cover border-4 border-card"
            />
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-3">
                <h1
                  className="text-2xl font-bold text-foreground"
                  style={{ textShadow: "0 1px 6px rgba(0,0,0,0.7)" }}
                >
                  {displayName}
                </h1>
                <button
                  onClick={() => toggleFavorite(channel.id)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isFav ? "text-pink-400" : "text-muted-foreground hover:text-pink-400"
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} />
                </button>
                <a
                  href={`https://www.youtube.com/channel/${channel.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              {channel.group && (
                <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded mt-1 inline-block">
                  {channel.group}
                </span>
              )}
            </div>
          </div>

          <div className="flex gap-6 mt-4">
            <div>
              <span className="text-lg font-bold text-foreground">
                {channel.subscriber_count?.toLocaleString() ?? "—"}
              </span>
              <p className="text-xs text-muted-foreground">{t.profile.subscribers}</p>
            </div>
            <div>
              <span className="text-lg font-bold text-foreground">
                {channel.video_count?.toLocaleString() ?? "—"}
              </span>
              <p className="text-xs text-muted-foreground">{t.profile.videos}</p>
            </div>
          </div>

          {channel.description && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{channel.description}</p>
          )}
        </div>
      </div>

      {/* Live / Upcoming */}
      {(live.length > 0 || upcoming.length > 0) && (
        <section>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            {t.profile.liveUpcoming}
            {live.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-live/20 text-live text-xs font-semibold flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-live" />
                </span>
                {live.length} LIVE
              </span>
            )}
          </h2>
          <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...live, ...upcoming].map((s) => (
              <StreamCard key={s.id} stream={s} />
            ))}
          </StaggerList>
        </section>
      )}

      {/* Tabs */}
      <section>
        <div className="flex border-b border-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.key
                  ? "text-primary border-primary"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "past" && (
          <div key="tab-past" className={TAB_PANEL_TRANSITION_CLASS}>
            {pastInitLoading ? (
              <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
            ) : pastVideos.length === 0 ? (
              <p className="text-muted-foreground">{t.profile.noStreams}</p>
            ) : (
              <>
                <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pastVideos.map((s) => (
                    <StreamCard key={s.id} stream={s} />
                  ))}
                </StaggerList>
                {pastHasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleLoadMorePast(); }}
                      disabled={pastLoadingMore}
                      className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {pastLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                      {pastLoadingMore ? t.common.loading : t.common.loadMore}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === "clips" && (
          <div key="tab-clips" className={TAB_PANEL_TRANSITION_CLASS}>
            {clipsInitLoading ? (
              <LoadTransition loading={true} minHeightClassName="py-8" loaderClassName="w-6 h-6">null</LoadTransition>
            ) : clipVideos.length === 0 ? (
              <p className="text-muted-foreground">{t.profile.noClips}</p>
            ) : (
              <>
                <StaggerList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {clipVideos.map((s) => (
                    <StreamCard key={s.id} stream={s} />
                  ))}
                </StaggerList>
                {clipsHasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); handleLoadMoreClips(); }}
                      disabled={clipsLoadingMore}
                      className="px-6 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {clipsLoadingMore && <Loader2 className="w-4 h-4 animate-spin inline mr-2" />}
                      {clipsLoadingMore ? t.common.loading : t.common.loadMore}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default MemberProfile;
