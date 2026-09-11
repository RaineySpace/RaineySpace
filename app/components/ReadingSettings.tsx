"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Sheet from "@/app/components/Sheet";
import {
  DEFAULT_READING_SETTINGS,
  LEADING_OPTIONS,
  READING_SETTINGS_CHANGE_EVENT,
  READING_SETTINGS_STORAGE_KEY,
  TEXT_SIZE_OPTIONS,
  THEME_OPTIONS,
  readReadingSettings,
  saveReadingSettings,
  subscribeSystemTheme,
  syncReadingSettingsFromStorage,
  type ReadingSettings as ReadingSettingsValue,
} from "@/lib/reading-settings";

const DESKTOP_QUERY = "(min-width: 640px)";

interface ReadingSettingsProps {
  /** Which edge of the trigger the desktop popover hangs from. */
  align?: "start" | "end";
}

interface SegmentGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

function SegmentGroup<T extends string>({ label, options, value, onChange }: SegmentGroupProps<T>) {
  const labelId = useId();
  return (
    <div className="reading-settings-group">
      <span id={labelId} className="reading-settings-label">{label}</span>
      <div role="radiogroup" aria-labelledby={labelId} className="reading-settings-segments">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="reading-settings-segment"
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const index = options.findIndex((item) => item.value === option.value);
                const delta = event.key === "ArrowRight" ? 1 : -1;
                const next = options[(index + delta + options.length) % options.length];
                onChange(next.value);
                const parent = event.currentTarget.parentElement;
                const buttons = parent?.querySelectorAll<HTMLButtonElement>("button");
                buttons?.[(index + delta + options.length) % options.length]?.focus();
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReadingSettingsPanel({
  settings,
  onChange,
}: {
  settings: ReadingSettingsValue;
  onChange: (patch: Partial<ReadingSettingsValue>) => void;
}) {
  return (
    <>
      <p className="reading-settings-title">阅读设置</p>
      <SegmentGroup
        label="文字大小"
        options={TEXT_SIZE_OPTIONS}
        value={settings.size}
        onChange={(size) => onChange({ size })}
      />
      <SegmentGroup
        label="行间距"
        options={LEADING_OPTIONS}
        value={settings.leading}
        onChange={(leading) => onChange({ leading })}
      />
      <SegmentGroup
        label="外观"
        options={THEME_OPTIONS}
        value={settings.theme}
        onChange={(theme) => onChange({ theme })}
      />
    </>
  );
}

export default function ReadingSettings({ align = "end" }: ReadingSettingsProps) {
  const pathname = usePathname();
  const [settings, setSettings] = useState<ReadingSettingsValue>(DEFAULT_READING_SETTINGS);
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    const sync = () => setSettings(readReadingSettings());
    const onStorage = (event: StorageEvent) => {
      if (event.key !== READING_SETTINGS_STORAGE_KEY && event.key !== null) return;
      syncReadingSettingsFromStorage(event.newValue);
    };
    sync();
    window.addEventListener(READING_SETTINGS_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    const unsubscribeSystemTheme = subscribeSystemTheme();
    return () => {
      window.removeEventListener(READING_SETTINGS_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
      unsubscribeSystemTheme();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [close, isDesktop, open]);

  const update = useCallback((patch: Partial<ReadingSettingsValue>) => {
    setSettings(saveReadingSettings(patch));
  }, []);

  return (
    <div ref={containerRef} className="reading-settings">
      <button
        ref={triggerRef}
        type="button"
        className="reading-settings-trigger"
        aria-label="阅读设置"
        title="调整文字大小"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Aa
      </button>

      {open && isDesktop && (
        <div
          id={panelId}
          role="dialog"
          aria-label="阅读设置"
          className={`reading-settings-popover ${align === "start" ? "is-align-start" : "is-align-end"}`}
        >
          <ReadingSettingsPanel settings={settings} onChange={update} />
        </div>
      )}

      <Sheet
        open={open && !isDesktop}
        onClose={() => setOpen(false)}
        id={panelId}
        label="阅读设置"
        closeLabel="关闭阅读设置"
        className="reading-settings-sheet"
        returnFocusRef={triggerRef}
      >
        <ReadingSettingsPanel settings={settings} onChange={update} />
      </Sheet>
    </div>
  );
}
