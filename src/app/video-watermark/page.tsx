import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ConverterToolPage } from '@/components/ConverterToolPage';
import { WatermarkBox } from '@/components/WatermarkBox';
import { CONVERTER_TOOLS } from '@/lib/converterTools';
import { buildMetadata } from '@/lib/seo';
import { getSeoOverride, isContentEnabled } from '@/lib/config/contentConfig';
import { toolKeywords } from '@/lib/seoDefaults';

export const dynamic = 'force-static';
const tool = CONVERTER_TOOLS['video-watermark'];

export async function generateMetadata(): Promise<Metadata> {
  const override = getSeoOverride('converter', tool.key);
  return buildMetadata({
    title: override?.title || tool.metaTitle,
    description: override?.description || tool.metaDescription,
    path: override?.canonical || `/${tool.slug}`,
    noindex: override?.noindex,
    image: override?.ogImage,
    keywords: override?.keywords || toolKeywords(tool.key, tool.keyword),
  });
}

export default function Page() {
  if (!isContentEnabled('converter', tool.key)) redirect('/');
  return (
    <ConverterToolPage tool={tool}>
      <WatermarkBox />
    </ConverterToolPage>
  );
}
