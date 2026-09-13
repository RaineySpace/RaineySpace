const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { marked } = require('marked');
const load = require('./load-typescript.cjs');
const config = load('lib/config.ts');
const { getPosts } = load('lib/posts.ts');
const { canonicalUrl, markdownUrl, pages, postUrl } = load('lib/seo.ts');

const output = path.resolve('out');
const read = (filename) => fs.readFile(path.join(output, filename), 'utf8');

function decode(value) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10));
    return entities[entity.toLowerCase()];
  });
}

// Inspect the known HTML serialization produced by the static export.
function attributes(source) {
  return Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)="([^"]*)"/g), (match) => [match[1], decode(match[2])]));
}

function tags(html, name) {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g')), (match) => attributes(match[1]));
}

function jsonLd(html) {
  return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
    .filter((match) => attributes(match[1]).type === 'application/ld+json')
    .map((match) => JSON.parse(match[2]));
}

function verifyPage(html, expected) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1];
  assert.ok(head, `${expected.url}: missing head`);
  const links = tags(head, 'link');
  const metas = tags(head, 'meta');
  const meta = (key) => metas.find((tag) => tag.name === key || tag.property === key)?.content;
  assert.equal(decode(head.match(/<title>(.*?)<\/title>/s)?.[1] || ''), expected.title, expected.url);
  assert.deepEqual(links.filter((tag) => tag.rel === 'canonical').map((tag) => tag.href), [expected.url], expected.url);
  assert.equal(meta('description'), expected.description, expected.url);
  assert.equal(meta('og:title'), expected.title, expected.url);
  assert.equal(meta('og:description'), expected.description, expected.url);
  assert.equal(meta('og:url'), expected.url, expected.url);
  assert.equal(meta('og:locale'), 'zh_CN');
  assert.equal(meta('twitter:title'), expected.title, expected.url);
  assert.equal(meta('twitter:description'), expected.description, expected.url);
  assert.equal(meta('twitter:creator'), config.twitterHandle);
  for (const [type, filename] of [['application/rss+xml', 'rss.xml'], ['application/atom+xml', 'atom.xml']]) {
    assert.ok(links.some((tag) => tag.rel === 'alternate' && tag.type === type && tag.href === `${config.siteUrl}/${filename}`), `${expected.url}: missing ${type}`);
  }
  if (expected.markdown) {
    assert.ok(links.some((tag) => tag.rel === 'alternate' && tag.type === 'text/markdown' && tag.href === expected.markdown), `${expected.url}: missing Markdown alternate`);
  }
  assert.equal(Boolean(meta('robots')?.includes('noindex')), expected.noindex === true, `${expected.url}: incorrect indexing policy`);
  return { data: jsonLd(html), meta };
}

async function main() {
  const posts = await getPosts();
  const listedPosts = posts.filter((post) => !post.hidden);
  const indexablePosts = posts.filter((post) => !post.noindex);
  const projectRegistry = JSON.parse(await fs.readFile('content/projects.json', 'utf8'));
  for (const page of [pages.home, pages.articles, pages.photography, pages.projects]) {
    const html = await read(`${page.pathname.slice(1)}index.html`);
    const { data } = verifyPage(html, { ...page, url: canonicalUrl(page.pathname) });
    assert.equal(data.length, 1, `${page.pathname}: expected one JSON-LD block`);
    if (page === pages.home) {
      assert.deepEqual(data[0]['@graph'].map((item) => item['@type']).sort(), ['Person', 'WebSite']);
      continue;
    }
    assert.equal(data[0]['@type'], 'CollectionPage');
    const items = data[0].mainEntity.itemListElement;
    assert.equal(data[0].mainEntity.numberOfItems, items.length);
    assert.deepEqual(items.map((item) => item.position), items.map((_, index) => index + 1));
    if (page === pages.articles) assert.deepEqual(items.map((item) => item.url), listedPosts.map((post) => postUrl(post.slug)));
    if (page === pages.photography) assert.deepEqual(items.map((item) => item.url), posts.filter((post) => post.photography && post.images.length).map((post) => postUrl(post.slug)));
    if (page === pages.projects) assert.deepEqual(items.map((item) => item.url).sort(), Object.values(projectRegistry).map((project) => project.url).sort());
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    const hrefs = tags(body, 'a').map((tag) => new URL(tag.href, config.siteUrl).href.replace(/\/$/, ''));
    for (const item of items) assert.ok(hrefs.includes(item.url.replace(/\/$/, '')), `${page.pathname}: JSON-LD item has no rendered link: ${item.url}`);
  }

  for (const post of posts) {
    const html = await read(`${post.slug}/index.html`);
    const expected = {
      title: `${post.title} - ${config.title}`, description: post.summary || config.description,
    };
    const { data, meta } = verifyPage(html, { ...expected, url: postUrl(post.slug), markdown: markdownUrl(post.slug), noindex: post.noindex });
    const navigation = html.match(/<nav aria-label="文章导航"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
    assert.ok(navigation, `${post.slug}: missing static article navigation`);
    const navigationLinks = tags(navigation, 'a').map((tag) => tag.href);
    assert.ok(navigationLinks.includes('/articles/'), `${post.slug}: missing archive link`);
    for (const href of navigationLinks) {
      assert.ok((await fs.stat(path.join(output, decodeURIComponent(href), 'index.html'))).isFile(), `${post.slug}: broken navigation ${href}`);
      const linkedPost = posts.find((item) => postUrl(item.slug) === new URL(href, config.siteUrl).href);
      if (linkedPost && linkedPost.slug !== 'about') assert.ok(!linkedPost.hidden, `${post.slug}: hidden related article ${href}`);
    }
    assert.equal(meta('og:image'), new URL(post.cover || config.ogImage, config.siteUrl).href);
    assert.equal(meta('twitter:image'), meta('og:image'));
    if (post.noindex) assert.equal(data.length, 0, `${post.slug}: noindex content has JSON-LD`);
    else if (post.slug === 'about') {
      assert.equal(data.length, 1);
      assert.equal(data[0]['@type'], 'AboutPage');
      assert.equal(data[0].name, expected.title);
      assert.equal(data[0].description, post.summary || undefined);
    }
    else {
      assert.equal(data.length, 1);
      assert.equal(data[0]['@type'], 'BlogPosting');
      assert.equal(data[0].headline, post.title);
      assert.equal(data[0].datePublished, post.date?.toISOString());
      assert.equal(data[0].dateModified, post.updated?.toISOString());
      assert.equal(meta('article:modified_time'), post.updated?.toISOString());
      assert.equal(data[0].image, post.cover ? new URL(post.cover, config.siteUrl).href : undefined);
    }
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.ok(body.includes(post.content), `${post.slug}: body missing from static HTML`);
    const header = body.match(/<header class="article-header">([\s\S]*?)<\/header>/)?.[1] || '';
    assert.equal(tags(header, 'h1').length, post.showHeader && post.showTitle ? 1 : 0, `${post.slug}: incorrect visible title`);
    assert.equal(header.includes('class="article-meta '), Boolean(post.showHeader && (post.date || post.location || post.tags.length)), `${post.slug}: incorrect visible metadata`);
    assert.equal(header.includes('class="article-summary"'), Boolean(post.showHeader && post.summary), `${post.slug}: incorrect visible summary`);
    if (post.coverDisplaySrc) assert.ok(tags(header, 'img').some((image) => image.src === post.coverDisplaySrc), `${post.slug}: cover missing from article header`);
    assert.equal(await read(`${post.slug}/index.md`), await fs.readFile(`public/${post.slug}/index.md`, 'utf8'));
  }

  const sitemap = await read('sitemap.xml');
  const entries = Array.from(sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => ({
    url: decode(match[1].match(/<loc>(.*?)<\/loc>/)?.[1] || ''),
    lastmod: match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
  }));
  assert.deepEqual(entries.map((entry) => entry.url).sort(), [pages.home, pages.articles, pages.photography, pages.projects].map((page) => canonicalUrl(page.pathname)).concat(indexablePosts.map((post) => postUrl(post.slug))).sort());
  for (const entry of entries) {
    const post = indexablePosts.find((post) => postUrl(post.slug) === entry.url);
    assert.equal(entry.lastmod, post ? (post.updated || post.date)?.toISOString() : undefined, entry.url);
  }

  const llms = await read('llms.txt');
  const links = [];
  marked.walkTokens(marked.lexer(llms), (token) => { if (token.type === 'link') links.push(token.href); });
  assert.deepEqual(links.filter((href) => href.endsWith('/index.md')).sort(), indexablePosts.map((post) => markdownUrl(post.slug)).sort());
  for (const href of links) {
    const url = new URL(href);
    assert.equal(url.origin, new URL(config.siteUrl).origin);
    const filename = decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok((await fs.stat(path.join(output, filename))).isFile(), href);
  }
  for (const post of posts.filter((post) => post.noindex)) assert.ok(!links.includes(postUrl(post.slug)) && !links.includes(markdownUrl(post.slug)), `${post.slug}: noindex entry in llms.txt`);
  assert.ok(llms.includes('## 内容'));
  assert.ok(llms.includes('不允许将内容用于模型训练'));

  const robots = await read('robots.txt');
  assert.match(robots, /Content-Signal: search=yes, ai-input=yes, ai-train=no/);
  assert.match(robots, /User-agent: \*[\s\S]*?Allow: \//);
  const blocked = ['Amazonbot', 'Applebot-Extended', 'Bytespider', 'CCBot', 'ClaudeBot', 'CloudflareBrowserRenderingCrawler', 'Google-Extended', 'GPTBot', 'meta-externalagent'];
  for (const bot of blocked) assert.ok(robots.includes(`User-agent: ${bot}\nDisallow: /`), `missing training opt-out: ${bot}`);
  for (const bot of ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot', 'ChatGPT-User', 'Claude-User', 'Perplexity-User']) {
    assert.ok(!robots.includes(`User-agent: ${bot}\nDisallow: /`), `search/user bot blocked: ${bot}`);
  }
  assert.ok(robots.includes(`Sitemap: ${config.siteUrl}/sitemap.xml`));
  const headers = await read('_headers');
  assert.ok(headers.includes(`/:slug/index.md\n  Link: <${canonicalUrl('/:slug/')}>; rel="canonical"`));
  const noindexPaths = headers.trim().split(/\n\s*\n/).filter((rule) => rule.includes('X-Robots-Tag: noindex')).map((rule) => rule.split('\n')[0]);
  assert.deepEqual(noindexPaths.sort(), posts.filter((post) => post.noindex).map((post) => new URL(markdownUrl(post.slug)).pathname).sort(), 'incorrect Markdown noindex rules');
  for (const feed of ['rss.xml', 'atom.xml']) {
    const xml = await read(feed);
    for (const post of listedPosts) assert.ok(xml.includes(postUrl(post.slug)), `${feed}: missing ${post.slug}`);
    const ids = Array.from(xml.matchAll(/<(?:id|guid)(?:\s[^>]*)?>([^<]+)<\/(?:id|guid)>/g), (match) => match[1]);
    for (const post of posts.filter((post) => post.hidden)) assert.ok(!ids.includes(postUrl(post.slug)), `${feed}: hidden entry ${post.slug}`);
  }
  console.log(`SEO validation passed for ${posts.length + 4} HTML pages, ${indexablePosts.length} indexable Markdown entries, sitemap, feeds, robots.txt and _headers.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
