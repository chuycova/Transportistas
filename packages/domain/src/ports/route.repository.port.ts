// Puerto: IRouteRepository

import type { Route, CreateRouteInput, RouteStatus } from '../entities/route.entity.js';

export interface RouteFilters {
  tenantId: string;
  status?: RouteStatus;
  vehicleId?: string;
}

export interface IRouteRepository {
  findById(id: string, tenantId: string): Promise<Route | null>;
  findMany(filters: RouteFilters): Promise<Route[]>;
  create(input: CreateRouteInput): Promise<Route>;
  update(id: string, tenantId: string, input: Partial<CreateRouteInput>): Promise<Route>;
  updateStatus(id: string, tenantId: string, status: RouteStatus): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
