import { FRIEND_KIND, getEntityById, loadEntities } from "./registry.ts";
import type { Entity } from "./entities.ts";

export type Friend = Entity<"friend">;

export function getFriendById(friendId: string): Friend | null {
  return getEntityById(FRIEND_KIND, friendId);
}

export async function getFriends(): Promise<Friend[]> {
  return loadEntities(FRIEND_KIND);
}
