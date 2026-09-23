import { getEntityById, loadEntities, PROJECT_KIND } from "@/lib/registry.mjs";
import type { Entity } from "@/lib/entities";

export type Project = Entity<"project">;

export function getProjectById(projectId: string): Project | null {
  return getEntityById(PROJECT_KIND, projectId);
}

export async function getProjects(): Promise<Project[]> {
  return loadEntities(PROJECT_KIND);
}

export async function getFeaturedProjects(limit = 3): Promise<Project[]> {
  return (await getProjects()).slice(0, limit);
}
