import { getPublicPosts } from '@/lib/posts';
import { llmsText } from '@/lib/seo';

export const dynamic = 'force-static';

export async function GET() {
  return new Response(llmsText(await getPublicPosts()), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
