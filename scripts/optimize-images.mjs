import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import sharp from "sharp";

const publicDir = path.join(process.cwd(), "public");
const OPTIMIZED_DIR = "_optimized";
const SKIP_PUBLIC_DIRS = new Set(["assets", OPTIMIZED_DIR]);
const RASTER_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const MAX_EDGE = 1600;
const WEBP_QUALITY = 80;
const SKIP_MAX_BYTES = 150 * 1024;

function toOptimizedRelative(relativePath) {
  const parsed = path.posix.parse(relativePath);
  return path.posix.join(parsed.dir, `${parsed.name}.webp`);
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
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const jobs = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP_PUBLIC_DIRS.has(entry.name)) continue;

    const slug = entry.name;
    const postDir = path.join(publicDir, slug);
    const markdownPath = path.join(postDir, "index.md");
    if (!(await exists(markdownPath))) continue;

    const fileContents = await fs.readFile(markdownPath, "utf8");
    const { content } = matter(fileContents);
    const seen = new Set();

    for (const href of extractImageTokens(content)) {
      const relativePath = normalizeRelativeImagePath(href);
      if (!relativePath || seen.has(relativePath) || !isRasterImagePath(relativePath)) continue;
      seen.add(relativePath);

      const sourcePath = path.join(postDir, relativePath);
      if (!(await exists(sourcePath))) continue;

      jobs.push({
        slug,
        relativePath,
        sourcePath,
        outputPath: path.join(publicDir, OPTIMIZED_DIR, slug, toOptimizedRelative(relativePath)),
      });
    }
  }

  return jobs;
}

async function shouldSkipSource(sourcePath) {
  const image = sharp(sourcePath, { animated: true, failOn: "none" });
  const metadata = await image.metadata();

  if ((metadata.pages && metadata.pages > 1) || (metadata.delay && metadata.delay.length > 1)) {
    return "animated";
  }

  const stats = await fs.stat(sourcePath);
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width > 0 && height > 0 && width <= MAX_EDGE && height <= MAX_EDGE && stats.size <= SKIP_MAX_BYTES) {
    return "small";
  }

  return null;
}

async function isFresh(sourcePath, outputPath) {
  if (!(await exists(outputPath))) return false;
  const [sourceStat, outputStat] = await Promise.all([fs.stat(sourcePath), fs.stat(outputPath)]);
  return outputStat.mtimeMs >= sourceStat.mtimeMs;
}

async function generateOptimized(sourcePath, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
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
  const expectedOutputs = new Set();
  const counts = { generated: 0, reused: 0, skippedSmall: 0, skippedAnimated: 0 };

  for (const job of jobs) {
    const skipReason = await shouldSkipSource(job.sourcePath);
    if (skipReason === "animated") {
      counts.skippedAnimated += 1;
      if (await exists(job.outputPath)) await fs.unlink(job.outputPath);
      continue;
    }
    if (skipReason === "small") {
      counts.skippedSmall += 1;
      if (await exists(job.outputPath)) await fs.unlink(job.outputPath);
      continue;
    }

    expectedOutputs.add(job.outputPath);
    if (await isFresh(job.sourcePath, job.outputPath)) {
      counts.reused += 1;
      continue;
    }

    await generateOptimized(job.sourcePath, job.outputPath);
    counts.generated += 1;
  }

  const removed = await removeOrphans(expectedOutputs);
  console.log(
    `Optimized images: ${counts.generated} generated, ${counts.reused} reused, ${counts.skippedSmall} already small, ${counts.skippedAnimated} animated skipped, ${removed} orphan(s) removed.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
