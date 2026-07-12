/** Renders a JSON-LD block. Server component — no client JS shipped. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Schema objects are built server-side from trusted data only.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
