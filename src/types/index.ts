// Enums
export type UserRole = 'admin' | 'operator';

export type ServiceStatus = 'pending' | 'in_progress' | 'completed';

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

// Demand types (categories)
export interface DemandType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

// Settlement (Assentamento)
export interface Settlement {
  id: string;
  name: string;
  createdAt: Date;
}

// Location (Localidade)
export interface Location {
  id: string;
  name: string;
  settlementId: string;
  createdAt: Date;
}

// Producer (Produtor)
export interface Producer {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  settlementId: string;
  locationId: string;
  demandTypeIds: string[]; // Categories the producer is linked to
  createdAt: Date;
}

// Service (Atendimento)
export interface Service {
  id: string;
  producerId: string;
  demandTypeId: string;
  settlementId: string;
  locationId: string;
  
  // Service details
  purpose: string; // Finalidade
  workedArea: number; // Área trabalhada (ha)
  machinery: string; // Maquinário
  operatorName: string; // Nome do operador
  chassisCode: string; // Chassi/Código do patrimônio
  termSigned: boolean; // Termo assinado
  
  // GPS
  latitude?: number;
  longitude?: number;
  
  // Status
  status: ServiceStatus;
  scheduledDate: Date;
  completedDate?: Date;
  
  // Metadata
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // For offline sync
  syncStatus?: 'synced' | 'pending' | 'error';
  localId?: string;
}

// Extended service with relations (for display)
export interface ServiceWithRelations extends Service {
  producer?: Producer;
  demandType?: DemandType;
  settlement?: Settlement;
  location?: Location;
}

// Auth context types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Dashboard stats
export interface DashboardStats {
  totalServices: number;
  pendingServices: number;
  inProgressServices: number;
  completedServices: number;
  totalProducers: number;
  servicesByDemandType: { demandTypeId: string; count: number }[];
}

// Form types
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
  purpose: string;
  workedArea: number;
  machinery: string;
  operatorName: string;
  chassisCode: string;
  termSigned: boolean;
  scheduledDate: Date;
  notes?: string;
}

// Offline sync
export interface SyncQueueItem {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'service' | 'producer' | 'settlement' | 'location' | 'demandType';
  data: unknown;
  timestamp: Date;
  retries: number;
}
