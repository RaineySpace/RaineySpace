import { loadContentIndex } from './content-index.ts';
import { collectionEntities, type Entity } from './entities.ts';

export type Project = Entity<'project'>;

export async function getProjects(): Promise<Entity[]> {
  return collectionEntities(loadContentIndex().entities.values(), 'project');
}
