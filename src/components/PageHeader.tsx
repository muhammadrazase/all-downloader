export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <section className="container-page py-12 text-center">
      <h1 className="mx-auto max-w-3xl text-4xl font-bold text-ink">{title}</h1>
      {subtitle && <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">{subtitle}</p>}
    </section>
  );
}
