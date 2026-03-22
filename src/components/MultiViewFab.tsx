import { useMultiView } from "@/contexts/MultiViewContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useNavigate, useLocation } from "react-router-dom";
import { MonitorPlay } from "lucide-react";

export function MultiViewFab() {
  const { selectedIds } = useMultiView();
  const { t } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  if (selectedIds.length === 0 || location.pathname === "/multi-view") return null;

  return (
    <button
      onClick={() => navigate("/multi-view")}
      className="fixed bottom-24 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 animate-in slide-in-from-bottom-4 md:bottom-6 md:right-6"
    >
      <MonitorPlay className="w-5 h-5" />
      <span className="text-sm font-semibold">
        {t.multiView.open} ({selectedIds.length})
      </span>
    </button>
  );
}
