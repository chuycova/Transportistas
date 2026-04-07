// Puerto: IAlertRepository

import type { Alert, CreateAlertInput } from '../entities/alert.entity.js';

export interface AlertFilters {
  tenantId: string;
  vehicleId?: string;
  isResolved?: boolean;
  alertType?: Alert['alertType'];
  from?: Date;
  to?: Date;
}

export interface IAlertRepository {
  findById(id: string, tenantId: string): Promise<Alert | null>;
  findMany(filters: AlertFilters): Promise<Alert[]>;
  create(input: CreateAlertInput): Promise<Alert>;
  resolve(id: string, tenantId: string, resolvedById: string, note?: string): Promise<void>;
  markNotificationSent(id: string): Promise<void>;
}
