"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

const AXIS_LOCK_PX = 8;
const VERTICAL_DISTANCE_PX = 80;
const VERTICAL_FLICK_PX = 36;
const VELOCITY_PX_MS = 0.45;
const SETTLE_MS = 250;

interface GestureSession {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  fromHandle: boolean;
  dragging: boolean;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setTransition(element: HTMLElement | null, value: string) {
  if (!element) return;
  element.style.transition = value;
}

interface UseSheetGesturesOptions {
  isOpen: boolean;
  sheetRef: RefObject<HTMLDivElement>;
  backdropRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

export function useSheetGestures({
  isOpen,
  sheetRef,
  backdropRef,
  onClose,
}: UseSheetGesturesOptions) {
  const gestureRef = useRef<GestureSession | null>(null);
  const settleTokenRef = useRef(0);
  const settlingRef = useRef(false);
  const onCloseRef = useRef(onClose);

  onCloseRef.current = onClose;

  const resetSheet = useCallback((withTransition = false) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;

    sheet.classList.remove("is-dragging");
    backdrop?.classList.remove("is-dragging");
    setTransition(
      sheet,
      withTransition ? `transform ${SETTLE_MS}ms ease-out` : "none",
    );
    setTransition(
      backdrop,
      withTransition ? `opacity ${SETTLE_MS}ms ease-out` : "none",
    );
    sheet.style.transform = "translate3d(0, 0, 0)";
    if (backdrop) backdrop.style.opacity = "1";

    if (!withTransition) {
      sheet.style.transition = "";
      sheet.style.transform = "";
      if (backdrop) {
        backdrop.style.transition = "";
        backdrop.style.opacity = "";
      }
    }
  }, [backdropRef, sheetRef]);

  const beginDrag = useCallback(() => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;
    sheet.classList.add("is-dragging");
    backdrop?.classList.add("is-dragging");
    sheet.style.animation = "none";
    setTransition(sheet, "none");
    setTransition(backdrop, "none");
  }, [backdropRef, sheetRef]);

  const applyDrag = useCallback((offsetY: number) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet) return;
    const y = Math.max(0, offsetY);
    sheet.style.transform = `translate3d(0, ${y}px, 0)`;
    if (backdrop) backdrop.style.opacity = String(Math.max(0, 1 - y / 320));
  }, [backdropRef, sheetRef]);

  useEffect(() => {
    if (!isOpen) {
      settleTokenRef.current += 1;
      settlingRef.current = false;
      gestureRef.current = null;
    }
  }, [isOpen]);

  const settle = useCallback((shouldClose: boolean) => {
    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;

    if (!shouldClose) {
      resetSheet(true);
      return;
    }

    if (!sheet || prefersReducedMotion()) {
      onCloseRef.current();
      return;
    }

    const token = ++settleTokenRef.current;
    settlingRef.current = true;
    sheet.classList.remove("is-dragging");
    backdrop?.classList.remove("is-dragging");
    setTransition(sheet, `transform 200ms ease-in`);
    setTransition(backdrop, `opacity 200ms ease-in`);
    sheet.style.transform = `translate3d(0, ${sheet.offsetHeight}px, 0)`;
    if (backdrop) backdrop.style.opacity = "0";

    const finish = () => {
      if (token !== settleTokenRef.current) return;
      settleTokenRef.current += 1;
      settlingRef.current = false;
      onCloseRef.current();
    };

    const timeout = window.setTimeout(finish, 240);
    const handleEnd = (event: TransitionEvent) => {
      if (event.target !== sheet || event.propertyName !== "transform") return;
      window.clearTimeout(timeout);
      sheet.removeEventListener("transitionend", handleEnd);
      finish();
    };
    sheet.addEventListener("transitionend", handleEnd);
  }, [backdropRef, resetSheet, sheetRef]);

  const endGesture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gestureRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!gesture.dragging) return;

    const dy = event.clientY - gesture.startY;
    const duration = Math.max(event.timeStamp - gesture.startTime, 1);
    const velocityY = dy / duration;
    const passedDistance = dy > VERTICAL_DISTANCE_PX;
    const flicked = dy > VERTICAL_FLICK_PX && velocityY > VELOCITY_PX_MS;
    settle(passedDistance || flicked);
  }, [settle]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (gestureRef.current || settlingRef.current) return;
    if ((event.target as HTMLElement | null)?.closest("button, a")) return;

    const fromHandle = Boolean((event.target as HTMLElement | null)?.closest("[data-sheet-handle]"));
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      fromHandle,
      dragging: false,
    };

    if (fromHandle) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.dragging) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;

      if (Math.abs(dx) > Math.abs(dy) || dy < 0) {
        if (!gesture.fromHandle) gestureRef.current = null;
        return;
      }

      const sheet = sheetRef.current;
      if (!gesture.fromHandle && sheet && sheet.scrollTop > 0) {
        gestureRef.current = null;
        return;
      }

      gesture.dragging = true;
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      beginDrag();
    }

    if (prefersReducedMotion()) return;
    applyDrag(dy);
  }, [applyDrag, beginDrag, sheetRef]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    endGesture(event);
  }, [endGesture]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (gesture.dragging) resetSheet(true);
  }, [resetSheet]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
