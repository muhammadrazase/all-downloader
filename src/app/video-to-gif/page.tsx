import type { Metadata } from 'next';
import { ConverterToolPage } from '@/components/ConverterToolPage';
import { CONVERTER_TOOLS } from '@/lib/converterTools';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';
const tool = CONVERTER_TOOLS['video-to-gif'];

export const metadata: Metadata = buildMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: `/${tool.slug}`,
  keywords: [tool.keyword, 'convert video online', 'free video converter', 'online converter', 'no upload'],
});

export default function Page() {
  return <ConverterToolPage tool={tool} />;
}
