import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/contexts/SettingsContext";
import { triggerCinema } from "@/components/CinemaOverlay";
import { fetchVideoDetails } from "@/lib/holodex";
import { Trash2, Play, ListMusic, ArrowLeft, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
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

export default function Playlist() {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const { playlists, removeFromPlaylist, deletePlaylist, renamePlaylist, directYoutube, getVideoMeta, t } = useSettings();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
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

  const handlePlay = (videoId: string) => {
    if (directYoutube) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsEditing(false);
                }}
                className="text-xl font-bold px-2 py-1 rounded-md bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring flex-1"
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
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground truncate">{playlist.name}</h1>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={startEdit}>
                <Pencil className="w-4 h-4" />
              </Button>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {playlist.videoIds.length} {t.playlists.videos}
          </p>
        </div>
      </div>

      {/* Video list */}
      {playlist.videoIds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ListMusic className="w-10 h-10" />
          <p className="text-sm">{t.playlists.empty}</p>
        </div>
      ) : (
        <StaggerList className="space-y-2">
          {playlist.videoIds.map((videoId) => {
            const meta = getVideoMeta(videoId) ?? fetchedMeta[videoId];
            const thumbnail = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
            const displayName = meta?.title || videoId;
            return (
              <div
                key={videoId}
                className="flex items-center gap-4 p-3 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors group"
              >
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
                    href={`https://www.youtube.com/watch?v=${videoId}`}
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
    </div>
  );
}
