import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { translations, type Locale, type TranslationKeys } from "@/lib/i18n";

export interface VideoMeta {
  title: string;
  channelName: string;
}

export interface RecentVideoMeta {
  id: string;
  title: string;
  channelName: string;
  thumbnail?: string;
  status?: "live" | "upcoming" | "past";
  watchedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  videoIds: string[];
}

export interface StreamReminder {
  videoId: string;
  title: string;
  channelName: string;
  scheduledFor: string;
  notifiedAt?: string;
}

interface SettingsState {
  locale: Locale;
  theme: "dark" | "light" | "grape" | "forest";
  username: string;
  avatar: string;
  directYoutube: boolean;
  favorites: string[];
  hideInactive: boolean;
  hidePrivateVideos: boolean;
  clipLanguages: string[];
  playlists: Playlist[];
  videoMeta: Record<string, VideoMeta>;
  recentVideos: RecentVideoMeta[];
  reminders: StreamReminder[];
  jellyfinUrl: string;
  jellyfinToken: string;
}

interface SettingsContextValue extends SettingsState {
  setLocale: (l: Locale) => void;
  setTheme: (t: "dark" | "light" | "grape" | "forest") => void;
  setUsername: (value: string) => void;
  setAvatar: (value: string) => void;
  setDirectYoutube: (v: boolean) => void;
  toggleFavorite: (channelId: string) => void;
  isFavorite: (channelId: string) => boolean;
  setHideInactive: (v: boolean) => void;
  setHidePrivateVideos: (v: boolean) => void;
  toggleClipLanguage: (lang: string) => void;
  setJellyfinUrl: (v: string) => void;
  setJellyfinToken: (v: string) => void;
  createPlaylist: (name: string) => void;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addToPlaylist: (playlistId: string, videoId: string, meta?: VideoMeta) => void;
  removeFromPlaylist: (playlistId: string, videoId: string) => void;
  exportConfig: () => string;
  importConfig: (json: string) => boolean;
  getVideoMeta: (videoId: string) => VideoMeta | undefined;
  recordRecentVideo: (video: Omit<RecentVideoMeta, "watchedAt"> & { watchedAt?: string }) => void;
  toggleReminder: (reminder: Omit<StreamReminder, "notifiedAt">) => void;
  hasReminder: (videoId: string) => boolean;
  markReminderNotified: (videoId: string, notifiedAt?: string) => void;
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
  recentVideos: [],
  reminders: [],
  jellyfinUrl: "",
  jellyfinToken: "",
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
    document.documentElement.classList.toggle("grape", state.theme === "grape");
    document.documentElement.classList.toggle("forest", state.theme === "forest");
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
  const setJellyfinUrl = useCallback((jellyfinUrl: string) => setState((s) => ({ ...s, jellyfinUrl })), []);
  const setJellyfinToken = useCallback((jellyfinToken: string) => setState((s) => ({ ...s, jellyfinToken })), []);
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

  const recordRecentVideo = useCallback(
    (video: Omit<RecentVideoMeta, "watchedAt"> & { watchedAt?: string }) => {
      setState((s) => {
        const nextVideo: RecentVideoMeta = {
          ...video,
          watchedAt: video.watchedAt ?? new Date().toISOString(),
        };

        return {
          ...s,
          recentVideos: [nextVideo, ...s.recentVideos.filter((entry) => entry.id !== video.id)].slice(0, 24),
        };
      });
    },
    []
  );

  const toggleReminder = useCallback((reminder: Omit<StreamReminder, "notifiedAt">) => {
    setState((s) => {
      const exists = s.reminders.some((entry) => entry.videoId === reminder.videoId);
      return {
        ...s,
        reminders: exists
          ? s.reminders.filter((entry) => entry.videoId !== reminder.videoId)
          : [...s.reminders, reminder],
      };
    });
  }, []);

  const hasReminder = useCallback((videoId: string) => state.reminders.some((entry) => entry.videoId === videoId), [state.reminders]);

  const markReminderNotified = useCallback((videoId: string, notifiedAt?: string) => {
    setState((s) => ({
      ...s,
      reminders: s.reminders.map((entry) =>
        entry.videoId === videoId
          ? { ...entry, notifiedAt: notifiedAt ?? new Date().toISOString() }
          : entry
      ),
    }));
  }, []);

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
    setJellyfinUrl,
    setJellyfinToken,
    createPlaylist,
    deletePlaylist,
    renamePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    exportConfig,
    importConfig,
    getVideoMeta,
    recordRecentVideo,
    toggleReminder,
    hasReminder,
    markReminderNotified,
    t: translations[state.locale],
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
