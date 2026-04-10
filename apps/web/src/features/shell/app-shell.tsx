'use client';
// ─── features/shell/app-shell.tsx ────────────────────────────────────────────
// Application shell. El LiveMap y VehicleListSidebar se montan UNA VEZ aquí
// y se ocultan con CSS cuando no estamos en "/" — esto evita que el mapa se
// destruya/reconstruya al navegar entre páginas (pérdida de estado, re-auth
// de Google Maps, re-conexión del WebSocket).
//
// SEGURIDAD: el mapa no persiste datos sensibles; solo renderiza posiciones GPS
// ya autenticadas. Ocultar con CSS es seguro — el contenido no es accesible
// para usuarios no autenticados porque AppShell solo se renderiza dentro del
// layout protegido.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map as MapIcon, Truck, LogOut, Route as RouteIcon, History, Settings, Users, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { SocketInitialize } from '@/features/dashboard/socket-manager';
import { LiveMap } from '@/features/dashboard/live-map';
import { VehicleListSidebar } from '@/features/dashboard/vehicle-list-sidebar';

const NAV_ITEMS = [
  { href: '/', icon: MapIcon, label: 'Mapa en vivo', exact: true },
  { href: '/vehicles', icon: Truck, label: 'Flotilla', exact: false },
  { href: '/users', icon: Users, label: 'Usuarios', exact: false },
  { href: '/routes', icon: RouteIcon, label: 'Rutas', exact: false },
  { href: '/historial', icon: History, label: 'Historial', exact: false },
  { href: '/geofences', icon: ShieldAlert, label: 'Geocercas', exact: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const pathname = usePathname();

  // El mapa de dashboard solo es visible en "/"
  const isMapPage = pathname === '/';

  return (
    <div className="flex bg-background w-full h-screen overflow-hidden">
      {/* Socket.io initializer — renders null, solo gestiona el ciclo WS */}
      <SocketInitialize />

      {/* Narrow icon nav */}
      <nav
        className="flex w-14 flex-col items-center gap-2 border-r border-border/50 bg-card/60 py-4 z-20 flex-shrink-0"
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

        <Link
          href="/settings"
          className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors mb-2 ${
            pathname.startsWith('/settings')
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Ajustes Generales"
          aria-label="Ajustes Generales"
        >
          <Settings className="h-5 w-5" />
        </Link>

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

      {/* ── Zona de contenido ──────────────────────────────────────────────────
          El sidebar + mapa están SIEMPRE montados pero ocultos con CSS fuera
          de "/". Así Google Maps no pierde su instancia, el WebSocket no se
          reconecta y el estado de vehículos se preserva entre navegaciones.
      ────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Dashboard (sidebar + mapa) — siempre montado, visible solo en "/" */}
        <div
          className="flex flex-1 overflow-hidden absolute inset-0 z-0"
          style={{ visibility: isMapPage ? 'visible' : 'hidden' }}
          aria-hidden={!isMapPage}
        >
          <VehicleListSidebar />
          <div className="relative flex-1">
            <LiveMap />
          </div>
        </div>

        {/* Rutas internas (/vehicles, /routes, etc.) — sobre el mapa */}
        {!isMapPage && (
          <main className="flex-1 flex flex-col overflow-hidden z-10 bg-background">
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
