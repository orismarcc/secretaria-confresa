import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { 
  DemandType, Settlement, Location, Producer, Service, ServiceWithRelations, DashboardStats 
} from '@/types';
import {
  initializeStorage,
  demandTypeStorage,
  settlementStorage,
  locationStorage,
  producerStorage,
  serviceStorage,
  generateId,
} from '@/lib/storage';

interface DataContextType {
  // Data
  demandTypes: DemandType[];
  settlements: Settlement[];
  locations: Location[];
  producers: Producer[];
  services: Service[];
  
  // Stats
  stats: DashboardStats;
  
  // Demand Types CRUD
  createDemandType: (name: string, description?: string) => void;
  updateDemandType: (id: string, updates: Partial<DemandType>) => void;
  deleteDemandType: (id: string) => void;
  
  // Settlements CRUD
  createSettlement: (name: string) => void;
  updateSettlement: (id: string, updates: Partial<Settlement>) => void;
  deleteSettlement: (id: string) => void;
  
  // Locations CRUD
  createLocation: (name: string, settlementId: string) => void;
  updateLocation: (id: string, updates: Partial<Location>) => void;
  deleteLocation: (id: string) => void;
  getLocationsBySettlement: (settlementId: string) => Location[];
  
  // Producers CRUD
  createProducer: (data: Omit<Producer, 'id' | 'createdAt'>) => void;
  updateProducer: (id: string, updates: Partial<Producer>) => void;
  deleteProducer: (id: string) => void;
  searchProducers: (query: string) => Producer[];
  
  // Services CRUD
  createService: (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  deleteService: (id: string) => void;
  getServiceWithRelations: (id: string) => ServiceWithRelations | undefined;
  getPendingServices: () => ServiceWithRelations[];
  
  // Refresh
  refreshData: () => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [producers, setProducers] = useState<Producer[]>([]);
  const [services, setServices] = useState<Service[]>([]);

  const refreshData = useCallback(() => {
    setDemandTypes(demandTypeStorage.getAll());
    setSettlements(settlementStorage.getAll());
    setLocations(locationStorage.getAll());
    setProducers(producerStorage.getAll());
    setServices(serviceStorage.getAll());
  }, []);

  useEffect(() => {
    initializeStorage();
    refreshData();
  }, [refreshData]);

  // Calculate stats
  const stats: DashboardStats = {
    totalServices: services.length,
    pendingServices: services.filter(s => s.status === 'pending').length,
    inProgressServices: services.filter(s => s.status === 'in_progress').length,
    completedServices: services.filter(s => s.status === 'completed').length,
    totalProducers: producers.length,
    servicesByDemandType: demandTypes.map(dt => ({
      demandTypeId: dt.id,
      count: services.filter(s => s.demandTypeId === dt.id).length,
    })),
  };

  // Demand Types CRUD
  const createDemandType = (name: string, description?: string) => {
    const newType: DemandType = {
      id: generateId(),
      name,
      description,
      isActive: true,
      createdAt: new Date(),
    };
    demandTypeStorage.create(newType);
    refreshData();
  };

  const updateDemandType = (id: string, updates: Partial<DemandType>) => {
    demandTypeStorage.update(id, updates);
    refreshData();
  };

  const deleteDemandType = (id: string) => {
    demandTypeStorage.delete(id);
    refreshData();
  };

  // Settlements CRUD
  const createSettlement = (name: string) => {
    const newSettlement: Settlement = {
      id: generateId(),
      name,
      createdAt: new Date(),
    };
    settlementStorage.create(newSettlement);
    refreshData();
  };

  const updateSettlement = (id: string, updates: Partial<Settlement>) => {
    settlementStorage.update(id, updates);
    refreshData();
  };

  const deleteSettlement = (id: string) => {
    settlementStorage.delete(id);
    refreshData();
  };

  // Locations CRUD
  const createLocation = (name: string, settlementId: string) => {
    const newLocation: Location = {
      id: generateId(),
      name,
      settlementId,
      createdAt: new Date(),
    };
    locationStorage.create(newLocation);
    refreshData();
  };

  const updateLocation = (id: string, updates: Partial<Location>) => {
    locationStorage.update(id, updates);
    refreshData();
  };

  const deleteLocation = (id: string) => {
    locationStorage.delete(id);
    refreshData();
  };

  const getLocationsBySettlement = (settlementId: string): Location[] => {
    return locations.filter(l => l.settlementId === settlementId);
  };

  // Producers CRUD
  const createProducer = (data: Omit<Producer, 'id' | 'createdAt'>) => {
    const newProducer: Producer = {
      ...data,
      id: generateId(),
      createdAt: new Date(),
    };
    producerStorage.create(newProducer);
    refreshData();
  };

  const updateProducer = (id: string, updates: Partial<Producer>) => {
    producerStorage.update(id, updates);
    refreshData();
  };

  const deleteProducer = (id: string) => {
    producerStorage.delete(id);
    refreshData();
  };

  const searchProducers = (query: string): Producer[] => {
    if (!query.trim()) return producers;
    return producerStorage.search(query);
  };

  // Services CRUD
  const createService = (data: Omit<Service, 'id' | 'createdAt' | 'updatedAt' | 'syncStatus'>) => {
    const newService: Service = {
      ...data,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      syncStatus: 'synced',
    };
    serviceStorage.create(newService);
    refreshData();
  };

  const updateService = (id: string, updates: Partial<Service>) => {
    serviceStorage.update(id, updates);
    refreshData();
  };

  const deleteService = (id: string) => {
    serviceStorage.delete(id);
    refreshData();
  };

  const getServiceWithRelations = (id: string): ServiceWithRelations | undefined => {
    const service = services.find(s => s.id === id);
    if (!service) return undefined;
    
    return {
      ...service,
      producer: producers.find(p => p.id === service.producerId),
      demandType: demandTypes.find(d => d.id === service.demandTypeId),
      settlement: settlements.find(s => s.id === service.settlementId),
      location: locations.find(l => l.id === service.locationId),
    };
  };

  const getPendingServices = (): ServiceWithRelations[] => {
    return services
      .filter(s => s.status !== 'completed')
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .map(service => ({
        ...service,
        producer: producers.find(p => p.id === service.producerId),
        demandType: demandTypes.find(d => d.id === service.demandTypeId),
        settlement: settlements.find(s => s.id === service.settlementId),
        location: locations.find(l => l.id === service.locationId),
      }));
  };

  return (
    <DataContext.Provider value={{
      demandTypes,
      settlements,
      locations,
      producers,
      services,
      stats,
      createDemandType,
      updateDemandType,
      deleteDemandType,
      createSettlement,
      updateSettlement,
      deleteSettlement,
      createLocation,
      updateLocation,
      deleteLocation,
      getLocationsBySettlement,
      createProducer,
      updateProducer,
      deleteProducer,
      searchProducers,
      createService,
      updateService,
      deleteService,
      getServiceWithRelations,
      getPendingServices,
      refreshData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
