"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLightboxGestures } from "@/app/components/useLightboxGestures";
import { useSheetGestures } from "@/app/components/useSheetGestures";
import LivePhoto from "@/app/components/LivePhoto";

export interface PreviewImage {
  id: string;
  src: string;
  displaySrc?: string;
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

function LightboxSlide({
  image,
  isActive,
  onActiveSettled,
}: {
  image: PreviewImage;
  isActive: boolean;
  onActiveSettled?: (src: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const previewRef = useRef<HTMLImageElement>(null);
  const previewSrc = image.displaySrc && image.displaySrc !== image.src ? image.displaySrc : null;
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | undefined>();
  const isReady = loadedSrc === image.src;
  const isError = failedSrc === image.src;
  const showSpinner = !isReady && !isError && !previewReady;

  const markReady = (img: HTMLImageElement) => {
    setLoadedSrc(image.src);
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    }
  };

  useLayoutEffect(() => {
    setNaturalSize(undefined);
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoadedSrc(image.src);
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      return;
    }
    if (img.complete) {
      setFailedSrc(image.src);
    }
  }, [image.src]);

  useLayoutEffect(() => {
    setPreviewReady(false);
    const img = previewRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) setPreviewReady(true);
  }, [previewSrc]);

  useLayoutEffect(() => {
    if (isActive && (isReady || isError)) onActiveSettled?.(image.src);
  }, [image.src, isActive, isError, isReady, onActiveSettled]);

  const media = (
    <>
      {showSpinner && <div className="image-lightbox-spinner" aria-hidden="true" />}
      {isError && <p className="image-lightbox-error">图片加载失败</p>}
      {previewSrc && (
        <img
          ref={previewRef}
          src={previewSrc}
          alt=""
          draggable={false}
          decoding="async"
          className={`is-preview ${previewReady ? "is-ready" : ""}`}
          onLoad={() => setPreviewReady(true)}
        />
      )}
      <img
        ref={imgRef}
        src={image.src}
        alt={isActive ? image.alt : ""}
        draggable={false}
        decoding="async"
        fetchPriority={isActive ? "high" : "low"}
        className={`is-full ${isReady ? "is-ready" : ""}`}
        onLoad={(event) => markReady(event.currentTarget)}
        onError={() => setFailedSrc(image.src)}
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
          playOnce={isActive}
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetBackdropRef = useRef<HTMLButtonElement>(null);
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [settledSrc, setSettledSrc] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isOpen = activeIndex !== null;
  const activeImage = activeIndex === null ? null : images[activeIndex];
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
  const isCurrentBusy = Boolean(activeImage && settledSrc !== activeImage.src);
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

  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => {
      const target = typeof returnFocus === "function" ? returnFocus() : returnFocus;
      target?.focus();
    });
  }, [returnFocus]);

  const handleClosed = useCallback(() => {
    onClose();
    restoreFocus();
  }, [onClose, restoreFocus]);

  const closeLightbox = useCallback(() => {
    setSheetOpen(false);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      handleClosed();
    }
  }, [handleClosed]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const showPrevious = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    onActiveIndexChange(wrapIndex(activeIndex - 1, images.length));
  }, [activeIndex, images.length, onActiveIndexChange]);

  const showNext = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    onActiveIndexChange(wrapIndex(activeIndex + 1, images.length));
  }, [activeIndex, images.length, onActiveIndexChange]);

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

  const sheetGestureHandlers = useSheetGestures({
    isOpen: sheetOpen,
    sheetRef,
    backdropRef: sheetBackdropRef,
    onClose: closeSheet,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen) {
      if (dialog?.open) dialog.close();
      return;
    }

    if (dialog && !dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (sheetOpen) {
          closeSheet();
          return;
        }
        closeLightbox();
        return;
      }
      if (sheetOpen) return;
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
  }, [closeLightbox, closeSheet, isOpen, sheetOpen, showNext, showPrevious]);

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

  return (
    <dialog
      ref={dialogRef}
      aria-label="图片预览"
      className="image-lightbox max-h-none max-w-none bg-transparent p-0 text-white"
      onClose={handleClosed}
      onCancel={(event) => {
        event.preventDefault();
        if (sheetOpen) {
          closeSheet();
          return;
        }
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
            aria-busy={isCurrentBusy || undefined}
            onPointerDown={gestureHandlers.onPointerDown}
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
                  onActiveSettled={role === "current" ? setSettledSrc : undefined}
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
                    type="button"
                    className="image-lightbox-more"
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
                    onClick={() => onActiveIndexChange(index)}
                    aria-label={`查看第 ${index + 1} 张：${image.alt}`}
                    aria-current={index === activeIndex ? "true" : undefined}
                    className={`image-lightbox-thumbnail ${index === activeIndex ? "is-active" : ""}`}
                  >
                    <img src={image.displaySrc || image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
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
      {activeImage && sheetOpen && (
        <div className="image-lightbox-sheet-layer">
          <button
            ref={sheetBackdropRef}
            type="button"
            className="image-lightbox-sheet-backdrop"
            aria-label="关闭详情"
            onClick={closeSheet}
          />
          <div
            ref={sheetRef}
            className="image-lightbox-sheet"
            role="dialog"
            aria-label={titleText || "图片详情"}
            onPointerDown={sheetGestureHandlers.onPointerDown}
            onPointerMove={sheetGestureHandlers.onPointerMove}
            onPointerUp={sheetGestureHandlers.onPointerUp}
            onPointerCancel={sheetGestureHandlers.onPointerCancel}
          >
            <div className="image-lightbox-sheet-grab" data-sheet-handle>
              <span className="image-lightbox-sheet-handle" aria-hidden="true" />
              <div className="image-lightbox-sheet-header">
                <span className="image-lightbox-sheet-title">{titleText || "图片详情"}</span>
                <button
                  type="button"
                  className="image-lightbox-sheet-close"
                  aria-label="关闭详情"
                  onClick={closeSheet}
                >
                  <CloseIcon />
                </button>
              </div>
            </div>
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
          </div>
        </div>
      )}
    </dialog>
  );
}
