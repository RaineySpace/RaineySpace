"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ImageLightbox, { type PreviewImage } from "@/app/components/ImageLightbox";

interface MarkdownContentProps {
  html: string;
}

export default function MarkdownContent({ html }: MarkdownContentProps) {
  const contentRef = useRef<HTMLElement>(null);
  const returnFocusIndexRef = useRef<number | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const previewImages: PreviewImage[] = [];
    const imageElements = Array.from(content.querySelectorAll("img"));

    imageElements.forEach((image) => {
      if (image.closest("a")) return;

      const index = previewImages.length;
      const alt = image.alt.trim() || `文章图片 ${index + 1}`;
      const displaySrc = image.currentSrc || image.getAttribute("src") || "";
      const fullSrc = image.getAttribute("data-full-src") || displaySrc;
      previewImages.push({
        id: `article-image-${index}-${fullSrc || "unknown"}`,
        src: fullSrc,
        displaySrc,
        alt,
      });
    });

    setImages(previewImages.filter((image) => image.src));
    setActiveIndex(null);
  }, [html]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let previewIndex = 0;
    Array.from(content.querySelectorAll("img")).forEach((image) => {
      image.removeAttribute("data-image-preview");
      image.removeAttribute("data-image-preview-index");
      image.removeAttribute("role");
      image.removeAttribute("tabindex");
      image.removeAttribute("aria-label");

      if (image.closest("a")) return;
      const previewImage = images[previewIndex];
      if (!previewImage) return;

      image.dataset.imagePreview = "true";
      image.dataset.imagePreviewIndex = String(previewIndex);
      image.setAttribute("role", "button");
      image.tabIndex = 0;
      image.setAttribute("aria-label", `查看大图：${previewImage.alt}`);
      previewIndex += 1;
    });
  }, [activeIndex, html, images]);

  const openImage = (image: HTMLImageElement) => {
    const index = Number(image.dataset.imagePreviewIndex);
    if (!Number.isInteger(index) || !images[index]) return;
    returnFocusIndexRef.current = index;
    setActiveIndex(index);
  };

  return (
    <>
      <section
        ref={contentRef}
        className="markdown-content"
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={(event) => {
          const target = event.target;
          if (target instanceof HTMLImageElement && target.dataset.imagePreview === "true") {
            openImage(target);
          }
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const target = event.target;
          if (target instanceof HTMLImageElement && target.dataset.imagePreview === "true") {
            event.preventDefault();
            openImage(target);
          }
        }}
      />
      <ImageLightbox
        images={images}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onClose={() => setActiveIndex(null)}
        returnFocus={() => {
          const index = returnFocusIndexRef.current;
          if (index === null) return null;
          const previewableImages = Array.from(
            contentRef.current?.querySelectorAll<HTMLImageElement>("img") || [],
          ).filter((image) => !image.closest("a"));
          return previewableImages[index] || null;
        }}
      />
    </>
  );
}
