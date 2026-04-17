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
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map as MapIcon, Truck, LogOut, Route as RouteIcon, History, Settings, Users, ShieldAlert, Bell, PackagePlus, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { SocketInitialize } from '@/features/dashboard/socket-manager';
import { LiveMap } from '@/features/dashboard/live-map';
import { VehicleListSidebar } from '@/features/dashboard/vehicle-list-sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/',           icon: MapIcon,    label: 'Mapa en vivo', exact: true },
  { href: '/vehicles',   icon: Truck,       label: 'Flotilla',     exact: false },
  { href: '/users',      icon: Users,       label: 'Usuarios',     exact: false },
  { href: '/routes',     icon: RouteIcon,    label: 'Rutas',        exact: false },
  { href: '/trips',      icon: PackagePlus, label: 'Viajes',       exact: false },
  { href: '/historial',  icon: History,     label: 'Historial',    exact: false },
  { href: '/geofences',  icon: ShieldAlert,   label: 'Geocercas',  exact: false },
  { href: '/incidents',  icon: AlertTriangle, label: 'Incidentes', exact: false },
];

// ─── Hook: badge de notificaciones ───────────────────────────────────────────
// Cuenta alertas no resueltas del tenant actual en tiempo real.

function useUnreadAlertCount(): number {
  const supabase = createSupabaseBrowserClient();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let tenantId: string | undefined;

    const fetchCount = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      tenantId = session?.user?.user_metadata?.tenant_id as string | undefined;
      if (!tenantId) return;

      const { count: c } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('is_resolved', false);

      setCount(c ?? 0);
    };

    void fetchCount();

    // Suscripción realtime para mantener el badge actualizado
    const channel = supabase
      .channel('shell-alert-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'alerts',
      }, () => { void fetchCount(); })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [supabase]);

  return count;
}

// ─────────────────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut }   = useAuth();
  const pathname      = usePathname();
  const unreadAlerts  = useUnreadAlertCount();

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

        {/* Notificaciones — con badge de conteo encima de Ajustes */}
        <Link
          href="/notifications"
          className={`relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors mb-1 ${
            pathname.startsWith('/notifications')
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
          title="Notificaciones"
          aria-label="Notificaciones"
        >
          <Bell className="h-5 w-5" />
          {unreadAlerts > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white leading-none">
              {unreadAlerts > 9 ? '9+' : unreadAlerts}
            </span>
          )}
        </Link>

        {/* Ajustes */}
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
