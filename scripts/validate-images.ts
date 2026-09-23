import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';

import type { ImageManifest, OptimizedImage } from "../lib/optimized-images.ts";

const output = path.resolve('out');
const localFile = (url: string) => path.join(output, decodeURIComponent(url));
const attributes = (source: string) => Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)="([^\"]*)"/g), (match) => [match[1].toLowerCase(), match[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"')]));
const variants = (srcSet: string) => srcSet.split(', ').map((part) => {
  const [src, width] = part.split(' ');
  return { src, width: Number(width.slice(0, -1)) };
});

async function main() {
  const manifest: ImageManifest = JSON.parse(await fs.readFile(path.join(output, '_optimized/manifest.json'), 'utf8'));
  const widths = new Map<string, number>();
  const originals = new Map<string, OptimizedImage>();
  const checked = new Set<string>();
  const checkVersion = async (url: string) => {
    assert.match(url, /^\/_optimized\/images\/[a-f0-9]{64}\/[^/]+$/, 'Image URL must include a content hash: ' + url);
    if (checked.has(url)) return;
    const bytes = await fs.readFile(localFile(url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), url.split('/')[3], 'Image bytes disagree with URL: ' + url);
    checked.add(url);
  };
  for (const [original, image] of Object.entries(manifest)) {
    assert.ok((await fs.stat(localFile(original))).isFile(), `Missing original: ${original}`);
    await checkVersion(image.originalSrc);
    assert.deepEqual(await fs.readFile(localFile(image.originalSrc)), await fs.readFile(localFile(original)), 'Versioned original differs from source: ' + original);
    originals.set(image.originalSrc, image);
    assert.ok(image.width > 0 && image.height > 0, original);
    if (!image.srcSet) {
      assert.equal(image.displaySrc, image.originalSrc, 'Animated images must use the preserved original');
      continue;
    }
    assert.notEqual(image.displaySrc, original, original);
    const candidates = variants(image.srcSet);
    assert.ok(candidates.some((candidate) => candidate.src === image.displaySrc), original);
    assert.equal(image.thumbnailSrc, candidates[0].src, original);
    for (const candidate of candidates) {
      await checkVersion(candidate.src);
      const metadata = await sharp(localFile(candidate.src)).metadata();
      assert.equal(candidate.width, metadata.width, candidate.src);
      assert.ok(metadata.width && metadata.height);
      assert.ok(Math.max(metadata.width, metadata.height) <= 1600, candidate.src);
      widths.set(candidate.src, metadata.width);
    }
    const last = candidates.at(-1);
    assert.ok(last);
    const largest = await sharp(localFile(last.src)).metadata();
    assert.equal(image.width, largest.width, original);
    assert.equal(image.height, largest.height, original);
  }

  let pages = 0;
  let responsiveImages = 0;
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { await walk(filename); continue; }
      if (entry.name !== 'index.html') continue;
      pages += 1;
      const html = (await fs.readFile(filename, 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
        const image = attributes(match[1]);
        assert.ok(!manifest[image.src]?.srcSet && !originals.get(image.src)?.srcSet, `${filename}: original displayed before opening lightbox: ${image.src}`);
        if (image.src?.startsWith('/_optimized/') && !originals.has(image.src)) {
          assert.ok(image.srcset && image.sizes, `${filename}: missing responsive attributes`);
          assert.ok(widths.has(image.src), `${filename}: missing display image ${image.src}`);
          for (const candidate of variants(image.srcset)) {
            assert.equal(widths.get(candidate.src), candidate.width, `${filename}: invalid candidate ${candidate.src}`);
          }
          responsiveImages += 1;
        }
        if (image['data-full-src']?.startsWith('/_optimized/')) {
          const expected = originals.get(image['data-full-src']);
          assert.ok(expected, `${filename}: unknown versioned original ${image['data-full-src']}`);
          assert.equal(Number(image.width), expected.width, filename);
          assert.equal(Number(image.height), expected.height, filename);
        }
      }
      if (html.includes('class="article-cover') || html.includes(' article-cover"')) {
        assert.match(html, /aria-label="查看封面原图：[^\"]+"/, `${filename}: cover has no accessible lightbox trigger`);
      }
    }
  };
  await walk(output);
  assert.ok(responsiveImages > 0, 'No responsive images in static export');
  const headers = await fs.readFile(path.join(output, '_headers'), 'utf8');
  assert.ok(headers.includes('/_optimized/images/*\n  Cache-Control: public, max-age=31536000, immutable'));
  for (const pathname of ['/', '/*/', '/*.html', '/*.txt', '/_optimized/manifest.json']) {
    assert.ok(headers.includes(`${pathname}\n  Cache-Control: no-cache`), 'Missing cache revalidation: ' + pathname);
  }
  console.log(`Image validation passed: ${Object.keys(manifest).length} versioned originals, ${widths.size} variants, ${responsiveImages} responsive images across ${pages} HTML pages, and cache headers.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
