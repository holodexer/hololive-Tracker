import { useEffect, useState } from "react";
import { useLocation, Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import { CinemaOverlay, useCinema } from "@/components/CinemaOverlay";
import { MultiViewFab } from "@/components/MultiViewFab";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import SyncWatch from "@/pages/SyncWatch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { ROUTE_FADE_OUT_MS, ROUTE_TRANSITION_CLASS } from "@/lib/transitions";

export function RootLayout() {
  const { theme } = useSettings();
  const cinema = useCinema();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [pendingLocation, setPendingLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<"fadeIn" | "fadeOut">("fadeIn");
  const isSyncRoute = displayLocation.pathname === "/sync";

  useEffect(() => {
    if (location.pathname === displayLocation.pathname) {
      setDisplayLocation(location);
      setPendingLocation(location);
      return;
    }

    setPendingLocation(location);
    setTransitionStage("fadeOut");
  }, [location, displayLocation.pathname]);

  useEffect(() => {
    if (transitionStage !== "fadeOut") return;
    const timer = window.setTimeout(() => {
      setDisplayLocation(pendingLocation);
      setTransitionStage("fadeIn");
    }, ROUTE_FADE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [transitionStage, pendingLocation]);

  return (
    <div className={cn("min-h-screen flex w-full bg-background text-foreground", theme)}>
      <SidebarProvider>
        {!isMobile && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <main
            className={cn("flex-1 overflow-auto", isMobile ? "p-3" : "p-6")}
            style={isMobile ? { paddingBottom: "calc(6.25rem + env(safe-area-inset-bottom, 0px))" } : undefined}
          >
            <div
              className={cn(
                ROUTE_TRANSITION_CLASS,
                transitionStage === "fadeOut" ? "opacity-0" : "opacity-100"
              )}
            >
              {/* Keep SyncWatch mounted globally so route switches do not drop realtime connection. */}
              <div className={cn(isSyncRoute ? "block" : "hidden")}>
                <SyncWatch />
              </div>

              <div className={cn(isSyncRoute ? "hidden" : "block")}>
                <Outlet />
              </div>
            </div>
          </main>
        </div>
      </SidebarProvider>
      {isMobile && <MobileBottomNav />}
      <GlobalSearch />
      <ReminderWatcher />
      <MultiViewFab />
      {cinema.payload?.videoId && (
        <CinemaOverlay
          videoId={cinema.payload.videoId}
          rememberChatPreference={cinema.payload.rememberChatPreference}
          onClose={cinema.close}
        />
      )}
    </div>
  );
}
