import { formatDateText, getEntityById, loadEntities, PROJECT_KIND } from "@/lib/registry.mjs";

export interface Project {
  id: string;
  name: string;
  url: string;
  description?: string;
  cover?: string;
  pinned: boolean;
  date: Date | null;
  dateText: string;
}

function toProject(entity: {
  id: string;
  name: string;
  url: string;
  description?: string;
  image?: string;
  pinned: boolean;
  date: Date | null;
  dateText?: string;
}): Project {
  return {
    id: entity.id,
    name: entity.name,
    url: entity.url,
    description: entity.description,
    cover: entity.image,
    pinned: entity.pinned,
    date: entity.date,
    dateText: entity.dateText || formatDateText(entity.date),
  };
}

export function getProjectById(projectId: string): Project | null {
  if (!projectId) return null;
  try {
    return toProject(getEntityById(PROJECT_KIND, projectId));
  } catch {
    throw new Error(`Unknown projectId "${projectId}". Add it to content/projects.json.`);
  }
}

export async function getProjects(): Promise<Project[]> {
  return loadEntities(PROJECT_KIND).map(toProject);
}

export async function getFeaturedProjects(limit = 3): Promise<Project[]> {
  return (await getProjects()).slice(0, limit);
}
