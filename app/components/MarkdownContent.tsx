"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ImageLightbox, { type PreviewImage } from "@/app/components/ImageLightbox";
import { AttachedLivePhoto } from "@/app/components/LivePhoto";

interface ArticleImageMeta {
  src: string;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focalLength?: string;
  focalLength35mm?: string;
  liveVideoSrc?: string;
}

interface MarkdownContentProps {
  html: string;
  images?: ArticleImageMeta[];
  location?: string;
  date?: string;
}

const EMPTY_IMAGES: ArticleImageMeta[] = [];

function previewImageFromEvent(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  if (target instanceof HTMLImageElement && target.dataset.imagePreview === "true") {
    return target;
  }
  const wrapped = target.closest(".live-photo")?.querySelector("img");
  if (wrapped instanceof HTMLImageElement && wrapped.dataset.imagePreview === "true") {
    return wrapped;
  }
  return null;
}

function previewFieldsFromPostImage(
  image: ArticleImageMeta | undefined,
  location?: string,
  date?: string,
): Pick<
  PreviewImage,
  | "capturedAt"
  | "date"
  | "location"
  | "latitude"
  | "longitude"
  | "camera"
  | "lens"
  | "aperture"
  | "shutter"
  | "iso"
  | "focalLength"
  | "focalLength35mm"
  | "liveVideoSrc"
> {
  return {
    capturedAt: image?.capturedAt,
    date,
    location: location || undefined,
    latitude: image?.latitude,
    longitude: image?.longitude,
    camera: image?.camera,
    lens: image?.lens,
    aperture: image?.aperture,
    shutter: image?.shutter,
    iso: image?.iso,
    focalLength: image?.focalLength,
    focalLength35mm: image?.focalLength35mm,
    liveVideoSrc: image?.liveVideoSrc,
  };
}

export default function MarkdownContent({
  html,
  images: postImages = EMPTY_IMAGES,
  location,
  date,
}: MarkdownContentProps) {
  const contentRef = useRef<HTMLElement>(null);
  const returnFocusIndexRef = useRef<number | null>(null);
  const [images, setImages] = useState<PreviewImage[]>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [livePhotos, setLivePhotos] = useState<Array<{ root: HTMLElement; videoSrc: string }>>([]);
  const [livePhotoHtml, setLivePhotoHtml] = useState(html);

  if (html !== livePhotoHtml) {
    setLivePhotoHtml(html);
    setLivePhotos([]);
  }

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const extrasBySrc = new Map(postImages.map((image) => [image.src, image]));
    const previewImages: PreviewImage[] = [];
    const imageElements = Array.from(content.querySelectorAll("img"));

    imageElements.forEach((image) => {
      if (image.closest("a")) return;

      const index = previewImages.length;
      const alt = image.alt.trim() || `文章图片 ${index + 1}`;
      const displaySrc = image.currentSrc || image.getAttribute("src") || "";
      const fullSrc = image.getAttribute("data-full-src") || displaySrc;
      const extras = extrasBySrc.get(fullSrc);
      const liveVideoSrc = extras?.liveVideoSrc || image.getAttribute("data-live-src") || undefined;
      previewImages.push({
        id: `article-image-${index}-${fullSrc || "unknown"}`,
        src: fullSrc,
        displaySrc,
        alt,
        ...previewFieldsFromPostImage(extras, location, date),
        liveVideoSrc,
      });
    });

    setImages(previewImages.filter((image) => image.src));
    setActiveIndex(null);
    setLivePhotos(
      Array.from(content.querySelectorAll<HTMLElement>(".live-photo"))
        .map((root) => ({
          root,
          videoSrc: root.dataset.liveSrc || root.querySelector("img")?.dataset.liveSrc || "",
        }))
        .filter((item) => item.videoSrc),
    );
  }, [date, html, location, postImages]);

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
          const image = previewImageFromEvent(event.target);
          if (image) openImage(image);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const image = previewImageFromEvent(event.target);
          if (image) {
            event.preventDefault();
            openImage(image);
          }
        }}
        onContextMenu={(event) => {
          if (event.target instanceof Element && event.target.closest(".live-photo")) {
            event.preventDefault();
          }
        }}
      />
      {livePhotos.map((item, index) => (
        <AttachedLivePhoto key={`${item.videoSrc}-${index}`} root={item.root} videoSrc={item.videoSrc} />
      ))}
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
