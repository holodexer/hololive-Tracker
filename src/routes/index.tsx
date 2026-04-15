import { createHashRouter } from "react-router-dom";
import { RootLayout } from "@/components/layout/RootLayout";
import Index from "@/pages/Index";
import Members from "@/pages/Members";
import MemberProfile from "@/pages/MemberProfile";
import Jellyfin from "@/pages/Jellyfin";
import Clips from "@/pages/Clips";
import Playlist from "@/pages/Playlist";
import Playlists from "@/pages/Playlists";
import MultiView from "@/pages/MultiView";
import Favorites from "@/pages/Favorites";
import NotFound from "@/pages/NotFound";

export const router = createHashRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Index />,
      },
      {
        path: "favorites",
        element: <Favorites />,
      },
      {
        path: "members",
        element: <Members />,
      },
      {
        path: "k-hub",
        element: <Jellyfin />,
      },
      {
        path: "member/:channelId",
        element: <MemberProfile />,
      },
      {
        path: "clips",
        element: <Clips />,
      },
      {
        path: "playlists",
        element: <Playlists />,
      },
      {
        path: "playlist/:playlistId",
        element: <Playlist />,
      },
      {
        path: "multi-view",
        element: <MultiView />,
      },
      {
        path: "sync",
        element: null, // Rendered parallel via layout for socket keep-alive
      },
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);
