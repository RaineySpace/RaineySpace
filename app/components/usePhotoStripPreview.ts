"use client";

import { useEffect, type RefObject } from "react";
import { hoverInput } from "@/lib/hover-input";
import { advanceSpring, clamp, photoFocus, photoStripLayout, springSettled, type PhotoSlot, type SpringState } from "@/lib/photo-strip-motion";

export function usePhotoStripPreview(ref: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    const stage = ref.current;
    const viewport = stage?.querySelector<HTMLElement>(".photo-strip-viewport");
    const track = stage?.querySelector<HTMLElement>(".photo-strip-track");
    if (!stage || !viewport || !track || !enabled) return;
    const buttons = [...track.querySelectorAll<HTMLButtonElement>("[data-photo-index]")];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    let slots: PhotoSlot[] = [];
    let focus: SpringState = { value: 0, velocity: 0 };
    let expansion: SpringState = { value: 0, velocity: 0 };
    let targetFocus = 0;
    let targetExpansion = 0;
    let frame = 0;
    let lastTime = 0;
    let measurementKey = "";
    let pointer: { x: number; y: number } | null = null;

    function clearStyles() {
      buttons.forEach(button => {
        button.style.removeProperty("transform");
        button.style.removeProperty("--photo-emphasis");
        button.removeAttribute("data-hovered");
      });
      stage!.removeAttribute("data-expanded");
    }

    function reset() {
      cancelAnimationFrame(frame);
      frame = 0;
      expansion = { value: 0, velocity: 0 };
      focus.velocity = 0;
      targetExpansion = 0;
      pointer = null;
      clearStyles();
    }

    function measure() {
      const rect = stage!.getBoundingClientRect();
      const section = stage!.closest("section");
      const header = section?.querySelector("header")?.getBoundingClientRect();
      const next = section?.nextElementSibling?.getBoundingClientRect();
      const bleed = Math.max(0, Math.min(72, rect.left - 20, document.documentElement.clientWidth - rect.right - 20));
      const top = Math.max(0, Math.min(4, rect.top - (header?.bottom ?? rect.top - 16) - 12));
      const bottom = Math.max(0, Math.min(28, (next?.top ?? rect.bottom + 40) - rect.bottom - 12));
      const key = [rect.width, rect.height, bleed, top, bottom].join();
      if (key === measurementKey) return false;
      measurementKey = key;
      reset();
      stage!.style.setProperty("--photo-bleed", `${bleed}px`);
      stage!.style.setProperty("--photo-top-space", `${top}px`);
      stage!.style.setProperty("--photo-bottom-space", `${bottom}px`);
      const origin = track!.getBoundingClientRect();
      slots = buttons.map(button => {
        const bounds = button.getBoundingClientRect();
        const css = getComputedStyle(button);
        return {
          x: bounds.left + bounds.width / 2 - origin.left,
          y: bounds.top + bounds.height / 2 - origin.top,
          width: parseFloat(css.width), height: parseFloat(css.height),
          rotation: parseFloat(css.getPropertyValue("--photo-rotation")) || 0,
        };
      });
      return true;
    }

    function render() {
      const poses = photoStripLayout(slots, focus.value, expansion.value, {
        left: viewport!.scrollLeft + 4, right: viewport!.scrollLeft + viewport!.clientWidth - 4,
        top: 4, bottom: track!.clientHeight - 4,
      });
      const nearest = Math.round(clamp(focus.value, 0, buttons.length - 1));
      poses.forEach((pose, index) => {
        const button = buttons[index];
        button.style.transform = `translate(${pose.x - slots[index].x}px, ${pose.y - slots[index].y}px) rotate(${pose.rotation}deg) scale(${pose.scale})`;
        button.style.setProperty("--photo-emphasis", String(pose.emphasis));
        if (index === nearest && targetExpansion) button.dataset.hovered = "true";
        else button.removeAttribute("data-hovered");
      });
      stage!.dataset.expanded = "true";
    }

    function tick(time: number) {
      const seconds = (time - lastTime) / 1000;
      lastTime = time;
      focus = advanceSpring(focus, targetFocus, seconds);
      expansion = advanceSpring(expansion, targetExpansion, seconds);
      const bounded = clamp(expansion.value, 0, 1);
      if (bounded !== expansion.value) expansion = { value: bounded, velocity: 0 };
      const settled = springSettled(focus, targetFocus) && springSettled(expansion, targetExpansion);
      if (settled) {
        focus = { value: targetFocus, velocity: 0 };
        expansion = { value: targetExpansion, velocity: 0 };
      }
      render();
      if (settled) {
        frame = 0;
        if (!targetExpansion) clearStyles();
      } else frame = requestAnimationFrame(tick);
    }

    function start() {
      if (frame) return;
      lastTime = performance.now();
      frame = requestAnimationFrame(tick);
    }

    function activate(nextFocus: number, instant = false) {
      targetFocus = nextFocus;
      if (expansion.value === 0 && targetExpansion === 0) focus = { value: nextFocus, velocity: 0 };
      targetExpansion = 1;
      if (reducedMotion.matches) {
        clearStyles();
        buttons[Math.round(nextFocus)]?.style.setProperty("--photo-emphasis", "1");
        return;
      }
      if (instant) {
        cancelAnimationFrame(frame);
        frame = 0;
        focus = { value: nextFocus, velocity: 0 };
        expansion = { value: 1, velocity: 0 };
        render();
      } else start();
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== "mouse" || !hoverInput.getSnapshot().hoverEnabled) return;
      if (pointer?.x === event.clientX && pointer.y === event.clientY) return;
      pointer = { x: event.clientX, y: event.clientY };
      const x = event.clientX - viewport!.getBoundingClientRect().left + viewport!.scrollLeft;
      // Empty padding does not initiate magnification; once active it bridges gaps.
      if (!targetExpansion && !(event.target instanceof Element && event.target.closest("[data-photo-index]"))) return;
      activate(photoFocus(slots, x));
    }

    function leave() {
      pointer = null;
      targetExpansion = 0;
      if (reducedMotion.matches) clearStyles();
      else start();
    }

    function focusIn(event: FocusEvent) {
      if (hoverInput.getSnapshot().mode !== "keyboard") return;
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("[data-photo-index]") : null;
      if (button) activate(Number(button.dataset.photoIndex), true);
    }

    function focusOut(event: FocusEvent) {
      if (!(event.relatedTarget instanceof Node && track!.contains(event.relatedTarget)) && hoverInput.getSnapshot().mode === "keyboard") reset();
    }

    function scroll() {
      reset();
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index >= 0 && hoverInput.getSnapshot().mode === "keyboard") activate(index, true);
    }

    const unsubscribe = hoverInput.subscribe(() => {
      if (!hoverInput.getSnapshot().hoverEnabled) reset();
    });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerleave", leave);
    track.addEventListener("focusin", focusIn);
    track.addEventListener("focusout", focusOut);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", measure);
    reducedMotion.addEventListener("change", reset);
    return () => {
      unsubscribe();
      observer.disconnect();
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerleave", leave);
      track.removeEventListener("focusin", focusIn);
      track.removeEventListener("focusout", focusOut);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", measure);
      reducedMotion.removeEventListener("change", reset);
      reset();
    };
  }, [ref, enabled]);
}
