import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { canonicalUrl, markdownUrl } from '../lib/seo.ts';
import { listPostSlugs, postMarkdownPath } from '../lib/post-files.ts';
import { parsePostOptions } from '../lib/post-options.ts';

async function generateHeaders(root = process.cwd()) {
  const publicDir = path.join(root, 'public');
  const slugs = (await listPostSlugs(publicDir)).sort();
  const rules = [
    `/*.md\n  Content-Type: text/markdown; charset=utf-8\n  Link: <${canonicalUrl('/:splat/')}>; rel="canonical"\n  Cache-Control: no-cache`,
    '/_optimized/images/*\n  Cache-Control: public, max-age=31536000, immutable',
    ...['/', '/*/', '/*.html', '/*.txt', '/*.xml', '/_optimized/manifest.json'].map((pathname) => `${pathname}\n  Cache-Control: no-cache`),
  ];
  let noindexCount = 0;

  for (const slug of slugs) {
    const { data } = matter(await fs.readFile(postMarkdownPath(publicDir, slug), 'utf8'));
    let options;
    try {
      options = parsePostOptions(data);
    } catch (error) {
      throw new Error(`${slug}: ${(error instanceof Error ? error.message : String(error))}`);
    }
    if (options.noindex) {
      rules.push(`${new URL(markdownUrl(slug)).pathname}\n  X-Robots-Tag: noindex`);
      noindexCount += 1;
    }
  }

  // Rebuild the complete file so removed or unmarked posts leave no stale rules.
  await fs.writeFile(path.join(root, 'out', '_headers'), `${rules.join('\n\n')}\n`, 'utf8');
  return noindexCount;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  generateHeaders().then((count) => {
    console.log(`Generated out/_headers with versioned image caching, page revalidation, Markdown canonical links and ${count} noindex rule(s).`);
  }).catch((error) => {
    console.error((error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}

export { generateHeaders };
