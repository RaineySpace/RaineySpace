import type { Metadata } from "next";
import BackButton from "@/app/components/BackButton";
import EntityList from "@/app/components/EntityList";
import { emptyCollectionMessage, entityTitle } from "@/lib/entity-rendering.ts";
import JsonLd from "@/app/components/JsonLd";
import { getFriends } from "@/lib/friends";
import { collectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.friends);

export default async function FriendsPage() {
  const friends = await getFriends();

  return (
    <div>
      <JsonLd data={collectionJsonLd(pages.friends, friends.map((friend) => ({
        url: friend.url, name: entityTitle(friend), description: friend.description,
      })))} />
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <BackButton iconOnly />
          <h1 className="page-title">朋友们</h1>
        </div>
        <p className="page-description">
          欢迎大家去朋友们那里逛逛。
        </p>
      </header>
      <EntityList items={friends} headingLevel="h2" emptyLabel={emptyCollectionMessage.friend} />
    </div>
  );
}
