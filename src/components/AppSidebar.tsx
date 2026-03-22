import { Home, Users, Heart, ListMusic, MonitorPlay, Radio } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useHolodexStreams, useHololiveChannels } from "@/hooks/useHolodex";
import { useSettings } from "@/contexts/SettingsContext";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getDisplayName } from "@/lib/utils";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { data } = useHolodexStreams();
  const { data: channels } = useHololiveChannels();
  const { favorites, playlists, locale, t } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { title: t.nav.home, url: "/", icon: Home },
    { title: t.nav.favorites, url: "/favorites", icon: Heart },
    { title: t.nav.members, url: "/members", icon: Users },
    { title: t.sidebar.playlists, url: "/playlists", icon: ListMusic },
    { title: t.nav.multiView, url: "/multi-view", icon: MonitorPlay },
    { title: t.nav.syncWatch, url: "/sync", icon: Radio },
  ];

  const liveChannelIds = new Set(data?.live?.map((v) => v.channel.id) ?? []);
  const favoriteChannels = channels?.filter((ch) => favorites.includes(ch.id)) ?? [];

  const sortedFavorites = [...favoriteChannels].sort((a, b) => {
    const aLive = liveChannelIds.has(a.id) ? 0 : 1;
    const bLive = liveChannelIds.has(b.id) ? 0 : 1;
    return aLive - bLive;
  });



  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarHeader className="border-b border-border/40">
        <div className="flex items-center justify-between px-3 py-2.5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <div className="flex items-center gap-2.5 min-w-0 group-data-[collapsible=icon]:hidden">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 shrink-0" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
              <polygon points="11,9 25,16 11,23" fill="white" />
              <circle cx="8" cy="16" r="2" fill="white" opacity="0.7" />
            </svg>
            <span className="text-sm font-bold text-foreground tracking-tight truncate">Holodexer</span>
          </div>
          <SidebarTrigger className="shrink-0" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary font-bold text-xs tracking-widest uppercase">
            {t.sidebar.navigation}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Favorites */}
        {sortedFavorites.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-pink-400 font-bold text-xs tracking-widest uppercase flex items-center gap-1">
              <Heart className="w-3 h-3 fill-current" />
              {t.sidebar.favorites}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sortedFavorites.map((ch) => {
                  const isLive = liveChannelIds.has(ch.id);
                  const name = getDisplayName(ch, locale);

                  return (
                    <SidebarMenuItem key={ch.id}>
                      <SidebarMenuButton
                        asChild
                        className="h-10 px-2 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0"
                      >
                        <button onClick={() => navigate(`/member/${ch.id}`)}>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                            <img
                              src={ch.photo ?? ""}
                              alt={name}
                              className={`h-full w-full rounded-full object-cover aspect-square ${
                                isLive ? "ring-[3px] ring-live shadow-[0_0_12px_hsl(var(--live)/0.6)] group-data-[collapsible=icon]:animate-none group-data-[collapsible=icon]:shadow-none" : ""
                              }`}
                            />
                          </span>
                          <span className="text-xs text-sidebar-foreground truncate">
                            {name}
                          </span>
                          {isLive && (
                            <span className="ml-auto text-[10px] font-semibold text-live flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-live opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-live" />
                              </span>
                              LIVE
                            </span>
                          )}
                        </button>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

      </SidebarContent>

      <SidebarFooter className="p-2">
        <SettingsPanel collapsed={collapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
