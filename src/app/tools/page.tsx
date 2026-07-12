import type { Metadata } from 'next';
import { ToolsHub } from '@/components/ToolsSection';
import { PageHeader } from '@/components/PageHeader';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { JsonLd } from '@/components/JsonLd';
import { AdSlot } from '@/components/ads/AdSlot';
import { breadcrumbSchema } from '@/lib/schema';
import { buildMetadata } from '@/lib/seo';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'All Free Video Tools — AI, Converters & Thumbnails',
  description:
    'Every SnapVidly video tool in one place: AI transcript and summary, MP3/GIF converters, thumbnail grabbers, bulk downloader and the Chrome extension. Free, no signup.',
  path: '/tools',
  keywords: [
    'free online video tools',
    'all-in-one video toolkit',
    'ai video tools',
    'video converter',
    'thumbnail downloader',
    'video to text',
    'video summary',
  ],
});

const crumbs = [
  { name: 'Home', path: '/' },
  { name: 'Tools', path: '/tools' },
];

export default function ToolsPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema(crumbs)} />
      <section className="container-page pt-8">
        <Breadcrumbs items={crumbs} />
      </section>
      <PageHeader
        title="All video tools"
        subtitle="Free, no signup — transcribe, summarize, convert and grab thumbnails from any video, plus bulk downloading and the Chrome extension."
      />
      <section className="container-page pb-8">
        <ToolsHub />
      </section>
      <div className="container-page pb-16">
        <AdSlot placement="rectangle" ezoicId={112} />
      </div>
    </>
  );
}
