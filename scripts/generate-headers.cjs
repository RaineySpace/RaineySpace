const fs = require('node:fs/promises');
const path = require('node:path');
const matter = require('gray-matter');
const load = require('./load-typescript.cjs');
const { canonicalUrl, markdownUrl } = load('lib/seo.ts');
const { SKIP_PUBLIC_DIRS } = load('lib/optimized-images.ts');
const { parsePostOptions } = require('../lib/post-options.mjs');

async function generateHeaders(root = process.cwd()) {
  const publicDir = path.join(root, 'public');
  const entries = await fs.readdir(publicDir, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory() && !SKIP_PUBLIC_DIRS.has(entry.name))
    .map((entry) => entry.name).sort();
  const rules = [`/:slug/index.md\n  Link: <${canonicalUrl('/:slug/')}>; rel="canonical"`];

  for (const slug of slugs) {
    const { data } = matter(await fs.readFile(path.join(publicDir, slug, 'index.md'), 'utf8'));
    let options;
    try {
      options = parsePostOptions(data);
    } catch (error) {
      throw new Error(`${slug}: ${error.message}`);
    }
    if (options.noindex) {
      rules.push(`${new URL(markdownUrl(slug)).pathname}\n  X-Robots-Tag: noindex`);
    }
  }

  // Rebuild the complete file so removed or unmarked posts leave no stale rules.
  await fs.writeFile(path.join(root, 'out', '_headers'), `${rules.join('\n\n')}\n`, 'utf8');
  return rules.length - 1;
}

if (require.main === module) {
  generateHeaders().then((count) => {
    console.log(`Generated out/_headers with Markdown canonical links and ${count} noindex rule(s).`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { generateHeaders };
