export interface OpeningPreview {
  src: string;
  width: number;
  height: number;
}

interface SourceGeometry {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  crop: number[];
  radius: number;
}

export interface OpeningImage extends OpeningPreview {
  element: HTMLImageElement;
  geometry: SourceGeometry | null;
}

function sourceGeometry(image: HTMLImageElement): SourceGeometry | null {
  const rect = image.getBoundingClientRect();
  const style = getComputedStyle(image);
  const width = image.clientWidth;
  const height = image.clientHeight;
  if (!width || !height || rect.bottom <= 0 || rect.top >= window.innerHeight ||
      rect.right <= 0 || rect.left >= window.innerWidth) return null;

  // A uniform 2D transform preserves the photograph's proportions, including
  // the rotated homepage cards. Unsupported geometry uses the fade fallback.
  let matrix = new DOMMatrix();
  let radius = parseFloat(style.borderTopLeftRadius) || 0;
  for (let node: HTMLElement | null = image; node; node = node.parentElement) {
    const computed = getComputedStyle(node);
    if (computed.transform !== "none") {
      const transform = new DOMMatrix(computed.transform);
      if (!transform.is2D) return null;
      matrix = transform.multiply(matrix);
    }
    if (computed.overflowX !== "visible" || computed.overflowY !== "visible") {
      radius = Math.max(radius, parseFloat(computed.borderTopLeftRadius) || 0);
      const clip = node.getBoundingClientRect();
      if (rect.left < clip.left - 1 || rect.right > clip.right + 1 ||
          rect.top < clip.top - 1 || rect.bottom > clip.bottom + 1) return null;
    }
  }
  const scale = Math.hypot(matrix.a, matrix.b);
  if (!scale || Math.abs(scale - Math.hypot(matrix.c, matrix.d)) > 0.01 ||
      Math.abs(matrix.a * matrix.c + matrix.b * matrix.d) > 0.01 ||
      matrix.a * matrix.d - matrix.b * matrix.c <= 0) return null;

  const fit = style.objectFit;
  const contain = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const cover = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  let fitScale = contain;
  if (fit === "cover") fitScale = cover;
  else if (fit === "scale-down") fitScale = Math.min(1, contain);
  else if (fit === "none") fitScale = 1;
  else if (fit !== "contain" && Math.abs(contain - cover) > 0.01) return null;

  const position = style.objectPosition.split(" ");
  if (position.length !== 2 || position.some((value) => !value.endsWith("%"))) return null;
  const positionX = parseFloat(position[0]) / 100;
  const positionY = parseFloat(position[1]) / 100;
  if (!Number.isFinite(positionX) || !Number.isFinite(positionY)) return null;
  const renderedWidth = image.naturalWidth * fitScale;
  const renderedHeight = image.naturalHeight * fitScale;
  const offsetX = (width - renderedWidth) * positionX;
  const offsetY = (height - renderedHeight) * positionY;
  const shiftX = offsetX + (renderedWidth - width) / 2;
  const shiftY = offsetY + (renderedHeight - height) / 2;

  return {
    centerX: rect.left + rect.width / 2 + matrix.a * shiftX + matrix.c * shiftY,
    centerY: rect.top + rect.height / 2 + matrix.b * shiftX + matrix.d * shiftY,
    width: renderedWidth * scale,
    height: renderedHeight * scale,
    rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI,
    crop: [
      Math.max(0, -offsetY) / renderedHeight * 100,
      Math.max(0, renderedWidth + offsetX - width) / renderedWidth * 100,
      Math.max(0, renderedHeight + offsetY - height) / renderedHeight * 100,
      Math.max(0, -offsetX) / renderedWidth * 100,
    ],
    radius: radius * scale,
  };
}

export function captureOpeningImage(target: HTMLElement | null | undefined): OpeningImage | null {
  const image = target instanceof HTMLImageElement ? target : target?.querySelector("img");
  if (!image?.isConnected || !image.complete || !image.naturalWidth || !image.naturalHeight) return null;
  let geometry: SourceGeometry | null = null;
  try {
    geometry = sourceGeometry(image);
  } catch {
    // Missing geometry APIs must never prevent opening an image.
  }
  return {
    element: image,
    src: image.currentSrc || image.src,
    width: image.naturalWidth,
    height: image.naturalHeight,
    geometry,
  };
}

export function animateLightboxOpening(
  dialog: HTMLDialogElement,
  stage: HTMLElement,
  source: OpeningImage | null,
  onFinish: () => void,
): () => void {
  const animations: Animation[] = [];
  let layer: HTMLImageElement | null = null;
  let sourceVisibility: string | undefined;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    animations.forEach((animation) => animation.cancel());
    layer?.remove();
    if (source && sourceVisibility !== undefined) source.element.style.visibility = sourceVisibility;
    delete dialog.dataset.opening;
  };

  try {
    const rect = stage.getBoundingClientRect();
    const geometry = source?.geometry;
    if (source && geometry && rect.width > 0 && rect.height > 0) {
      const scale = Math.min(rect.width / source.width, rect.height / source.height);
      const width = source.width * scale;
      const height = source.height * scale;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const startScale = geometry.width / width;
      layer = document.createElement("img");
      layer.src = source.src;
      layer.alt = "";
      layer.draggable = false;
      layer.setAttribute("aria-hidden", "true");
      layer.className = "image-lightbox-opening-image";
      Object.assign(layer.style, {
        left: `${centerX - width / 2}px`, top: `${centerY - height / 2}px`,
        width: `${width}px`, height: `${height}px`,
      });
      dialog.appendChild(layer);
      animations.push(layer.animate([
        {
          transform: `translate(${geometry.centerX - centerX}px, ${geometry.centerY - centerY}px) rotate(${geometry.rotation}deg) scale(${startScale})`,
          clipPath: `inset(${geometry.crop.map((value) => `${value}%`).join(" ")} round ${geometry.radius / startScale}px)`,
        },
        { transform: "translate(0, 0) rotate(0deg) scale(1)", clipPath: "inset(0% 0% 0% 0% round 0px)" },
      ], { duration: 280, easing: "ease-out", fill: "both" }));
      sourceVisibility = source.element.style.visibility;
      source.element.style.visibility = "hidden";
      dialog.dataset.opening = "shared";
    } else {
      dialog.dataset.opening = "fade";
      animations.push(stage.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 150, easing: "ease-out", fill: "both",
      }));
    }
    void Promise.all(animations.map((animation) => animation.finished)).then(() => {
      if (!stopped) onFinish();
    }).catch(() => {
      if (!stopped) onFinish();
    });
  } catch {
    stop();
    // Also covers browsers without Web Animations; preserve ordinary viewing.
    queueMicrotask(onFinish);
  }
  return stop;
}
