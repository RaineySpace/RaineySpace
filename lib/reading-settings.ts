export type TextSize = "sm" | "md" | "lg";
export type Leading = "tight" | "normal" | "loose";

export interface ReadingSettings {
  size: TextSize;
  leading: Leading;
}

export const READING_SETTINGS_STORAGE_KEY = "reading-settings";
export const READING_SETTINGS_CHANGE_EVENT = "reading-settings-change";
export const TEXT_SIZE_ATTRIBUTE = "data-text-size";
export const LEADING_ATTRIBUTE = "data-leading";

const LEGACY_STORAGE_KEY = "senior-mode";

export const DEFAULT_READING_SETTINGS: ReadingSettings = { size: "md", leading: "normal" };

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

const TEXT_SIZES: TextSize[] = ["sm", "md", "lg"];
const LEADINGS: Leading[] = ["tight", "normal", "loose"];

/**
 * Runs synchronously in <head> so the first paint already uses the saved
 * typography tokens. Kept dependency-free and mirrored by `normalize` below.
 */
export const READING_SETTINGS_BOOTSTRAP_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,k="${READING_SETTINGS_STORAGE_KEY}",raw=s.getItem(k),v=null;if(raw){try{v=JSON.parse(raw)}catch(e){}}if(!v&&s.getItem("${LEGACY_STORAGE_KEY}")==="1"){v={size:"lg"};s.setItem(k,JSON.stringify({size:"lg",leading:"normal"}));}s.removeItem("${LEGACY_STORAGE_KEY}");if(!v)return;if(v.size==="sm"||v.size==="lg")d.setAttribute("${TEXT_SIZE_ATTRIBUTE}",v.size);if(v.leading==="tight"||v.leading==="loose")d.setAttribute("${LEADING_ATTRIBUTE}",v.leading);}catch(e){}})();`;

function normalize(value: unknown): ReadingSettings {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ReadingSettings, unknown>>;
  const size = TEXT_SIZES.find((item) => item === candidate.size) ?? DEFAULT_READING_SETTINGS.size;
  const leading = LEADINGS.find((item) => item === candidate.leading) ?? DEFAULT_READING_SETTINGS.leading;
  return { size, leading };
}

export function readReadingSettings(): ReadingSettings {
  const root = document.documentElement;
  return normalize({
    size: root.getAttribute(TEXT_SIZE_ATTRIBUTE) ?? DEFAULT_READING_SETTINGS.size,
    leading: root.getAttribute(LEADING_ATTRIBUTE) ?? DEFAULT_READING_SETTINGS.leading,
  });
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
}

export function saveReadingSettings(patch: Partial<ReadingSettings>) {
  const next = normalize({ ...readReadingSettings(), ...patch });
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
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  applyToDocument(normalize(parsed));
  window.dispatchEvent(new Event(READING_SETTINGS_CHANGE_EVENT));
}
