import { useSettings } from "@/contexts/SettingsContext";
import { Settings, Globe, Moon, Sun, Monitor, Filter, Languages, Download, Upload, User, ImagePlus, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { showValidationError, showSuccess } from "@/lib/errors";

const localeLabels: Record<Locale, string> = {
  en: "English",
  "zh-TW": "繁體中文",
  ja: "日本語",
};

const clipLangOptions = [
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

type SettingsTab = "user" | "general" | "filter" | "backup";

export function SettingsPanel({ collapsed = false, externalOpen, onExternalOpenChange }: { collapsed?: boolean; externalOpen?: boolean; onExternalOpenChange?: (open: boolean) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = onExternalOpenChange || setInternalOpen;
  const [activeTab, setActiveTab] = useState<SettingsTab>("user");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const {
    locale, theme, username, avatar, directYoutube, hideInactive, hidePrivateVideos, clipLanguages,
    setLocale, setTheme, setUsername, setAvatar, setDirectYoutube, setHideInactive, setHidePrivateVideos, toggleClipLanguage,
    exportConfig, importConfig, t,
  } = useSettings();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const nextAvatar = await resizeImageToDataUrl(file, 160);
      setAvatar(nextAvatar);
    } catch {
      showValidationError(t.settings.avatarError);
    }

    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  // Scroll lock when settings is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleExport = () => {
    const json = exportConfig();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hololive-tracker-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = importConfig(reader.result as string);
      if (success) {
        showSuccess(t.settings.importSuccess);
        setTimeout(() => window.location.reload(), 800);
      } else {
        showValidationError(t.settings.importError);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const tabs: { key: SettingsTab; label: string }[] = [
    { key: "user", label: t.settings.tabUser },
    { key: "general", label: t.settings.tabGeneral },
    { key: "filter", label: t.settings.tabFilter },
    { key: "backup", label: t.settings.tabBackup },
  ];

  return (
    <>
      {externalOpen === undefined && (
        <button
          onClick={() => setOpen(true)}
          className={`flex items-center gap-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent rounded-md transition-colors ${
            collapsed
              ? "mx-auto h-8 w-8 justify-center p-0"
              : "w-full px-3 py-2"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t.nav.settings}</span>}
        </button>
      )}

      {open && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-background border border-border rounded-xl w-full max-w-lg p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl relative z-[201]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-foreground">{t.settings.title}</h2>

            {/* Tab Bar */}
            <div className="flex border-b border-border">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* User Tab */}
            {activeTab === "user" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {t.settings.username}
                  </label>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                    placeholder={t.settings.usernamePlaceholder}
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">{t.settings.usernameDesc}</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ImagePlus className="w-4 h-4" />
                    {t.settings.avatar}
                  </label>
                  <div className="flex items-center gap-4 rounded-lg border border-border/50 bg-card/40 p-4">
                    {avatar ? (
                      <img src={avatar} alt={username || "User avatar"} className="h-16 w-16 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                        {(username.trim().charAt(0) || "?").toUpperCase()}
                      </div>
                    )}
                    <div className="flex flex-1 flex-wrap gap-2">
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <ImagePlus className="w-4 h-4" />
                        {t.settings.avatarUpload}
                      </button>
                      {avatar && (
                        <button
                          onClick={() => setAvatar("")}
                          className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-muted"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t.common.delete}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.settings.avatarDesc}</p>
                </div>
              </div>
            )}

            {/* General Tab */}
            {activeTab === "general" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    {t.settings.language}
                  </label>
                  <div className="flex gap-2">
                    {(Object.keys(localeLabels) as Locale[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLocale(l)}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          locale === l
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-muted"
                        }`}
                      >
                        {localeLabels[l]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Monitor className="w-4 h-4" />
                    {t.settings.theme}
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setTheme("dark")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        theme === "dark"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5" />
                      {t.settings.darkMode}
                    </button>
                    <button
                      onClick={() => setTheme("light")}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                        theme === "light"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-secondary-foreground hover:bg-muted"
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5" />
                      {t.settings.lightMode}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">{t.settings.playback}</label>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{t.settings.directYoutube}</p>
                      <p className="text-xs text-muted-foreground">{t.settings.directYoutubeDesc}</p>
                    </div>
                    <Switch checked={directYoutube} onCheckedChange={setDirectYoutube} />
                  </div>
                </div>
              </div>
            )}

            {/* Content Filter Tab */}
            {activeTab === "filter" && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    {t.settings.contentFilter}
                  </label>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{t.settings.hideInactive}</p>
                      <p className="text-xs text-muted-foreground">{t.settings.hideInactiveDesc}</p>
                    </div>
                    <Switch checked={hideInactive} onCheckedChange={setHideInactive} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">{t.settings.hidePrivate}</p>
                      <p className="text-xs text-muted-foreground">{t.settings.hidePrivateDesc}</p>
                    </div>
                    <Switch checked={hidePrivateVideos} onCheckedChange={setHidePrivateVideos} />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Languages className="w-4 h-4" />
                    {t.settings.clipLanguage}
                  </label>
                  <p className="text-xs text-muted-foreground">{t.settings.clipLanguageDesc}</p>
                  <div className="flex gap-4">
                    {clipLangOptions.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={clipLanguages.includes(opt.value)}
                          onCheckedChange={() => toggleClipLanguage(opt.value)}
                        />
                        <span className="text-sm text-foreground">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Backup Tab */}
            {activeTab === "backup" && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Download className="w-4 h-4" />
                      {t.settings.exportConfig}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t.settings.exportDesc}</p>
                    <button
                      onClick={handleExport}
                      className="mt-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      {t.settings.exportConfig}
                    </button>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      {t.settings.importConfig}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t.settings.importDesc}</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 px-4 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-muted transition-colors"
                    >
                      {t.settings.importConfig}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {locale === "zh-TW" ? "關閉" : locale === "ja" ? "閉じる" : "Close"}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function resizeImageToDataUrl(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("image_failed"));
      image.onload = () => {
        const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("canvas_failed"));
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.88));
      };
      image.src = String(reader.result);
    };

    reader.readAsDataURL(file);
  });
}
