import type { Metadata } from 'next';
import { ConverterToolPage } from '@/components/ConverterToolPage';
import { CONVERTER_TOOLS } from '@/lib/converterTools';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';
const tool = CONVERTER_TOOLS['video-to-mp3'];

export const metadata: Metadata = buildMetadata({
  title: tool.metaTitle,
  description: tool.metaDescription,
  path: `/${tool.slug}`,
  keywords: [tool.keyword, 'extract audio from video', 'youtube to mp3', 'video to mp3 online free', 'convert video to mp3 free', 'no upload'],
});

export default function Page() {
  return <ConverterToolPage tool={tool} />;
}
