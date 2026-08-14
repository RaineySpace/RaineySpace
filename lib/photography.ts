import { formatDate, getPosts, type Post, type PostImage } from "@/lib/posts";

export interface Photo {
  id: string;
  src: string;
  displaySrc: string;
  alt: string;
  date: string;
  capturedAt?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  camera?: string;
  lens?: string;
  aperture?: string;
  shutter?: string;
  iso?: string;
  focalLength?: string;
  focalLength35mm?: string;
  sourceSlug: string;
  sourceTitle: string;
}

export interface PhotographyAlbum {
  slug: string;
  title: string;
  date: string;
  location?: string;
  photos: Photo[];
}

function toPhoto(image: PostImage, post: Post): Photo {
  return {
    id: image.id,
    src: image.src,
    displaySrc: image.displaySrc,
    alt: image.alt,
    date: formatDate(post.date),
    capturedAt: image.capturedAt,
    location: post.location || undefined,
    latitude: image.latitude,
    longitude: image.longitude,
    camera: image.camera,
    lens: image.lens,
    aperture: image.aperture,
    shutter: image.shutter,
    iso: image.iso,
    focalLength: image.focalLength,
    focalLength35mm: image.focalLength35mm,
    sourceSlug: post.slug,
    sourceTitle: post.title,
  };
}

export async function getPhotographyAlbums(): Promise<PhotographyAlbum[]> {
  const posts = await getPosts();

  return posts
    .filter((post) => post.photography)
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      date: formatDate(post.date),
      location: post.location || undefined,
      photos: post.images.map((image) => toPhoto(image, post)),
    }))
    .filter((album) => album.photos.length > 0);
}

export async function getPhotographyPhotos(): Promise<Photo[]> {
  return (await getPhotographyAlbums()).flatMap((album) => album.photos);
}

export async function getFeaturedPhotos(limit = 6): Promise<Photo[]> {
  return (await getPhotographyPhotos()).slice(0, limit);
}
