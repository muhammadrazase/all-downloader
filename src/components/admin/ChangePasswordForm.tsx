'use client';

import { useActionState } from 'react';
import { changePasswordAction } from '@/app/admin/actions';

interface State {
  error?: string;
  success?: boolean;
}

async function action(_prev: State, formData: FormData): Promise<State> {
  const result = await changePasswordAction(formData);
  return result.error ? { error: result.error } : { success: true };
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm">
        <span className="text-ink-muted">New password (min 12 characters)</span>
        <input
          type="password"
          name="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Confirm new password</span>
        <input
          type="password"
          name="confirm"
          required
          minLength={12}
          autoComplete="new-password"
          className="mt-1 w-full rounded-lg border border-surface-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Password changed. Every other session has been signed out.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:opacity-90 disabled:opacity-60"
      >
        {pending ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
