import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate } from "react-router-dom";
import { ListMusic, Plus, Trash2, Pencil, Check, X, MoreVertical } from "lucide-react";
import { buildYouTubeThumbnailUrl } from "@/lib/urls";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/PageHeader";

export default function Playlists() {
  const { playlists, createPlaylist, deletePlaylist, renamePlaylist, t } = useSettings();
  const navigate = useNavigate();
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const composingRef = useRef(false);

  const handleCreate = () => {
    if (newName.trim()) {
      createPlaylist(newName.trim());
      setNewName("");
      setShowNew(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renamePlaylist(id, editName.trim());
    }
    setEditingId(null);
  };

  const startEdit = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        title={t.sidebar.playlists}
        badge={`${playlists.length} ${t.playlists.videos}`}
        description={playlists.length === 0 ? t.playlists.empty : undefined}
        actions={!showNew ? (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t.playlists.create}
          </Button>
        ) : undefined}
      />

      {showNew && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !composingRef.current) handleCreate();
              if (e.key === "Escape") { setShowNew(false); setNewName(""); }
            }}
            onCompositionStart={() => { composingRef.current = true; }}
            onCompositionEnd={() => { composingRef.current = false; }}
            placeholder={t.playlists.namePlaceholder}
            className="flex-1 text-sm px-3 py-2 rounded-md bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
          />
          <Button size="sm" onClick={handleCreate}>
            {t.playlists.confirmCreate}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowNew(false); setNewName(""); }}>
            {t.common.cancel}
          </Button>
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <ListMusic className="w-12 h-12" />
          <p>{t.playlists.empty}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {playlists.map((pl) => {
            const coverThumb = pl.videoIds.length > 0
              ? buildYouTubeThumbnailUrl(pl.videoIds[0])
              : null;
            const isEditing = editingId === pl.id;

            return (
              <div key={pl.id} className="group flex flex-col gap-1.5">
                {/* Thumbnail card */}
                <div
                  className="relative aspect-video rounded-xl overflow-hidden bg-muted cursor-pointer"
                  onClick={() => !isEditing && navigate(`/playlist/${pl.id}`)}
                >
                  {coverThumb ? (
                    <img src={coverThumb} alt={pl.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ListMusic className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}
                  {/* Bottom overlay: name + count */}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2 flex items-end justify-between gap-2">
                    <p className="text-sm font-semibold text-white line-clamp-1 flex-1 min-w-0">{pl.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <ListMusic className="w-3 h-3 text-white/80" />
                      <span className="text-xs text-white/80 font-medium">
                        {pl.videoIds.length} {t.playlists.videos}
                      </span>
                    </div>
                  </div>
                  {/* Top-right ⋮ menu */}
                  {!isEditing && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="icon" className="h-7 w-7 bg-black/60 hover:bg-black/80 border-0 text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => startEdit(pl.id, pl.name)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t.playlists.rename}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteTarget(pl.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.common.delete}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>

                {/* Inline rename input (only shown when editing) */}
                {isEditing && (
                  <div className="flex gap-1 items-center px-1">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 text-sm px-2 py-1 rounded bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => handleRename(pl.id)}>
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingId(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.playlists.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.playlists.deleteConfirmDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) deletePlaylist(deleteTarget); setDeleteTarget(null); }}
            >
              {t.common.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
