import exifr from "exifr";

export interface ImageExif {
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return readNumber(value[0]);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatCapturedAt(value: unknown): string | undefined {
  if (typeof value === "string") {
    const match = value.trim().match(
      /^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2})(?::\d{2})?/,
    );
    if (match) return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }

  return undefined;
}

function formatCamera(make: string | undefined, model: string | undefined): string | undefined {
  if (!make && !model) return undefined;
  if (!model) return make;
  if (!make) return model;
  if (model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return `${make} ${model}`;
}

function formatAperture(fNumber: number): string {
  const rounded = Math.round(fNumber * 10) / 10;
  const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `ƒ/${value}`;
}

function formatShutter(exposureTime: number): string | undefined {
  if (exposureTime <= 0) return undefined;
  if (exposureTime >= 1) {
    const rounded = Math.round(exposureTime * 10) / 10;
    const value = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${value}s`;
  }
  return `1/${Math.round(1 / exposureTime)}`;
}

function formatFocalLength(mm: number): string {
  return `${Math.round(mm)}mm`;
}

function formatIso(value: number): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return String(Math.round(value));
}

function readGps(value: unknown, min: number, max: number): number | undefined {
  const number = readNumber(value);
  if (number === undefined || number < min || number > max) return undefined;
  return Math.round(number * 1e6) / 1e6;
}

export async function readImageExif(filePath: string): Promise<ImageExif> {
  let parsed: unknown;
  try {
    parsed = await exifr.parse(filePath, {
      tiff: true,
      exif: true,
      gps: true,
      mergeOutput: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: false,
    });
  } catch {
    return {};
  }

  if (!isRecord(parsed)) return {};

  const make = readString(parsed.Make);
  const model = readString(parsed.Model);
  const lens = formatCamera(readString(parsed.LensMake), readString(parsed.LensModel));
  const fNumber = readNumber(parsed.FNumber);
  const exposureTime = readNumber(parsed.ExposureTime);
  const iso = formatIso(readNumber(parsed.ISO) ?? readNumber(parsed.ISOSpeedRatings) ?? Number.NaN);
  const focalLength = readNumber(parsed.FocalLength);
  const focalLength35mm = readNumber(parsed.FocalLengthIn35mmFormat);
  const latitude = readGps(parsed.latitude, -90, 90);
  const longitude = readGps(parsed.longitude, -180, 180);
  const capturedAt = formatCapturedAt(parsed.DateTimeOriginal) || formatCapturedAt(parsed.CreateDate);

  const exif: ImageExif = {};
  if (capturedAt) exif.capturedAt = capturedAt;
  if (latitude !== undefined && longitude !== undefined) {
    exif.latitude = latitude;
    exif.longitude = longitude;
  }
  const camera = formatCamera(make, model);
  if (camera) exif.camera = camera;
  if (lens) {
    const trimmedLens =
      camera && lens.toLowerCase().startsWith(camera.toLowerCase())
        ? lens.slice(camera.length).trim()
        : lens;
    if (trimmedLens) exif.lens = trimmedLens;
  }
  if (fNumber !== undefined && fNumber > 0) exif.aperture = formatAperture(fNumber);
  if (exposureTime !== undefined) {
    const shutter = formatShutter(exposureTime);
    if (shutter) exif.shutter = shutter;
  }
  if (iso) exif.iso = iso;
  if (focalLength !== undefined && focalLength > 0) exif.focalLength = formatFocalLength(focalLength);
  if (focalLength35mm !== undefined && focalLength35mm > 0) {
    exif.focalLength35mm = formatFocalLength(focalLength35mm);
  }
  return exif;
}
