import { formatDateText, FRIEND_KIND, getEntityById, loadEntities } from "@/lib/registry.mjs";

export interface Friend {
  id: string;
  name: string;
  title: string;
  url: string;
  description?: string;
  icon?: string;
  pinned: boolean;
  date: Date | null;
  dateText: string;
}

function toFriend(entity: {
  id: string;
  name: string;
  title?: string;
  url: string;
  description?: string;
  image?: string;
  pinned: boolean;
  date: Date | null;
  dateText?: string;
}): Friend {
  return {
    id: entity.id,
    name: entity.name,
    title: entity.title!,
    url: entity.url,
    description: entity.description,
    icon: entity.image,
    pinned: entity.pinned,
    date: entity.date,
    dateText: entity.dateText || formatDateText(entity.date),
  };
}

export function getFriendById(friendId: string): Friend | null {
  if (!friendId) return null;
  try {
    return toFriend(getEntityById(FRIEND_KIND, friendId));
  } catch {
    throw new Error(`Unknown friend "${friendId}". Add it to content/friends.json.`);
  }
}

export async function getFriends(): Promise<Friend[]> {
  return loadEntities(FRIEND_KIND).map(toFriend);
}
