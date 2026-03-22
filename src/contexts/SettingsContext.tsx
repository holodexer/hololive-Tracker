import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, type Locale, type TranslationKeys } from "@/lib/i18n";

export interface VideoMeta {
  title: string;
  channelName: string;
}

export interface Playlist {
  id: string;
  name: string;
  videoIds: string[];
}

interface SettingsState {
  locale: Locale;
  theme: "dark" | "light";
  username: string;
  avatar: string;
  directYoutube: boolean;
  favorites: string[];
  hideInactive: boolean;
  hidePrivateVideos: boolean;
  clipLanguages: string[];
  playlists: Playlist[];
  videoMeta: Record<string, VideoMeta>;
}

interface SettingsContextValue extends SettingsState {
  setLocale: (l: Locale) => void;
  setTheme: (t: "dark" | "light") => void;
  setUsername: (value: string) => void;
  setAvatar: (value: string) => void;
  setDirectYoutube: (v: boolean) => void;
  toggleFavorite: (channelId: string) => void;
  isFavorite: (channelId: string) => boolean;
  setHideInactive: (v: boolean) => void;
  setHidePrivateVideos: (v: boolean) => void;
  toggleClipLanguage: (lang: string) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, videoId: string, meta?: VideoMeta) => void;
  removeFromPlaylist: (playlistId: string, videoId: string) => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  getVideoMeta: (videoId: string) => VideoMeta | undefined;
  t: TranslationKeys;
}

const STORAGE_KEY = "hololive-tracker-settings";

const defaultSettings: SettingsState = {
  locale: "en",
  theme: "dark",
  username: "",
  avatar: "",
  directYoutube: false,
  favorites: [],
  hideInactive: false,
  hidePrivateVideos: false,
  clipLanguages: ["en"],
  playlists: [],
  videoMeta: {},
};

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

function saveSettings(s: SettingsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SettingsState>(loadSettings);

  useEffect(() => {
    saveSettings(state);
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", state.theme === "dark");
    document.documentElement.classList.toggle("light", state.theme === "light");
  }, [state.theme]);

  const setLocale = useCallback((locale: Locale) => setState((s) => ({ ...s, locale })), []);
  const setTheme = useCallback((theme: "dark" | "light") => setState((s) => ({ ...s, theme })), []);
  const setUsername = useCallback((username: string) => setState((s) => ({ ...s, username })), []);
  const setAvatar = useCallback((avatar: string) => setState((s) => ({ ...s, avatar })), []);
  const setDirectYoutube = useCallback((directYoutube: boolean) => setState((s) => ({ ...s, directYoutube })), []);
  const toggleFavorite = useCallback(
    (channelId: string) =>
      setState((s) => ({
        ...s,
        favorites: s.favorites.includes(channelId)
          ? s.favorites.filter((id) => id !== channelId)
          : [...s.favorites, channelId],
      })),
    []
  );
  const isFavorite = useCallback((channelId: string) => state.favorites.includes(channelId), [state.favorites]);
  const setHideInactive = useCallback((hideInactive: boolean) => setState((s) => ({ ...s, hideInactive })), []);
  const setHidePrivateVideos = useCallback((hidePrivateVideos: boolean) => setState((s) => ({ ...s, hidePrivateVideos })), []);
  const toggleClipLanguage = useCallback(
    (lang: string) =>
      setState((s) => ({
        ...s,
        clipLanguages: s.clipLanguages.includes(lang)
          ? s.clipLanguages.filter((l) => l !== lang)
          : [...s.clipLanguages, lang],
      })),
    []
  );

  const createPlaylist = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      playlists: [...s.playlists, { id: crypto.randomUUID(), name, videoIds: [] }],
    }));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setState((s) => ({ ...s, playlists: s.playlists.filter((p) => p.id !== id) }));
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState((s) => ({
      ...s,
      playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, videoId: string, meta?: VideoMeta) => {
    setState((s) => ({
      ...s,
      playlists: s.playlists.map((p) =>
        p.id === playlistId && !p.videoIds.includes(videoId)
          ? { ...p, videoIds: [...p.videoIds, videoId] }
          : p
      ),
      videoMeta: meta ? { ...s.videoMeta, [videoId]: meta } : s.videoMeta,
    }));
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, videoId: string) => {
    setState((s) => ({
      ...s,
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, videoIds: p.videoIds.filter((v) => v !== videoId) } : p
      ),
    }));
  }, []);

  const exportConfig = useCallback(() => {
    return JSON.stringify(state, null, 2);
  }, [state]);

  const importConfig = useCallback((json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      setState({ ...defaultSettings, ...parsed });
      return true;
    } catch {
      return false;
    }
  }, []);

  const getVideoMeta = useCallback((videoId: string) => state.videoMeta[videoId], [state.videoMeta]);

  const value: SettingsContextValue = {
    ...state,
    setLocale,
    setTheme,
    setUsername,
    setAvatar,
    setDirectYoutube,
    toggleFavorite,
    isFavorite,
    setHideInactive,
    setHidePrivateVideos,
    toggleClipLanguage,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    exportConfig,
    importConfig,
    getVideoMeta,
    t: translations[state.locale],
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
