"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import ImageLightbox, { type PreviewImage } from "@/app/components/ImageLightbox";
import type { Photo } from "@/lib/photography";

interface PhotoGalleryProps {
  photos: Photo[];
  variant: "strip" | "grid";
}

const rotations = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1", "rotate-1"];

export default function PhotoGallery({ photos, variant }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const previewImages = useMemo<PreviewImage[]>(
    () =>
      photos.map((photo) => ({
        id: photo.id,
        src: photo.src,
        displaySrc: photo.displaySrc,
        alt: photo.alt,
        metadata: [photo.location, photo.date].filter(Boolean).join(" · "),
        sourceHref: `/${photo.sourceSlug}`,
        sourceLabel: `查看图集《${photo.sourceTitle}》`,
      })),
    [photos],
  );

  if (photos.length === 0) return null;

  return (
    <>
      <div
        className={variant === "strip" ? "photo-strip" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}
        aria-label="摄影作品"
      >
        {photos.map((photo, index) => (
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
            <Image
              src={photo.displaySrc}
              alt={photo.alt}
              fill
              sizes={variant === "strip" ? "120px" : "(min-width: 640px) 200px, 50vw"}
              className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
            />
          </button>
        ))}
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
