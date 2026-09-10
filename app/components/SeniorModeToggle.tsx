"use client";

import { useEffect, useState } from "react";
import {
  SENIOR_MODE_CHANGE_EVENT,
  SENIOR_MODE_CLASS,
  SENIOR_MODE_STORAGE_KEY,
  isSeniorModeEnabled,
  setSeniorModeEnabled,
} from "@/lib/senior-mode";

export default function SeniorModeToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isSeniorModeEnabled());
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SENIOR_MODE_STORAGE_KEY && event.key !== null) return;
      document.documentElement.classList.toggle(SENIOR_MODE_CLASS, event.newValue === "1");
      window.dispatchEvent(new Event(SENIOR_MODE_CHANGE_EVENT));
      sync();
    };

    sync();
    window.addEventListener(SENIOR_MODE_CHANGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SENIOR_MODE_CHANGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "关闭适老化大字模式" : "开启适老化大字模式"}
      title={enabled ? "关闭大字" : "大字"}
      onClick={() => setSeniorModeEnabled(!enabled)}
      className="senior-mode-toggle inline-flex items-center py-1 text-sm text-[--muted] transition-colors hover:text-[--title] focus-visible:text-[--title] aria-pressed:font-medium aria-pressed:text-[--title]"
    >
      大字
    </button>
  );
}
