import projectDefinitions from "@/content/projects.json";
import { getPosts, type Post } from "@/lib/posts";

interface ProjectDefinition {
  name: string;
  url: string;
  description?: string;
  cover?: string;
  sourceUrl?: string;
  pinned?: boolean;
}

const projectRegistry = projectDefinitions as Record<string, ProjectDefinition>;

export interface Project {
  id: string;
  name: string;
  url: string;
  description?: string;
  cover?: string;
  sourceUrl?: string;
  pinned: boolean;
}

function toProject(id: string, definition: ProjectDefinition): Project {
  return {
    id,
    name: definition.name,
    url: definition.url,
    description: definition.description || undefined,
    cover: definition.cover || undefined,
    sourceUrl: definition.sourceUrl || undefined,
    pinned: definition.pinned || false,
  };
}

export function getProjectById(projectId: string): Project | null {
  if (!projectId) return null;
  const definition = projectRegistry[projectId];
  if (!definition) {
    throw new Error(`Unknown projectId "${projectId}". Add it to content/projects.json.`);
  }
  return toProject(projectId, definition);
}

function isNewerPost(candidate: Post, current: Post): boolean {
  if (!candidate.date) return false;
  if (!current.date) return true;
  const difference = candidate.date.getTime() - current.date.getTime();
  return difference > 0 || (difference === 0 && candidate.slug.localeCompare(current.slug) < 0);
}

function compareLatestDates(a: Post, b: Post): number {
  if (!a.date && !b.date) return a.slug.localeCompare(b.slug);
  if (!a.date) return 1;
  if (!b.date) return -1;
  return b.date.getTime() - a.date.getTime() || a.slug.localeCompare(b.slug);
}

export async function getProjects(): Promise<Project[]> {
  const latestPostByProject = new Map<string, Post>();

  for (const post of await getPosts()) {
    if (!post.projectId) continue;
    const current = latestPostByProject.get(post.projectId);
    if (!current || isNewerPost(post, current)) {
      latestPostByProject.set(post.projectId, post);
    }
  }

  return Array.from(latestPostByProject, ([projectId, latestPost]) => {
    const project = getProjectById(projectId);
    if (!project) throw new Error(`Post references an empty projectId.`);
    return { project, latestPost };
  })
    .sort((a, b) => {
      if (a.project.pinned !== b.project.pinned) return a.project.pinned ? -1 : 1;
      return compareLatestDates(a.latestPost, b.latestPost) || a.project.id.localeCompare(b.project.id);
    })
    .map(({ project }) => project);
}

export async function getFeaturedProjects(limit = 3): Promise<Project[]> {
  return (await getProjects()).slice(0, limit);
}
