import { cachedJson } from '@/lib/apiCache';
import { CONTENT_KINDS, filterVisible, type ContentKind } from '@/lib/config/contentConfig';
import { site } from '@/lib/site';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';

export const revalidate = 3600; // fallback; admin toggles revalidate this path on demand

interface RegistryItem {
  key: string;
  name: string;
  slug: string;
}

const REGISTRIES: Record<ContentKind, RegistryItem[]> = {
  platform: PLATFORM_LIST,
  'ai-tool': AI_TOOL_LIST,
  converter: CONVERTER_LIST,
  'image-tool': IMAGE_TOOL_LIST,
  'pdf-tool': PDF_TOOL_LIST,
  'file-tool': FILE_TOOL_LIST,
  'blog-post': [],
};

export async function GET() {
  const tools = CONTENT_KINDS.flatMap(({ kind }) =>
    filterVisible(kind, REGISTRIES[kind], (t) => t.key).map((t) => ({
      kind,
      key: t.key,
      name: t.name,
      path: `/${t.slug}`,
      url: `${site.url}/${t.slug}`,
    })),
  );
  return cachedJson({ updatedAt: new Date().toISOString(), count: tools.length, tools });
}
