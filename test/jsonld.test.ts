import { describe, it, expect } from 'vitest';
import { serializeJsonLd } from '@/lib/jsonLdSerialize';

/**
 * Regression test: JSON.stringify escapes neither '<' nor '/', so a value
 * containing "</script>" (an admin-authored blog title, an SEO override, ...)
 * would close a surrounding <script> tag early and let arbitrary markup
 * follow it on a public page. serializeJsonLd must escape '<' first.
 */
describe('serializeJsonLd', () => {
  it('escapes a literal "</script>" inside a data value so it cannot close the tag early', () => {
    const html = serializeJsonLd({ headline: 'Title</script><script>alert(1)</script>' });
    expect(html).not.toContain('</script>');
    expect(html).toContain('\\u003c/script>');
    // Still valid, round-trippable JSON with the original string intact.
    expect(JSON.parse(html)).toEqual({ headline: 'Title</script><script>alert(1)</script>' });
  });

  it('renders ordinary data unchanged', () => {
    const html = serializeJsonLd({ '@type': 'WebApplication', name: 'SnapVidly' });
    expect(JSON.parse(html)).toEqual({ '@type': 'WebApplication', name: 'SnapVidly' });
  });
});
