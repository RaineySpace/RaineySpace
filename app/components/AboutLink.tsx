"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function AboutLink() {
  const pathname = usePathname();
  const isActive = pathname === "/about/";
  return (
    <Link
      href="/about"
      className={[
        isActive ? "" : "hover:scale-[1.2]",
        isActive ? "cursor-default" : "cursor-pointer",
      ].join(" ")}
    >
      <Image src="/me.jpg" alt="Me" width={20} height={20} className="relative -top-1 mx-1 inline h-8 w-8 rounded-full" />
    </Link>
  );
}