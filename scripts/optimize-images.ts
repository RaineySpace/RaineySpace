import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import matter from "gray-matter";
import { marked } from "marked";
import sharp from "sharp";
import { listPostSlugs, postAssetDir, postMarkdownPath } from "../lib/post-files.ts";

import type { ImageManifest, OptimizedImage } from "../lib/optimized-images.ts";
import { isPlainObject } from "../lib/registry.ts";

const publicDir = path.join(process.cwd(), "public");
const OPTIMIZED_DIR = "_optimized";
const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;
const WIDTHS = [320, 640, 960];
const IMAGE_DIR = `${OPTIMIZED_DIR}/images`;
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
// Toolchain changes invalidate the build cache, but public URLs always hash the output bytes.
const pipelineHash = digest(Buffer.concat([
  await fs.readFile(fileURLToPath(import.meta.url)),
  Buffer.from(JSON.stringify(sharp.versions)),
]));

function assetUrl(relativePath: string) {
  return `/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function isRasterImagePath(relativePath: string) {
  return RASTER_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

function normalizeRelativeImagePath(value: unknown) {
  const href = String(value).trim().split(/[?#]/, 1)[0];
  if (
    !href ||
    href.startsWith("/") ||
    href.startsWith("//") ||
    href.includes("\\") ||
    /^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return null;
  }

  let decodedHref;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return null;
  }

  if (decodedHref.includes("\\") || decodedHref.split("/").includes("..")) return null;
  const normalized = path.posix.normalize(decodedHref).replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    return null;
  }
  return normalized;
}

function extractImageTokens(content: string) {
  const images: string[] = [];

  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isPlainObject(value)) return;
    if (value.type === "image") {
      images.push(String(value.href || ""));
      return;
    }
    Object.values(value).forEach(visit);
  };

  visit(marked.lexer(content));
  return images;
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function collectPostImages() {
  const slugs = await listPostSlugs(publicDir);
  const jobs = [];

  for (const slug of slugs) {
    const postDir = postAssetDir(publicDir, slug);
    const markdownPath = postMarkdownPath(publicDir, slug);
    if (!(await exists(markdownPath))) continue;

    const fileContents = await fs.readFile(markdownPath, "utf8");
    const { data, content } = matter(fileContents);
    const seen = new Set();
    const hrefs = extractImageTokens(content);
    if (data.cover) hrefs.unshift(String(data.cover));

    for (const href of hrefs) {
      const relativePath = normalizeRelativeImagePath(href);
      if (!relativePath || seen.has(relativePath) || !isRasterImagePath(relativePath)) continue;
      seen.add(relativePath);

      const sourcePath = path.join(postDir, relativePath);
      if (!(await exists(sourcePath))) continue;

      jobs.push({
        slug,
        relativePath,
        sourcePath,
      });
    }
  }

  return jobs;
}

async function writeVersionedImage(bytes: Buffer, filename: string, expectedOutputs: Set<string>) {
  const relativeOutput = `${IMAGE_DIR}/${digest(bytes)}/${filename}`;
  const outputPath = path.join(publicDir, relativeOutput);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  expectedOutputs.add(outputPath);
  return assetUrl(relativeOutput);
}

async function generateOptimized(bytes: Buffer, width: number) {
  return sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });
}

async function reusableOutputs(entry: OptimizedImage | undefined, sourceHash: string) {
  if (entry?.sourceHash !== sourceHash || entry?.pipelineHash !== pipelineHash || !entry.originalSrc) return null;
  const urls = new Set([entry.originalSrc, entry.displaySrc, entry.thumbnailSrc].filter((url): url is string => Boolean(url)));
  for (const candidate of (entry.srcSet || '').split(', ').filter(Boolean)) urls.add(candidate.split(' ')[0]);
  const files = [];
  for (const url of urls) {
    const match = url.match(/^\/_optimized\/images\/([a-f0-9]{64})\/[^/]+$/);
    if (!match) return null;
    const filename = path.join(publicDir, decodeURIComponent(url));
    try {
      if (digest(await fs.readFile(filename)) !== match[1]) return null;
    } catch (error) {
      if ((error instanceof Error && 'code' in error ? error.code : undefined) !== 'ENOENT') throw error;
      return null;
    }
    files.push(filename);
  }
  return files;
}

async function removeOrphans(expectedOutputs: Set<string>) {
  const optimizedRoot = path.join(publicDir, OPTIMIZED_DIR);
  if (!(await exists(optimizedRoot))) return 0;

  let removed = 0;

  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        const leftover = await fs.readdir(fullPath);
        if (leftover.length === 0) await fs.rmdir(fullPath);
        continue;
      }
      if (!expectedOutputs.has(fullPath)) {
        await fs.unlink(fullPath);
        removed += 1;
      }
    }
  };

  await walk(optimizedRoot);
  return removed;
}

async function main() {
  const jobs = await collectPostImages();
  const manifestPath = path.join(publicDir, OPTIMIZED_DIR, 'manifest.json');
  const previous: ImageManifest = await exists(manifestPath) ? JSON.parse(await fs.readFile(manifestPath, 'utf8')) : {};
  const expectedOutputs = new Set([manifestPath]);
  const manifest: ImageManifest = {};
  const counts = { generated: 0, reused: 0, skippedAnimated: 0 };

  for (const job of jobs) {
    const bytes = await fs.readFile(job.sourcePath);
    const sourceHash = digest(bytes);
    const sourceUrl = assetUrl(`${job.slug}/${job.relativePath}`);
    const cached = previous[sourceUrl];
    const reusable = await reusableOutputs(cached, sourceHash);
    if (reusable) {
      reusable.forEach((filename) => expectedOutputs.add(filename));
      manifest[sourceUrl] = cached;
      if (cached.srcSet) counts.reused += cached.srcSet.split(', ').length;
      else counts.skippedAnimated += 1;
      continue;
    }
    const metadata = await sharp(bytes, { animated: true, failOn: 'none' }).metadata();
    const rotated = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
    const sourceHeight = metadata.pageHeight || metadata.height;
    const width = rotated ? sourceHeight : metadata.width;
    const height = rotated ? metadata.width : sourceHeight;
    if (!width || !height) throw new Error(`Missing image dimensions: ${job.sourcePath}`);
    const filename = path.posix.basename(job.relativePath);
    const originalSrc = await writeVersionedImage(bytes, filename, expectedOutputs);
    if ((metadata.pages ?? 1) > 1 || (metadata.delay?.length ?? 0) > 1) {
      counts.skippedAnimated += 1;
      // Preserve animation instead of replacing it with a still frame.
      manifest[sourceUrl] = { originalSrc, displaySrc: originalSrc, width, height, sourceHash, pipelineHash };
      continue;
    }

    const maxWidth = Math.max(1, Math.floor(width * Math.min(1, MAX_EDGE / Math.max(width, height))));
    const widths = [...WIDTHS.filter((value) => value < maxWidth), maxWidth];
    const variants = [];
    for (const targetWidth of widths) {
      const { data, info } = await generateOptimized(bytes, targetWidth);
      const src = await writeVersionedImage(data, `${filename}.${targetWidth}.webp`, expectedOutputs);
      counts.generated += 1;
      variants.push({ src, width: info.width, height: info.height });
    }
    const largest = variants.at(-1);
    if (!largest) throw new Error(`No optimized variants: ${job.sourcePath}`);
    const display = variants.find((variant) => variant.width >= 640) || largest;
    manifest[sourceUrl] = {
      originalSrc,
      displaySrc: display.src,
      thumbnailSrc: variants[0].src,
      width: largest.width,
      height: largest.height,
      srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
      sourceHash,
      pipelineHash,
    };
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const removed = await removeOrphans(expectedOutputs);
  console.log(
    `Optimized images: ${counts.generated} variants generated, ${counts.reused} reused, ${counts.skippedAnimated} animated preserved, ${removed} orphan(s) removed; ${Object.keys(manifest).length} images in manifest.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
