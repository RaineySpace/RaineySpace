import fs from 'fs/promises';
import matter from 'gray-matter';

export interface Post {
  title?: string;
  date?: Date;
  summary?: string;
  slug: string;
  cover?: string;
  tags?: string[];
  hidden?: boolean;
  content: string;
}

export async function getPosts(): Promise<Post[]> {
  const entries = await fs.readdir("./public/", { withFileTypes: true });
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const fileContents = await Promise.all(
    dirs.map((dir) => fs.readFile("./public/" + dir + "/index.md", "utf8")),
  );
  const posts = dirs.map((slug, i) => {
    const fileContent = fileContents[i];
    const { data, content } = matter(fileContent);
    return { ...data, content, slug } as Post;
  });
  return posts.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() < b.date.getTime() ? 1 : -1;
  });
}

export async function getPostBySlug(slug: string): Promise<Post> {
  const fileContents = await fs.readFile(`./public/${slug}/index.md`, 'utf8');
  const { data, content } = matter(fileContents);
  return { ...data, content, slug } as Post;
}
