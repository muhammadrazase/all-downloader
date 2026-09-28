interface SettingFieldProps {
  label: string;
  name: string;
  hint?: string;
  configured?: boolean;
  secret?: boolean;
  defaultValue?: string;
}

// Secrets are write-only: input stays blank, shows a "configured" badge + Clear checkbox instead.
export function SettingField({ label, name, hint, configured, secret, defaultValue }: SettingFieldProps) {
  return (
    <label className="block text-sm">
      <span className="flex items-center gap-2 text-ink-muted">
        {label}
        {secret && configured && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">configured</span>
        )}
      </span>
      <input
        name={name}
        type={secret ? 'password' : 'text'}
        placeholder={secret ? (configured ? 'Leave blank to keep the current value' : 'Not set') : undefined}
        defaultValue={secret ? undefined : defaultValue}
        autoComplete="off"
        className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
      {secret && configured && (
        <span className="mt-1 flex items-center gap-1.5 text-xs text-ink-faint">
          <input type="checkbox" name={`clear_${name}`} className="h-3.5 w-3.5 rounded border-surface-border" />
          Clear this value
        </span>
      )}
    </label>
  );
}
