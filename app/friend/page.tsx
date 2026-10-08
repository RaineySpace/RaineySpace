import type { Metadata } from "next";
import EntityList from "@/app/components/EntityList";
import { emptyCollectionMessage } from "@/lib/entity-rendering.ts";
import JsonLd from "@/app/components/JsonLd";
import { getFriends } from "@/lib/friends";
import { entityCollectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.friends);

export default async function FriendsPage() {
  const friends = await getFriends();

  return (
    <div>
      <JsonLd data={entityCollectionJsonLd(pages.friends, friends)} />
      <header className="mb-3">
        <h1 className="page-title">朋友们</h1>
        <p className="page-description">
          欢迎大家去朋友们那里逛逛。
        </p>
      </header>
      <EntityList items={friends} headingLevel="h2" emptyLabel={emptyCollectionMessage.friend} />
    </div>
  );
}
