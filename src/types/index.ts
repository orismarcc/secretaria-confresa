// =============================================================================
// types/index.ts — canonical domain types
// Updated 2026-05-26 to match current DB schema (audit M-05).
// =============================================================================

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'operator';

/** Values stored in services.status */
export type ServiceStatus = 'pending' | 'in_progress' | 'completed';

/** Demand-type categories stored in demand_types.category */
export type DemandCategory =
  | 'patrulha_mecanizada'
  | 'calcario'
  | 'logistica_insumos'
  | 'assistencia_tecnica'
  | 'entregas';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// ─── Demand Types ─────────────────────────────────────────────────────────────

export interface DemandType {
  id: string;
  name: string;
  description?: string | null;
  category?: DemandCategory | null;
  isActive: boolean;
  createdAt: Date;
}

// ─── Settlements / Locations ──────────────────────────────────────────────────

export interface Settlement {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Location {
  id: string;
  name: string;
  settlementId: string;
  createdAt: Date;
}

// ─── Producer ─────────────────────────────────────────────────────────────────

export interface Producer {
  id: string;
  name: string;
  /** CPF stored encrypted in DB; displayed via mask_cpf() */
  cpf: string;
  phone: string;
  settlementId: string;
  locationId?: string | null;
  locationName?: string | null;
  /** IDs of demand types this producer is linked to */
  demandTypeIds: string[];
  propertyName?: string | null;
  propertySize?: number | null;
  /** DAP/CAF identifier */
  dapCap?: string | null;
  caf?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isActive?: boolean;
  createdAt: Date;
}

// ─── Service (Atendimento) ────────────────────────────────────────────────────

export interface Service {
  id: string;
  producerId: string;
  demandTypeId: string;
  settlementId?: string | null;
  locationId?: string | null;
  operatorId?: string | null;
  machineryId?: string | null;
  responsibleTechnicianId?: string | null;

  // Scheduling
  scheduledDate: string; // ISO date string
  appointmentDate?: string | null; // data de agendamento
  completedAt?: string | null;
  createdAt?: string | null;

  // Details
  purpose?: string | null;
  notes?: string | null;
  completionNotes?: string | null;
  priority: 'low' | 'medium' | 'high';

  // Operational metrics (filled on finalisation)
  workedArea?: number | null; // hectares
  fuelLiters?: number | null; // combustível (L)
  workedHours?: number | null; // horas trabalhadas
  limestoneQuantity?: number | null; // calcário (ton)
  inputQuantity?: number | null; // insumos (ton)

  // DAM
  damIssued?: boolean | null;
  damIssuedAt?: string | null;
  damPaid?: boolean | null;
  damPaidAt?: string | null;
  damReceiptUrl?: string | null;

  // GPS
  latitude?: number | null;
  longitude?: number | null;

  status: ServiceStatus;
  position?: number | null;
}

/** Service with embedded join data from PostgREST `*` select */
export interface ServiceWithRelations extends Service {
  producer?: Pick<Producer, 'name' | 'cpf' | 'phone' | 'locationName' | 'latitude' | 'longitude'> | null;
  demandType?: Pick<DemandType, 'name'> | null;
  settlement?: Pick<Settlement, 'name'> | null;
  location?: Pick<Location, 'name'> | null;
  machineryInfo?: { name: string; patrimony_number: string } | null;
  responsibleTechnician?: { name: string } | null;
  createdByProfile?: { name: string } | null;
}

// ─── Photos ───────────────────────────────────────────────────────────────────

export interface ServicePhoto {
  id: string;
  serviceId: string;
  producerId: string;
  demandTypeId: string;
  localBlobKey: string;
  remoteUrl?: string | null;
  capturedAt: Date;
  syncStatus: 'pending' | 'synced' | 'error';
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalServices: number;
  pendingServices: number;
  inProgressServices: number;
  completedServices: number;
  totalProducers: number;
  servicesByDemandType: { demandTypeId: string; count: number }[];
}

// ─── Offline sync ─────────────────────────────────────────────────────────────

export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'service' | 'producer' | 'settlement' | 'location' | 'demandType';
  data: unknown;
  timestamp: Date;
  retries: number;
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ServiceFormData {
  producerId: string;
  demandTypeId: string;
  purpose?: string;
  workedArea?: number | null;
  operatorId?: string | null;
  machineryId?: string | null;
  scheduledDate: string;
  notes?: string | null;
  priority?: 'low' | 'medium' | 'high';
}
