import type { Metadata } from 'next';
import { AiToolPage } from '@/components/AiToolPage';
import { AI_TOOLS } from '@/lib/aiTools';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';
const tool = AI_TOOLS['video-summary'];

export const metadata: Metadata = buildMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: `/${tool.slug}`,
  keywords: tool.keywords,
});

export default function Page() {
  return <AiToolPage tool={tool} />;
}
