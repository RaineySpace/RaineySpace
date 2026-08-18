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

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canHoverPlay() {
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches && !prefersReducedMotion();
}

function useLivePhotoMedia() {
  const [media, setMedia] = useState<{ hover: boolean; reduced: boolean } | null>(null);

  useEffect(() => {
    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMedia({ hover: hover.matches, reduced: reduced.matches });
    update();
    hover.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      hover.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);

  return media;
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
  hoverLoop,
  playOnce,
}: {
  root: HTMLElement | null;
  videoRef: RefObject<HTMLVideoElement>;
  videoSrc?: string;
  hoverLoop: boolean;
  playOnce: boolean;
}) {
  const hoverRef = useRef(false);
  const finishedOnceRef = useRef(false);
  const playTokenRef = useRef(0);
  const hoverLoopRef = useRef(hoverLoop);
  const playOnceRef = useRef(playOnce);
  const videoSrcRef = useRef(videoSrc);

  hoverLoopRef.current = hoverLoop;
  playOnceRef.current = playOnce;
  videoSrcRef.current = videoSrc;

  const syncPlayback = () => {
    const video = videoRef.current;
    const src = videoSrcRef.current;
    const looping = Boolean(src && hoverLoopRef.current && hoverRef.current && canHoverPlay());
    const once = Boolean(
      src &&
        playOnceRef.current &&
        !finishedOnceRef.current &&
        !canHoverPlay() &&
        !prefersReducedMotion(),
    );
    const shouldPlay = looping || once;

    if (!shouldPlay) {
      playTokenRef.current += 1;
      root?.classList.remove("is-playing");
      if (video) {
        video.loop = false;
        resetLiveVideo(video);
      }
      return;
    }
    if (!video || !src) return;

    const token = ++playTokenRef.current;
    armLiveVideo(video, src);
    video.loop = looping;
    try {
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        video.currentTime = 0;
      }
    } catch {
      /* ignore unset media */
    }

    const reveal = () => {
      if (token !== playTokenRef.current) return;
      root?.classList.add("is-playing");
    };

    const hide = () => {
      if (token !== playTokenRef.current) return;
      root?.classList.remove("is-playing");
    };

    const playPromise = video.play();
    playPromise
      ?.then(reveal)
      .catch((error: unknown) => {
        if (token !== playTokenRef.current) return;
        const name =
          error && typeof error === "object" && "name" in error
            ? String((error as { name?: string }).name)
            : "";
        if (name === "AbortError" || name === "NotAllowedError") {
          video.play()?.then(reveal).catch(hide);
          return;
        }
        hide();
      });
  };
  const syncPlaybackRef = useRef(syncPlayback);
  syncPlaybackRef.current = syncPlayback;

  useEffect(() => {
    finishedOnceRef.current = false;
    hoverRef.current = false;
    if (root && hoverLoop && canHoverPlay() && root.matches(":hover")) {
      hoverRef.current = true;
    }
    syncPlaybackRef.current();
  }, [hoverLoop, playOnce, root, videoSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playOnce) return;

    const onEnded = () => {
      finishedOnceRef.current = true;
      root?.classList.remove("is-playing");
      resetLiveVideo(video);
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [playOnce, root, videoRef, videoSrc]);

  useEffect(() => {
    if (!root) return;

    const onMouseEnter = () => {
      if (!hoverLoopRef.current || !canHoverPlay()) return;
      hoverRef.current = true;
      syncPlaybackRef.current();
    };
    const onMouseLeave = () => {
      if (!hoverRef.current) return;
      hoverRef.current = false;
      syncPlaybackRef.current();
    };

    root.addEventListener("mouseenter", onMouseEnter);
    root.addEventListener("mouseleave", onMouseLeave);
    return () => {
      root.removeEventListener("mouseenter", onMouseEnter);
      root.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [root]);
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

function LivePhotoVideo({
  videoRef,
  objectFit,
  loop,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  objectFit: "cover" | "contain";
  loop: boolean;
}) {
  return (
    <video
      ref={videoRef}
      className={`live-photo-video is-${objectFit}`}
      muted
      loop={loop}
      playsInline
      preload="auto"
      disablePictureInPicture
      controls={false}
      aria-hidden="true"
    />
  );
}

interface LivePhotoProps {
  children: ReactNode;
  className?: string;
  badgeSize?: "sm" | "md";
  fill?: boolean;
  objectFit?: "cover" | "contain";
  videoSrc?: string;
  playOnce?: boolean;
  hoverLoop?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
}

export default function LivePhoto({
  children,
  className,
  badgeSize = "md",
  fill = false,
  objectFit = "cover",
  videoSrc,
  playOnce = false,
  hoverLoop = true,
  naturalWidth,
  naturalHeight,
}: LivePhotoProps) {
  const [root, setRoot] = useState<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containBadge = objectFit === "contain";
  const [badgeStyle, setBadgeStyle] = useState<CSSProperties | undefined>();
  const media = useLivePhotoMedia();
  const allowHover = Boolean(videoSrc && hoverLoop && media?.hover && !media.reduced);
  const allowOnce = Boolean(videoSrc && playOnce && media && !media.hover && !media.reduced);
  const mountVideo = allowHover || allowOnce;

  useLivePhotoPlayback({
    root,
    videoRef,
    videoSrc,
    hoverLoop: allowHover,
    playOnce: allowOnce,
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
      {mountVideo && <LivePhotoVideo videoRef={videoRef} objectFit={objectFit} loop={allowHover} />}
      <span className="live-photo-badge-anchor" style={containBadge ? badgeStyle : undefined}>
        <LivePhotoBadge size={badgeSize} />
      </span>
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
  const media = useLivePhotoMedia();
  const allowHover = Boolean(media?.hover && !media.reduced);

  useLivePhotoPlayback({
    root,
    videoRef,
    videoSrc,
    hoverLoop: allowHover,
    playOnce: false,
  });

  if (!allowHover) return null;

  return createPortal(<LivePhotoVideo videoRef={videoRef} objectFit="cover" loop />, root);
}
