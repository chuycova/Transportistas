import {
  Controller, Get, UseGuards, NotFoundException, Logger, Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/guards/roles.guard';
import { AuthUser, type AuthenticatedUser } from '../../common/decorators/auth.decorators';
import { SUPABASE_ADMIN_CLIENT, type SupabaseAdminClient } from '../../infrastructure/supabase-admin.provider';

/**
 * Datos mínimos que el conductor necesita para navegar.
 * NUNCA se incluyen: polyline_coords completa, datos de otros vehículos,
 * información de otros conductores del tenant.
 */
interface RouteItem {
  id: string;
  name: string;
  origin_name: string;
  dest_name: string;
  status: 'draft' | 'active' | 'archived';
  total_distance_m: number | null;
  estimated_duration_s: number | null;
  deviation_threshold_m: number | null;
  waypoints: Array<{ lat: number; lng: number }>;
  stops: Array<{
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    order: number;
  }>;
}

interface DriverAssignment {
  driver: {
    id: string;
    full_name: string;
    role: 'driver';
  };
  vehicle: {
    id: string;
    plate: string;
    alias: string | null;
    color: string | null;
    vehicle_type: string;
  } | null;
  /** @deprecated Use routes[] instead. Kept for backwards compat. */
  activeRoute: RouteItem | null;
  /** Todas las rutas no archivadas asignadas al vehículo */
  routes: RouteItem[];
}

@Controller('driver')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverAssignmentController {
  private readonly logger = new Logger(DriverAssignmentController.name);

  constructor(
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly adminClient: SupabaseAdminClient,
  ) {}

  /**
   * GET /api/v1/driver/assignment
   *
   * El endpoint principal para la app móvil del conductor.
   * Devuelve SOLO lo necesario para esa sesión de conducción:
   *   - sus datos de perfil
   *   - su vehículo asignado
   *   - la ruta activa de ese vehículo con waypoints simplificados
   *
   * Solo accesible para `role = 'driver'`.
   */
  @Get('assignment')
  @Roles('driver')
  async getAssignment(@AuthUser() user: AuthenticatedUser): Promise<DriverAssignment> {
    const db = this.adminClient;

    // 1. Perfil del conductor
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      this.logger.warn(`Driver profile not found: ${user.id}`);
      throw new NotFoundException('Perfil de conductor no encontrado');
    }

    // 2. Vehículo asignado al conductor
    // Primero intenta por assigned_driver_id (conductor principal), si no
    // busca en vehicle_user_assignments (asignación múltiple).
    let vehicle: { id: string; plate: string; alias: string | null; color: string | null; vehicle_type: string } | null = null;

    const { data: vehicleByDriver, error: vehicleError } = await db
      .from('vehicles')
      .select('id, plate, alias, color, vehicle_type')
      .eq('assigned_driver_id', user.id)
      .eq('tenant_id', user.tenantId)
      .maybeSingle();

    if (vehicleError) {
      this.logger.warn(`Vehicle lookup error for driver ${user.id}: ${vehicleError.message}`);
    }

    vehicle = vehicleByDriver ?? null;

    // Si no está como conductor principal, buscar en asignaciones múltiples
    if (!vehicle) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: assignment } = await (db as any)
        .from('vehicle_user_assignments')
        .select('vehicle_id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { vehicle_id: string } | null };

      if (assignment?.vehicle_id) {
        const { data: assignedVehicle } = await db
          .from('vehicles')
          .select('id, plate, alias, color, vehicle_type')
          .eq('id', assignment.vehicle_id)
          .eq('tenant_id', user.tenantId)
          .maybeSingle();

        vehicle = assignedVehicle ?? null;
      }
    }

    if (!vehicle) {
      // Conductor sin vehículo — información válida, no es error
      return {
        driver: { id: profile.id, full_name: profile.full_name, role: 'driver' },
        vehicle: null,
        activeRoute: null,
        routes: [],
      };
    }

    // 3a. Rutas via legacy routes.vehicle_id (backward-compat)
    const { data: routesByVehicle, error: routeError } = await db
      .from('routes_with_polyline')
      .select(`
        id, name, origin_name, dest_name, status,
        total_distance_m, estimated_duration_s, deviation_threshold_m,
        polyline_coords, stops
      `)
      .eq('vehicle_id', vehicle.id)
      .in('status', ['active', 'draft'])
      .order('status', { ascending: false }); // active primero

    if (routeError) {
      this.logger.warn(`Route lookup error for vehicle ${vehicle.id}: ${routeError.message}`);
    }

    // 3b. Rutas via route_assignments (new system: assigned to this driver)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assignmentRows } = await (db as any)
      .from('route_assignments')
      .select('route_id')
      .eq('driver_id', user.id)
      .eq('is_active', true) as { data: Array<{ route_id: string }> | null };

    const assignedRouteIds = (assignmentRows ?? []).map((a) => a.route_id);

    let routesByAssignment: RawRoute[] = [];
    if (assignedRouteIds.length > 0) {
      const { data: assignedRoutes } = await db
        .from('routes_with_polyline')
        .select(`
          id, name, origin_name, dest_name, status,
          total_distance_m, estimated_duration_s, deviation_threshold_m,
          polyline_coords, stops
        `)
        .in('id', assignedRouteIds)
        .in('status', ['active', 'draft']);

      routesByAssignment = (assignedRoutes ?? []) as unknown as RawRoute[];
    }

    type RawRoute = {
      id: string;
      name: string;
      origin_name: string;
      dest_name: string;
      status: string;
      total_distance_m: number | null;
      estimated_duration_s: number | null;
      deviation_threshold_m: number | null;
      polyline_coords: [number, number][] | null;
      stops: Array<{ name: string; address?: string; lat: number; lng: number; order_index: number }> | null;
    };

    // 3c. Merge and deduplicate by route ID
    const rawByVehicle = (routesByVehicle ?? []) as unknown as RawRoute[];
    const seenIds = new Set<string>();
    const rawList: RawRoute[] = [];
    for (const r of [...rawByVehicle, ...routesByAssignment]) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        rawList.push(r);
      }
    }

    // 4. Trips activamente en curso para este conductor.
    //    Solo excluimos rutas con un viaje en marcha (in_transit o at_destination) —
    //    así el conductor no puede iniciar la misma ruta dos veces simultáneamente.
    //    Las rutas completadas NO se excluyen: el supervisor puede reasignarlas
    //    cuando quiera y el conductor puede volver a hacerlas en cualquier momento.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: blockedTrips } = await (db as any)
      .from('trips')
      .select('route_id, status')
      .eq('driver_id', user.id)
      .in('status', ['in_transit', 'at_destination']) as { data: Array<{ route_id: string | null; status: string }> | null };

    const blockedRouteIds = new Set(
      (blockedTrips ?? [])
        .map((t) => t.route_id)
        .filter(Boolean) as string[],
    );

    if (blockedRouteIds.size > 0) {
      this.logger.log(
        `Driver ${user.id}: blocked route IDs (trip in progress): ${[...blockedRouteIds].join(', ')}`,
      );
    }


    const parseRoute = (route: RawRoute): RouteItem => {
      const rawPolyline = (route.polyline_coords ?? []) as [number, number][];
      const waypoints = rawPolyline
        .filter((_, i) => i % 3 === 0)
        .map(([lng, lat]) => ({ lat, lng }));
      const rawStops = Array.isArray(route.stops) ? route.stops : [];
      const stops = (rawStops as Array<{ name: string; address?: string; lat: number; lng: number; order_index: number }>)
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({ name: s.name, address: s.address ?? null, lat: s.lat, lng: s.lng, order: s.order_index }));
      return {
        id: route.id,
        name: route.name,
        origin_name: route.origin_name,
        dest_name: route.dest_name,
        status: route.status as 'draft' | 'active' | 'archived',
        total_distance_m: route.total_distance_m,
        estimated_duration_s: route.estimated_duration_s,
        deviation_threshold_m: route.deviation_threshold_m,
        waypoints,
        stops,
      };
    };

    // Solo devolver rutas que no están bloqueadas por un trip activo
    const routes = rawList
      .filter((r) => !blockedRouteIds.has(r.id))
      .map(parseRoute);

    const activeRoute = routes.find((r) => r.status === 'active') ?? null;

    if (activeRoute) {
      this.logger.log(
        `Driver ${user.id} → vehicle ${vehicle.id} → ${routes.length} routes ` +
        `(active: "${activeRoute.name}", ${activeRoute.waypoints.length} waypts)`,
      );
    }

    return {
      driver: { id: profile.id, full_name: profile.full_name, role: 'driver' },
      vehicle: {
        id: vehicle.id,
        plate: vehicle.plate,
        alias: vehicle.alias,
        color: vehicle.color,
        vehicle_type: vehicle.vehicle_type,
      },
      activeRoute,
      routes,
    };
  }
}

