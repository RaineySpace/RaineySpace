"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLightboxGestures } from "@/app/components/useLightboxGestures";

export interface PreviewImage {
  id: string;
  src: string;
  alt: string;
  metadata?: string;
  sourceHref?: string;
  sourceLabel?: string;
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

function wrapIndex(index: number, length: number) {
  return (index + length) % length;
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
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const isReady = loadedSrc === image.src;
  const isError = failedSrc === image.src;

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.complete && img.naturalWidth > 0) {
      setLoadedSrc(image.src);
      return;
    }
    if (img.complete) {
      setFailedSrc(image.src);
    }
  }, [image.src]);

  useLayoutEffect(() => {
    if (isActive && (isReady || isError)) onActiveSettled?.(image.src);
  }, [image.src, isActive, isError, isReady, onActiveSettled]);

  return (
    <div className="image-lightbox-slide" aria-hidden={isActive ? undefined : true}>
      {!isReady && !isError && <div className="image-lightbox-spinner" aria-hidden="true" />}
      {isError && <p className="image-lightbox-error">图片加载失败</p>}
      <img
        ref={imgRef}
        src={image.src}
        alt={isActive ? image.alt : ""}
        draggable={false}
        decoding="async"
        fetchPriority={isActive ? "high" : "low"}
        className={isReady ? "is-ready" : undefined}
        onLoad={() => setLoadedSrc(image.src)}
        onError={() => setFailedSrc(image.src)}
      />
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
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [settledSrc, setSettledSrc] = useState<string | null>(null);
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
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    } else {
      handleClosed();
    }
  }, [handleClosed]);

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

  useEffect(() => {
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
  }, [closeLightbox, isOpen, showNext, showPrevious]);

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

  return (
    <dialog
      ref={dialogRef}
      aria-label="图片预览"
      className="image-lightbox m-auto max-h-none max-w-none bg-transparent p-0 text-white"
      onClose={handleClosed}
      onCancel={(event) => {
        event.preventDefault();
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
            className="image-lightbox-close rounded-md bg-black/60 px-3 py-2 text-sm text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            关闭
          </button>

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

          <div className="min-h-[2.5rem] max-w-full text-center">
            {hasMultipleImages && (
              <p className="text-xs text-gray-400">
                {activeIndex + 1} / {images.length}
              </p>
            )}
            <p className="line-clamp-2 text-sm font-medium">{activeImage.alt}</p>
            {activeImage.metadata && <p className="mt-1 text-xs text-gray-300">{activeImage.metadata}</p>}
            {activeImage.sourceHref && activeImage.sourceLabel && (
              <a
                href={activeImage.sourceHref}
                className="mt-1 inline-block text-xs text-gray-300 underline decoration-gray-500 underline-offset-4 hover:text-white"
              >
                {activeImage.sourceLabel}
              </a>
            )}
          </div>

          <div className="image-lightbox-thumbnails">
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
                  className={`image-lightbox-thumbnail ${
                    index === activeIndex
                      ? "border-white opacity-100"
                      : "border-transparent opacity-55 hover:opacity-90"
                  }`}
                >
                  <img src={image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
            {hasOverflowingThumbnails && (
              <>
                <span className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black via-black/80 to-transparent" />
                <span className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black via-black/80 to-transparent" />
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
