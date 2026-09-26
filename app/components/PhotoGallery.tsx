"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useRef, useState, type CSSProperties } from "react";
import ImageLightbox, { type PreviewImage } from "@/app/components/ImageLightbox";
import LivePhoto from "@/app/components/LivePhoto";
import type { Photo } from "@/lib/photography";
import { usePhotoStripPreview } from "@/app/components/usePhotoStripPreview";

interface PhotoGalleryProps {
  photos: Photo[];
  variant: "strip" | "grid";
}

const rotations = [-2, 1, -1, 2, -1, 1];

function toPreviewImage(photo: Photo): PreviewImage {
  return {
    id: photo.id,
    src: photo.src,
    displaySrc: photo.displaySrc,
    thumbnailSrc: photo.thumbnailSrc,
    srcSet: photo.srcSet,
    alt: photo.alt,
    capturedAt: photo.capturedAt,
    date: photo.date,
    location: photo.location,
    latitude: photo.latitude,
    longitude: photo.longitude,
    camera: photo.camera,
    lens: photo.lens,
    aperture: photo.aperture,
    shutter: photo.shutter,
    iso: photo.iso,
    focalLength: photo.focalLength,
    focalLength35mm: photo.focalLength35mm,
    sourceHref: `/${photo.sourceSlug}/`,
    sourceLabel: `查看图集《${photo.sourceTitle}》`,
    sourceTitle: photo.sourceTitle,
    liveVideoSrc: photo.liveVideoSrc,
  };
}

export default function PhotoGallery({ photos, variant }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  usePhotoStripPreview(stripRef, variant === "strip" && activeIndex === null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previewImages = useMemo<PreviewImage[]>(() => photos.map(toPreviewImage), [photos]);
  const sizes = variant === "strip" ? "146px" : "(min-width: 672px) 203px, (min-width: 640px) calc((100vw - 64px) / 3), calc((100vw - 52px) / 2)";

  if (photos.length === 0) return null;

  const cards = photos.map((photo, index) => {
    const overlayMeta = [photo.capturedAt || photo.date, photo.location].filter(Boolean).join(" · ");
    const imageClassName = variant === "grid" ? "transition-transform duration-200 group-hover:[transform:scale(1.02)]" : "";
    const image = (
      <img
        src={photo.thumbnailSrc || photo.displaySrc}
        srcSet={photo.srcSet}
        alt={photo.alt}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        className={`absolute inset-0 h-full w-full object-cover${!photo.liveVideoSrc && imageClassName ? ` ${imageClassName}` : ""}`}
      />
    );
    const visual = photo.liveVideoSrc ? (
      <LivePhoto fill badgeSize="sm" className={imageClassName}>
        {image}
      </LivePhoto>
    ) : image;

    return (
      <button
        key={photo.id}
        type="button"
        onClick={(event) => {
          returnFocusRef.current = event.currentTarget;
          setActiveIndex(index);
        }}
        className={
          variant === "strip"
            ? "group photo-strip-item cursor-pointer"
            : "group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-lg bg-(--surface-muted) focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--lightLink) dark:focus-visible:ring-(--darkLink)"
        }
        aria-label={`查看大图：${photo.alt}`}
        data-photo-index={variant === "strip" ? index : undefined}
        style={variant === "strip" ? { "--photo-rotation": `${rotations[index % rotations.length]}deg` } as CSSProperties : undefined}
      >
        {variant === "strip" ? <span className="photo-strip-visual">{visual}</span> : visual}
        {variant === "grid" && (
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t/srgb from-black/75 via-black/35 to-transparent px-2 pb-2 pt-8 text-left text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="line-clamp-1 text-xs font-medium">{photo.alt}</span>
            {overlayMeta && (
              <span className="mt-0.5 block line-clamp-1 text-xs text-white/80">{overlayMeta}</span>
            )}
          </span>
        )}
      </button>
    );
  });

  return (
    <>
      <div
        className={variant === "strip" ? "photo-gallery photo-strip" : "photo-gallery grid grid-cols-2 gap-3 sm:grid-cols-3"}
        aria-label="摄影作品"
        ref={variant === "strip" ? stripRef : undefined}
      >
        {variant === "strip" ? (
          <div className="photo-strip-viewport">
            <div className="photo-strip-track">{cards}</div>
          </div>
        ) : cards}
      </div>

      <ImageLightbox
        images={previewImages}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onClose={() => setActiveIndex(null)}
        returnFocus={() => returnFocusRef.current}
      />
    </>
  );
}
