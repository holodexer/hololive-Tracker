import { useState, useMemo } from "react";
import { useHololiveChannels, useHolodexStreams } from "@/hooks/useHolodex";
import { useSettings } from "@/contexts/SettingsContext";
import { Loader2, Heart, Search, Filter } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { getDisplayName } from "@/lib/utils";

const Members = () => {
  const { data: channels, isLoading } = useHololiveChannels();
  const { data: streamData } = useHolodexStreams();
  const { toggleFavorite, isFavorite, hideInactive, locale, t } = useSettings();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [genFilter, setGenFilter] = useState<string>("all");

  const liveChannelIds = new Set(streamData?.live?.map((v) => v.channel.id) ?? []);

  const vtubers = useMemo(() => {
    let list = channels?.filter((ch) => ch.type === "vtuber") ?? [];
    if (hideInactive) list = list.filter((ch) => !ch.inactive);
    return list;
  }, [channels, hideInactive]);

  const generations = useMemo(() => {
    const groups = new Set(vtubers.map((ch) => ch.group).filter(Boolean) as string[]);
    return Array.from(groups).sort();
  }, [vtubers]);

  const filtered = useMemo(() => {
    // Exclude favorites from the main list to avoid duplication
    let list = vtubers.filter((ch) => !isFavorite(ch.id));
    if (genFilter !== "all") list = list.filter((ch) => ch.group === genFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          (ch.english_name?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [vtubers, genFilter, search, isFavorite]);

  const favoriteChannels = vtubers.filter((ch) => isFavorite(ch.id));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t.members.title}</h1>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.members.search}
            className="pl-9"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={genFilter}
            onChange={(e) => setGenFilter(e.target.value)}
            className="pl-9 pr-4 h-10 rounded-md border border-input bg-background text-foreground text-sm appearance-none cursor-pointer"
          >
            <option value="all">{t.members.allGenerations}</option>
            {generations.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Favorites (pinned top) */}
      {favoriteChannels.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-pink-400 fill-current" />
            <h2 className="text-lg font-semibold text-foreground">{t.members.favorites}</h2>
          </div>
          <div className="space-y-2">
            {favoriteChannels.map((ch) => (
              <MemberRow
                key={ch.id}
                channel={ch}
                isLive={liveChannelIds.has(ch.id)}
                isFav={true}
                locale={locale}
                subscribersLabel={t.members.subscribers}
                onToggleFav={() => toggleFavorite(ch.id)}
                onClick={() => navigate(`/member/${ch.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Members List (excluding favorites) */}
      <section>
        <div className="space-y-2">
          {filtered.map((ch) => (
            <MemberRow
              key={ch.id}
              channel={ch}
              isLive={liveChannelIds.has(ch.id)}
              isFav={false}
              locale={locale}
              subscribersLabel={t.members.subscribers}
              onToggleFav={() => toggleFavorite(ch.id)}
              onClick={() => navigate(`/member/${ch.id}`)}
            />
          ))}
          {filtered.length === 0 && (
            <p className="text-muted-foreground text-sm py-4">{t.members.noFound}</p>
          )}
        </div>
      </section>
    </div>
  );
};

function MemberRow({
  channel,
  isLive,
  isFav,
  locale,
  subscribersLabel,
  onToggleFav,
  onClick,
}: {
  channel: { id: string; name: string; english_name?: string; photo?: string; group?: string; subscriber_count?: number };
  isLive: boolean;
  isFav: boolean;
  locale: string;
  subscribersLabel: string;
  onToggleFav: () => void;
  onClick: () => void;
}) {
  const name = getDisplayName(channel, locale as any);

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors">
      <button onClick={onClick} className="shrink-0">
        <img
          src={channel.photo ?? ""}
          alt={name}
          className={`w-12 h-12 rounded-full object-cover ${
            isLive ? "ring-3 ring-live animate-pulse-live" : ""
          }`}
        />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{name}</span>
          {isLive && (
            <span className="text-[10px] font-bold text-live uppercase px-1.5 py-0.5 rounded bg-live/20 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
              </span>
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {channel.group && (
            <span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">{channel.group}</span>
          )}
          {channel.subscriber_count != null && (
            <span className="text-xs text-muted-foreground">
              {channel.subscriber_count.toLocaleString()} {subscribersLabel}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        className={`p-2 rounded-full transition-colors ${
          isFav ? "text-pink-400" : "text-muted-foreground hover:text-pink-400"
        }`}
      >
        <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}

export default Members;
