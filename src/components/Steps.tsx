/** Numbered how-to steps. Server-rendered; pairs with HowTo JSON-LD. */
export function Steps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="card p-6">
      <h3 className="text-xl">{title}</h3>
      <ol className="mt-5 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent">
              {i + 1}
            </span>
            <span className="pt-0.5 text-ink-muted">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
