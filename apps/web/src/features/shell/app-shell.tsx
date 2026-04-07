'use client';
// ─── features/shell/app-shell.tsx ────────────────────────────────────────────
// Application shell with icon navigation sidebar.
// Migrated from App.tsx (was react-router NavLink, now uses next/link).
// Also initializes the Socket.io real-time connection.

import { type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map as MapIcon, Truck, LogOut, Route as RouteIcon, History } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { SocketInitialize } from '@/features/dashboard/socket-manager';

const NAV_ITEMS = [
  { href: '/', icon: MapIcon, label: 'Mapa en vivo', exact: true },
  { href: '/vehicles', icon: Truck, label: 'Flotilla', exact: false },
  { href: '/routes', icon: RouteIcon, label: 'Rutas', exact: false },
  { href: '/historial', icon: History, label: 'Historial', exact: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const pathname = usePathname();

  return (
    <div className="flex bg-background w-full h-screen overflow-hidden">
      {/* Socket.io initializer — renders null, only manages WS lifecycle */}
      <SocketInitialize />

      {/* Narrow icon nav */}
      <nav
        className="flex w-14 flex-col items-center gap-2 border-r border-border/50 bg-card/60 py-4 z-20"
        aria-label="Navegación principal"
      >
        <Link
          href="/"
          className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white text-xs font-black shadow-lg"
          aria-label="Inicio"
        >
          Z
        </Link>

        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={label}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}

        <div className="flex-1" />

        <button
          type="button"
          onClick={signOut}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </nav>

      {/* Page content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
