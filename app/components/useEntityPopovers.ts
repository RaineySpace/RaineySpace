"use client";

import { useLayoutEffect, type RefObject } from "react";
import { alignEntityChipPopovers } from "@/lib/entity-chip-popovers";
import { hoverInput } from "@/lib/hover-input";

export function useEntityPopovers(ref: RefObject<HTMLElement | null>, contentKey: string) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root?.querySelector(".entity-chip")) return;
    const align = () => alignEntityChipPopovers(root);
    const reopen = (event: PointerEvent | FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const chip = target.closest<HTMLElement>(".entity-chip");
      if (!chip || (event.type === "pointerenter" && target !== chip)) return;
      if (event.type === "pointerenter") {
        if ((event as PointerEvent).pointerType !== "mouse" || !hoverInput.getSnapshot().hoverEnabled) return;
      } else {
        const mode = hoverInput.getSnapshot().mode;
        if (mode === "touch" || mode === "pen" || !target.matches(":focus-visible")) return;
        // Keep the next focus target visible while Tab transfers focus into the card.
        chip.dataset.keyboardOpen = "true";
      }
      align();
      // Returning from another tab must not reopen a dismissed card.
      if ((event.relatedTarget instanceof Node && !chip.contains(event.relatedTarget)) ||
          (event.type === "focusin" && !event.relatedTarget && hoverInput.getSnapshot().mode === "keyboard")) {
        delete chip.dataset.dismissed;
      }
    };
    const focusLeft = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const chip = event.target.closest<HTMLElement>(".entity-chip");
      if (chip && !(event.relatedTarget instanceof Node && chip.contains(event.relatedTarget))) {
        delete chip.dataset.keyboardOpen;
      }
    };
    const dismissChip = (chip: HTMLElement) => {
      // Keep keyboard focus on the trigger when closing a focused popover link.
      if (chip.querySelector(".entity-chip-popover")?.contains(document.activeElement)) {
        chip.querySelector<HTMLAnchorElement>(".entity-inline-link")?.focus({ preventScroll: true });
      }
      chip.dataset.dismissed = "true";
    };
    const dismiss = (event: MouseEvent) => {
      if (event.type === "auxclick" && event.button !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      const chip = link?.closest<HTMLElement>(".entity-chip");
      if (!chip || !root.contains(chip)) return;
      dismissChip(chip);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // :hover still identifies the pointer target after the global keyboard handler
      // has disabled its visual state. Escape must keep it closed on the next move.
      root.querySelectorAll<HTMLElement>(".entity-chip:hover, .entity-chip:has(:focus-visible)").forEach(dismissChip);
    };
    const unsubscribe = hoverInput.subscribe(() => {
      const { mode, hoverEnabled } = hoverInput.getSnapshot();
      // Touch panels leave layout entirely; measure again when they become available.
      if (hoverEnabled || mode === "keyboard") align();
      if (mode !== "none") return;
      root.querySelectorAll<HTMLElement>(".entity-chip").forEach((chip) => {
        delete chip.dataset.keyboardOpen;
        chip.dataset.dismissed = "true";
      });
    });
    align();

    const observer = new ResizeObserver(align);
    observer.observe(root);
    // Inline roots do not report size changes. Reader font settings can resize
    // even hidden panels, which must not overflow the touch viewport.
    root.querySelectorAll(".entity-chip-popover-panel").forEach((panel) => observer.observe(panel));
    root.addEventListener("pointerenter", reopen, true);
    root.addEventListener("focusin", reopen);
    root.addEventListener("focusout", focusLeft);
    root.addEventListener("click", dismiss, true);
    root.addEventListener("auxclick", dismiss, true);
    root.addEventListener("load", align, true);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      unsubscribe();
      root.removeEventListener("pointerenter", reopen, true);
      root.removeEventListener("focusin", reopen);
      root.removeEventListener("focusout", focusLeft);
      root.removeEventListener("click", dismiss, true);
      root.removeEventListener("auxclick", dismiss, true);
      root.removeEventListener("load", align, true);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", align);
    };
  }, [ref, contentKey]);
}
