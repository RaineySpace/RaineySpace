import { getPosts } from "@/lib/posts";

export interface Project {
  id: string;
  name: string;
  summary: string;
  detailHref: string;
  projectUrl?: string;
  sourceUrl?: string;
  year: string;
  tags: string[];
}

export async function getProjects(): Promise<Project[]> {
  const posts = await getPosts();

  return posts
    .filter((post) => post.project)
    .map((post) => ({
      id: post.slug,
      name: post.title,
      summary: post.summary,
      detailHref: `/${post.slug}`,
      projectUrl: post.projectUrl || undefined,
      sourceUrl: post.sourceUrl || undefined,
      year: post.date ? String(post.date.getUTCFullYear()) : "",
      tags: post.tags,
    }));
}

export async function getFeaturedProjects(limit = 3): Promise<Project[]> {
  return (await getProjects()).slice(0, limit);
}
