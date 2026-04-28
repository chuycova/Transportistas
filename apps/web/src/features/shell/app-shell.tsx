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
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Map as MapIcon, Truck, LogOut, Route as RouteIcon, History, Settings, Users, ShieldAlert, PackagePlus, AlertTriangle, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/features/auth/auth-provider';
import { SocketInitialize } from '@/features/dashboard/socket-manager';
import { LiveMap } from '@/features/dashboard/live-map';
import { VehicleListSidebar } from '@/features/dashboard/vehicle-list-sidebar';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { NotificationBell } from '@/features/notifications/notification-popover';
import { NotificationToastContainer } from '@/features/notifications/notification-toast';

const NAV_ITEMS = [
  { href: '/',           icon: LayoutDashboard, label: 'Centro de Control', exact: true  },
  { href: '/map',        icon: MapIcon,         label: 'Mapa en vivo',      exact: true  },
  { href: '/vehicles',   icon: Truck,           label: 'Flotilla',          exact: false },
  { href: '/users',      icon: Users,           label: 'Usuarios',          exact: false },
  { href: '/routes',     icon: RouteIcon,       label: 'Rutas',             exact: false },
  { href: '/trips',      icon: PackagePlus,     label: 'Viajes',            exact: false },
  { href: '/historial',  icon: History,         label: 'Historial',         exact: false },
  { href: '/geofences',  icon: ShieldAlert,     label: 'Geocercas',         exact: false },
  { href: '/incidents',  icon: AlertTriangle,   label: 'Incidentes',        exact: false },
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

// ─── NavTooltip ───────────────────────────────────────────────────────────────
// Muestra el label del ítem después de 1s de hover, estilo VSCode.
// Aparece a la derecha del nav con un slide suave usando transiciones CSS puras.

interface NavTooltipProps {
  label: string;
  children: ReactNode;
}

function NavTooltip({ label, children }: NavTooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => setVisible(true), 500);
  };

  const handleLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {/* Tooltip label — CSS transition, no framer-motion needed */}
      <div
        aria-hidden="true"
        className="absolute left-full ml-3 z-[100] whitespace-nowrap pointer-events-none"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : 'translateX(-6px)',
          transition: 'opacity 0.14s ease, transform 0.14s ease',
        }}
      >
        {/* Arrow pointing left */}
        <span
          className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-border/70"
          aria-hidden="true"
        />
        <span
          className="absolute right-full top-1/2 -translate-y-1/2 translate-x-px border-[5px] border-transparent border-r-card"
          aria-hidden="true"
        />

        <span className="flex items-center rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-xs font-medium text-foreground shadow-xl shadow-black/10">
          {label}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: ReactNode }) {
  const { signOut }   = useAuth();
  const pathname      = usePathname();
  const unreadAlerts  = useUnreadAlertCount();
  const mapsApiKey    = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

  // El mapa persistente es visible solo en /map.
  // En '/' se muestra el dashboard de resumen (DashboardPage).
  const isMapPage = pathname === '/map';

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
            <NavTooltip key={href} label={label}>
              <Link
                href={href}
                className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" />
              </Link>
            </NavTooltip>
          );
        })}

        <div className="flex-1" />

        {/* Notificaciones — hover popover + badge + tooltip */}
        <NavTooltip label="Notificaciones">
          <NotificationBell
            isActive={pathname.startsWith('/notifications')}
            unreadCount={unreadAlerts}
          />
        </NavTooltip>

        {/* Ajustes */}
        <NavTooltip label="Ajustes generales">
          <Link
            href="/settings"
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors mb-2 ${
              pathname.startsWith('/settings')
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            aria-label="Ajustes Generales"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </NavTooltip>

        <NavTooltip label="Cerrar sesión">
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </NavTooltip>
      </nav>

      {/* ── Zona de contenido ──────────────────────────────────────────────────
          El sidebar + mapa están SIEMPRE montados pero ocultos con CSS fuera
          de "/". Así Google Maps no pierde su instancia, el WebSocket no se
          reconecta y el estado de vehículos se preserva entre navegaciones.
      ────────────────────────────────────────────────────────────────────── */}
      {/* Toast container — rendered once, fixed position, z-[9999] */}
      <NotificationToastContainer />

      <APIProvider apiKey={mapsApiKey}>
        <div className="flex flex-1 overflow-hidden relative">

          {/* Dashboard (sidebar + mapa) — siempre montado, visible solo en "/map" */}
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
      </APIProvider>
    </div>
  );
}
