import type { Metadata } from "next";
import BackButton from "@/app/components/BackButton";
import EntityCard from "@/app/components/EntityCard";
import HoverCardList from "@/app/components/HoverCardList";
import JsonLd from "@/app/components/JsonLd";
import { getFriends } from "@/lib/friends";
import { collectionJsonLd, pageMetadata, pages } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(pages.friends);

export default async function FriendsPage() {
  const friends = await getFriends();

  return (
    <div>
      <JsonLd data={collectionJsonLd(pages.friends, friends.map((friend) => ({
        url: friend.url, name: friend.title, description: friend.description,
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
      {friends.length > 0 ? (
        <HoverCardList>
          {friends.map((friend) => (
            <EntityCard key={friend.id} item={friend} headingLevel="h2" visitLabel="访问站点" />
          ))}
        </HoverCardList>
      ) : (
        <p className="text-sm text-[--muted]">暂时还没有添加朋友。</p>
      )}
    </div>
  );
}
