"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { LIVE_PHOTO_LONG_PRESS_MS, LIVE_PHOTO_MOVE_CANCEL_PX, unlockLiveVideo } from "@/app/components/LivePhoto";

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
  startedAt: number;
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
  canLivePhoto?: boolean;
  stageRef: RefObject<HTMLDivElement>;
  trackRef: RefObject<HTMLDivElement>;
  shellRef: RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onLivePhotoHoldStart?: () => void;
  onLivePhotoHoldEnd?: () => void;
  liveVideoSrc?: string;
}

export function useLightboxGestures({
  isOpen,
  activeIndex,
  hasMultipleImages,
  canLivePhoto = false,
  stageRef,
  trackRef,
  shellRef,
  onPrevious,
  onNext,
  onClose,
  onLivePhotoHoldStart,
  onLivePhotoHoldEnd,
  liveVideoSrc,
}: UseLightboxGesturesOptions) {
  const gestureRef = useRef<GestureSession | null>(null);
  const settleTokenRef = useRef(0);
  const settlingRef = useRef(false);
  const liveTimerRef = useRef<number | null>(null);
  const liveHoldingRef = useRef(false);
  const hasMultipleRef = useRef(hasMultipleImages);
  const canLivePhotoRef = useRef(canLivePhoto);
  const onPreviousRef = useRef(onPrevious);
  const onNextRef = useRef(onNext);
  const onCloseRef = useRef(onClose);
  const onLivePhotoHoldStartRef = useRef(onLivePhotoHoldStart);
  const onLivePhotoHoldEndRef = useRef(onLivePhotoHoldEnd);
  const liveVideoSrcRef = useRef(liveVideoSrc);

  hasMultipleRef.current = hasMultipleImages;
  canLivePhotoRef.current = canLivePhoto;
  onPreviousRef.current = onPrevious;
  onNextRef.current = onNext;
  onCloseRef.current = onClose;
  onLivePhotoHoldStartRef.current = onLivePhotoHoldStart;
  onLivePhotoHoldEndRef.current = onLivePhotoHoldEnd;
  liveVideoSrcRef.current = liveVideoSrc;

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

  const clearLiveTimer = useCallback(() => {
    if (liveTimerRef.current == null) return;
    window.clearTimeout(liveTimerRef.current);
    liveTimerRef.current = null;
  }, []);

  const pauseActiveLiveVideo = useCallback(() => {
    const video = stageRef.current?.querySelector<HTMLVideoElement>(
      '.image-lightbox-slide:not([aria-hidden="true"]) video.live-photo-video',
    );
    if (!video) return;
    video.pause();
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) video.currentTime = 0;
    } catch {
      /* ignore unset media */
    }
  }, [stageRef]);

  const endLiveHold = useCallback(() => {
    clearLiveTimer();
    if (liveHoldingRef.current) {
      liveHoldingRef.current = false;
      onLivePhotoHoldEndRef.current?.();
      return;
    }
    pauseActiveLiveVideo();
  }, [clearLiveTimer, pauseActiveLiveVideo]);

  useLayoutEffect(() => {
    endLiveHold();
    if (!isOpen) return;
    settleTokenRef.current += 1;
    settlingRef.current = false;
    resetTrack();
    resetShell();
  }, [activeIndex, endLiveHold, isOpen, resetShell, resetTrack]);

  useEffect(() => {
    if (!isOpen) {
      settleTokenRef.current += 1;
      settlingRef.current = false;
      gestureRef.current = null;
      endLiveHold();
      return;
    }
    const stage = stageRef.current;
    const frame = requestAnimationFrame(() => resetTrack());
    if (!stage || typeof ResizeObserver === "undefined") {
      return () => {
        cancelAnimationFrame(frame);
        endLiveHold();
      };
    }

    const observer = new ResizeObserver(() => {
      if (gestureRef.current || settlingRef.current || liveHoldingRef.current) return;
      resetTrack();
    });
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      endLiveHold();
    };
  }, [endLiveHold, isOpen, resetTrack, stageRef]);

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

    const wasLiveHold = liveHoldingRef.current;
    endLiveHold();
    if (wasLiveHold) return;

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
  }, [endLiveHold, settleHorizontal, settleVertical, stageRef]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" && event.button !== 0) return;
    if (gestureRef.current) return;
    if ((event.target as HTMLElement | null)?.closest("button, a")) return;

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTime: event.timeStamp,
      startedAt: performance.now(),
      axis: "undecided",
    };

    if (!canLivePhotoRef.current) {
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    const video = stageRef.current?.querySelector<HTMLVideoElement>(
      '.image-lightbox-slide:not([aria-hidden="true"]) video.live-photo-video',
    );
    unlockLiveVideo(video, liveVideoSrcRef.current);
    clearLiveTimer();
    liveTimerRef.current = window.setTimeout(() => {
      liveTimerRef.current = null;
      const gesture = gestureRef.current;
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      if (gesture.axis !== "undecided") return;
      liveHoldingRef.current = true;
      onLivePhotoHoldStartRef.current?.();
    }, LIVE_PHOTO_LONG_PRESS_MS);
  }, [clearLiveTimer, stageRef]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    if (liveHoldingRef.current) return;

    if (performance.now() - gesture.startedAt < 80 && gesture.axis === "undecided") {
      gesture.startX = event.clientX;
      gesture.startY = event.clientY;
      gesture.startTime = event.timeStamp;
      return;
    }

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.axis === "undecided") {
      const distance = Math.hypot(dx, dy);
      const livePending = liveTimerRef.current != null || liveHoldingRef.current;
      const lockPx = livePending ? LIVE_PHOTO_MOVE_CANCEL_PX : AXIS_LOCK_PX;
      if (distance < lockPx) return;
      clearLiveTimer();
      pauseActiveLiveVideo();
      if (Math.abs(dx) > Math.abs(dy) && hasMultipleRef.current) {
        gesture.axis = "horizontal";
      } else {
        gesture.axis = "vertical";
      }
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    }

    if (prefersReducedMotion()) return;

    if (gesture.axis === "horizontal") applyHorizontal(dx);
    else if (gesture.axis === "vertical") applyVertical(dy);
  }, [applyHorizontal, applyVertical, clearLiveTimer, pauseActiveLiveVideo]);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    endGesture(event);
  }, [endGesture]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;
    gestureRef.current = null;
    endLiveHold();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resetTrack(true);
    resetShell(true);
  }, [endLiveHold, resetShell, resetTrack]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
