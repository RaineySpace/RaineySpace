import fs from 'fs/promises';
import matter from 'gray-matter';
import { Feed } from 'feed';
import * as config from './config';
import { Renderer, marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

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
  hidden: boolean;
  content: string;
  headings: Heading[];
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

function renderMarkdown(content: string): { html: string; headings: Heading[] } {
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

  const html = marked.parse(content, { renderer }) as string;
  return { html, headings };
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const fileContents = await fs.readFile(`./public/${slug}/index.md`, 'utf8');
  const { data, content } = matter(fileContents);
  const date = normalizeDate(data.date);
  const rendered = renderMarkdown(content);

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
    hidden: !!data.hidden,
    content: rendered.html,
    headings: rendered.headings,
  };
}

export async function getPosts(): Promise<Post[]> {
  const entries = await fs.readdir("./public/", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const posts = await Promise.all(dirs.map(getPostBySlug));
  return posts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() < b.date.getTime() ? 1 : -1;
  });
}

export async function getPublicPosts(): Promise<Post[]> {
  return (await getPosts()).filter((post) => !post.hidden);
}

export async function generateFeed() {
  const posts = await getPublicPosts();

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
