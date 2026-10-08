import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import { markdownUrl, postUrl } from '../lib/seo.ts';
import { loadContentIndex } from '../lib/content-index.ts';
import { collectionAliases, entityPath } from '../lib/content-paths.ts';
import { isIndexable } from '../lib/entities.ts';

async function generateHeaders(root = process.cwd()) {
  const { entities } = loadContentIndex(root);
  const rules = [
    '/*.md\n  Content-Type: text/markdown; charset=utf-8\n  Cache-Control: no-cache',
    '/_optimized/images/*\n  Cache-Control: public, max-age=31536000, immutable',
    '/feed\n  Content-Type: application/rss+xml; charset=utf-8\n  Cache-Control: no-cache',
    ...['/', '/*/', '/*.html', '/*.txt', '/*.xml', '/_optimized/manifest.json'].map((pathname) => `${pathname}\n  Cache-Control: no-cache`),
  ];
  const redirects: string[] = [];
  let noindexCount = 0;
  for (const entity of [...entities.values()].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const headers = [];
    if (!isIndexable(entity)) { headers.push('  X-Robots-Tag: noindex'); noindexCount++; }
    if (!entity.redirect) headers.push(`  Link: <${postUrl(entity.slug)}>; rel="canonical"`);
    if (headers.length) rules.push(`${new URL(markdownUrl(entity.slug)).pathname}\n${headers.join('\n')}`);
    if (entity.redirect) {
      const pathname = entityPath(entity.slug);
      redirects.push(`${pathname.slice(0, -1)} ${entity.url} 302`, `${pathname} ${entity.url} 302`);
    }
  }
  for (const [old, type] of Object.entries(collectionAliases)) redirects.push(`/${old} /${type}/ 301`, `/${old}/ /${type}/ 301`);
  // Both files are derived in full; removing metadata must remove stale rules too.
  await fs.writeFile(path.join(root, 'out', '_headers'), `${rules.join('\n\n')}\n`, 'utf8');
  await fs.writeFile(path.join(root, 'out', '_redirects'), `${redirects.join('\n')}\n`, 'utf8');
  return noindexCount;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  generateHeaders().then((count) => {
    console.log(`Generated out/_headers and out/_redirects with ${count} noindex rule(s).`);
  }).catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}
export { generateHeaders };
