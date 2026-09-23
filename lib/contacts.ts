import { CONTACT_KIND, getEntityById, loadEntities } from "./registry.ts";
import type { Entity } from "./entities.ts";

export type Contact = Entity<"contact">;

export function getContactById(contactId: string): Contact | null {
  return getEntityById(CONTACT_KIND, contactId);
}

export async function getContacts(): Promise<Contact[]> {
  return loadEntities(CONTACT_KIND);
}
