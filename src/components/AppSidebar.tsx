/**
 * @file src/components/AppSidebar.tsx
 * @description 應用程式的核心常駐側邊欄 (Sidebar) 元件。
 * 負責全站路由導航、全域搜尋呼叫、以及將最愛頻道依照「是否開播」進行排序與狀態展示。
 */

import { Home, Users, Heart, ListMusic, MonitorPlay, Radio, Search, Video } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useHolodexStreams, useHololiveChannels } from "@/hooks/useHolodex";
import { useSettings } from "@/contexts/SettingsContext";
import { SettingsPanel } from "@/components/SettingsPanel";
import { useNavigate } from "react-router-dom";
import { openGlobalSearch } from "@/components/GlobalSearch";
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
import { getDisplayName, getChannelPhotoUrl, cn } from "@/lib/utils";

export function AppSidebar() {
  // --- 狀態定義 ---
  const { state } = useSidebar();
  const isSidebarCollapsed = state === "collapsed";
  const { data: streamsData } = useHolodexStreams();
  const { data: channelsData } = useHololiveChannels();
  const { favorites, locale, t } = useSettings();
  const navigate = useNavigate();

  // --- 衍生資料邏輯 ---
  
  // 依照裝置作業系統動態顯示搜尋快捷鍵
  const searchShortcutLabel = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "Cmd+K"
    : "Ctrl+K";

  // 主導航清單
  const navItems = [
    { title: t.nav.home, url: "/", icon: Home },
    { title: t.nav.favorites, url: "/favorites", icon: Heart },
    { title: t.nav.members, url: "/members", icon: Users },
    { title: t.nav.jellyfin, url: "/k-hub", icon: Video },
    { title: t.sidebar.playlists, url: "/playlists", icon: ListMusic },
    { title: t.nav.multiView, url: "/multi-view", icon: MonitorPlay },
    { title: t.nav.syncWatch, url: "/sync", icon: Radio },
  ];

  // 將所有直播中的頻道 ID 列為 Set 以便於 O(1) 查找
  const activeLiveChannelIds = new Set(streamsData?.live?.map((v) => v.channel.id) ?? []);
  
  // 篩選出具備完整資訊的收藏頻道
  const favoritedChannels = channelsData?.filter((ch) => favorites.includes(ch.id)) ?? [];

  // 排序邏輯：正在直播中的頻道強制置頂顯示
  const sortedFavoritedChannels = [...favoritedChannels].sort((chA, chB) => {
    const isALive = activeLiveChannelIds.has(chA.id) ? 0 : 1;
    const isBLive = activeLiveChannelIds.has(chB.id) ? 0 : 1;
    return isALive - isBLive;
  });

  // --- 畫面渲染 ---
  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      
      {/* 側邊欄頂部：Logo 區塊 */}
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
        {/* 全域搜尋按鈕 */}
        <div className="px-2 pt-3 pb-1">
          <button
            type="button"
            onClick={openGlobalSearch}
            className="flex w-full items-center gap-2 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
            title={t.search.open}
          >
            <Search className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">{t.nav.search}</span>
            <span className="text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">{searchShortcutLabel}</span>
          </button>
        </div>

        {/* 網站主要導航區 (Main Navigation) */}
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

        {/* 收藏頻道捷徑 (Favorites Shortcuts) */}
        {sortedFavoritedChannels.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-pink-400 font-bold text-xs tracking-widest uppercase flex items-center gap-1">
              <Heart className="w-3 h-3 fill-current" />
              {t.sidebar.favorites}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sortedFavoritedChannels.map((ch) => {
                  const isCurrentlyLive = activeLiveChannelIds.has(ch.id);
                  const channelDisplayName = getDisplayName(ch, locale);

                  return (
                    <SidebarMenuItem key={ch.id}>
                      <SidebarMenuButton
                        asChild
                        className="h-10 px-2 group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-0"
                      >
                        <button onClick={() => navigate(`/member/${ch.id}`)}>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                            <img
                              src={getChannelPhotoUrl(ch.photo)}
                              alt={channelDisplayName}
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (!img.dataset.fallbackTried) {
                                  img.dataset.fallbackTried = "1";
                                  img.src = `https://unavatar.io/youtube/${ch.id}`;
                                  return;
                                }
                                img.onerror = null;
                                img.src = "/channel-placeholder.svg";
                              }}
                              className={cn("h-full w-full rounded-full object-cover aspect-square", {
                                "ring-[3px] ring-live shadow-[0_0_12px_hsl(var(--live)/0.6)] group-data-[collapsible=icon]:animate-none group-data-[collapsible=icon]:shadow-none": isCurrentlyLive
                              })}
                            />
                          </span>
                          <span className="text-xs text-sidebar-foreground truncate">
                            {channelDisplayName}
                          </span>
                          
                          {/* 如果正在實況中，顯示動態的 LIVE 標籤 */}
                          {isCurrentlyLive && (
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
        <SettingsPanel collapsed={isSidebarCollapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}
