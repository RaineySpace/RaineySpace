"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import ImageLightbox, { type PreviewImage } from "@/app/components/ImageLightbox";
import LivePhoto from "@/app/components/LivePhoto";
import type { Photo } from "@/lib/photography";

interface PhotoGalleryProps {
  photos: Photo[];
  variant: "strip" | "grid";
}

const rotations = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1", "rotate-1"];

function toPreviewImage(photo: Photo): PreviewImage {
  return {
    id: photo.id,
    src: photo.src,
    displaySrc: photo.displaySrc,
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
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previewImages = useMemo<PreviewImage[]>(() => photos.map(toPreviewImage), [photos]);

  if (photos.length === 0) return null;

  return (
    <>
      <div
        className={variant === "strip" ? "photo-strip" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}
        aria-label="摄影作品"
      >
        {photos.map((photo, index) => {
          const overlayMeta = [photo.capturedAt || photo.date, photo.location].filter(Boolean).join(" · ");

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
                  ? `group photo-strip-item cursor-pointer ${rotations[index % rotations.length]}`
                  : "group relative aspect-[4/5] cursor-pointer overflow-hidden rounded-md bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--lightLink] dark:bg-gray-800 dark:focus-visible:ring-[--darkLink]"
              }
              aria-label={`查看大图：${photo.alt}`}
            >
              {photo.liveVideoSrc ? (
                <LivePhoto
                  videoSrc={photo.liveVideoSrc}
                  fill
                  badgeSize="sm"
                  className="transition-transform duration-200 group-hover:scale-[1.02]"
                >
                  <Image
                    src={photo.displaySrc}
                    alt={photo.alt}
                    fill
                    sizes={variant === "strip" ? "120px" : "(min-width: 640px) 200px, 50vw"}
                    className="object-cover"
                  />
                </LivePhoto>
              ) : (
                <Image
                  src={photo.displaySrc}
                  alt={photo.alt}
                  fill
                  sizes={variant === "strip" ? "120px" : "(min-width: 640px) 200px, 50vw"}
                  className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                />
              )}
              {variant === "grid" && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-2 pb-2 pt-8 text-left text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <span className="line-clamp-1 text-xs font-medium">{photo.alt}</span>
                  {overlayMeta && (
                    <span className="mt-0.5 block line-clamp-1 text-[11px] text-white/80">{overlayMeta}</span>
                  )}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <ImageLightbox
        images={previewImages}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onClose={() => setActiveIndex(null)}
        returnFocus={returnFocusRef.current}
      />
    </>
  );
}
