"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeLink() {
  const pathname = usePathname();
  const isActive = pathname === "/";
  return (
    <Link
      href="/"
      className={[
        "inline-block text-base font-semibold leading-[1.6] transition-transform duration-200 motion-reduce:transform-none",
        isActive ? "" : "hover:scale-[1.2]",
        isActive ? "cursor-default" : "cursor-pointer",
      ].join(" ")}
    >
      Rainey&apos;s Blog
    </Link>
  );
}
