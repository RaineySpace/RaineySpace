import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import sharp from "sharp";
import { listPostSlugs, postAssetDir, postMarkdownPath } from "../lib/post-files.mjs";

const publicDir = path.join(process.cwd(), "public");
const OPTIMIZED_DIR = "_optimized";
const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;
const WIDTHS = [320, 640, 960];
const pipelineMtime = (await fs.stat(fileURLToPath(import.meta.url))).mtimeMs;

function assetUrl(relativePath) {
  return `/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function isRasterImagePath(relativePath) {
  return RASTER_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

function normalizeRelativeImagePath(value) {
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

function extractImageTokens(content) {
  const images = [];

  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (value.type === "image") {
      images.push(String(value.href || ""));
      return;
    }
    Object.values(value).forEach(visit);
  };

  visit(marked.lexer(content));
  return images;
}

async function exists(filePath) {
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

async function isFresh(sourcePath, outputPath) {
  if (!(await exists(outputPath))) return false;
  const [sourceStat, outputStat] = await Promise.all([fs.stat(sourcePath), fs.stat(outputPath)]);
  return outputStat.mtimeMs >= Math.max(sourceStat.mtimeMs, pipelineMtime);
}

async function generateOptimized(sourcePath, outputPath, width) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width,
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);
}

async function removeOrphans(expectedOutputs) {
  const optimizedRoot = path.join(publicDir, OPTIMIZED_DIR);
  if (!(await exists(optimizedRoot))) return 0;

  let removed = 0;

  const walk = async (dir) => {
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
  const expectedOutputs = new Set([manifestPath]);
  const manifest = {};
  const counts = { generated: 0, reused: 0, skippedAnimated: 0 };

  for (const job of jobs) {
    const metadata = await sharp(job.sourcePath, { animated: true, failOn: 'none' }).metadata();
    const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
    const sourceHeight = metadata.pageHeight || metadata.height;
    const width = rotated ? sourceHeight : metadata.width;
    const height = rotated ? metadata.width : sourceHeight;
    if (!width || !height) throw new Error(`Missing image dimensions: ${job.sourcePath}`);
    const originalSrc = assetUrl(`${job.slug}/${job.relativePath}`);
    if (metadata.pages > 1 || metadata.delay?.length > 1) {
      counts.skippedAnimated += 1;
      // Preserve animation instead of replacing it with a still frame.
      manifest[originalSrc] = { displaySrc: originalSrc, width, height };
      continue;
    }

    const maxWidth = Math.max(1, Math.floor(width * Math.min(1, MAX_EDGE / Math.max(width, height))));
    const widths = [...WIDTHS.filter((value) => value < maxWidth), maxWidth];
    const variants = [];
    for (const targetWidth of widths) {
      // Include the original extension so photo.jpg and photo.png never collide.
      const relativeOutput = `${OPTIMIZED_DIR}/${job.slug}/${job.relativePath}.${targetWidth}.webp`;
      const outputPath = path.join(publicDir, relativeOutput);
      expectedOutputs.add(outputPath);
      if (await isFresh(job.sourcePath, outputPath)) {
        counts.reused += 1;
      } else {
        await generateOptimized(job.sourcePath, outputPath, targetWidth);
        counts.generated += 1;
      }
      const size = await sharp(outputPath).metadata();
      variants.push({ src: assetUrl(relativeOutput), width: size.width, height: size.height });
    }
    const largest = variants.at(-1);
    const display = variants.find((variant) => variant.width >= 640) || largest;
    manifest[originalSrc] = {
      displaySrc: display.src,
      thumbnailSrc: variants[0].src,
      width: largest.width,
      height: largest.height,
      srcSet: variants.map((variant) => `${variant.src} ${variant.width}w`).join(', '),
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
