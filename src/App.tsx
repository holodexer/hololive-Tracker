import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { MultiViewProvider } from "@/contexts/MultiViewContext";
import { CinemaOverlay, useCinema } from "@/components/CinemaOverlay";
import { MultiViewFab } from "@/components/MultiViewFab";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Index from "./pages/Index.tsx";
import Members from "./pages/Members.tsx";
import MemberProfile from "./pages/MemberProfile.tsx";
import Clips from "./pages/Clips.tsx";
import Playlist from "./pages/Playlist.tsx";
import Playlists from "./pages/Playlists.tsx";
import MultiView from "./pages/MultiView.tsx";
import SyncWatch from "./pages/SyncWatch.tsx";
import Favorites from "./pages/Favorites.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function AppContent() {
  const cinema = useCinema();
  const isMobile = useIsMobile();
  const { t } = useSettings();

  return (
    <>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          {!isMobile && <AppSidebar />}
          <div className="flex-1 flex flex-col min-w-0">

            <main className={cn("flex-1 overflow-auto", isMobile ? "p-3 pb-20" : "p-6")}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/favorites" element={<Favorites />} />
                <Route path="/members" element={<Members />} />
                <Route path="/member/:channelId" element={<MemberProfile />} />
                <Route path="/clips" element={<Clips />} />
                <Route path="/playlists" element={<Playlists />} />
                <Route path="/playlist/:playlistId" element={<Playlist />} />
                <Route path="/multi-view" element={<MultiView />} />
                <Route path="/sync" element={<SyncWatch />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
          </div>
        </div>
      </SidebarProvider>
      {isMobile && <MobileBottomNav />}
      <MultiViewFab />
      {cinema.videoId && (
        <CinemaOverlay videoId={cinema.videoId} onClose={cinema.close} />
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
