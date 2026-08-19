"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prepareLiveVideo(video: HTMLVideoElement) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
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

function useLivePhotoOnce({
  root,
  videoRef,
  videoSrc,
  enabled,
}: {
  root: HTMLElement | null;
  videoRef: RefObject<HTMLVideoElement>;
  videoSrc?: string;
  enabled: boolean;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (!root || !video || !videoSrc || !enabled || prefersReducedMotion()) {
      root?.classList.remove("is-playing");
      if (video) resetLiveVideo(video);
      return;
    }

    let cancelled = false;
    let playToken = 0;
    prepareLiveVideo(video);
    if (video.getAttribute("data-live-src") !== videoSrc || !video.getAttribute("src")) {
      video.src = videoSrc;
      video.setAttribute("data-live-src", videoSrc);
    }

    const hide = () => {
      root.classList.remove("is-playing");
    };

    const reveal = () => {
      if (!cancelled) root.classList.add("is-playing");
    };

    const tryPlay = () => {
      if (cancelled) return;
      const token = ++playToken;
      try {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          video.currentTime = 0;
        }
      } catch {
        /* ignore unset media */
      }
      video.play()?.then(reveal).catch((error: unknown) => {
        if (cancelled || token !== playToken) return;
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

    const onEnded = () => {
      hide();
      resetLiveVideo(video);
    };

    video.addEventListener("ended", onEnded);
    video.addEventListener("playing", reveal);
    tryPlay();

    return () => {
      cancelled = true;
      playToken += 1;
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("playing", reveal);
      hide();
      resetLiveVideo(video);
    };
  }, [enabled, root, videoRef, videoSrc]);
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
  children: ReactNode;
  className?: string;
  badgeSize?: "sm" | "md";
  fill?: boolean;
  objectFit?: "cover" | "contain";
  videoSrc?: string;
  playOnce?: boolean;
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
  naturalWidth,
  naturalHeight,
}: LivePhotoProps) {
  const [root, setRoot] = useState<HTMLSpanElement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containBadge = objectFit === "contain";
  const [badgeStyle, setBadgeStyle] = useState<CSSProperties | undefined>();
  const shouldPlay = Boolean(videoSrc && playOnce);

  useLivePhotoOnce({
    root,
    videoRef,
    videoSrc,
    enabled: shouldPlay,
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
      {shouldPlay && (
        <video
          ref={videoRef}
          className={`live-photo-video is-${objectFit}`}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          controls={false}
          aria-hidden="true"
        />
      )}
      <span className="live-photo-badge-anchor" style={containBadge ? badgeStyle : undefined}>
        <LivePhotoBadge size={badgeSize} />
      </span>
    </span>
  );
}
