import { Home, Heart, Users, MonitorPlay, Radio, MoreHorizontal, ListMusic, Settings } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { SettingsPanel } from "@/components/SettingsPanel";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useSettings();
  const [moreOpen, setMoreOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const navItems = [
    { title: t.nav.home, url: "/", icon: Home },
    { title: t.nav.favorites, url: "/favorites", icon: Heart },
    { title: t.nav.members, url: "/members", icon: Users },
    { title: t.nav.syncWatch, url: "/sync", icon: Radio },
  ];

  const moreItems = [
    { title: t.nav.multiView, url: "/multi-view", icon: MonitorPlay },
    { title: t.nav.playlists, url: "/playlists", icon: ListMusic },
  ];

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const moreIsActive = moreItems.some((item) => isActive(item.url));

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 shadow-[0_-10px_30px_hsl(var(--background)/0.35)] backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 items-stretch min-h-[4.5rem] px-1.5 pt-1.5">
          {navItems.map((item) => {
            const active = isActive(item.url);
            return (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-all min-h-[4rem]",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
                <span className="text-[11px] font-medium leading-none">{item.title}</span>
              </button>
            );
          })}

          {/* More menu */}
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-all min-h-[4rem]",
                  moreIsActive
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <MoreHorizontal className={cn("h-5 w-5", moreIsActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]")} />
                <span className="text-[11px] font-medium leading-none">{t.nav.more}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              sideOffset={8}
              className="w-48 p-1 bg-card border-border"
            >
              {moreItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <button
                    key={item.url}
                    onClick={() => {
                      navigate(item.url);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px]",
                      active
                        ? "text-primary bg-primary/10"
                        : "text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.title}
                  </button>
                );
              })}
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => {
                  setMoreOpen(false);
                  setSettingsOpen(true);
                }}
                className="flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors min-h-[44px]"
              >
                <Settings className="w-4 h-4" />
                {t.nav.settings}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </nav>

      {/* Hidden settings panel triggered externally */}
      <SettingsPanel
        externalOpen={settingsOpen}
        onExternalOpenChange={setSettingsOpen}
      />
    </>
  );
}
