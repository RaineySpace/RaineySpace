"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

export const LIVE_PHOTO_LONG_PRESS_MS = 280;
export const LIVE_PHOTO_MOVE_CANCEL_PX = 24;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canHoverPlay() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion();
}

function prepareLiveVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
}

function armLiveVideo(video: HTMLVideoElement, src: string) {
  prepareLiveVideo(video);
  if (video.getAttribute("data-live-src") === src && video.getAttribute("src")) return;
  video.src = src;
  video.setAttribute("data-live-src", src);
}

function resetLiveVideo(video: HTMLVideoElement) {
  video.pause();
  try {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      video.currentTime = 0;
    }
  } catch {
    /* ignore unset media */
  }
}

export function unlockLiveVideo(video: HTMLVideoElement | null, src?: string) {
  if (!video) return;
  if (src) armLiveVideo(video, src);
  else prepareLiveVideo(video);
  if (!video.getAttribute("src") && !src) return;
  const playPromise = video.play();
  playPromise?.catch(() => {
    /* Safari may reject until the media is armed; the reveal path retries. */
  });
}

function LivePhotoBadge({ size = "md" }: { size?: "sm" | "md" }) {
  const compact = size === "sm";
  return (
    <span className={`live-photo-badge${compact ? " is-sm" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="live-photo-badge-icon" fill="none">
        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="3.1" fill="currentColor" />
      </svg>
      <span className="live-photo-badge-label">LIVE</span>
    </span>
  );
}

function useLivePhotoPlayback({
  root,
  videoRef,
  videoSrc,
  enableHover = true,
  enablePress = true,
  enabled = true,
  playing: playingProp = false,
}: {
  root: HTMLElement | null;
  videoRef: RefObject<HTMLVideoElement>;
  videoSrc: string;
  enableHover?: boolean;
  enablePress?: boolean;
  enabled?: boolean;
  playing?: boolean;
}) {
  const hoverRef = useRef(false);
  const pressRef = useRef(false);
  const playingRef = useRef(false);
  const armedRef = useRef(false);
  const playTokenRef = useRef(0);
  const suppressClickRef = useRef(false);
  const pressTimerRef = useRef<number | null>(null);
  const pressPointRef = useRef<{ id: number; x: number; y: number; startedAt: number } | null>(null);
  const enabledRef = useRef(enabled);
  const enableHoverRef = useRef(enableHover);
  const enablePressRef = useRef(enablePress);
  const playingPropRef = useRef(playingProp);
  const videoSrcRef = useRef(videoSrc);

  enabledRef.current = enabled;
  enableHoverRef.current = enableHover;
  enablePressRef.current = enablePress;
  playingPropRef.current = playingProp;
  videoSrcRef.current = videoSrc;

  const clearPressTimer = () => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const syncPlayback = () => {
    const video = videoRef.current;
    const shouldPlay =
      enabledRef.current && (playingPropRef.current || hoverRef.current || pressRef.current);

    if (!shouldPlay) {
      playTokenRef.current += 1;
      playingRef.current = false;
      root?.classList.remove("is-playing");
      if (video) resetLiveVideo(video);
      return;
    }

    if (!video) return;

    armedRef.current = true;
    armLiveVideo(video, videoSrcRef.current);

    const token = ++playTokenRef.current;
    playingRef.current = true;
    root?.classList.add("is-playing");
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.currentTime = 0;
      }
    } catch {
      /* ignore unset media */
    }
    const playPromise = video.play();
    playPromise?.catch((error: unknown) => {
      if (token !== playTokenRef.current) return;
      const name = error && typeof error === "object" && "name" in error ? String((error as { name?: string }).name) : "";
      if (name === "AbortError" || name === "NotAllowedError") {
        const retry = video.play();
        retry?.catch(() => {
          if (token !== playTokenRef.current) return;
          playingRef.current = false;
          root?.classList.remove("is-playing");
        });
        return;
      }
      playingRef.current = false;
      root?.classList.remove("is-playing");
    });
  };
  const syncPlaybackRef = useRef(syncPlayback);
  syncPlaybackRef.current = syncPlayback;

  const endPress = () => {
    const hadPress = pressRef.current || pressPointRef.current != null || pressTimerRef.current != null;
    clearPressTimer();
    pressPointRef.current = null;
    if (!hadPress) return;
    pressRef.current = false;
    syncPlaybackRef.current();
  };

  useEffect(() => {
    hoverRef.current = false;
    pressRef.current = false;
    armedRef.current = false;
    if (root && enabledRef.current && enableHoverRef.current && canHoverPlay() && root.matches(":hover")) {
      hoverRef.current = true;
    }
    syncPlaybackRef.current();
  }, [root, videoSrc]);

  useEffect(() => {
    if (!enabled) {
      hoverRef.current = false;
      pressRef.current = false;
      clearPressTimer();
      pressPointRef.current = null;
    } else if (root && enableHoverRef.current && canHoverPlay() && root.matches(":hover")) {
      hoverRef.current = true;
    }
    syncPlaybackRef.current();
  }, [enabled, playingProp, root]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) prepareLiveVideo(video);
  }, [root, videoRef]);

  useEffect(() => {
    if (!root) return;

    const onMouseEnter = () => {
      if (!enabledRef.current || !enableHoverRef.current || !canHoverPlay()) return;
      hoverRef.current = true;
      syncPlaybackRef.current();
    };

    const onMouseLeave = () => {
      if (!hoverRef.current) return;
      hoverRef.current = false;
      syncPlaybackRef.current();
    };

    const beginPress = (pointerId: number, x: number, y: number) => {
      if (!enabledRef.current || !enablePressRef.current) return;
      if (pressPointRef.current) return;

      pressPointRef.current = { id: pointerId, x, y, startedAt: performance.now() };
      unlockLiveVideo(videoRef.current, videoSrcRef.current);
      clearPressTimer();
      pressTimerRef.current = window.setTimeout(() => {
        pressTimerRef.current = null;
        if (!pressPointRef.current) return;
        pressRef.current = true;
        suppressClickRef.current = true;
        syncPlaybackRef.current();
      }, LIVE_PHOTO_LONG_PRESS_MS);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!enabledRef.current || !enablePressRef.current) return;
      if (event.pointerType !== "touch" && event.pointerType !== "pen" && canHoverPlay()) return;
      if (event.pointerType !== "touch" && event.button !== 0) return;
      beginPress(event.pointerId, event.clientX, event.clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      const point = pressPointRef.current;
      if (!point) return;
      if (performance.now() - point.startedAt < 80) {
        point.x = event.clientX;
        point.y = event.clientY;
        return;
      }
      const dx = event.clientX - point.x;
      const dy = event.clientY - point.y;
      if (Math.hypot(dx, dy) < LIVE_PHOTO_MOVE_CANCEL_PX) return;
      endPress();
    };

    const onPointerEnd = () => {
      endPress();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressClickRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
    };

    const onContextMenu = (event: Event) => {
      if (!enablePressRef.current) return;
      event.preventDefault();
    };

    const onTouchEnd = () => {
      endPress();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!enabledRef.current || !enablePressRef.current) return;
      if (event.touches.length !== 1) return;
      unlockLiveVideo(videoRef.current, videoSrcRef.current);
      const touch = event.touches[0];
      beginPress(touch.identifier, touch.clientX, touch.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      const point = pressPointRef.current;
      if (!point || event.touches.length === 0) return;
      const touch = event.touches[0];
      if (performance.now() - point.startedAt < 80) {
        point.x = touch.clientX;
        point.y = touch.clientY;
        return;
      }
      const dx = touch.clientX - point.x;
      const dy = touch.clientY - point.y;
      if (Math.hypot(dx, dy) < LIVE_PHOTO_MOVE_CANCEL_PX) return;
      endPress();
    };

    root.addEventListener("mouseenter", onMouseEnter);
    root.addEventListener("mouseleave", onMouseLeave);
    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointermove", onPointerMove);
    root.addEventListener("pointerup", onPointerEnd);
    root.addEventListener("pointercancel", onPointerEnd);
    root.addEventListener("lostpointercapture", onPointerEnd);
    root.addEventListener("touchstart", onTouchStart, { passive: true });
    root.addEventListener("touchmove", onTouchMove, { passive: true });
    root.addEventListener("click", onClickCapture, true);
    root.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("blur", onTouchEnd);

    return () => {
      clearPressTimer();
      root.removeEventListener("mouseenter", onMouseEnter);
      root.removeEventListener("mouseleave", onMouseLeave);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerEnd);
      root.removeEventListener("pointercancel", onPointerEnd);
      root.removeEventListener("lostpointercapture", onPointerEnd);
      root.removeEventListener("touchstart", onTouchStart);
      root.removeEventListener("touchmove", onTouchMove);
      root.removeEventListener("click", onClickCapture, true);
      root.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("blur", onTouchEnd);
    };
  }, [root, videoRef]);
}

function LivePhotoOverlays({
  videoRef,
  objectFit,
  badgeSize,
  badgeStyle,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  objectFit: "cover" | "contain";
  badgeSize: "sm" | "md";
  badgeStyle?: CSSProperties;
}) {
  return (
    <>
      <video
        ref={videoRef}
        className={`live-photo-video is-${objectFit}`}
        muted
        defaultMuted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        aria-hidden="true"
      />
      <span className="live-photo-badge-anchor" style={badgeStyle}>
        <LivePhotoBadge size={badgeSize} />
      </span>
    </>
  );
}

function containedBadgeStyle(
  container: HTMLElement | null,
  naturalWidth?: number,
  naturalHeight?: number,
): CSSProperties | undefined {
  if (!container || !naturalWidth || !naturalHeight) return undefined;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (!width || !height) return undefined;
  const scale = Math.min(width / naturalWidth, height / naturalHeight);
  const contentWidth = naturalWidth * scale;
  const contentHeight = naturalHeight * scale;
  return {
    top: (height - contentHeight) / 2,
    left: (width - contentWidth) / 2,
    width: contentWidth,
    height: contentHeight,
  };
}

interface LivePhotoProps {
  videoSrc: string;
  children: ReactNode;
  className?: string;
  badgeSize?: "sm" | "md";
  fill?: boolean;
  objectFit?: "cover" | "contain";
  enableHover?: boolean;
  enablePress?: boolean;
  enabled?: boolean;
  playing?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
}

export default function LivePhoto({
  videoSrc,
  children,
  className,
  badgeSize = "md",
  fill = false,
  objectFit = "cover",
  enableHover = true,
  enablePress = true,
  enabled = true,
  playing = false,
  naturalWidth,
  naturalHeight,
}: LivePhotoProps) {
  const [root, setRoot] = useState<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containBadge = objectFit === "contain";
  const [badgeStyle, setBadgeStyle] = useState<CSSProperties | undefined>();

  useLivePhotoPlayback({
    root,
    videoRef,
    videoSrc,
    enableHover,
    enablePress,
    enabled,
    playing,
  });

  useEffect(() => {
    if (!root || !containBadge) {
      setBadgeStyle(undefined);
      return;
    }

    const update = () => setBadgeStyle(containedBadgeStyle(root, naturalWidth, naturalHeight));
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(root);
    return () => observer.disconnect();
  }, [containBadge, naturalHeight, naturalWidth, root]);

  return (
    <span
      ref={setRoot}
      className={`live-photo${fill ? " live-photo-fill" : ""}${className ? ` ${className}` : ""}`}
      data-live-src={videoSrc}
    >
      {children}
      <LivePhotoOverlays
        videoRef={videoRef}
        objectFit={objectFit}
        badgeSize={badgeSize}
        badgeStyle={containBadge ? badgeStyle : undefined}
      />
    </span>
  );
}

export function AttachedLivePhoto({
  root,
  videoSrc,
}: {
  root: HTMLElement;
  videoSrc: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useLivePhotoPlayback({
    root,
    videoRef,
    videoSrc,
    enableHover: true,
    enablePress: true,
    enabled: true,
  });

  return createPortal(
    <LivePhotoOverlays videoRef={videoRef} objectFit="cover" badgeSize="md" />,
    root,
  );
}
