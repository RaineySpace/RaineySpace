import { formatDate, getPosts, type Post, type PostImage } from "./posts.ts";

export interface Photo {
  id: string;
  src: string;
  displaySrc: string;
  thumbnailSrc?: string;
  srcSet?: string;
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
  anchor: string;
  sourceTitle: string;
  liveVideoSrc?: string;
}

function toPhoto(image: PostImage, post: Post): Photo {
  return {
    id: image.id,
    src: image.src,
    displaySrc: image.displaySrc,
    thumbnailSrc: image.thumbnailSrc,
    srcSet: image.srcSet,
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
    anchor: image.anchor,
    sourceTitle: post.title,
    liveVideoSrc: image.liveVideoSrc,
  };
}

export function collectPhotographyPhotos(posts: Post[]): Photo[] {
  const rows = posts.flatMap((post) => post.images.map((image, order) => ({ post, image, order })))
    .filter(({ image }) => image.photography);
  const timestamp = ({ post, image }: typeof rows[number]) => {
    const captured = image.capturedAt ? new Date(image.capturedAt).getTime() : NaN;
    return Number.isFinite(captured) ? captured : post.date?.getTime() ?? -Infinity;
  };
  rows.sort((a, b) => {
    const dateOrder = timestamp(b) - timestamp(a);
    if (dateOrder && !Number.isNaN(dateOrder)) return dateOrder;
    return (a.post.slug < b.post.slug ? -1 : a.post.slug > b.post.slug ? 1 : 0) || a.order - b.order;
  });
  return rows.map(({ post, image }) => toPhoto(image, post));
}

export async function getPhotographyPhotos(): Promise<Photo[]> {
  return collectPhotographyPhotos(await getPosts());
}

export async function getFeaturedPhotos(limit = 6): Promise<Photo[]> {
  return (await getPhotographyPhotos()).slice(0, limit);
}
