import { DemandType, Settlement, Location, Producer, Service, SyncQueueItem } from '@/types';
import { defaultDemandTypes, sampleSettlements, sampleLocations, sampleProducers, sampleServices } from '@/data/mockData';

const STORAGE_KEYS = {
  DEMAND_TYPES: 'agri_demand_types',
  SETTLEMENTS: 'agri_settlements',
  LOCATIONS: 'agri_locations',
  PRODUCERS: 'agri_producers',
  SERVICES: 'agri_services',
  SYNC_QUEUE: 'agri_sync_queue',
  AUTH_USER: 'agri_auth_user',
};

// Initialize with default data if empty
export function initializeStorage(): void {
  if (!localStorage.getItem(STORAGE_KEYS.DEMAND_TYPES)) {
    localStorage.setItem(STORAGE_KEYS.DEMAND_TYPES, JSON.stringify(defaultDemandTypes));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTLEMENTS)) {
    localStorage.setItem(STORAGE_KEYS.SETTLEMENTS, JSON.stringify(sampleSettlements));
  }
  if (!localStorage.getItem(STORAGE_KEYS.LOCATIONS)) {
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(sampleLocations));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCERS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCERS, JSON.stringify(sampleProducers));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(sampleServices));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SYNC_QUEUE)) {
    localStorage.setItem(STORAGE_KEYS.SYNC_QUEUE, JSON.stringify([]));
  }
}

// Generic get/set functions
function getFromStorage<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function setToStorage<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Demand Types
export const demandTypeStorage = {
  getAll: (): DemandType[] => getFromStorage<DemandType>(STORAGE_KEYS.DEMAND_TYPES),
  getById: (id: string): DemandType | undefined => 
    demandTypeStorage.getAll().find(d => d.id === id),
  create: (demandType: DemandType): void => {
    const all = demandTypeStorage.getAll();
    all.push(demandType);
    setToStorage(STORAGE_KEYS.DEMAND_TYPES, all);
  },
  update: (id: string, updates: Partial<DemandType>): void => {
    const all = demandTypeStorage.getAll();
    const index = all.findIndex(d => d.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates };
      setToStorage(STORAGE_KEYS.DEMAND_TYPES, all);
    }
  },
  delete: (id: string): void => {
    const all = demandTypeStorage.getAll().filter(d => d.id !== id);
    setToStorage(STORAGE_KEYS.DEMAND_TYPES, all);
  },
};

// Settlements
export const settlementStorage = {
  getAll: (): Settlement[] => getFromStorage<Settlement>(STORAGE_KEYS.SETTLEMENTS),
  getById: (id: string): Settlement | undefined => 
    settlementStorage.getAll().find(s => s.id === id),
  create: (settlement: Settlement): void => {
    const all = settlementStorage.getAll();
    all.push(settlement);
    setToStorage(STORAGE_KEYS.SETTLEMENTS, all);
  },
  update: (id: string, updates: Partial<Settlement>): void => {
    const all = settlementStorage.getAll();
    const index = all.findIndex(s => s.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates };
      setToStorage(STORAGE_KEYS.SETTLEMENTS, all);
    }
  },
  delete: (id: string): void => {
    const all = settlementStorage.getAll().filter(s => s.id !== id);
    setToStorage(STORAGE_KEYS.SETTLEMENTS, all);
  },
};

// Locations
export const locationStorage = {
  getAll: (): Location[] => getFromStorage<Location>(STORAGE_KEYS.LOCATIONS),
  getById: (id: string): Location | undefined => 
    locationStorage.getAll().find(l => l.id === id),
  getBySettlement: (settlementId: string): Location[] => 
    locationStorage.getAll().filter(l => l.settlementId === settlementId),
  create: (location: Location): void => {
    const all = locationStorage.getAll();
    all.push(location);
    setToStorage(STORAGE_KEYS.LOCATIONS, all);
  },
  update: (id: string, updates: Partial<Location>): void => {
    const all = locationStorage.getAll();
    const index = all.findIndex(l => l.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates };
      setToStorage(STORAGE_KEYS.LOCATIONS, all);
    }
  },
  delete: (id: string): void => {
    const all = locationStorage.getAll().filter(l => l.id !== id);
    setToStorage(STORAGE_KEYS.LOCATIONS, all);
  },
};

// Producers
export const producerStorage = {
  getAll: (): Producer[] => getFromStorage<Producer>(STORAGE_KEYS.PRODUCERS),
  getById: (id: string): Producer | undefined => 
    producerStorage.getAll().find(p => p.id === id),
  search: (query: string): Producer[] => {
    const all = producerStorage.getAll();
    const lowerQuery = query.toLowerCase();
    return all.filter(p => 
      p.name.toLowerCase().includes(lowerQuery) || 
      p.cpf.includes(query)
    );
  },
  create: (producer: Producer): void => {
    const all = producerStorage.getAll();
    all.push(producer);
    setToStorage(STORAGE_KEYS.PRODUCERS, all);
  },
  update: (id: string, updates: Partial<Producer>): void => {
    const all = producerStorage.getAll();
    const index = all.findIndex(p => p.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates };
      setToStorage(STORAGE_KEYS.PRODUCERS, all);
    }
  },
  delete: (id: string): void => {
    const all = producerStorage.getAll().filter(p => p.id !== id);
    setToStorage(STORAGE_KEYS.PRODUCERS, all);
  },
};

// Services
export const serviceStorage = {
  getAll: (): Service[] => getFromStorage<Service>(STORAGE_KEYS.SERVICES),
  getById: (id: string): Service | undefined => 
    serviceStorage.getAll().find(s => s.id === id),
  getByStatus: (status: Service['status']): Service[] => 
    serviceStorage.getAll().filter(s => s.status === status),
  getPending: (): Service[] => 
    serviceStorage.getAll()
      .filter(s => s.status !== 'completed')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()),
  create: (service: Service): void => {
    const all = serviceStorage.getAll();
    all.push(service);
    setToStorage(STORAGE_KEYS.SERVICES, all);
  },
  update: (id: string, updates: Partial<Service>): void => {
    const all = serviceStorage.getAll();
    const index = all.findIndex(s => s.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates, updatedAt: new Date() };
      setToStorage(STORAGE_KEYS.SERVICES, all);
    }
  },
  delete: (id: string): void => {
    const all = serviceStorage.getAll().filter(s => s.id !== id);
    setToStorage(STORAGE_KEYS.SERVICES, all);
  },
};

// Sync Queue
export const syncQueueStorage = {
  getAll: (): SyncQueueItem[] => getFromStorage<SyncQueueItem>(STORAGE_KEYS.SYNC_QUEUE),
  add: (item: SyncQueueItem): void => {
    const all = syncQueueStorage.getAll();
    all.push(item);
    setToStorage(STORAGE_KEYS.SYNC_QUEUE, all);
  },
  remove: (id: string): void => {
    const all = syncQueueStorage.getAll().filter(i => i.id !== id);
    setToStorage(STORAGE_KEYS.SYNC_QUEUE, all);
  },
  clear: (): void => {
    setToStorage(STORAGE_KEYS.SYNC_QUEUE, []);
  },
  getPendingCount: (): number => syncQueueStorage.getAll().length,
};

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
