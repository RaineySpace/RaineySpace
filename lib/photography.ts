import { formatDate, getPosts } from "@/lib/posts";

export interface Photo {
  id: string;
  src: string;
  displaySrc: string;
  alt: string;
  date: string;
  location?: string;
  sourceSlug: string;
  sourceTitle: string;
}

export async function getPhotographyPhotos(): Promise<Photo[]> {
  const posts = await getPosts();

  return posts
    .filter((post) => post.photography)
    .flatMap((post) =>
      post.images.map((image) => ({
        ...image,
        date: formatDate(post.date),
        location: post.location || undefined,
        sourceSlug: post.slug,
        sourceTitle: post.title,
      })),
    );
}

export async function getFeaturedPhotos(limit = 6): Promise<Photo[]> {
  return (await getPhotographyPhotos()).slice(0, limit);
}
