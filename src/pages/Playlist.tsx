import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerCinema } from "@/components/CinemaOverlay";
import { fetchVideoDetails } from "@/lib/holodex";
import { buildYouTubeThumbnailUrl, buildYouTubeWatchUrl } from "@/lib/urls";
import { Trash2, Play, ListMusic, ArrowLeft, Pencil, Check, X, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StaggerList } from "@/components/StaggerList";
import { PageHeader } from "@/components/PageHeader";

type SortMode = "added-desc" | "added-asc" | "title-asc" | "channel-asc";

export default function Playlist() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { playlists, removeFromPlaylist, deletePlaylist, renamePlaylist, directYoutube, getVideoMeta, recordRecentVideo, t } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("added-desc");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const composingRef = useRef(false);

  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <ListMusic className="w-12 h-12" />
        <p>{t.errors.playlistNotFound}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t.nav.home}
        </Button>
      </div>
    );
  }

  const missingMetaIds = playlist.videoIds.filter((videoId) => !getVideoMeta(videoId)?.title);

  const { data: fetchedMeta = {} } = useQuery<Record<string, { title: string; channelName: string }>>({
    queryKey: ["playlist-missing-meta", playlist.id, missingMetaIds.join(",")],
    enabled: missingMetaIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        missingMetaIds.map(async (videoId) => {
          try {
            const video = await fetchVideoDetails(videoId);
            return [videoId, { title: video.title, channelName: video.channel?.name || "" }] as const;
          } catch {
            return null;
          }
        })
      );
      return Object.fromEntries(results.filter((entry): entry is readonly [string, { title: string; channelName: string }] => entry !== null));
    },
  });

  const entries = useMemo(() => {
    return playlist.videoIds.map((videoId, index) => {
      const meta = getVideoMeta(videoId) ?? fetchedMeta[videoId];
      return {
        videoId,
        index,
        meta,
        title: meta?.title ?? videoId,
        channelName: meta?.channelName ?? "",
        thumbnail: buildYouTubeThumbnailUrl(videoId, "hq720"),
      };
    });
  }, [playlist.videoIds, getVideoMeta, fetchedMeta]);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    let nextEntries = entries;

    if (normalizedSearch) {
      nextEntries = nextEntries.filter((entry) => {
        const haystack = `${entry.title} ${entry.channelName} ${entry.videoId}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }

    const sortedEntries = [...nextEntries];
    sortedEntries.sort((left, right) => {
      switch (sortMode) {
        case "added-asc":
          return left.index - right.index;
        case "title-asc":
          return left.title.localeCompare(right.title);
        case "channel-asc":
          return left.channelName.localeCompare(right.channelName) || left.title.localeCompare(right.title);
        case "added-desc":
        default:
          return right.index - left.index;
      }
    });

    return sortedEntries;
  }, [entries, search, sortMode]);

  const selectedCount = selectedIds.length;
  const allVisibleSelected = filteredEntries.length > 0 && filteredEntries.every((entry) => selectedIds.includes(entry.videoId));

  const handlePlay = (videoId: string) => {
    const meta = getVideoMeta(videoId) ?? fetchedMeta[videoId];
    recordRecentVideo({
      id: videoId,
      title: meta?.title ?? videoId,
      channelName: meta?.channelName ?? "",
      thumbnail: buildYouTubeThumbnailUrl(videoId, "hq720"),
      status: "past",
    });

    if (directYoutube) {
      window.open(buildYouTubeWatchUrl(videoId), "_blank");
    } else {
      triggerCinema(videoId);
    }
  };

  const handleDelete = () => {
    deletePlaylist(playlist.id);
    navigate("/");
  };

  const startEdit = () => {
    setEditName(playlist.name);
    setIsEditing(true);
  };

  const handleRename = () => {
    if (editName.trim()) {
      renamePlaylist(playlist.id, editName.trim());
    }
    setIsEditing(false);
  };

  const toggleSelected = (videoId: string, checked: boolean) => {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(videoId) ? current : [...current, videoId];
      }

      return current.filter((id) => id !== videoId);
    });
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode((current) => {
      if (current) {
        setSelectedIds([]);
      }
      return !current;
    });
  };

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !filteredEntries.some((entry) => entry.videoId === id)));
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      filteredEntries.forEach((entry) => next.add(entry.videoId));
      return Array.from(next);
    });
  };

  const handleBulkRemove = () => {
    selectedIds.forEach((videoId) => removeFromPlaylist(playlist.id, videoId));
    setSelectedIds([]);
    setSelectionMode(false);
    setShowBulkDeleteConfirm(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mt-3 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <PageHeader
          className="flex-1"
          title={playlist.name}
          badge={`${playlist.videoIds.length} ${t.playlists.videos}`}
          actions={
            <div className="flex items-center gap-2">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setIsEditing(false);
                    }}
                    onCompositionStart={() => {
                      composingRef.current = true;
                    }}
                    onCompositionEnd={() => {
                      composingRef.current = false;
                    }}
                    className="w-[220px] max-w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    autoFocus
                  />
                  <Button size="icon" variant="ghost" onClick={handleRename}>
                    <Check className="w-4 h-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={startEdit}>
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                {t.common.delete}
              </Button>
            </div>
          }
        />
      </div>

      {playlist.videoIds.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.playlists.searchPlaceholder}
                className="pl-9"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <SlidersHorizontal className="h-4 w-4" />
                <span>{t.playlists.sortLabel}</span>
              </div>
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="added-desc">{t.playlists.sortNewest}</SelectItem>
                  <SelectItem value="added-asc">{t.playlists.sortOldest}</SelectItem>
                  <SelectItem value="title-asc">{t.playlists.sortTitle}</SelectItem>
                  <SelectItem value="channel-asc">{t.playlists.sortChannel}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant={selectionMode ? "default" : "outline"} size="sm" onClick={handleToggleSelectionMode}>
                {selectionMode ? t.playlists.clearSelection : t.playlists.selectionMode}
              </Button>
              <Button size="sm" onClick={() => handlePlay(filteredEntries[0].videoId)} disabled={filteredEntries.length === 0}>
                <Play className="w-4 h-4 mr-2" />
                {t.playlists.playFirst}
              </Button>
            </div>
          </div>

          {selectionMode && (
            <div className="mt-3 flex flex-col gap-3 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Checkbox checked={allVisibleSelected} onCheckedChange={() => handleSelectAllVisible()} />
                <span>{t.playlists.selectAllVisible}</span>
                <span>{selectedCount} {t.playlists.selectedCount}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteConfirm(true)}
                disabled={selectedCount === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {t.playlists.removeSelected}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Video list */}
      {playlist.videoIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ListMusic className="w-10 h-10" />
          <p className="text-sm">{t.playlists.empty}</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-muted-foreground gap-3">
          <Search className="w-8 h-8" />
          <p className="text-sm">{t.playlists.noMatches}</p>
        </div>
      ) : (
        <StaggerList className="space-y-2">
          {filteredEntries.map(({ videoId, meta, thumbnail, title }) => {
            const displayName = title;
            const selected = selectedIds.includes(videoId);
            return (
              <div
                key={videoId}
                className={`flex items-center gap-4 p-3 rounded-lg bg-card border transition-colors group ${
                  selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                {selectionMode && (
                  <Checkbox checked={selected} onCheckedChange={(checked) => toggleSelected(videoId, Boolean(checked))} />
                )}
                <button
                  onClick={() => handlePlay(videoId)}
                  className="relative shrink-0 w-40 aspect-video rounded-md overflow-hidden"
                >
                  <img src={thumbnail} alt={displayName} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-8 h-8 text-foreground fill-current" />
                  </div>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {meta?.channelName && (
                    <p className="text-xs text-muted-foreground truncate">{meta.channelName}</p>
                  )}
                  <a
                    href={buildYouTubeWatchUrl(videoId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    {meta?.title ? `youtube.com/watch?v=${videoId}` : videoId}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFromPlaylist(playlist.id, videoId)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={selectionMode}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </StaggerList>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.playlists.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.playlists.deleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.playlists.removeSelectedTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.playlists.removeSelectedDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkRemove}
            >
              {t.playlists.removeSelected}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
