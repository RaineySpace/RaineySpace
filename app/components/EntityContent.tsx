"use client";

import { useRef } from "react";
import { useEntityPopovers } from "@/app/components/useEntityPopovers";

/** Client interaction boundary: receive rendered HTML, not the full document. */
export default function EntityContent({ html, inline = false, className }: {
  html: string;
  inline?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEntityPopovers(ref, html);
  const Root = inline ? "span" : "div";
  return <Root ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
