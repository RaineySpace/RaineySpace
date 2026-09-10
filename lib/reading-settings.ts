export type TextSize = "sm" | "md" | "lg";
export type Leading = "tight" | "normal" | "loose";
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface ReadingSettings {
  size: TextSize;
  leading: Leading;
  theme: ThemePreference;
}

export const READING_SETTINGS_STORAGE_KEY = "reading-settings";
export const READING_SETTINGS_CHANGE_EVENT = "reading-settings-change";
export const TEXT_SIZE_ATTRIBUTE = "data-text-size";
export const LEADING_ATTRIBUTE = "data-leading";
export const THEME_ATTRIBUTE = "data-theme";

const LEGACY_STORAGE_KEY = "senior-mode";
const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export const DEFAULT_READING_SETTINGS: ReadingSettings = { size: "md", leading: "normal", theme: "system" };

export const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: "sm", label: "小" },
  { value: "md", label: "默认" },
  { value: "lg", label: "大" },
];

export const LEADING_OPTIONS: { value: Leading; label: string }[] = [
  { value: "tight", label: "紧" },
  { value: "normal", label: "默认" },
  { value: "loose", label: "宽" },
];

export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

const TEXT_SIZES: TextSize[] = ["sm", "md", "lg"];
const LEADINGS: Leading[] = ["tight", "normal", "loose"];
const THEMES: ThemePreference[] = ["system", "light", "dark"];

/**
 * Runs synchronously in <head> so the first paint already uses the saved
 * typography tokens and the resolved colour theme. Kept dependency-free and
 * mirrored by `normalize` / `applyToDocument` below.
 */
export const READING_SETTINGS_BOOTSTRAP_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,k="${READING_SETTINGS_STORAGE_KEY}",raw=s.getItem(k),v=null;if(raw){try{v=JSON.parse(raw)}catch(e){}}if(!v&&s.getItem("${LEGACY_STORAGE_KEY}")==="1"){v={size:"lg"};s.setItem(k,JSON.stringify({size:"lg",leading:"normal",theme:"system"}));}s.removeItem("${LEGACY_STORAGE_KEY}");v=v||{};if(v.size==="sm"||v.size==="lg")d.setAttribute("${TEXT_SIZE_ATTRIBUTE}",v.size);if(v.leading==="tight"||v.leading==="loose")d.setAttribute("${LEADING_ATTRIBUTE}",v.leading);var dark=v.theme==="dark"||(v.theme!=="light"&&matchMedia("${DARK_SCHEME_QUERY}").matches);d.setAttribute("${THEME_ATTRIBUTE}",dark?"dark":"light");}catch(e){}})();`;

let cached: ReadingSettings | null = null;

function normalize(value: unknown): ReadingSettings {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ReadingSettings, unknown>>;
  const size = TEXT_SIZES.find((item) => item === candidate.size) ?? DEFAULT_READING_SETTINGS.size;
  const leading = LEADINGS.find((item) => item === candidate.leading) ?? DEFAULT_READING_SETTINGS.leading;
  const theme = THEMES.find((item) => item === candidate.theme) ?? DEFAULT_READING_SETTINGS.theme;
  return { size, leading, theme };
}

function parse(raw: string | null): ReadingSettings {
  if (!raw) return { ...DEFAULT_READING_SETTINGS };
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READING_SETTINGS };
  }
}

export function systemPrefersDark() {
  return window.matchMedia(DARK_SCHEME_QUERY).matches;
}

export function resolveTheme(theme: ThemePreference): ResolvedTheme {
  if (theme === "system") return systemPrefersDark() ? "dark" : "light";
  return theme;
}

export function readReadingSettings(): ReadingSettings {
  if (cached) return cached;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(READING_SETTINGS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  cached = parse(raw);
  return cached;
}

function applyToDocument(settings: ReadingSettings) {
  const root = document.documentElement;
  if (settings.size === DEFAULT_READING_SETTINGS.size) {
    root.removeAttribute(TEXT_SIZE_ATTRIBUTE);
  } else {
    root.setAttribute(TEXT_SIZE_ATTRIBUTE, settings.size);
  }
  if (settings.leading === DEFAULT_READING_SETTINGS.leading) {
    root.removeAttribute(LEADING_ATTRIBUTE);
  } else {
    root.setAttribute(LEADING_ATTRIBUTE, settings.leading);
  }
  root.setAttribute(THEME_ATTRIBUTE, resolveTheme(settings.theme));
}

export function saveReadingSettings(patch: Partial<ReadingSettings>) {
  const next = normalize({ ...readReadingSettings(), ...patch });
  cached = next;
  applyToDocument(next);
  try {
    localStorage.setItem(READING_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage may be unavailable (private mode / quota); the in-session attributes still apply.
  }
  window.dispatchEvent(new Event(READING_SETTINGS_CHANGE_EVENT));
  return next;
}

/** Mirrors a change made in another tab without re-saving it. */
export function syncReadingSettingsFromStorage(raw: string | null) {
  cached = parse(raw);
  applyToDocument(cached);
  window.dispatchEvent(new Event(READING_SETTINGS_CHANGE_EVENT));
}

/** Keeps `data-theme` following the OS while the preference is "system". */
export function subscribeSystemTheme() {
  const media = window.matchMedia(DARK_SCHEME_QUERY);
  const onChange = () => {
    if (readReadingSettings().theme !== "system") return;
    document.documentElement.setAttribute(THEME_ATTRIBUTE, media.matches ? "dark" : "light");
  };
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
