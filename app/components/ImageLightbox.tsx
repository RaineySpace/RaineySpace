"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef } from "react";

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

export default function ImageLightbox({
  images,
  activeIndex,
  onActiveIndexChange,
  onClose,
  returnFocus,
}: ImageLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const thumbnailTrackRef = useRef<HTMLDivElement>(null);
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const isOpen = activeIndex !== null;
  const activeImage = activeIndex === null ? null : images[activeIndex];
  const hasMultipleImages = images.length > 1;
  const hasOverflowingThumbnails = images.length > 5;

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
    onActiveIndexChange((activeIndex - 1 + images.length) % images.length);
  }, [activeIndex, images.length, onActiveIndexChange]);

  const showNext = useCallback(() => {
    if (activeIndex === null || images.length < 2) return;
    onActiveIndexChange((activeIndex + 1) % images.length);
  }, [activeIndex, images.length, onActiveIndexChange]);

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
      {activeImage && (
        <div className="relative flex h-[92vh] w-[min(94vw,76rem)] flex-col items-center justify-center gap-3 py-2">
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute right-0 top-0 z-20 rounded-md bg-black/60 px-3 py-2 text-sm text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            关闭
          </button>

          <div className="relative mt-9 min-h-0 w-full flex-1">
            <img src={activeImage.src} alt={activeImage.alt} className="h-full w-full rounded-md object-contain" />

            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  aria-label="上一张"
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
                >
                  <ChevronIcon direction="left" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  aria-label="下一张"
                  className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            )}
          </div>

          <div className="min-h-[2.5rem] max-w-full text-center">
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
