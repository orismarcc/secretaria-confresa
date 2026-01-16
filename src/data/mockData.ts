import { DemandType, Settlement, Location, Producer, Service, User } from '@/types';

// Default demand types (8 categories)
export const defaultDemandTypes: DemandType[] = [
  { id: '1', name: 'Operação com Grade', description: 'Serviço de gradagem do solo', isActive: true, createdAt: new Date() },
  { id: '2', name: 'PC (Pé de Galinha)', description: 'Preparo do solo com implemento PC', isActive: true, createdAt: new Date() },
  { id: '3', name: 'Plantadeira', description: 'Serviço de plantio mecanizado', isActive: true, createdAt: new Date() },
  { id: '4', name: 'Calcário', description: 'Aplicação de calcário para correção do solo', isActive: true, createdAt: new Date() },
  { id: '5', name: 'Silagem', description: 'Produção e armazenamento de silagem', isActive: true, createdAt: new Date() },
  { id: '6', name: 'Mudas de Banana', description: 'Distribuição de mudas de banana', isActive: true, createdAt: new Date() },
  { id: '7', name: 'Mudas de Açaí', description: 'Distribuição de mudas de açaí', isActive: true, createdAt: new Date() },
  { id: '8', name: 'Outros', description: 'Outros serviços agrícolas', isActive: true, createdAt: new Date() },
];

// Sample settlements
export const sampleSettlements: Settlement[] = [
  { id: 's1', name: 'Assentamento Rio Branco', createdAt: new Date() },
  { id: 's2', name: 'Assentamento São João', createdAt: new Date() },
  { id: 's3', name: 'Assentamento Boa Esperança', createdAt: new Date() },
  { id: 's4', name: 'Assentamento Nova Vida', createdAt: new Date() },
];

// Sample locations
export const sampleLocations: Location[] = [
  { id: 'l1', name: 'Lote 1 - Setor A', settlementId: 's1', createdAt: new Date() },
  { id: 'l2', name: 'Lote 2 - Setor A', settlementId: 's1', createdAt: new Date() },
  { id: 'l3', name: 'Lote 1 - Setor B', settlementId: 's1', createdAt: new Date() },
  { id: 'l4', name: 'Comunidade Central', settlementId: 's2', createdAt: new Date() },
  { id: 'l5', name: 'Ramal do Sol', settlementId: 's2', createdAt: new Date() },
  { id: 'l6', name: 'Vicinal Norte', settlementId: 's3', createdAt: new Date() },
  { id: 'l7', name: 'Área Rural 1', settlementId: 's4', createdAt: new Date() },
];

// Sample producers
export const sampleProducers: Producer[] = [
  {
    id: 'p1',
    name: 'José da Silva',
    cpf: '123.456.789-00',
    phone: '(68) 99999-1111',
    settlementId: 's1',
    locationId: 'l1',
    demandTypeIds: ['1', '3', '4'],
    createdAt: new Date(),
  },
  {
    id: 'p2',
    name: 'Maria Santos',
    cpf: '234.567.890-11',
    phone: '(68) 99999-2222',
    settlementId: 's1',
    locationId: 'l2',
    demandTypeIds: ['2', '5'],
    createdAt: new Date(),
  },
  {
    id: 'p3',
    name: 'João Oliveira',
    cpf: '345.678.901-22',
    phone: '(68) 99999-3333',
    settlementId: 's2',
    locationId: 'l4',
    demandTypeIds: ['6', '7'],
    createdAt: new Date(),
  },
  {
    id: 'p4',
    name: 'Ana Pereira',
    cpf: '456.789.012-33',
    phone: '(68) 99999-4444',
    settlementId: 's3',
    locationId: 'l6',
    demandTypeIds: ['1', '2', '8'],
    createdAt: new Date(),
  },
];

// Sample services
export const sampleServices: Service[] = [
  {
    id: 'srv1',
    producerId: 'p1',
    demandTypeId: '1',
    settlementId: 's1',
    locationId: 'l1',
    purpose: 'Preparo do solo para plantio de milho',
    workedArea: 5.5,
    machinery: 'Trator MF 275',
    operatorName: 'Carlos Operador',
    chassisCode: 'PAT-001-2024',
    termSigned: true,
    latitude: -9.974,
    longitude: -67.810,
    status: 'pending',
    scheduledDate: new Date(Date.now() + 86400000), // Tomorrow
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
  },
  {
    id: 'srv2',
    producerId: 'p2',
    demandTypeId: '5',
    settlementId: 's1',
    locationId: 'l2',
    purpose: 'Silagem para alimentação do gado',
    workedArea: 3.0,
    machinery: 'Ensiladeira JF',
    operatorName: 'Pedro Operador',
    chassisCode: 'PAT-002-2024',
    termSigned: true,
    latitude: -9.975,
    longitude: -67.812,
    status: 'in_progress',
    scheduledDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
  },
  {
    id: 'srv3',
    producerId: 'p3',
    demandTypeId: '6',
    settlementId: 's2',
    locationId: 'l4',
    purpose: 'Distribuição de mudas para novo plantio',
    workedArea: 2.0,
    machinery: 'Caminhão 3/4',
    operatorName: 'Marcos Operador',
    chassisCode: 'PAT-003-2024',
    termSigned: false,
    status: 'completed',
    scheduledDate: new Date(Date.now() - 86400000), // Yesterday
    completedDate: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
  },
  {
    id: 'srv4',
    producerId: 'p4',
    demandTypeId: '4',
    settlementId: 's3',
    locationId: 'l6',
    purpose: 'Correção do solo com calcário',
    workedArea: 10.0,
    machinery: 'Distribuidor Vicon',
    operatorName: 'Carlos Operador',
    chassisCode: 'PAT-004-2024',
    termSigned: true,
    latitude: -9.980,
    longitude: -67.815,
    status: 'pending',
    scheduledDate: new Date(Date.now() + 172800000), // Day after tomorrow
    createdAt: new Date(),
    updatedAt: new Date(),
    syncStatus: 'synced',
  },
];

// Sample users
export const sampleUsers: User[] = [
  {
    id: 'u1',
    email: 'admin@agricultura.gov.br',
    name: 'Administrador',
    role: 'admin',
    createdAt: new Date(),
  },
  {
    id: 'u2',
    email: 'operador@agricultura.gov.br',
    name: 'Operador Campo',
    role: 'operator',
    createdAt: new Date(),
  },
];

// Demo credentials for testing
export const demoCredentials = {
  admin: { email: 'admin@agricultura.gov.br', password: 'admin123' },
  operator: { email: 'operador@agricultura.gov.br', password: 'operador123' },
};
