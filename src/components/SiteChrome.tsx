'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { Sidebar, type SidebarProps } from './Sidebar';
import { SupportWidget } from './SupportWidget';
import { RememberUsWidget } from './RememberUsWidget';
// Type-only — the real getBankTransferDetails() import (settings.server.ts,
// node:fs-adjacent) must never reach this client component's bundle.
import type { BankTransferDetails } from '@/lib/bankTransfer';

// `/admin` renders its own shell. `footer` is pre-rendered JSX from the root
// layout — importing Footer here would bundle its server-only deps for the client.
export function SiteChrome({
  children,
  footer,
  maintenanceMode,
  safepayEnabled,
  bankTransfer,
  ...sidebarProps
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  maintenanceMode: boolean;
  safepayEnabled: boolean;
  bankTransfer: BankTransferDetails | null;
} & SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = pathname?.startsWith('/admin');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (maintenanceMode && !isAdmin && pathname !== '/maintenance') router.replace('/maintenance');
  }, [maintenanceMode, isAdmin, pathname, router]);

  // Close the drawer on navigation so a route change never leaves it open.
  useEffect(() => setMobileOpen(false), [pathname]);

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <Navbar mobileOpen={mobileOpen} onToggleMobile={() => setMobileOpen((v) => !v)} />
      <div className="flex flex-1 items-start">
        <Sidebar {...sidebarProps} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
        <div className="min-w-0 flex-1">
          <main id="main">{children}</main>
          {footer}
        </div>
      </div>
      <SupportWidget safepayEnabled={safepayEnabled} bankTransfer={bankTransfer} />
      <RememberUsWidget />
    </>
  );
}
