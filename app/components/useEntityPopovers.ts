"use client";

import { useLayoutEffect, type RefObject } from "react";
import { alignEntityChipPopovers } from "@/lib/entity-chip-popovers";

export function useEntityPopovers(ref: RefObject<HTMLElement>, contentKey: string) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root?.querySelector(".entity-chip")) return;
    const align = () => alignEntityChipPopovers(root);
    align();

    const observer = new ResizeObserver(align);
    observer.observe(root);
    root.addEventListener("pointerenter", align, true);
    root.addEventListener("focusin", align);
    root.addEventListener("load", align, true);
    window.addEventListener("resize", align);
    return () => {
      observer.disconnect();
      root.removeEventListener("pointerenter", align, true);
      root.removeEventListener("focusin", align);
      root.removeEventListener("load", align, true);
      window.removeEventListener("resize", align);
    };
  }, [ref, contentKey]);
}
