import type { Entity as EntityData, EntityRenderOptions } from "@/lib/entities";
import Entity from "@/app/components/Entity";
import HoverCardList from "@/app/components/HoverCardList";

interface EntityListProps extends EntityRenderOptions {
  items: EntityData[];
  emptyLabel?: string;
}

export default function EntityList({ items, emptyLabel = "暂时还没有添加内容。", ...options }: EntityListProps) {
  if (!items.length) return <p className="text-sm text-(--muted)">{emptyLabel}</p>;

  if (options.variant === "inline") {
    return (
      <ul data-entity-boundary className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={`${item.kind}:${item.id}`} className="max-w-full">
            <Entity item={item} {...options} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <HoverCardList>
      {items.map((item) => <Entity key={`${item.kind}:${item.id}`} item={item} {...options} />)}
    </HoverCardList>
  );
}
