import type { Entity as EntityData, EntityRenderOptions } from "@/lib/entities";
import { renderEntityHtml } from "@/lib/entity-rendering.ts";
import EntityContent from "@/app/components/EntityContent";

/** Render at the page boundary so article bodies never become client card props. */
export default function Entity({ item, ...options }: EntityRenderOptions & { item: EntityData }) {
  return <EntityContent html={renderEntityHtml(item, options)} inline={options.variant === "inline"} />;
}
