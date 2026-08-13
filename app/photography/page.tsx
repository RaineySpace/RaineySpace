import type { Metadata } from "next";
import PhotoGallery from "@/app/components/PhotoGallery";
import { getPhotographyPhotos } from "@/lib/photography";

export const metadata: Metadata = {
  title: "摄影 - Rainey's Blog",
  description: "Rainey 的摄影记录。",
};

export default async function PhotographyPage() {
  const photos = await getPhotographyPhotos();

  return (
    <div className="relative -top-2.5">
      <header className="mb-8">
        <h1 className="text-[28px] font-black leading-none text-[--title]">摄影</h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          一些街头、日常和偶然遇见的光。
        </p>
      </header>
      <PhotoGallery photos={photos} variant="grid" />
    </div>
  );
}
