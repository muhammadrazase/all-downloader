import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FileToolPage } from '@/components/FileToolPage';
import { QrScannerBox } from '@/components/QrScannerBox';
import { FILE_TOOLS } from '@/lib/fileTools';
import { buildMetadata } from '@/lib/seo';
import { getSeoOverride, isContentEnabled } from '@/lib/config/contentConfig';
import { toolKeywords } from '@/lib/seoDefaults';

export const dynamic = 'force-static';
const tool = FILE_TOOLS['qr-code-scanner'];

export async function generateMetadata(): Promise<Metadata> {
  const override = getSeoOverride('file-tool', tool.key);
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
  if (!isContentEnabled('file-tool', tool.key)) redirect('/');
  return (
    <FileToolPage tool={tool}>
      <QrScannerBox />
    </FileToolPage>
  );
}
