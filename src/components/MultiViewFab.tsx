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
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors animate-in slide-in-from-bottom-4"
    >
      <MonitorPlay className="w-5 h-5" />
      <span className="text-sm font-semibold">
        {t.multiView.open} ({selectedIds.length})
      </span>
    </button>
  );
}
