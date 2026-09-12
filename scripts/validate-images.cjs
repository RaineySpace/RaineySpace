const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const output = path.resolve('out');
const localFile = (url) => path.join(output, decodeURIComponent(url));
const attributes = (source) => Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)="([^\"]*)"/g), (match) => [match[1].toLowerCase(), match[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"')]));
const variants = (srcSet) => srcSet.split(', ').map((part) => {
  const [src, width] = part.split(' ');
  return { src, width: Number(width.slice(0, -1)) };
});

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(output, '_optimized/manifest.json'), 'utf8'));
  const widths = new Map();
  for (const [original, image] of Object.entries(manifest)) {
    assert.ok((await fs.stat(localFile(original))).isFile(), `Missing original: ${original}`);
    assert.ok(image.width > 0 && image.height > 0, original);
    if (!image.srcSet) continue; // Animated originals retain their frames.
    assert.notEqual(image.displaySrc, original, original);
    const candidates = variants(image.srcSet);
    assert.ok(candidates.some((candidate) => candidate.src === image.displaySrc), original);
    assert.equal(image.thumbnailSrc, candidates[0].src, original);
    for (const candidate of candidates) {
      const metadata = await sharp(localFile(candidate.src)).metadata();
      assert.equal(candidate.width, metadata.width, candidate.src);
      assert.ok(Math.max(metadata.width, metadata.height) <= 1600, candidate.src);
      widths.set(candidate.src, metadata.width);
    }
    const largest = await sharp(localFile(candidates.at(-1).src)).metadata();
    assert.equal(image.width, largest.width, original);
    assert.equal(image.height, largest.height, original);
  }

  let pages = 0;
  let responsiveImages = 0;
  const walk = async (directory) => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) { await walk(filename); continue; }
      if (entry.name !== 'index.html') continue;
      pages += 1;
      const html = (await fs.readFile(filename, 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
      for (const match of html.matchAll(/<img\b([^>]*)>/g)) {
        const image = attributes(match[1]);
        assert.ok(!manifest[image.src]?.srcSet, `${filename}: original displayed before opening lightbox: ${image.src}`);
        if (image.src?.startsWith('/_optimized/')) {
          assert.ok(image.srcset && image.sizes, `${filename}: missing responsive attributes`);
          assert.ok(widths.has(image.src), `${filename}: missing display image ${image.src}`);
          for (const candidate of variants(image.srcset)) {
            assert.equal(widths.get(candidate.src), candidate.width, `${filename}: invalid candidate ${candidate.src}`);
          }
          responsiveImages += 1;
        }
        if (image['data-full-src'] && manifest[image['data-full-src']]) {
          const expected = manifest[image['data-full-src']];
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
  console.log(`Image validation passed: ${Object.keys(manifest).length} originals, ${widths.size} variants, ${responsiveImages} responsive images across ${pages} HTML pages.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
