import { loadContentIndex } from './content-index.ts';
import { collectionEntities, type Entity } from './entities.ts';

export type Friend = Entity<'friend'>;

export async function getFriends(): Promise<Entity[]> {
  return collectionEntities(loadContentIndex().entities.values(), 'friend');
}
