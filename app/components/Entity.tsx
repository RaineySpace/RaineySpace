"use client";

import { useRef } from "react";
import type { Entity as EntityData, EntityRenderOptions } from "@/lib/entities";
import { renderEntityHtml } from "@/lib/entity-rendering.mjs";
import { useEntityPopovers } from "@/app/components/useEntityPopovers";

/** Shared interaction boundary for generated Entity HTML, including Markdown. */
export function EntityContent({ html, inline = false, className }: {
  html: string;
  inline?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEntityPopovers(ref, html);
  const Root = inline ? "span" : "div";
  return <Root ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Entity({ item, ...options }: EntityRenderOptions & { item: EntityData }) {
  return <EntityContent html={renderEntityHtml(item, options)} inline={options.variant === "inline"} />;
}
