import fs from 'fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { Feed } from 'feed';
import * as config from './config';
import { Renderer, marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import { readImageExif, type ImageExif } from './image-exif';
import { parseUpdatedDate } from './post-dates.mjs';
import {
  resolveDisplayImage,
  type DisplayImage,
  SKIP_PUBLIC_DIRS,
  toOriginalSrc,
} from './optimized-images';

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

export interface Post {
  title: string;
  showTitle: boolean;
  date: Date | null;
  dateText: string;
  updated: Date | null;
  summary: string;
  slug: string;
  cover: string;
  coverDisplaySrc: string;
  coverImage?: DisplayImage;
  tags: string[];
  keywords: string[];
  location: string;
  hidden: boolean;
  pinned: boolean;
  photography: boolean;
  projectId: string;
  images: PostImage[];
  content: string;
  headings: Heading[];
}

export interface PostTagCount {
  tag: string;
  count: number;
}

export interface PostImage extends ImageExif, DisplayImage {
  id: string;
  src: string;
  alt: string;
  liveVideoSrc?: string;
}

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

const LIVE_PHOTO_BADGE_HTML =
  '<span class="live-photo-badge-anchor"><span class="live-photo-badge" aria-hidden="true"><svg viewBox="0 0 24 24" class="live-photo-badge-icon" fill="none"><circle cx="12" cy="12" r="8.25" stroke="currentColor" stroke-width="1.6" /><circle cx="12" cy="12" r="3.1" fill="currentColor" /></svg><span class="live-photo-badge-label">LIVE</span></span></span>';

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

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

function normalizeRelativeImagePath(value: string): string | null {
  const href = value.trim().split(/[?#]/, 1)[0];
  if (
    !href ||
    href.startsWith('/') ||
    href.startsWith('//') ||
    href.includes('\\') ||
    /^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return null;
  }

  let decodedHref: string;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return null;
  }

  if (decodedHref.includes('\\') || decodedHref.split('/').includes('..')) {
    return null;
  }

  const normalized = path.posix.normalize(decodedHref).replace(/^\.\//, '');
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    return null;
  }
  return normalized;
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

  const relativePath = normalizeRelativeImagePath(value);
  if (!relativePath) return { cover: "", coverDisplaySrc: "" };

  const filePath = path.join(process.cwd(), "public", slug, relativePath);
  if (!(await fileExists(filePath))) {
    return { cover: "", coverDisplaySrc: "" };
  }

  const cover = toOriginalSrc(slug, relativePath);
  const coverImage = await resolveDisplayImage(slug, relativePath);
  return {
    cover,
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
  const seen = new Set<string>();

  for (const extension of [".mov", ".MOV"]) {
    const fileName = `${parsed.name}${extension}`;
    if (seen.has(fileName)) continue;
    seen.add(fileName);

    if (await fileExists(path.join(directory, fileName))) {
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

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const token = value as Record<string, unknown>;
    if (token.type === 'image' && typeof token.href === 'string') {
      const relativePath = normalizeRelativeImagePath(token.href);
      if (relativePath && !seen.has(relativePath)) {
        seen.add(relativePath);
        relativePaths.push(relativePath);
        alts.set(relativePath, typeof token.text === 'string' ? token.text.trim() : '');
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
      src,
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
    slug: string;
    displayByRelativePath: Map<string, DisplayImage>;
    liveVideoSrcByRelativePath?: Map<string, string>;
  },
): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const counts = new Map<string, number>();
  const renderer = new Renderer();

  renderer.heading = (text, level) => {
    const plainText = stripHtml(String(text));
    if (level === 2 || level === 3) {
      const id = createHeadingId(plainText, counts);
      headings.push({ id, text: plainText, level });
      return `<h${level} id="${id}">${text}</h${level}>`;
    }
    return `<h${level}>${text}</h${level}>`;
  };

  renderer.image = (href, title, text) => {
    const hrefValue = href || '';
    const alt = escapeHtml(stripHtml(String(text || '')));
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    const relativePath = options ? normalizeRelativeImagePath(hrefValue) : null;

    if (!options || !relativePath) {
      return `<img src="${escapeHtml(hrefValue)}" alt="${alt}"${titleAttr} loading="lazy">`;
    }

    const originalSrc = toOriginalSrc(options.slug, relativePath);
    const display = options.displayByRelativePath.get(relativePath);
    const displaySrc = display?.displaySrc || originalSrc;
    const dimensions = display?.width && display.height ? ` width="${display.width}" height="${display.height}"` : '';
    const responsive = display?.srcSet ? ` srcset="${escapeHtml(display.srcSet)}" sizes="(min-width: 672px) 632px, calc(100vw - 40px)"` : '';
    const liveVideoSrc = options.liveVideoSrcByRelativePath?.get(relativePath);
    const liveAttr = liveVideoSrc ? ` data-live-src="${escapeHtml(liveVideoSrc)}"` : "";
    const image = `<img src="${escapeHtml(displaySrc)}" alt="${alt}"${titleAttr}${dimensions}${responsive} loading="lazy" decoding="async" data-full-src="${escapeHtml(originalSrc)}"${liveAttr}>`;
    if (!liveVideoSrc) return image;
    return `<span class="live-photo" data-live-src="${escapeHtml(liveVideoSrc)}">${image}${LIVE_PHOTO_BADGE_HTML}</span>`;
  };

  const html = marked.parse(content, { renderer }) as string;
  return { html, headings };
}

export async function getAboutContent(): Promise<string> {
  const readme = await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf8');
  return renderMarkdown(readme).html;
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const fileContents = await fs.readFile(`./public/${slug}/index.md`, 'utf8');
  const { data, content, matter: frontmatter } = matter(fileContents);
  const date = normalizeDate(data.date);
  let updated: Date | null;
  try {
    updated = parseUpdatedDate(data.updated, date, frontmatter);
  } catch (error) {
    throw new Error(`${slug}: ${(error as Error).message}`);
  }
  const { images, displayByRelativePath, liveVideoSrcByRelativePath } = await extractMarkdownImages(
    content,
    slug,
  );
  const rendered = renderMarkdown(content, { slug, displayByRelativePath, liveVideoSrcByRelativePath });
  const { cover, coverDisplaySrc, coverImage } = await resolveCover(slug, data.cover);

  return {
    title: data.title ? String(data.title) : slug,
    showTitle: Boolean(data.title),
    date,
    dateText: formatDate(date),
    updated,
    summary: data.summary ? String(data.summary) : '',
    slug,
    cover,
    coverDisplaySrc,
    coverImage,
    tags: normalizeList(data.tags),
    keywords: normalizeList(data.keywords),
    location: data.location ? String(data.location) : '',
    hidden: !!data.hidden,
    pinned: !!data.pinned,
    photography: !!data.photography,
    projectId: data.projectId ? String(data.projectId).trim() : '',
    images,
    content: rendered.html,
    headings: rendered.headings,
  };
}

function comparePostDates(a: Post, b: Post): number {
  if (!a.date && !b.date) return a.slug.localeCompare(b.slug);
  if (!a.date) return 1;
  if (!b.date) return -1;
  const difference = b.date.getTime() - a.date.getTime();
  return difference || a.slug.localeCompare(b.slug);
}

function comparePosts(a: Post, b: Post): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  return comparePostDates(a, b);
}

export async function getPosts(): Promise<Post[]> {
  const entries = await fs.readdir("./public/", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory() && !SKIP_PUBLIC_DIRS.has(entry.name))
    .map((entry) => entry.name);
  const posts = await Promise.all(dirs.map(getPostBySlug));
  return posts.sort(comparePosts);
}

export async function getPublicPosts(): Promise<Post[]> {
  return (await getPosts()).filter((post) => !post.hidden);
}

export function getRelatedPosts(post: Post, posts: readonly Post[], limit = 3): Post[] {
  if (post.hidden || post.tags.length === 0) return [];
  const tags = new Set(post.tags);
  return posts
    .filter((candidate) => !candidate.hidden && candidate.slug !== post.slug)
    .map((candidate) => ({
      post: candidate,
      matches: new Set(candidate.tags.filter((tag) => tags.has(tag))).size,
    }))
    .filter((candidate) => candidate.matches > 0)
    .sort((a, b) => b.matches - a.matches || comparePostDates(a.post, b.post))
    .slice(0, limit)
    .map((candidate) => candidate.post);
}

export function getPostTagCounts(posts: readonly Pick<Post, 'tags' | 'hidden'>[]): PostTagCount[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    if (post.hidden) continue;
    for (const tag of new Set(post.tags)) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort(
    (a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'zh-CN'),
  );
}

export async function generateFeed() {
  const posts = (await getPublicPosts()).sort(comparePostDates);

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
      date: post.date || new Date(),
      description: post.summary || stripHtml(post.content).substring(0, 200) + '...',
      content: post.content,
      id: `${config.siteUrl}/${post.slug}/`,
      image: post.cover ? toAbsoluteUrl(post.cover) : undefined,
      link: `${config.siteUrl}/${post.slug}/`,
      title: post.title,
    });
  }
  return feed;
}
