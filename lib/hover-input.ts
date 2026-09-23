export type InputMode = "none" | "mouse" | "touch" | "pen" | "keyboard";

export interface HoverInputSnapshot {
  mode: InputMode;
  hoverEnabled: boolean;
}

/** One input policy for CSS and pointer-driven components. Safe to import during SSR. */
export function createHoverInput() {
  let snapshot: HoverInputSnapshot = { mode: "none", hoverEnabled: false };
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    connect(browser: Window, document: Document) {
      const media = browser.matchMedia("(any-hover: hover)");
      const publish = (mode: InputMode, hoverEnabled: boolean) => {
        const data = document.documentElement.dataset;
        // Avoid invalidating root selectors on every mousemove.
        if (data.hoverEnabled !== String(hoverEnabled)) data.hoverEnabled = String(hoverEnabled);
        if (data.inputMode !== mode) data.inputMode = mode;
        if (snapshot.mode === mode && snapshot.hoverEnabled === hoverEnabled) return;
        snapshot = { mode, hoverEnabled };
        listeners.forEach((listener) => listener());
      };
      const reset = () => publish("none", false);
      const pointer = (event: PointerEvent) => {
        const mode = event.pointerType;
        if (mode !== "mouse" && mode !== "touch" && mode !== "pen") {
          reset();
          return;
        }
        publish(mode, mode === "mouse" && media.matches &&
          (event.type !== "pointerdown" || snapshot.hoverEnabled));
      };
      const keyboard = () => publish("keyboard", false);
      // Connecting a mouse does not turn a preceding finger interaction into hover.
      const capabilityChanged = () => publish(snapshot.mode, false);
      const visibilityChanged = () => {
        if (document.visibilityState === "hidden") reset();
      };

      const capture = { capture: true, passive: true };
      reset();
      document.addEventListener("pointerover", pointer, capture);
      document.addEventListener("pointermove", pointer, capture);
      document.addEventListener("pointerdown", pointer, capture);
      document.addEventListener("keydown", keyboard, capture);
      document.addEventListener("visibilitychange", visibilityChanged);
      browser.addEventListener("blur", reset);
      browser.addEventListener("pagehide", reset);
      browser.addEventListener("pageshow", reset);
      media.addEventListener("change", capabilityChanged);
      return () => {
        document.removeEventListener("pointerover", pointer, capture);
        document.removeEventListener("pointermove", pointer, capture);
        document.removeEventListener("pointerdown", pointer, capture);
        document.removeEventListener("keydown", keyboard, capture);
        document.removeEventListener("visibilitychange", visibilityChanged);
        browser.removeEventListener("blur", reset);
        browser.removeEventListener("pagehide", reset);
        browser.removeEventListener("pageshow", reset);
        media.removeEventListener("change", capabilityChanged);
        reset();
      };
    },
  };
}

export const hoverInput = createHoverInput();
