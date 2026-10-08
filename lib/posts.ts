import fs from 'fs/promises';
import path from 'node:path';
import { Feed } from 'feed';
import * as config from './config.ts';
import { Renderer, marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { readImageExif, type ImageExif } from './image-exif.ts';
import {
  resolveDisplayImage,
  type DisplayImage,
  toOriginalSrc,
} from './optimized-images.ts';
import { loadContentIndex, type ContentIndex } from './content-index.ts';
import { compareEntityDates, isIndexable, type Entity } from './entities.ts';
import { normalizeRelativeAssetPath, imageAnchor } from './content-paths.ts';
import { stripElementsByClass, transformEntityLinks, type EntityIndex } from './markdown-refs.ts';

// 配置 marked 使用 highlight.js
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    }
  })
);

export type Post = Entity & {
  showTitle: boolean;
  coverDisplaySrc: string;
  images: PostImage[];
  content: string;
  plainContent: string;
  headings: Heading[];
  outgoing: Entity[];
  incoming: Entity[];
};

export interface PostTagCount {
  tag: string;
  count: number;
}

export interface PostImage extends ImageExif, DisplayImage {
  id: string;
  src: string;
  alt: string;
  liveVideoSrc?: string;
  photography: boolean;
  anchor: string;
}

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

const LIVE_PHOTO_BADGE_HTML =
  '<span class="live-photo-badge-anchor"><span class="live-photo-badge" aria-hidden="true"><svg viewBox="0 0 24 24" class="live-photo-badge-icon" fill="none"><circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.6" /><circle cx="12" cy="12" r="3.1" fill="currentColor" /></svg><span class="live-photo-badge-label">LIVE</span></span></span>';

export function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function toAbsoluteUrl(src: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const pathname = src.startsWith("/") ? src : `/${src}`;
  return `${config.siteUrl}${pathname}`;
}

async function resolveCover(
  slug: string,
  raw: unknown,
): Promise<{ cover: string; coverDisplaySrc: string; coverImage?: DisplayImage }> {
  // Cover comes only from explicit frontmatter. Never fall back to body images.
  const value = raw ? String(raw).trim() : "";
  if (!value) return { cover: "", coverDisplaySrc: "" };

  if (/^https?:\/\//i.test(value)) {
    return { cover: value, coverDisplaySrc: value };
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return { cover: value, coverDisplaySrc: value };
  }

  const relativePath = normalizeRelativeAssetPath(value);
  if (!relativePath) return { cover: "", coverDisplaySrc: "" };

  const filePath = path.join(process.cwd(), "public", slug, relativePath);
  if (!(await fileExists(filePath))) {
    return { cover: "", coverDisplaySrc: "" };
  }

  const cover = toOriginalSrc(slug, relativePath);
  const coverImage = await resolveDisplayImage(slug, relativePath);
  return {
    cover: coverImage.originalSrc || cover,
    coverDisplaySrc: coverImage.displaySrc,
    coverImage,
  };
}

export async function resolveLiveVideoSrc(
  slug: string,
  relativePath: string,
): Promise<string | undefined> {
  const parsed = path.posix.parse(relativePath);
  const directory = path.join(process.cwd(), "public", slug, parsed.dir);
  let filenames: string[];
  try { filenames = await fs.readdir(directory); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }

  for (const extension of [".mov", ".MOV"]) {
    const fileName = `${parsed.name}${extension}`;
    // Preserve actual case even on case-insensitive development filesystems.
    if (filenames.includes(fileName)) {
      const relativeVideo = parsed.dir ? path.posix.join(parsed.dir, fileName) : fileName;
      return toOriginalSrc(slug, relativeVideo);
    }
  }

  return undefined;
}

async function extractMarkdownImages(
  content: string,
  slug: string,
): Promise<{
  images: PostImage[];
  displayByRelativePath: Map<string, DisplayImage>;
  liveVideoSrcByRelativePath: Map<string, string>;
}> {
  const images: PostImage[] = [];
  const displayByRelativePath = new Map<string, DisplayImage>();
  const liveVideoSrcByRelativePath = new Map<string, string>();
  const seen = new Set<string>();
  const relativePaths: string[] = [];
  const alts = new Map<string, string>();
  const selected = new Set<string>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const token = value as Record<string, unknown>;
    if (token.type === 'image' && typeof token.href === 'string') {
      const relativePath = normalizeRelativeAssetPath(token.href);
      if (relativePath && token.title === 'photography' && !selected.has(relativePath)) {
        selected.add(relativePath);
        alts.set(relativePath, String(token.text || '').trim());
      }
      if (relativePath && !seen.has(relativePath)) {
        seen.add(relativePath);
        relativePaths.push(relativePath);
        if (!alts.has(relativePath)) alts.set(relativePath, typeof token.text === 'string' ? token.text.trim() : '');
      }
      return;
    }

    for (const nested of Object.values(token)) {
      if (nested && typeof nested === 'object') visit(nested);
    }
  };

  visit(marked.lexer(content));

  for (const relativePath of relativePaths) {
    const src = toOriginalSrc(slug, relativePath);
    const display = await resolveDisplayImage(slug, relativePath);
    const liveVideoSrc = await resolveLiveVideoSrc(slug, relativePath);
    const filePath = path.join(process.cwd(), 'public', slug, relativePath);
    displayByRelativePath.set(relativePath, display);
    if (liveVideoSrc) liveVideoSrcByRelativePath.set(relativePath, liveVideoSrc);
    images.push({
      id: `${slug}/${relativePath}`,
      photography: selected.has(relativePath),
      anchor: imageAnchor(relativePath),
      src: display.originalSrc || src,
      ...display,
      alt: alts.get(relativePath) || '',
      ...(liveVideoSrc ? { liveVideoSrc } : {}),
      ...(await readImageExif(filePath)),
    });
  }

  return { images, displayByRelativePath, liveVideoSrcByRelativePath };
}

function createHeadingId(text: string, counts: Map<string, number>): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
  const count = counts.get(base) || 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function renderMarkdown(
  content: string,
  options?: {
    slug?: string;
    displayByRelativePath?: Map<string, DisplayImage>;
    liveVideoSrcByRelativePath?: Map<string, string>;
    dataRefFormat?: 'card' | 'plain';
    entities?: EntityIndex;
  },
): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const counts = new Map<string, number>();
  const renderer = new Renderer();
  const entities = options?.entities || loadContentIndex().entities;
  const anchoredImages = new Set<string>();

  renderer.heading = ({ tokens, depth: level }) => {
    const text = renderer.parser.parseInline(tokens);
    const plainText = stripHtml(stripElementsByClass(String(text), 'entity-chip-popover'));
    if (level === 2 || level === 3) {
      const id = createHeadingId(plainText, counts);
      headings.push({ id, text: plainText, level });
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
    return `<h${level}>${text}</h${level}>`;
  };

  renderer.image = ({ href, title, text }) => {
    const hrefValue = href || '';
    const alt = escapeHtml(stripHtml(String(text || '')));
    const titleAttr = title && title !== 'photography' ? ` title="${escapeHtml(title)}"` : '';
    const relativePath = options?.slug ? normalizeRelativeAssetPath(hrefValue) : null;

    if (!options?.slug || !relativePath) {
      return `<img src="${escapeHtml(hrefValue)}" alt="${alt}"${titleAttr} loading="lazy">`;
    }

    const display = options.displayByRelativePath?.get(relativePath);
    const originalSrc = display?.originalSrc || toOriginalSrc(options.slug, relativePath);
    const displaySrc = display?.displaySrc || originalSrc;
    const dimensions = display?.width && display.height ? ` width="${display.width}" height="${display.height}"` : '';
    const responsive = display?.srcSet ? ` srcset="${escapeHtml(display.srcSet)}" sizes="(min-width: 672px) 632px, calc(100vw - 40px)"` : '';
    const liveVideoSrc = options.liveVideoSrcByRelativePath?.get(relativePath);
    const liveAttr = liveVideoSrc ? ` data-live-src="${escapeHtml(liveVideoSrc)}"` : "";
    const anchor = anchoredImages.has(relativePath) ? '' : ` id="${escapeHtml(imageAnchor(relativePath))}"`;
    anchoredImages.add(relativePath);
    const image = `<img${anchor} src="${escapeHtml(displaySrc)}" alt="${alt}"${titleAttr}${dimensions}${responsive} loading="lazy" decoding="async" data-full-src="${escapeHtml(originalSrc)}"${liveAttr}>`;
    if (!liveVideoSrc) return image;
    return `<span class="live-photo" data-live-src="${escapeHtml(liveVideoSrc)}">${image}${LIVE_PHOTO_BADGE_HTML}</span>`;
  };

  const tokens = marked.lexer(content);
  transformEntityLinks(tokens, {
    entities,
    format: options?.dataRefFormat || 'card',
    source: options?.slug,
  });
  const walkTokens = marked.defaults.walkTokens;
  if (walkTokens) {
    marked.walkTokens(tokens, walkTokens);
  }
  const html = marked.parser(tokens, { renderer }) as string;
  return { html, headings };
}

export async function getWelcomeContent(): Promise<string> {
  const welcome = await fs.readFile(path.join(process.cwd(), 'WELCOME.md'), 'utf8');
  return renderMarkdown(welcome).html;
}

export async function getEndContent(): Promise<string> {
  const end = await fs.readFile(path.join(process.cwd(), 'END.md'), 'utf8');
  return renderMarkdown(end).html;
}

async function renderPost(slug: string, index: ContentIndex): Promise<Post> {
  const document = index.documents.get(slug);
  if (!document) throw new Error(`Unknown document "${slug}"`);
  const { entity, content } = document;
  const { images, displayByRelativePath, liveVideoSrcByRelativePath } = await extractMarkdownImages(content, slug);
  const renderOptions = { slug, displayByRelativePath, liveVideoSrcByRelativePath, entities: index.entities };
  const rendered = renderMarkdown(content, { ...renderOptions, dataRefFormat: 'card' });
  const plain = renderMarkdown(content, { ...renderOptions, dataRefFormat: 'plain' });
  const cover = await resolveCover(slug, entity.cover);
  const related = (slugs: string[] = []) => slugs.map((key) => index.entities.get(key)!).sort(compareEntityDates);
  return {
    ...entity, ...cover, showTitle: true, images,
    content: rendered.html, plainContent: plain.html, headings: rendered.headings,
    outgoing: related(index.outgoing.get(slug)), incoming: related(index.incoming.get(slug)),
  };
}

export async function getPostBySlug(slug: string): Promise<Post> {
  return renderPost(slug, loadContentIndex());
}

export async function getPosts(): Promise<Post[]> {
  const index = loadContentIndex();
  return (await Promise.all([...index.documents.keys()].map((slug) => renderPost(slug, index)))).sort(compareEntityDates);
}

export async function getListedPosts(): Promise<Post[]> {
  return (await getPosts()).filter((post) => post.type === 'article' && !post.hidden).sort((a, b) =>
    Boolean(a.pinned) !== Boolean(b.pinned) ? a.pinned ? -1 : 1 : compareEntityDates(a, b));
}

export async function getIndexablePosts(): Promise<Post[]> {
  return (await getPosts()).filter(isIndexable);
}

export function getPostTagCounts(posts: readonly Pick<Post, 'tags' | 'hidden' | 'type'>[]): PostTagCount[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    if (post.type !== 'article' || post.hidden) continue;
    for (const tag of new Set(post.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'),
  );
}

export async function generateFeed() {
  const posts = (await getListedPosts()).sort(compareEntityDates);

  const feed = new Feed({
    author: {
      name: config.author,
      email: config.email,
      link: config.siteUrl,
    },
    description: config.description,
    favicon: config.icon,
    feedLinks: { atom: `${config.siteUrl}/atom.xml`, rss: `${config.siteUrl}/rss.xml` },
    generator: "Feed for Node.js",
    id: config.siteUrl,
    image: config.avatar,
    link: config.siteUrl,
    title: config.title,
    copyright: config.copyright,
  });

  for (const post of posts) {
    feed.addItem({
      author: [{ name: config.author, email: config.email, link: config.siteUrl }],
      category: post.tags.map((tag) => ({ name: tag })),
      date: post.date!,
      description: post.summary || stripHtml(post.plainContent || post.content).substring(0, 200) + '...',
      content: post.plainContent || post.content,
      id: `${config.siteUrl}/${post.slug}/`,
      image: post.cover ? toAbsoluteUrl(post.cover) : undefined,
      link: `${config.siteUrl}/${post.slug}/`,
      title: post.title,
    });
  }
  return feed;
}
