export type Locale = "en" | "zh-TW" | "ja";

export interface TranslationKeys {
  app: {
    title: string;
  };
  cinema: {
    showChat: string;
  };
  clips: {
    title: string;
    noClips: string;
  };
  common: {
    cancel: string;
    add: string;
    save: string;
    delete: string;
    loadMore: string;
    loading: string;
  };
  errors: {
    notFound: string;
    pageNotFound: string;
    returnHome: string;
    playlistNotFound: string;
  };
  favorites: {
    title: string;
    live: string;
    archives: string;
    clips: string;
    noFavorites: string;
    noLive: string;
    noArchives: string;
    noClips: string;
  };
  home: {
    liveNow: string;
    live: string;
    upcomingStreams: string;
    next5Days: string;
    noLive: string;
    noUpcoming: string;
    failedToLoad: string;
  };
  locales: {
    en: string;
    ja: string;
    "zh-TW": string;
  };
  members: {
    title: string;
    favorites: string;
    noFavorites: string;
    search: string;
    allGenerations: string;
    subscribers: string;
    noFound: string;
  };
  multiView: {
    title: string;
    empty: string;
    streams: string;
    clearAll: string;
    select: string;
    open: string;
    addWindow: string;
    selectVideo: string;
    clickToAdd: string;
    layoutAuto: string;
    layoutGrid: string;
    saveConfig: string;
    copyConfigLink: string;
    saved: string;
    linkCopied: string;
    maxReached: string;
    muteTile: string;
    unmuteTile: string;
    addFromFavorites: string;
    noFavoritesLive: string;
    noFavorites: string;
    pickLive: string;
    muteAll: string;
    unmute: string;
    noLive: string;
  };
  nav: {
    home: string;
    members: string;
    jellyfin: string;
    clips: string;
    playlists: string;
    search: string;
    settings: string;
    favorites: string;
    multiView: string;
    syncWatch: string;
    more: string;
  };
  playlists: {
    create: string;
    namePlaceholder: string;
    empty: string;
    addTo: string;
    removeFrom: string;
    videos: string;
    rename: string;
    confirmCreate: string;
    searchPlaceholder: string;
    noMatches: string;
    sortLabel: string;
    sortNewest: string;
    sortOldest: string;
    sortTitle: string;
    sortChannel: string;
    selectionMode: string;
    selectAllVisible: string;
    clearSelection: string;
    selectedCount: string;
    removeSelected: string;
    removeSelectedTitle: string;
    removeSelectedDesc: string;
    playFirst: string;
    deleteConfirmTitle: string;
    deleteConfirmDesc: string;
  };
  profile: {
    subscribers: string;
    videos: string;
    liveUpcoming: string;
    pastStreams: string;
    clips: string;
    noStreams: string;
    noClips: string;
  };
  reminders: {
    toggle: string;
    added: string;
    removed: string;
    toastTitle: string;
    browserTitle: string;
  };
  search: {
    title: string;
    placeholder: string;
    empty: string;
    navigation: string;
    quickLinks: string;
    live: string;
    members: string;
    playlists: string;
    recent: string;
    open: string;
  };
  settings: {
    title: string;
    tabUser: string;
    language: string;
    username: string;
    usernameDesc: string;
    usernamePlaceholder: string;
    avatar: string;
    avatarDesc: string;
    avatarUpload: string;
    avatarError: string;
    theme: string;
    darkMode: string;
    lightMode: string;
    grapePurple: string;
    forestGreen: string;
    playback: string;
    directYoutube: string;
    directYoutubeDesc: string;
    contentFilter: string;
    hideInactive: string;
    hideInactiveDesc: string;
    hidePrivate: string;
    hidePrivateDesc: string;
    clipLanguage: string;
    clipLanguageDesc: string;
    tabGeneral: string;
    tabFilter: string;
    tabBackup: string;
    exportConfig: string;
    importConfig: string;
    exportDesc: string;
    importDesc: string;
    importSuccess: string;
    importError: string;
  };
  sidebar: {
    navigation: string;
    liveNow: string;
    favorites: string;
    playlists: string;
  };
  sync: {
    syncWatch: string;
    createRoom: string;
    createDesc: string;
    orJoin: string;
    enterRoom: string;
    join: string;
    roomNotFound: string;
    roomValidationError: string;
    invalidRoomId: string;
    room: string;
    host: string;
    guest: string;
    copyInvite: string;
    leave: string;
    loadVideo: string;
    pasteUrl: string;
    members: string;
    chat: string;
    log: string;
    queue: string;
    hostMode: string;
    freeControl: string;
    hostOnlyVideo: string;
    hostWaiting: string;
    guestWaiting: string;
    syncing: string;
    noMessages: string;
    messagePlaceholder: string;
    nicknameTitle: string;
    nicknameDesc: string;
    nicknamePlaceholder: string;
    joinButton: string;
    queueEmpty: string;
    queueAddHint: string;
    upNext: string;
    hostOnlyQueue: string;
    playNow: string;
    youIndicator: string;
    inviteCopied: string;
    openClips: string;
    clipsTitle: string;
    favoriteOnly: string;
    selectClipToAdd: string;
    selectLiveToAdd: string;
    selectArchiveToAdd: string;
    noClipsFound: string;
    noArchivesFound: string;
    clipsLoading: string;
    archivesLoading: string;
    liveNow: string;
    noLive: string;
    connecting: string;
    connected: string;
    reconnecting: string;
    connectionError: string;
    resyncNow: string;
    resyncRequested: string;
    syncStatus: string;
    hostStatusHint: string;
    guestStatusHint: string;
    lastSynced: string;
    syncThresholdLabel: string;
    tapToUnmute: string;
    roomList: string;
    noRooms: string;
  };
}

export const namespaces = [
  "common", "app", "nav", "home", "members", "clips", "profile", 
  "settings", "sidebar", "playlists", "search", "multiView", 
  "reminders", "favorites", "sync", "cinema", "errors", "locales"
];

export async function fetchTranslations(locale: Locale): Promise<TranslationKeys> {
  try {
    // 使用 Vite 提供的 BASE_URL 以正確對應 GitHub Pages 的子路徑部署
    // 若 base 為 '/hololive-Tracker/'，則 fetch 路徑為 '/hololive-Tracker/locales/en.json'
    const base = import.meta.env.BASE_URL ?? '/';
    const req = await fetch(`${base}locales/${locale}.json`);
    if (req.ok) {
      return await req.json() as TranslationKeys;
    }
  } catch (e) {
    console.error(`Failed to load translations for locale ${locale}`, e);
  }

  return {} as TranslationKeys;
}
