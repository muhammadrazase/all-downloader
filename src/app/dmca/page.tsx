import type { Metadata } from 'next';
import { PageHeader } from '@/components/PageHeader';
import { buildMetadata } from '@/lib/seo';
import { site } from '@/lib/site';

export const dynamic = 'force-static';

export const metadata: Metadata = buildMetadata({
  title: 'DMCA & Copyright Policy',
  description: 'SnapVidly DMCA policy and takedown process for copyright holders.',
  path: '/dmca',
});

export default function DmcaPage() {
  return (
    <>
      <PageHeader title="DMCA & copyright policy" subtitle="How to submit a takedown request." />
      <article className="prose-ssd mx-auto px-5 pb-16">
        <p><strong>Last updated: January 2026.</strong></p>
        <p>
          SnapVidly respects the intellectual property rights of others and expects its users to do the
          same. We do not host or store any user-downloaded content — files are fetched directly from the source
          platform. However, we take copyright seriously and will act on valid notices.
        </p>
        <h2>Filing a notice</h2>
        <p>
          If you are a copyright owner (or authorized to act on behalf of one) and believe our service is being used to
          infringe your rights, send a written notice to <a href={`mailto:${site.email}`}>{site.email}</a> including:
        </p>
        <ul>
          <li>Your contact information (name, email, address).</li>
          <li>A description of the copyrighted work you claim has been infringed.</li>
          <li>The exact URL(s) or material at issue.</li>
          <li>A statement that you have a good-faith belief the use is not authorized.</li>
          <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act.</li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <h2>Our response</h2>
        <p>
          Because we do not host content, our primary action is to block specific links or sources from being processed
          by our tool where technically feasible, and to cooperate with rights holders and platforms. We aim to respond
          to complete notices within a reasonable time.
        </p>
        <h2>Counter-notices</h2>
        <p>
          If you believe a notice was submitted in error, you may send a counter-notice to the same address with a
          detailed explanation.
        </p>
      </article>
    </>
  );
}
