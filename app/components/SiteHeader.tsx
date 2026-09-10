"use client";

import { useParams } from "next/navigation";
import HomeLink from "./HomeLink";
import AboutLink from "./AboutLink";
import BackButton from "./BackButton";
import SeniorModeToggle from "./SeniorModeToggle";

export default function SiteHeader() {
  const params = useParams<{ slug?: string }>();

  return (
    <header className={`site-header flex min-h-8 items-center justify-between ${params.slug ? "article-back-header xl:hidden" : ""}`}>
      {params.slug ? (
        <>
          <BackButton />
          <nav className="flex items-center gap-4">
            <SeniorModeToggle />
          </nav>
        </>
      ) : (
        <>
          <HomeLink />
          <nav className="flex items-center gap-4">
            <SeniorModeToggle />
            <AboutLink />
          </nav>
        </>
      )}
    </header>
  );
}
