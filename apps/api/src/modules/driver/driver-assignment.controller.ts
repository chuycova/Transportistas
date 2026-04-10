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
  activeRoute: {
    id: string;
    name: string;
    origin_name: string;
    dest_name: string;
    total_distance_m: number | null;
    estimated_duration_s: number | null;
    deviation_threshold_m: number | null;
    /** Polyline simplificada para el conductor — solo coordenadas, sin metadatos */
    waypoints: Array<{ lat: number; lng: number }>;
    stops: Array<{
      name: string;
      address: string | null;
      lat: number;
      lng: number;
      order: number;
    }>;
  } | null;
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
      };
    }

    // 3. Ruta activa del vehículo (si existe)
    // Consultamos routes_with_polyline (view) porque expone polyline_coords
    // como columna — la tabla routes guarda la geometría en formato geography
    // y el cliente JS no puede leerla directamente.
    const { data: routeRaw, error: routeError } = await db
      .from('routes_with_polyline')
      .select(`
        id, name, origin_name, dest_name,
        total_distance_m, estimated_duration_s, deviation_threshold_m,
        polyline_coords, stops
      `)
      .eq('vehicle_id', vehicle.id)
      .eq('status', 'active')
      .maybeSingle();

    // Casteamos a unknown primero para evitar el error del tipo generado de Supabase,
    // que no incluye routes_with_polyline en el schema por defecto.
    const route = routeRaw as unknown as {
      id: string;
      name: string;
      origin_name: string;
      dest_name: string;
      total_distance_m: number | null;
      estimated_duration_s: number | null;
      deviation_threshold_m: number | null;
      polyline_coords: [number, number][] | null;
      stops: Array<{ name: string; address?: string; lat: number; lng: number; order_index: number }> | null;
    } | null;

    if (routeError) {
      this.logger.warn(`Route lookup error for vehicle ${vehicle.id}: ${routeError.message}`);
    }

    let activeRoute: DriverAssignment['activeRoute'] = null;

    if (route) {
      // Convertir polyline_coords [lng, lat][] → { lat, lng }[]
      // Se entrega simplificada (cada 3er punto) para reducir payload en móvil
      const rawPolyline = (route.polyline_coords ?? []) as [number, number][];
      const waypoints = rawPolyline
        .filter((_, i) => i % 3 === 0) // simplificar: 1 de cada 3 puntos
        .map(([lng, lat]) => ({ lat, lng }));

      // Paradas ordenadas sin datos internos (sin tenant_id, sin route_id)
      // route.stops puede llegar como objeto o null desde Supabase JSON — normalizar a array
      const rawStops = Array.isArray(route.stops) ? route.stops : [];
      const stops = (rawStops as Array<{
        name: string;
        address?: string;
        lat: number;
        lng: number;
        order_index: number;
      }>)
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          name: s.name,
          address: s.address ?? null,
          lat: s.lat,
          lng: s.lng,
          order: s.order_index,
        }));

      activeRoute = {
        id: route.id,
        name: route.name,
        origin_name: route.origin_name,
        dest_name: route.dest_name,
        total_distance_m: route.total_distance_m,
        estimated_duration_s: route.estimated_duration_s,
        deviation_threshold_m: route.deviation_threshold_m,
        waypoints,
        stops,
      };

      this.logger.log(
        `Driver ${user.id} → vehicle ${vehicle.id} → route "${route.name}" ` +
        `(${waypoints.length} waypts, ${stops.length} stops)`,
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
    };
  }
}
