import { loadContentIndex } from './content-index.ts';
import { collectionEntities, type Entity } from './entities.ts';

export type Contact = Entity<'contact'>;

export async function getContacts(): Promise<Entity[]> {
  return collectionEntities(loadContentIndex().entities.values(), 'contact');
}
