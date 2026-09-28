import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PdfToolPage } from '@/components/PdfToolPage';
import { PdfToImageBox } from '@/components/PdfToImageBox';
import { PDF_TOOLS } from '@/lib/pdfTools';
import { buildMetadata } from '@/lib/seo';
import { getSeoOverride, isContentEnabled } from '@/lib/config/contentConfig';
import { toolKeywords } from '@/lib/seoDefaults';

export const dynamic = 'force-static';
const tool = PDF_TOOLS['pdf-to-jpg'];

export async function generateMetadata(): Promise<Metadata> {
  const override = getSeoOverride('pdf-tool', tool.key);
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
  if (!isContentEnabled('pdf-tool', tool.key)) redirect('/');
  return (
    <PdfToolPage tool={tool}>
      <PdfToImageBox />
    </PdfToolPage>
  );
}
