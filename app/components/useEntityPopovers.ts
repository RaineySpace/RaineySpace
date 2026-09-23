"use client";

import { useLayoutEffect, type RefObject } from "react";
import { alignEntityChipPopovers } from "@/lib/entity-chip-popovers";

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
      // Returning from another tab must not reopen a dismissed card.
      if (event.relatedTarget instanceof Node && !chip.contains(event.relatedTarget)) {
        delete chip.dataset.dismissed;
      }
    };
    const dismiss = (event: MouseEvent) => {
      if (event.type === "auxclick" && event.button !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      const chip = link?.closest<HTMLElement>(".entity-chip");
      if (!chip || !root.contains(chip)) return;
      // Keep keyboard focus on the trigger when closing a focused popover link.
      if (chip.querySelector(".entity-chip-popover")?.contains(document.activeElement)) {
        chip.querySelector<HTMLAnchorElement>(".entity-inline-link")?.focus({ preventScroll: true });
      }
      chip.dataset.dismissed = "true";
    };
    align();

    const observer = new ResizeObserver(align);
    observer.observe(root);
    root.addEventListener("pointerenter", align, true);
    root.addEventListener("focusin", align);
    root.addEventListener("pointerenter", reopen, true);
    root.addEventListener("focusin", reopen);
    root.addEventListener("click", dismiss, true);
    root.addEventListener("auxclick", dismiss, true);
    root.addEventListener("load", align, true);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      root.removeEventListener("pointerenter", align, true);
      root.removeEventListener("focusin", align);
      root.removeEventListener("pointerenter", reopen, true);
      root.removeEventListener("focusin", reopen);
      root.removeEventListener("click", dismiss, true);
      root.removeEventListener("auxclick", dismiss, true);
      root.removeEventListener("load", align, true);
      window.removeEventListener("resize", align);
    };
  }, [ref, contentKey]);
}
