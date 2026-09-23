"use client";

import { useRef, useState } from "react";
import ImageLightbox from "./ImageLightbox";

interface PostCoverProps {
  src: string;
  originalSrc: string;
  thumbnailSrc?: string;
  srcSet?: string;
  title: string;
  priority?: boolean;
  className?: string;
}

export default function PostCover({ src, originalSrc, thumbnailSrc, srcSet, title, priority = false, className = "" }: PostCoverProps) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const alt = `${title}的封面`;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label={`查看封面原图：${title}`}
        onClick={() => setOpen(true)}
        className={`block w-full cursor-zoom-in overflow-hidden rounded-xl bg-(--surface-muted) ring-1 ring-(--border) focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--lightLink) ${className}`.trim()}
      >
        {/* Covers may be local files or remote URLs, so they cannot use a fixed Next Image allowlist. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          srcSet={srcSet}
          sizes="(min-width: 672px) 632px, calc(100vw - 40px)"
          alt=""
          decoding="async"
          {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
          className="aspect-[16/9] h-auto w-full object-cover"
        />
      </button>
      <ImageLightbox
        images={[{ id: originalSrc, src: originalSrc, displaySrc: src, thumbnailSrc, srcSet, alt }]}
        activeIndex={open ? 0 : null}
        onActiveIndexChange={(index) => setOpen(index !== null)}
        onClose={() => setOpen(false)}
        returnFocus={() => trigger.current}
      />
    </>
  );
}
