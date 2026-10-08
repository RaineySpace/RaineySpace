import EntityRedirect from '@/app/components/EntityRedirect';
import { canonicalUrl } from '@/lib/seo';

export const metadata = { robots: { index: false, follow: true }, alternates: { canonical: canonicalUrl('/project/') } };
export default function LegacyCollection() {
  return <EntityRedirect url="/project/" title="正在打开集合" />;
}
