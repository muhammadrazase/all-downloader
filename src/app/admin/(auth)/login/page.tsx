import { LoginForm } from '@/components/admin/LoginForm';

export default function AdminLoginPage() {
  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-ink">SnapVidly Admin</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to manage the site.</p>
      </div>
      <LoginForm />
    </>
  );
}
