import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ReminderWatcher } from "@/components/ReminderWatcher";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { MultiViewProvider } from "@/contexts/MultiViewContext";
import { CinemaOverlay, useCinema } from "@/components/CinemaOverlay";
import { MultiViewFab } from "@/components/MultiViewFab";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ROUTE_FADE_OUT_MS, ROUTE_TRANSITION_CLASS } from "@/lib/transitions";
import Index from "./pages/Index.tsx";
import Members from "./pages/Members.tsx";
import MemberProfile from "./pages/MemberProfile.tsx";
import Jellyfin from "./pages/Jellyfin.tsx";
import Clips from "./pages/Clips.tsx";
import Playlist from "./pages/Playlist.tsx";
import Playlists from "./pages/Playlists.tsx";
import MultiView from "./pages/MultiView.tsx";
import SyncWatch from "./pages/SyncWatch.tsx";
import Favorites from "./pages/Favorites.tsx";
import NotFound from "./pages/NotFound.tsx";
import { ClipsOverlay } from "./components/sync/ClipsOverlay.tsx";

const queryClient = new QueryClient();

function AppContent() {
  const cinema = useCinema();
  const isMobile = useIsMobile();
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [pendingLocation, setPendingLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState<"fadeIn" | "fadeOut">("fadeIn");
  const isSyncRoute = displayLocation.pathname === "/sync";

  useEffect(() => {
    // Same route (pathname) updates should be immediate to avoid needless full-page fades,
    // e.g. SyncWatch search param changes or in-page overlay state reflected in URL.
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
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
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
                  <Routes location={displayLocation}>
                    <Route path="/" element={<Index />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/members" element={<Members />} />
                    <Route path="/k-hub" element={<Jellyfin />} />
                    <Route path="/member/:channelId" element={<MemberProfile />} />
                    <Route path="/clips" element={<Clips />} />
                    <Route path="/playlists" element={<Playlists />} />
                    <Route path="/playlist/:playlistId" element={<Playlist />} />
                    <Route path="/multi-view" element={<MultiView />} />
                    <Route path="/sync" element={null} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </div>
            </main>
          </div>
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
    </>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SettingsProvider>
          <MultiViewProvider>
            <HashRouter>
              <AppContent />
            </HashRouter>
          </MultiViewProvider>
        </SettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
