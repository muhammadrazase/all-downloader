import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AiToolPage } from '@/components/AiToolPage';
import { AI_TOOLS } from '@/lib/aiTools';
import { buildMetadata } from '@/lib/seo';
import { getSeoOverride, isContentEnabled } from '@/lib/config/contentConfig';

export const dynamic = 'force-static';
const tool = AI_TOOLS['video-to-text'];

export async function generateMetadata(): Promise<Metadata> {
  const override = getSeoOverride('ai-tool', tool.key);
  return buildMetadata({
    title: override?.title || tool.metaTitle,
    description: override?.description || tool.metaDescription,
    path: override?.canonical || `/${tool.slug}`,
    noindex: override?.noindex,
    image: override?.ogImage,
    keywords: override?.keywords || tool.keywords,
  });
}

export default function Page() {
  if (!isContentEnabled('ai-tool', tool.key)) redirect('/');
  return <AiToolPage tool={tool} />;
}
