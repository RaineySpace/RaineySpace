import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import * as config from '../lib/config.ts';
import { getPosts } from '../lib/posts.ts';
import { canonicalUrl, markdownUrl, pages, postUrl } from '../lib/seo.ts';
import { rewritePublishedMarkdown, toSiteAbsoluteAssetPath } from '../lib/published-markdown.ts';

import type { EntityDefinition } from '../lib/entities.ts';
import type { collectionJsonLd } from '../lib/seo.ts';

type Registry = Record<string, EntityDefinition>;
type ExportedJsonLd = Record<string, unknown> & {
  '@graph'?: { '@type': string }[];
  mainEntity?: ReturnType<typeof collectionJsonLd>['mainEntity'];
};
interface PageExpectation {
  url: string;
  title: string;
  description: string;
  markdown?: string;
  noindex?: boolean;
}

const output = path.resolve('out');
const read = (filename: string) => fs.readFile(path.join(output, filename), 'utf8');

function decode(value: string) {
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
    if (entity.startsWith('#')) return String.fromCodePoint(parseInt(entity.slice(entity[1].toLowerCase() === 'x' ? 2 : 1), entity[1].toLowerCase() === 'x' ? 16 : 10));
    return entities[entity.toLowerCase()];
  });
}

// Inspect the known HTML serialization produced by the static export.
function attributes(source: string) {
  return Object.fromEntries(Array.from(source.matchAll(/([\w:-]+)="([^"]*)"/g), (match) => [match[1], decode(match[2])]));
}

function tags(html: string, name: string) {
  return Array.from(html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g')), (match) => attributes(match[1]));
}

function jsonLd(html: string): ExportedJsonLd[] {
  return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g))
    .filter((match) => attributes(match[1]).type === 'application/ld+json')
    .map((match) => JSON.parse(match[2]));
}

function verifyPage(html: string, expected: PageExpectation) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1];
  assert.ok(head, `${expected.url}: missing head`);
  const links = tags(head, 'link');
  const metas = tags(head, 'meta');
  const meta = (key: string) => metas.find((tag) => tag.name === key || tag.property === key)?.content;
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
  const contactRegistry: Registry = JSON.parse(await fs.readFile('content/contacts.json', 'utf8'));
  const friendRegistry: Registry = JSON.parse(await fs.readFile('content/friends.json', 'utf8'));
  const projectRegistry: Registry = JSON.parse(await fs.readFile('content/projects.json', 'utf8'));
  for (const page of [pages.home, pages.articles, pages.photography, pages.projects, pages.friends, pages.contacts]) {
    const html = await read(`${page.pathname.slice(1)}index.html`);
    const { data } = verifyPage(html, { ...page, url: canonicalUrl(page.pathname) });
    assert.equal(data.length, 1, `${page.pathname}: expected one JSON-LD block`);
    if (page === pages.home) {
      assert.ok(data[0]['@graph']);
      assert.deepEqual(data[0]['@graph'].map((item) => item['@type']).sort(), ['Person', 'WebSite']);
      continue;
    }
    assert.equal(data[0]['@type'], 'CollectionPage');
    assert.ok(data[0].mainEntity);
    const items = data[0].mainEntity.itemListElement;
    assert.equal(data[0].mainEntity.numberOfItems, items.length);
    assert.deepEqual(items.map((item) => item.position), items.map((_, index) => index + 1));
    if (page === pages.articles) assert.deepEqual(items.map((item) => item.url), listedPosts.map((post) => postUrl(post.slug)));
    if (page === pages.photography) assert.deepEqual(items.map((item) => item.url), posts.filter((post) => post.photography && post.images.length).map((post) => postUrl(post.slug)));
    if (page === pages.contacts) assert.deepEqual(items.map((item) => item.url).sort(), Object.values(contactRegistry).map((contact) => contact.url).sort());
    if (page === pages.projects) assert.deepEqual(items.map((item) => item.url).sort(), Object.values(projectRegistry).map((project) => project.url).sort());
    if (page === pages.friends) {
      assert.deepEqual(items.map((item) => item.url).sort(), Object.values(friendRegistry).map((friend) => friend.url).sort());
      assert.deepEqual(items.map((item) => item.name).sort(), Object.values(friendRegistry).map((friend) => friend.title ?? friend.name).sort());
    }
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
      assert.equal(data[0].image, post.cover && !post.photography ? new URL(post.cover, config.siteUrl).href : undefined);
    }
    const body = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    assert.ok(body.includes(post.content), `${post.slug}: body missing from static HTML`);
    const header = body.match(/<header class="article-header">([\s\S]*?)<\/header>/)?.[1] || '';
    assert.equal(tags(header, 'h1').length, post.showHeader && post.showTitle ? 1 : 0, `${post.slug}: incorrect visible title`);
    assert.equal(header.includes('class="article-meta '), Boolean(post.showHeader && (post.date || post.location || post.tags.length)), `${post.slug}: incorrect visible metadata`);
    assert.equal(header.includes('class="article-summary"'), Boolean(post.showHeader && post.summary), `${post.slug}: incorrect visible summary`);
    const headerHasCover = tags(header, 'img').some((image) => image.src === post.coverDisplaySrc);
    if (post.photography) {
      assert.equal(headerHasCover, false, `${post.slug}: photography cover should stay share-only`);
    } else if (post.coverDisplaySrc) {
      assert.ok(headerHasCover, `${post.slug}: cover missing from article header`);
    }
    const source = await fs.readFile(`public/${post.slug}/index.md`, 'utf8');
    const published = await read(`${post.slug}.md`);
    assert.equal(published, rewritePublishedMarkdown(source, post.slug), `${post.slug}: published Markdown rewrite mismatch`);
    await assert.rejects(fs.access(path.join(output, post.slug, 'index.md')), { code: 'ENOENT' }, `${post.slug}: leaked /${post.slug}/index.md`);
    // Published Markdown keeps source asset URLs; rendered pages use content-versioned images.
    const { data: sourceData, content: sourceContent } = matter(source);
    const sourceImages = sourceData.cover ? [sourceData.cover] : [];
    marked.walkTokens(marked.lexer(sourceContent), (token) => {
      if (token.type === 'image') sourceImages.push(token.href);
    });
    for (const href of sourceImages) {
      const src = toSiteAbsoluteAssetPath(href, post.slug);
      if (src) assert.ok(published.includes(src), `${post.slug}: published Markdown missing ${src}`);
    }
    assert.doesNotMatch(published, /^cover:\s*['"]?\.\//m, `${post.slug}: published cover still relative`);
    assert.doesNotMatch(published, /!?\[[^\]]*\]\(\.\//, `${post.slug}: published Markdown still uses relative destinations`);
  }

  const home = await read('index.html');
  const homeBody = home.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.match(homeBody, /<footer(?:\s[^>]*)?>/);
  for (const [id, registry] of [['projects', projectRegistry], ['friends', friendRegistry], ['contacts', contactRegistry]] as const) {
    const section = id === 'contacts'
      ? homeBody.match(/<footer(?:\s[^>]*)?>([\s\S]*?)<\/footer>/)
      : homeBody.match(new RegExp(`<section id="${id}"[^>]*>([\\s\\S]*?)</section>`));
    assert.ok(section, `homepage missing ${id === 'contacts' ? 'contacts footer' : `${id} section`}`);
    const entityLinks = tags(section[1], 'a').filter((tag) => tag.class?.split(' ').includes(id === 'projects' ? 'entity-card-hit' : 'entity-inline-link'));
    assert.deepEqual(entityLinks.map((link) => link.href).sort(), Object.values(registry).map((item) => item.url).sort());
  }

  for (const slug of ['xiaofenshen', 'wefeather-copilot']) {
    await assert.rejects(fs.access(path.join(output, slug, 'index.html')), { code: 'ENOENT' }, `deleted post still exported: ${slug}`);
    await assert.rejects(fs.access(path.join(output, `${slug}.md`)), { code: 'ENOENT' }, `deleted Markdown still exported: ${slug}`);
    await assert.rejects(fs.access(path.join(output, slug, 'cover.webp')), { code: 'ENOENT' }, `deleted cover still exported: ${slug}`);
  }

  const friendsHtml = await read('friends/index.html');
  assert.doesNotMatch(friendsHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''), /friend:\*|project:/);
  if (Object.keys(friendRegistry).length === 0) assert.match(friendsHtml, /暂时还没有添加朋友。/);
  await assert.rejects(fs.access(path.join(output, 'friends.md')), { code: 'ENOENT' });
  const friendsBody = friendsHtml.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  assert.doesNotMatch(friendsBody, /<aside\b|aria-label="阅读设置"/);
  assert.doesNotMatch(friendsBody.split('<main>')[0], /<header\b/);

  const sitemap = await read('sitemap.xml');
  const entries = Array.from(sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g), (match) => ({
    url: decode(match[1].match(/<loc>(.*?)<\/loc>/)?.[1] || ''),
    lastmod: match[1].match(/<lastmod>(.*?)<\/lastmod>/)?.[1],
  }));
  assert.deepEqual(entries.map((entry) => entry.url).sort(), [pages.home, pages.articles, pages.photography, pages.projects, pages.friends, pages.contacts].map((page) => canonicalUrl(page.pathname)).concat(indexablePosts.map((post) => postUrl(post.slug))).sort());
  for (const entry of entries) {
    const post = indexablePosts.find((post) => postUrl(post.slug) === entry.url);
    assert.equal(entry.lastmod, post ? (post.updated || post.date)?.toISOString() : undefined, entry.url);
  }

  const llms = await read('llms.txt');
  const links: string[] = [];
  marked.walkTokens(marked.lexer(llms), (token) => { if (token.type === 'link') links.push(token.href); });
  assert.deepEqual(links.filter((href) => href.endsWith('.md')).sort(), indexablePosts.map((post) => markdownUrl(post.slug)).sort());
  for (const href of links) {
    const url = new URL(href);
    assert.equal(url.origin, new URL(config.siteUrl).origin);
    const filename = decodeURIComponent(url.pathname).slice(1) + (url.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok((await fs.stat(path.join(output, filename))).isFile(), href);
  }
  for (const post of posts.filter((post) => post.noindex)) assert.ok(!links.includes(postUrl(post.slug)) && !links.includes(markdownUrl(post.slug)), `${post.slug}: noindex entry in llms.txt`);
  assert.ok(llms.includes('## 内容'));
  assert.ok(llms.includes('不允许将内容用于模型训练'));
  assert.ok(sitemap.includes(postUrl('friends')));
  assert.ok(!sitemap.includes(postUrl('xiaofenshen')));
  assert.ok(!sitemap.includes(postUrl('wefeather-copilot')));
  assert.ok(llms.includes(canonicalUrl(pages.friends.pathname)));
  assert.ok(!llms.includes(markdownUrl('friends')));
  assert.ok(!llms.includes(markdownUrl('xiaofenshen')));
  assert.ok(!llms.includes(markdownUrl('wefeather-copilot')));

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
  assert.ok(headers.includes(`/*.md\n  Content-Type: text/markdown; charset=utf-8\n  Link: <${canonicalUrl('/:splat/')}>; rel="canonical"`));
  const noindexPaths = headers.trim().split(/\n\s*\n/).filter((rule) => rule.includes('X-Robots-Tag: noindex')).map((rule) => rule.split('\n')[0]);
  assert.deepEqual(noindexPaths.sort(), posts.filter((post) => post.noindex).map((post) => new URL(markdownUrl(post.slug)).pathname).sort(), 'incorrect Markdown noindex rules');
  for (const feed of ['rss.xml', 'atom.xml']) {
    const xml = await read(feed);
    for (const post of listedPosts) assert.ok(xml.includes(postUrl(post.slug)), `${feed}: missing ${post.slug}`);
    const ids = Array.from(xml.matchAll(/<(?:id|guid)(?:\s[^>]*)?>([^<]+)<\/(?:id|guid)>/g), (match) => match[1]);
    for (const post of posts.filter((post) => post.hidden)) assert.ok(!ids.includes(postUrl(post.slug)), `${feed}: hidden entry ${post.slug}`);
    assert.doesNotMatch(xml, /entity-card/);
    assert.doesNotMatch(xml, /"(project|friend):/);
    assert.ok(!xml.includes('/xiaofenshen/'), `${feed}: deleted xiaofenshen`);
    assert.ok(!xml.includes('/wefeather-copilot/'), `${feed}: deleted wefeather-copilot`);
  }
  console.log(`SEO validation passed for ${posts.length + 4} HTML pages, ${indexablePosts.length} indexable Markdown entries, sitemap, feeds, robots.txt and _headers.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
