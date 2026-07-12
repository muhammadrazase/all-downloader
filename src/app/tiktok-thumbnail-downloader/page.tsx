import type { Metadata } from 'next';
import { ImageToolPage } from '@/components/ImageToolPage';
import { IMAGE_TOOLS } from '@/lib/imageTools';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

const tool = IMAGE_TOOLS['tiktok-thumbnail'];

export const metadata: Metadata = buildMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: `/${tool.slug}`,
  keywords: [tool.keyword, 'tiktok cover download', 'tiktok cover image', 'download tiktok thumbnail', 'tiktok thumbnail grabber'],
});

export default function Page() {
  return <ImageToolPage tool={tool} />;
}
