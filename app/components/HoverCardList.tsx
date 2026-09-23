"use client";

import { useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent } from "react";
import { hoverInput } from "@/lib/hover-input";

interface Highlight {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  moving: boolean;
}

export default function HoverCardList({ children }: { children: ReactNode }) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLElement | null>(null);
  const [highlight, setHighlight] = useState<Highlight | null>(null);

  function show(item: HTMLElement) {
    const list = listRef.current;
    if (!list) return;
    activeRef.current = item;
    const bounds = list.getBoundingClientRect();
    const rect = item.getBoundingClientRect();
    setHighlight((previous) => ({
      x: rect.left - bounds.left,
      y: rect.top - bounds.top,
      width: rect.width,
      height: rect.height,
      visible: true,
      moving: previous?.visible ?? false,
    }));
  }

  function hide() {
    activeRef.current = null;
    setHighlight((previous) => previous ? { ...previous, visible: false } : null);
  }

  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse" || !hoverInput.getSnapshot().hoverEnabled) return;
    if (!(event.target instanceof Element)) return;
    const item = event.target.closest<HTMLElement>("[data-hover-card]");
    // Keep the highlight across list gaps so the next card can animate from it.
    // Leaving the list or changing input mode clears it instead.
    if (item && item !== activeRef.current && event.currentTarget.contains(item)) show(item);
  }

  useLayoutEffect(() => hoverInput.subscribe(() => {
    if (!hoverInput.getSnapshot().hoverEnabled) hide();
  }), []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const refresh = () => {
      const active = activeRef.current;
      if (!active) return;
      if (list.contains(active)) show(active);
      else hide();
    };
    refresh();
    const observer = new ResizeObserver(refresh);
    observer.observe(list);
    list.querySelectorAll<HTMLElement>("[data-hover-card]").forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [children]);

  return (
    <div
      ref={listRef}
      className="hover-card-list relative -mx-3 flex flex-col gap-3 px-3 isolate"
      onPointerOver={followPointer}
      onPointerMove={followPointer}
      onPointerLeave={hide}
    >
      <span
        aria-hidden="true"
        className="hover-card-highlight pointer-events-none absolute left-0 top-0 -z-10 rounded-xl bg-(--surface-muted)"
        style={{
          width: highlight?.width ?? 0,
          height: highlight?.height ?? 0,
          transform: `translate(${highlight?.x ?? 0}px, ${highlight?.y ?? 0}px)`,
          opacity: highlight?.visible ? 1 : 0,
          transitionProperty: highlight?.moving ? "transform, width, height, opacity" : "opacity",
        }}
      />
      {children}
    </div>
  );
}
