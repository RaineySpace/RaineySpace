"use client";

import { useParams } from "next/navigation";
import HomeLink from "./HomeLink";
import AboutLink from "./AboutLink";
import BackButton from "./BackButton";
import ReadingSettings from "./ReadingSettings";

export default function SiteHeader() {
  const params = useParams<{ slug?: string }>();

  return (
    <header className={`flex min-h-8 items-center justify-between ${params.slug ? "mb-6 xl:hidden" : "mb-8 sm:mb-10"}`}>
      {params.slug ? (
        <>
          <BackButton />
          <nav className="flex items-center gap-4">
            <ReadingSettings />
          </nav>
        </>
      ) : (
        <>
          <HomeLink />
          <nav className="flex items-center gap-2">
            <ReadingSettings />
            <AboutLink />
          </nav>
        </>
      )}
    </header>
  );
}
