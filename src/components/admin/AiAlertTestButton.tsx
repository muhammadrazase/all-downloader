'use client';

import { useActionState } from 'react';
import { sendTestAlertAction } from '@/app/admin/actions';

interface State {
  ok?: boolean;
  message?: string;
}

async function action(): Promise<State> {
  return sendTestAlertAction();
}

export function AiAlertTestButton() {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-surface-soft px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-border disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send test alert'}
      </button>
      {state.message && (
        <span role="status" className={`text-xs ${state.ok ? 'text-green-700' : 'text-red-700'}`}>
          {state.message}
        </span>
      )}
    </form>
  );
}
