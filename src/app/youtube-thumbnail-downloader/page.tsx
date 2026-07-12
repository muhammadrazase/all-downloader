import type { Metadata } from 'next';
import { ImageToolPage } from '@/components/ImageToolPage';
import { IMAGE_TOOLS } from '@/lib/imageTools';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

const tool = IMAGE_TOOLS['youtube-thumbnail'];

export const metadata: Metadata = buildMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: `/${tool.slug}`,
  keywords: [tool.keyword, 'youtube thumbnail grabber', 'download youtube thumbnail', 'youtube thumbnail hd', 'get youtube thumbnail image', 'youtube maxresdefault', 'youtube cover image'],
});

export default function Page() {
  return <ImageToolPage tool={tool} />;
}
