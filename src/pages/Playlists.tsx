import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate } from "react-router-dom";
import { ListMusic, Plus, Trash2, Pencil, Check, X } from "lucide-react";
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t.sidebar.playlists}</h1>
        {!showNew && (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t.playlists.create}
          </Button>
        )}
      </div>

      {showNew && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
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
        <StaggerList className="space-y-2" itemClassName="stagger-reveal">
          {playlists.map((pl) => {
            const coverThumb = pl.videoIds.length > 0
              ? `https://i.ytimg.com/vi/${pl.videoIds[0]}/mqdefault.jpg`
              : null;
            const isEditing = editingId === pl.id;

            return (
              <div
                key={pl.id}
                className="flex items-center gap-4 w-full p-4 rounded-lg bg-card border border-border hover:border-primary/40 transition-colors group"
              >
                <button
                  onClick={() => !isEditing && navigate(`/playlist/${pl.id}`)}
                  className="flex items-center gap-4 flex-1 min-w-0 text-left"
                >
                  {coverThumb ? (
                    <img src={coverThumb} alt={pl.name} className="w-16 aspect-video rounded-md object-cover shrink-0" />
                  ) : (
                    <ListMusic className="w-6 h-6 text-primary shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="flex-1 text-sm px-2 py-1 rounded-md bg-background border border-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRename(pl.id); }}>
                          <Check className="w-4 h-4 text-primary" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="font-medium text-foreground truncate">{pl.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pl.videoIds.length} {t.playlists.videos}
                        </p>
                      </>
                    )}
                  </div>
                </button>

                {!isEditing && (
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={(e) => { e.stopPropagation(); startEdit(pl.id, pl.name); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(pl.id); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </StaggerList>
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
