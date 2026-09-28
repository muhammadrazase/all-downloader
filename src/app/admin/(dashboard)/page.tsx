import { getDb } from '@/lib/db';
import { getSetting, getBoolSetting, hasDbValue } from '@/lib/config/settings.server';
import { CONTENT_KINDS, isContentEnabled } from '@/lib/config/contentConfig';
import { toggleMaintenanceModeAction, toggleAiEnabledAction } from '@/app/admin/actions';
import { getTotals } from '@/lib/analytics/queries';
import Link from 'next/link';
import { PLATFORM_LIST } from '@/lib/platforms';
import { AI_TOOL_LIST } from '@/lib/aiTools';
import { CONVERTER_LIST } from '@/lib/converterTools';
import { IMAGE_TOOL_LIST } from '@/lib/imageTools';
import { PDF_TOOL_LIST } from '@/lib/pdfTools';
import { FILE_TOOL_LIST } from '@/lib/fileTools';

const REGISTRIES: Record<string, { key: string }[]> = {
  platform: PLATFORM_LIST,
  'ai-tool': AI_TOOL_LIST,
  converter: CONVERTER_LIST,
  'image-tool': IMAGE_TOOL_LIST,
  'pdf-tool': PDF_TOOL_LIST,
  'file-tool': FILE_TOOL_LIST,
};

interface AuditRow {
  action: string;
  target: string | null;
  ip: string | null;
  at: number;
}

export default function AdminDashboardPage() {
  let total = 0;
  let hidden = 0;
  for (const { kind } of CONTENT_KINDS) {
    for (const item of REGISTRIES[kind] ?? []) {
      total++;
      if (!isContentEnabled(kind, item.key)) hidden++;
    }
  }

  const groqConfigured = Boolean(getSetting('GROQ_API_KEY'));
  const geminiConfigured = Boolean(getSetting('GEMINI_API_KEY'));
  const maintenanceMode = getBoolSetting('maintenanceMode', false);
  const aiEnabled = getBoolSetting('aiEnabled', true);
  const usingDbKeys = hasDbValue('GROQ_API_KEY') || hasDbValue('GEMINI_API_KEY');

  const visitors7d = getTotals(7).visitors;

  let recent: AuditRow[] = [];
  try {
    recent = getDb().prepare('SELECT action, target, ip, at FROM audit_log ORDER BY id DESC LIMIT 10').all() as AuditRow[];
  } catch {
    recent = [];
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-ink">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/analytics" className="block transition-opacity hover:opacity-80">
          <StatCard label="Visitors (7d)" value={visitors7d.toLocaleString()} />
        </Link>
        <StatCard label="Tools visible" value={`${total - hidden} / ${total}`} />
        <StatCard label="AI providers configured" value={[groqConfigured && 'Groq', geminiConfigured && 'Gemini'].filter(Boolean).join(' + ') || 'None'} />
        <StatCard label="Key source" value={usingDbKeys ? 'Admin panel' : 'Environment (.env)'} />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="text-lg font-semibold text-ink">Safety switches</h2>
        <ToggleRow
          label="Maintenance mode"
          hint="Redirects all public visitors to a maintenance page. The admin panel stays reachable."
          checked={maintenanceMode}
          action={toggleMaintenanceModeAction}
        />
        <ToggleRow
          label="AI features enabled"
          hint="Instantly disables transcription/summary calls without touching stored keys — a cost-runaway kill switch."
          checked={aiEnabled}
          action={toggleAiEnabledAction}
        />
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-semibold text-ink">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No admin actions recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-surface-border text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-2">
                <span className="text-ink">
                  {r.action}
                  {r.target ? <span className="text-ink-muted"> — {r.target}</span> : null}
                </span>
                <span className="shrink-0 text-xs text-ink-faint">{new Date(r.at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  action,
}: {
  label: string;
  hint: string;
  checked: boolean;
  action: () => Promise<void>;
}) {
  return (
    <form action={action} className="flex items-center justify-between gap-4 border-t border-surface-border pt-4 first:border-t-0 first:pt-0">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>
      </div>
      <button
        type="submit"
        aria-pressed={checked}
        className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          checked ? 'bg-accent text-accent-fg' : 'bg-surface-soft text-ink-muted'
        }`}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </form>
  );
}
