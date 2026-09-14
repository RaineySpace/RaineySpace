"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLightboxGestures } from "@/app/components/useLightboxGestures";
import Sheet from "@/app/components/Sheet";
import LivePhoto from "@/app/components/LivePhoto";
import { animateLightboxOpening, captureOpeningImage, type OpeningPreview } from "./lightbox-opening";
import { useCurrentImageLoading, useImagePreloading, usePreloadedImage, useOriginalDownload } from "./useImagePreloading";
import { formatImageBytes } from "@/lib/image-downloads";

export interface PreviewImage {
  id: string;
  src: string;
  displaySrc?: string;
  thumbnailSrc?: string;
  srcSet?: string;
  alt: string;
  capturedAt?: string;
  date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focalLength?: string;
  focalLength35mm?: string;
  sourceHref?: string;
  sourceLabel?: string;
  sourceTitle?: string;
  liveVideoSrc?: string;
}

interface ImageLightboxProps {
  images: PreviewImage[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  returnFocus?: HTMLElement | null | (() => HTMLElement | null);
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function Icon({ children, className = "h-3.5 w-3.5" }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function FocalIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" />
    </Icon>
  );
}

function ApertureIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v6M12 14v6M4.8 8.2l5.2 3M14 12.8l5.2 3M4.8 15.8 10 12.8M14 11.2l5.2-3" />
    </Icon>
  );
}

function ShutterIcon() {
  return (
    <Icon>
      <circle cx="12" cy="13" r="7" />
      <path d="M12 13V9M9 3h6" />
    </Icon>
  );
}

function IsoIcon() {
  return (
    <Icon>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M8 15V9h2.2a2 2 0 0 1 0 6H8Zm6 0V9h2" />
    </Icon>
  );
}

function PinIcon() {
  return (
    <Icon>
      <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.25" />
    </Icon>
  );
}

function wrapIndex(index: number, length: number) {
  return (index + length) % length;
}

function hasGps(image: PreviewImage): image is PreviewImage & { latitude: number; longitude: number } {
  return Number.isFinite(image.latitude) && Number.isFinite(image.longitude);
}

function mapUrl(latitude: number, longitude: number): string {
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
}

function displayDate(image: PreviewImage): string | undefined {
  const capturedDate = image.capturedAt?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  return capturedDate || image.date || undefined;
}

function MetaColumn({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="image-lightbox-meta-item">
      <span className="image-lightbox-meta-label">{label}</span>
      <div className="image-lightbox-meta-value">{children}</div>
    </div>
  );
}

function Param({ icon, value }: { icon: ReactNode; value: string }) {
  return (
    <span className="image-lightbox-param">
      {icon}
      {value}
    </span>
  );
}

function SheetCard({
  label,
  value,
  detail,
  icon,
  wide,
  children,
}: {
  label: string;
  value?: string;
  detail?: string;
  icon?: ReactNode;
  wide?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={`image-lightbox-sheet-card${wide ? " is-wide" : ""}`}>
      <span className="image-lightbox-sheet-card-label">{label}</span>
      {children || <span className="image-lightbox-sheet-card-value">{value}</span>}
      {detail && <span className="image-lightbox-sheet-card-detail">{detail}</span>}
      {icon && <span className="image-lightbox-sheet-card-icon">{icon}</span>}
    </div>
  );
}

type SlideRole = "previous" | "current" | "next";

function useLightboxImage(src: string | null) {
  const ref = useRef<HTMLImageElement>(null);
  const [result, setResult] = useState<{
    src: string;
    ready: boolean;
    cached: boolean;
    size?: { width: number; height: number };
  } | null>(null);

  useLayoutEffect(() => {
    setResult(null);
    const img = ref.current;
    if (!img || !src) return;
    let cancelled = false;
    let decoding = false;
    const cached = img.complete && img.naturalWidth > 0;
    const isCurrent = () => !cancelled && img.getAttribute("src") === src;
    const fail = () => {
      if (isCurrent()) setResult({ src, ready: false, cached: false });
    };
    const load = async () => {
      if (decoding || !isCurrent()) return;
      decoding = true;
      try {
        await img.decode();
        if (isCurrent()) {
          setResult({
            src, ready: true, cached,
            size: { width: img.naturalWidth, height: img.naturalHeight },
          });
        }
      } catch {
        fail();
      }
    };
    img.addEventListener("load", load);
    img.addEventListener("error", fail);
    if (img.complete) {
      if (img.naturalWidth > 0) void load();
      else fail();
    }
    return () => {
      cancelled = true;
      img.removeEventListener("load", load);
      img.removeEventListener("error", fail);
    };
  }, [src]);

  const current = result?.src === src ? result : null;
  return {
    ref,
    ready: current?.ready === true,
    error: current?.ready === false,
    cached: current?.cached,
    size: current?.size,
  };
}

function LightboxSlide({
  image,
  isActive,
  isOpening,
  openingPreview,
}: {
  image: PreviewImage;
  isActive: boolean;
  isOpening: boolean;
  openingPreview?: OpeningPreview;
}) {
  const previewSrc = image.displaySrc && image.displaySrc !== image.src ? image.displaySrc : null;
  const preloaded = usePreloadedImage(image.src);
  const download = useOriginalDownload(image.src, isActive || preloaded, isActive);
  const fullSrc = download.imageSrc;
  const full = useLightboxImage(fullSrc);
  const failed = full.error || download.status === "error";
  useCurrentImageLoading(image.src, isActive, full.ready, failed);
  const preview = useLightboxImage(previewSrc);
  const fallback = useLightboxImage(openingPreview?.src || null);
  const hasPreview = preview.ready || fallback.ready;
  const naturalSize = full.size || preview.size || fallback.size;
  const showSpinner = !full.ready && !failed && !hasPreview;
  const percent = download.total ? Math.min(100, Math.floor(download.loaded / download.total * 100)) : undefined;

  const media = (
    <>
      {showSpinner && <div className="image-lightbox-spinner" aria-hidden="true" />}
      {isActive && !isOpening && !full.ready && (hasPreview || !failed) && (
        <span className="image-lightbox-loading">
          {!failed && <span className="image-lightbox-loading-ring" aria-hidden="true" />}
          <span className="image-lightbox-loading-copy">
            <span className="image-lightbox-loading-heading">
              <span role="status">{failed ? "原图加载失败" : download.status === "ready" ? "解码中" : "加载中"}</span>
              {!failed && percent !== undefined && <span className="image-lightbox-loading-percent" role="progressbar" aria-label="原图下载进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>{percent}%</span>}
            </span>
            {!failed && (download.total || download.loaded > 0) && (
              <span className="image-lightbox-loading-bytes">{formatImageBytes(download.loaded, download.total)}{download.total ? ` / ${formatImageBytes(download.total)}` : " 已下载"}</span>
            )}
          </span>
        </span>
      )}
      {failed && !hasPreview && <p className="image-lightbox-error" role="status">图片加载失败</p>}
      {openingPreview && (
        <img
          ref={fallback.ref}
          src={openingPreview.src}
          alt=""
          draggable={false}
          className={`is-fallback ${fallback.ready ? "is-ready" : ""}`}
        />
      )}
      {previewSrc && (
        <img
          ref={preview.ref}
          src={previewSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={`is-preview ${preview.ready ? "is-ready" : ""}`}
        />
      )}
      <img
        ref={full.ref}
        src={fullSrc || undefined}
        alt={isActive ? image.alt : ""}
        aria-busy={isActive && !full.ready && !failed ? true : undefined}
        draggable={false}
        decoding="async"
        fetchPriority={isActive ? "high" : "low"}
        className={`is-full ${full.ready && !isOpening ? "is-ready" : ""}${full.cached || download.cached ? " is-cached" : ""}`}
      />
    </>
  );

  return (
    <div className="image-lightbox-slide" aria-hidden={isActive ? undefined : true}>
      {image.liveVideoSrc ? (
        <LivePhoto
          videoSrc={image.liveVideoSrc}
          fill
          objectFit="contain"
          playOnce={isActive && !isOpening}
          naturalWidth={naturalSize?.width}
          naturalHeight={naturalSize?.height}
        >
          {media}
        </LivePhoto>
      ) : (
        media
      )}
    </div>
  );
}

export default function ImageLightbox({
  images,
  activeIndex,
  onActiveIndexChange,
  onClose,
  returnFocus,
}: ImageLightboxProps) {
  useImagePreloading(images, activeIndex);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Defer media on the first render of an opening, before its layout effect.
  const [isOpening, setIsOpening] = useState(true);
  const [openingPreview, setOpeningPreview] = useState<(OpeningPreview & { originalSrc: string }) | null>(null);
  const openingCleanupRef = useRef<(() => void) | null>(null);
  const openingInputsRef = useRef({ returnFocus, activeSrc: "" });
  const previousActiveSrcRef = useRef<string | null>(null);
  useEffect(() => { setPortalTarget(document.body); }, []);
  const isOpen = activeIndex !== null;
  const activeImage = activeIndex === null ? null : images[activeIndex];
  openingInputsRef.current = { returnFocus, activeSrc: activeImage?.src || "" };
  const hasMultipleImages = images.length > 1;
  const hasOverflowingThumbnails = images.length > 5;
  const previousImage =
    hasMultipleImages && activeIndex !== null ? images[wrapIndex(activeIndex - 1, images.length)] : null;
  const nextImage =
    hasMultipleImages && activeIndex !== null ? images[wrapIndex(activeIndex + 1, images.length)] : null;
  const duplicateAdjacent = Boolean(previousImage && nextImage && previousImage.id === nextImage.id);
  const slides: Array<{ image: PreviewImage; role: SlideRole }> = [];
  if (previousImage) slides.push({ image: previousImage, role: "previous" });
  if (activeImage) slides.push({ image: activeImage, role: "current" });
  if (nextImage) slides.push({ image: nextImage, role: "next" });
  const dateText = activeImage ? displayDate(activeImage) : undefined;
  const focalText = activeImage ? activeImage.focalLength35mm || activeImage.focalLength : undefined;
  const params: Array<{ key: string; icon: ReactNode; value: string }> = [];
  if (focalText) params.push({ key: "focal", icon: <FocalIcon />, value: focalText });
  if (activeImage?.aperture) params.push({ key: "aperture", icon: <ApertureIcon />, value: activeImage.aperture });
  if (activeImage?.shutter) params.push({ key: "shutter", icon: <ShutterIcon />, value: activeImage.shutter });
  if (activeImage?.iso) params.push({ key: "iso", icon: <IsoIcon />, value: `ISO ${activeImage.iso}` });
  const locationText = activeImage?.location || (activeImage && hasGps(activeImage) ? "查看地图" : undefined);
  const capturedTime = activeImage?.capturedAt?.match(/\d{2}:\d{2}$/)?.[0];
  const titleText = activeImage?.alt?.trim() || undefined;
  const hasSummary = Boolean(locationText || dateText || activeImage?.camera);
  const hasExtra = Boolean(params.length > 0 || activeImage?.lens);
  const showMore = Boolean(titleText || hasExtra || hasSummary);
  const hasDesktopMeta = hasSummary || hasExtra;

  const finishOpening = useCallback(() => {
    openingCleanupRef.current?.();
    openingCleanupRef.current = null;
    setIsOpening(false);
  }, []);

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const target = typeof returnFocus === "function" ? returnFocus() : returnFocus;
      target?.focus();
    });
  }, [returnFocus]);

  const handleClosed = useCallback(() => {
    finishOpening();
    onClose();
    restoreFocus();
  }, [finishOpening, onClose, restoreFocus]);

  const closeLightbox = useCallback(() => {
    finishOpening();
    setSheetOpen(false);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      handleClosed();
    }
  }, [finishOpening, handleClosed]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const showPrevious = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    finishOpening();
    onActiveIndexChange(wrapIndex(activeIndex - 1, images.length));
  }, [activeIndex, finishOpening, images.length, onActiveIndexChange]);

  const showNext = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    finishOpening();
    onActiveIndexChange(wrapIndex(activeIndex + 1, images.length));
  }, [activeIndex, finishOpening, images.length, onActiveIndexChange]);

  const gestureHandlers = useLightboxGestures({
    isOpen,
    activeIndex,
    hasMultipleImages,
    stageRef,
    trackRef,
    shellRef,
    onPrevious: showPrevious,
    onNext: showNext,
    onClose: closeLightbox,
  });

  useLayoutEffect(() => {
    if (!portalTarget) return;
    const dialog = dialogRef.current;
    if (!isOpen) {
      if (dialog?.open) dialog.close();
      setOpeningPreview(null);
      setIsOpening(true);
      return;
    }

    const { returnFocus: sourceTarget, activeSrc } = openingInputsRef.current;
    const source = captureOpeningImage(typeof sourceTarget === "function" ? sourceTarget() : sourceTarget);
    setOpeningPreview(source ? { src: source.src, width: source.width, height: source.height, originalSrc: activeSrc } : null);
    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let cancelled = false;
    if (dialog && stageRef.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setIsOpening(true);
      openingCleanupRef.current = animateLightboxOpening(dialog, stageRef.current, source, () => {
        if (!cancelled) finishOpening();
      });
    } else {
      setIsOpening(false);
    }
    window.addEventListener("resize", finishOpening);
    window.visualViewport?.addEventListener("resize", finishOpening);

    return () => {
      cancelled = true;
      openingCleanupRef.current?.();
      openingCleanupRef.current = null;
      window.removeEventListener("resize", finishOpening);
      window.visualViewport?.removeEventListener("resize", finishOpening);
      document.body.style.overflow = previousOverflow;
    };
  }, [finishOpening, isOpen, portalTarget]);

  useLayoutEffect(() => {
    const src = activeImage?.src || null;
    if (src && previousActiveSrcRef.current && src !== previousActiveSrcRef.current) finishOpening();
    previousActiveSrcRef.current = src;
  }, [activeImage?.src, finishOpening]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (sheetOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeLightbox();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeLightbox, isOpen, sheetOpen, showNext, showPrevious]);

  useEffect(() => {
    if (activeIndex === null || !hasOverflowingThumbnails) return;
    const track = thumbnailTrackRef.current;
    const thumbnail = thumbnailRefs.current[activeIndex];
    if (!track || !thumbnail) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({
      left: thumbnail.offsetLeft - (track.clientWidth - thumbnail.clientWidth) / 2,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [activeIndex, hasOverflowingThumbnails]);

  useEffect(() => {
    setSheetOpen(false);
  }, [activeIndex]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    const handleChange = () => {
      if (media.matches) setSheetOpen(false);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  // Keep article typography and header layout from affecting the overlay images.
  if (!portalTarget) return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label="图片预览"
      className="image-lightbox max-h-none max-w-none bg-transparent p-0 text-white"
      onClose={handleClosed}
      onCancel={(event) => {
        event.preventDefault();
        if (sheetOpen) return;
        closeLightbox();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeLightbox();
      }}
    >
      {activeImage && activeIndex !== null && (
        <div ref={shellRef} className="image-lightbox-shell">
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="关闭"
            className="image-lightbox-close flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <CloseIcon />
          </button>

          <p className="image-lightbox-title-row">
            <span className="image-lightbox-title">{activeImage.alt}</span>
            {activeImage.sourceHref && activeImage.sourceLabel && (
              <>
                <span className="image-lightbox-title-sep" aria-hidden="true">
                  ·
                </span>
                <a href={activeImage.sourceHref} className="image-lightbox-album">
                  {activeImage.sourceLabel}
                </a>
              </>
            )}
          </p>

          <div
            ref={stageRef}
            className="image-lightbox-stage"
            onPointerDown={(event) => {
              finishOpening();
              gestureHandlers.onPointerDown(event);
            }}
            onPointerMove={gestureHandlers.onPointerMove}
            onPointerUp={gestureHandlers.onPointerUp}
            onPointerCancel={gestureHandlers.onPointerCancel}
          >
            <div ref={trackRef} className="image-lightbox-track">
              {slides.map(({ image, role }) => (
                <LightboxSlide
                  key={duplicateAdjacent && role !== "current" ? `${image.id}-${role}` : image.id}
                  image={image}
                  isActive={role === "current"}
                  isOpening={isOpening && role === "current"}
                  openingPreview={openingPreview?.originalSrc === image.src ? openingPreview : undefined}
                />
              ))}
            </div>

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="上一张"
                  className="image-lightbox-nav absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label="下一张"
                  className="image-lightbox-nav absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            )}
          </div>

          <div className="image-lightbox-caption">
            {showMore && (
              <div className="image-lightbox-meta image-lightbox-meta-summary">
                {locationText && (
                  <MetaColumn label="地点">
                    {hasGps(activeImage) ? (
                      <a
                        href={mapUrl(activeImage.latitude, activeImage.longitude)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="image-lightbox-meta-link"
                      >
                        <PinIcon />
                        {locationText}
                      </a>
                    ) : (
                      <span className="image-lightbox-param">
                        <PinIcon />
                        {locationText}
                      </span>
                    )}
                  </MetaColumn>
                )}
                {dateText && <MetaColumn label="日期">{dateText}</MetaColumn>}
                {activeImage.camera && <MetaColumn label="相机">{activeImage.camera}</MetaColumn>}
                {showMore && (
                  <button
                    ref={moreButtonRef}
                    type="button"
                    className="image-lightbox-more"
                    aria-haspopup="dialog"
                    aria-expanded={sheetOpen}
                    onClick={() => setSheetOpen(true)}
                  >
                    更多
                  </button>
                )}
              </div>
            )}
            {hasDesktopMeta && (
              <div className="image-lightbox-meta image-lightbox-meta-full">
                {params.length > 0 && (
                  <MetaColumn label="参数">
                    {params.map((param) => (
                      <Param key={param.key} icon={param.icon} value={param.value} />
                    ))}
                  </MetaColumn>
                )}
                {locationText && (
                  <MetaColumn label="地点">
                    {hasGps(activeImage) ? (
                      <a
                        href={mapUrl(activeImage.latitude, activeImage.longitude)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="image-lightbox-meta-link"
                      >
                        <PinIcon />
                        {locationText}
                      </a>
                    ) : (
                      <span className="image-lightbox-param">
                        <PinIcon />
                        {locationText}
                      </span>
                    )}
                  </MetaColumn>
                )}
                {dateText && <MetaColumn label="日期">{dateText}</MetaColumn>}
                {activeImage.camera && <MetaColumn label="相机">{activeImage.camera}</MetaColumn>}
                {activeImage.lens && <MetaColumn label="镜头">{activeImage.lens}</MetaColumn>}
              </div>
            )}
          </div>

          {hasMultipleImages && (
            <div className="image-lightbox-thumbnails">
              <p className="image-lightbox-count">
                {activeIndex + 1} / {images.length}
              </p>
              <div
                ref={thumbnailTrackRef}
                className={`image-lightbox-thumbnail-track ${hasOverflowingThumbnails ? "justify-start" : "justify-center"}`}
                aria-label="图片缩略图"
              >
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    ref={(element) => {
                      thumbnailRefs.current[index] = element;
                    }}
                    type="button"
                    onClick={() => {
                      finishOpening();
                      onActiveIndexChange(index);
                    }}
                    aria-label={`查看第 ${index + 1} 张：${image.alt}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`image-lightbox-thumbnail ${index === activeIndex ? "is-active" : ""}`}
                  >
                    <img src={image.thumbnailSrc || image.displaySrc || image.src} srcSet={image.srcSet} sizes="64px" alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
              {hasOverflowingThumbnails && (
                <>
                  <span className="image-lightbox-thumbnail-fade is-left" />
                  <span className="image-lightbox-thumbnail-fade is-right" />
                </>
              )}
            </div>
          )}
        </div>
      )}
      {activeImage && (
        <Sheet
          open={sheetOpen}
          onClose={closeSheet}
          label={titleText || "图片详情"}
          closeLabel="关闭详情"
          className="image-lightbox-sheet"
          returnFocusRef={moreButtonRef}
          renderHeader={(close) => (
            <div className="image-lightbox-sheet-header">
              <span className="image-lightbox-sheet-title">{titleText || "图片详情"}</span>
              <button
                type="button"
                className="image-lightbox-sheet-close"
                aria-label="关闭详情"
                onClick={close}
              >
                <CloseIcon />
              </button>
            </div>
          )}
        >
          <div className="image-lightbox-sheet-grid">
            {locationText && (
              <SheetCard label="地点">
                {hasGps(activeImage) ? (
                  <a
                    href={mapUrl(activeImage.latitude, activeImage.longitude)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="image-lightbox-sheet-card-value image-lightbox-meta-link"
                  >
                    {locationText}
                  </a>
                ) : (
                  <span className="image-lightbox-sheet-card-value">{locationText}</span>
                )}
              </SheetCard>
            )}
            {dateText && (
              <SheetCard label="拍摄于" value={dateText} detail={capturedTime} />
            )}
            {activeImage.camera && <SheetCard label="相机" value={activeImage.camera} />}
            {activeImage.lens && <SheetCard label="镜头" value={activeImage.lens} />}
            {activeImage.aperture && (
              <SheetCard label="光圈" value={activeImage.aperture} icon={<ApertureIcon />} />
            )}
            {activeImage.shutter && (
              <SheetCard label="快门" value={activeImage.shutter} icon={<ShutterIcon />} />
            )}
            {focalText && <SheetCard label="焦距" value={focalText} icon={<FocalIcon />} />}
            {activeImage.iso && (
              <SheetCard label="感光度" value={activeImage.iso} icon={<IsoIcon />} />
            )}
          </div>
        </Sheet>
      )}
    </dialog>,
    portalTarget,
  );
}
