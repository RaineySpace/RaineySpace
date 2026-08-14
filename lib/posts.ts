import fs from 'fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { Feed } from 'feed';
import * as config from './config';
import { Renderer, marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import {
  resolveDisplaySrc,
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
  summary: string;
  slug: string;
  cover: string;
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

export interface PostImage {
  id: string;
  src: string;
  displaySrc: string;
  alt: string;
}

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

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

async function extractMarkdownImages(
  content: string,
  slug: string,
): Promise<{ images: PostImage[]; displaySrcByRelativePath: Map<string, string> }> {
  const images: PostImage[] = [];
  const displaySrcByRelativePath = new Map<string, string>();
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
    const displaySrc = await resolveDisplaySrc(slug, relativePath);
    displaySrcByRelativePath.set(relativePath, displaySrc);
    images.push({
      id: `${slug}/${relativePath}`,
      src,
      displaySrc,
      alt: alts.get(relativePath) || '',
    });
  }

  return { images, displaySrcByRelativePath };
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
  options?: { slug: string; displaySrcByRelativePath: Map<string, string> },
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
    const displaySrc = options.displaySrcByRelativePath.get(relativePath) || originalSrc;
    return `<img src="${escapeHtml(displaySrc)}" alt="${alt}"${titleAttr} loading="lazy" data-full-src="${escapeHtml(originalSrc)}">`;
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
  const { data, content } = matter(fileContents);
  const date = normalizeDate(data.date);
  const { images, displaySrcByRelativePath } = await extractMarkdownImages(content, slug);
  const rendered = renderMarkdown(content, { slug, displaySrcByRelativePath });

  return {
    title: data.title ? String(data.title) : slug,
    showTitle: Boolean(data.title),
    date,
    dateText: formatDate(date),
    summary: data.summary ? String(data.summary) : '',
    slug,
    cover: data.cover ? String(data.cover) : '',
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
      link: `${config.siteUrl}/${post.slug}/`,
      title: post.title,
    });
  }
  return feed;
}
