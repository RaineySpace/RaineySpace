"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trade_Winds } from "next/font/google";

const trade = Trade_Winds({
  weight: ["400"],
  subsets: ["latin"],
});

export default function HomeLink() {
  const pathname = usePathname();
  const isActive = pathname === "/";
  return (
    <Link 
      href="/" 
      className={[
        trade.className,
        "inline-block text-2xl font-black",
        isActive ? "" : "hover:scale-[1.2]",
        isActive ? "cursor-default" : "cursor-pointer",
      ].join(" ")}
    >
      <span style={{
        backgroundImage:
          "linear-gradient(45deg, var(--pink), var(--purple))",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
      }}>
        Rainey&apos;s Blog
      </span>
    </Link>
  );
}
