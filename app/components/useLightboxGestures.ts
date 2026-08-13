"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

const AXIS_LOCK_PX = 8;
const HORIZONTAL_DISTANCE_RATIO = 0.2;
const HORIZONTAL_FLICK_PX = 32;
const VERTICAL_DISTANCE_PX = 80;
const VERTICAL_FLICK_PX = 36;
const VELOCITY_PX_MS = 0.45;
const SETTLE_MS = 250;

type GestureAxis = "undecided" | "horizontal" | "vertical";

interface GestureSession {
  pointerId: number;
  startX: number;
  startY: number;
  startTime: number;
  axis: GestureAxis;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setTransition(element: HTMLElement | null, value: string) {
  if (!element) return;
  element.style.transition = value;
}

interface UseLightboxGesturesOptions {
  isOpen: boolean;
  activeIndex: number | null;
  hasMultipleImages: boolean;
  stageRef: RefObject<HTMLDivElement>;
  trackRef: RefObject<HTMLDivElement>;
  shellRef: RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
}

export function useLightboxGestures({
  isOpen,
  activeIndex,
  hasMultipleImages,
  stageRef,
  trackRef,
  shellRef,
  onPrevious,
  onNext,
  onClose,
}: UseLightboxGesturesOptions) {
  const gestureRef = useRef<GestureSession | null>(null);
  const settleTokenRef = useRef(0);
  const settlingRef = useRef(false);
  const hasMultipleRef = useRef(hasMultipleImages);
  const onPreviousRef = useRef(onPrevious);
  const onNextRef = useRef(onNext);
  const onCloseRef = useRef(onClose);

  hasMultipleRef.current = hasMultipleImages;
  onPreviousRef.current = onPrevious;
  onNextRef.current = onNext;
  onCloseRef.current = onClose;

  const resetTrack = useCallback((withTransition = false) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track) return;
    setTransition(track, withTransition ? `transform ${SETTLE_MS}ms ease-out` : "none");
    const width = stage?.clientWidth ?? 0;
    const base = hasMultipleRef.current ? -width : 0;
    track.style.transform = `translate3d(${base}px, 0, 0)`;
  }, [stageRef, trackRef]);

  const resetShell = useCallback((withTransition = false) => {
    const shell = shellRef.current;
    if (!shell) return;
    setTransition(
      shell,
      withTransition ? `transform ${SETTLE_MS}ms ease-out, opacity ${SETTLE_MS}ms ease-out` : "none",
    );
    shell.style.transform = "translate3d(0, 0, 0)";
    shell.style.opacity = "1";
  }, [shellRef]);

  const applyHorizontal = useCallback((offsetX: number) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track) return;
    setTransition(track, "none");
    const width = stage?.clientWidth ?? 0;
    track.style.transform = `translate3d(${-width + offsetX}px, 0, 0)`;
  }, [stageRef, trackRef]);

  const applyVertical = useCallback((offsetY: number) => {
    const shell = shellRef.current;
    if (!shell) return;
    const y = Math.max(0, offsetY);
    setTransition(shell, "none");
    shell.style.transform = `translate3d(0, ${y}px, 0)`;
    shell.style.opacity = String(Math.max(0.4, 1 - y / 420));
  }, [shellRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    settleTokenRef.current += 1;
    settlingRef.current = false;
    resetTrack();
    resetShell();
  }, [activeIndex, isOpen, resetShell, resetTrack]);

  useEffect(() => {
    if (!isOpen) {
      settleTokenRef.current += 1;
      settlingRef.current = false;
      gestureRef.current = null;
      return;
    }
    const stage = stageRef.current;
    const frame = requestAnimationFrame(() => resetTrack());
    if (!stage || typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(() => {
      if (gestureRef.current || settlingRef.current) return;
      resetTrack();
    });
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isOpen, resetTrack, stageRef]);

  const settleHorizontal = useCallback((direction: -1 | 0 | 1) => {
    const track = trackRef.current;
    const stage = stageRef.current;
    if (!track || !stage) {
      if (direction === 1) onNextRef.current();
      if (direction === -1) onPreviousRef.current();
      if (direction === 0) resetTrack();
      return;
    }

    const token = ++settleTokenRef.current;
    const width = stage.clientWidth;
    const reduced = prefersReducedMotion();
    settlingRef.current = direction !== 0;

    if (reduced || direction === 0) {
      settlingRef.current = false;
      if (direction === 1) onNextRef.current();
      else if (direction === -1) onPreviousRef.current();
      else resetTrack(true);
      return;
    }

    setTransition(track, `transform ${SETTLE_MS}ms ease-out`);
    track.style.transform = `translate3d(${direction === 1 ? -2 * width : 0}px, 0, 0)`;

    const finish = () => {
      if (token !== settleTokenRef.current) return;
      settleTokenRef.current += 1;
      settlingRef.current = false;
      if (direction === 1) onNextRef.current();
      else onPreviousRef.current();
    };

    const timeout = window.setTimeout(finish, SETTLE_MS + 40);
    const handleEnd = (event: TransitionEvent) => {
      if (event.target !== track || event.propertyName !== "transform") return;
      window.clearTimeout(timeout);
      track.removeEventListener("transitionend", handleEnd);
      finish();
    };
    track.addEventListener("transitionend", handleEnd);
  }, [resetTrack, stageRef, trackRef]);

  const settleVertical = useCallback((shouldClose: boolean) => {
    const shell = shellRef.current;
    if (!shouldClose) {
      resetShell(true);
      return;
    }

    if (!shell || prefersReducedMotion()) {
      onCloseRef.current();
      return;
    }

    const token = ++settleTokenRef.current;
    settlingRef.current = true;
    setTransition(shell, `transform 200ms ease-in, opacity 200ms ease-in`);
    shell.style.transform = "translate3d(0, 30vh, 0)";
    shell.style.opacity = "0";

    const finish = () => {
      if (token !== settleTokenRef.current) return;
      settleTokenRef.current += 1;
      settlingRef.current = false;
      onCloseRef.current();
    };

    const timeout = window.setTimeout(finish, 240);
    const handleEnd = (event: TransitionEvent) => {
      if (event.target !== shell || event.propertyName !== "opacity") return;
      window.clearTimeout(timeout);
      shell.removeEventListener("transitionend", handleEnd);
      finish();
    };
    shell.addEventListener("transitionend", handleEnd);
  }, [resetShell, shellRef]);

  const endGesture = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gestureRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;
    const duration = Math.max(event.timeStamp - gesture.startTime, 1);
    const velocityX = dx / duration;
    const velocityY = dy / duration;
    const width = stageRef.current?.clientWidth ?? 1;

    if (gesture.axis === "horizontal" && hasMultipleRef.current) {
      const passedDistance = Math.abs(dx) > width * HORIZONTAL_DISTANCE_RATIO;
      const flicked = Math.abs(dx) > HORIZONTAL_FLICK_PX && Math.abs(velocityX) > VELOCITY_PX_MS;
      if ((passedDistance || flicked) && dx < 0) settleHorizontal(1);
      else if ((passedDistance || flicked) && dx > 0) settleHorizontal(-1);
      else settleHorizontal(0);
      return;
    }

    if (gesture.axis === "vertical") {
      const passedDistance = dy > VERTICAL_DISTANCE_PX;
      const flicked = dy > VERTICAL_FLICK_PX && velocityY > VELOCITY_PX_MS;
      settleVertical(passedDistance || flicked);
    }
  }, [settleHorizontal, settleVertical, stageRef]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (gestureRef.current) return;
    if ((event.target as HTMLElement | null)?.closest("button, a")) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      axis: "undecided",
    };
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.axis === "undecided") {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      if (Math.abs(dx) > Math.abs(dy) && hasMultipleRef.current) {
        gesture.axis = "horizontal";
      } else {
        gesture.axis = "vertical";
      }
    }

    if (prefersReducedMotion()) return;

    if (gesture.axis === "horizontal") applyHorizontal(dx);
    else if (gesture.axis === "vertical") applyVertical(dy);
  }, [applyHorizontal, applyVertical]);

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
    resetTrack(true);
    resetShell(true);
  }, [resetShell, resetTrack]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
