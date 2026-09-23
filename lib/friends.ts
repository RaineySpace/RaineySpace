import { FRIEND_KIND, getEntityById, loadEntities } from "@/lib/registry.mjs";
import type { Entity } from "@/lib/entities";

export type Friend = Entity<"friend">;

export function getFriendById(friendId: string): Friend | null {
  return getEntityById(FRIEND_KIND, friendId);
}

export async function getFriends(): Promise<Friend[]> {
  return loadEntities(FRIEND_KIND);
}
