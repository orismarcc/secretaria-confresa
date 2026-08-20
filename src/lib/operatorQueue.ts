// Fila offline das ações do operador (Iniciar / Finalizar) com foto e GPS.
// Guarda tudo no IndexedDB (idb-keyval): se o operador perder sinal no campo,
// a ação fica pendente e é sincronizada automaticamente ao voltar a conexão.
import { get, set, del, keys, createStore } from 'idb-keyval';

// Bancos separados: o idb-keyval cria apenas UM object store por banco,
// então cada store precisa do seu próprio nome de banco.
const actionStore = createStore('agri-operator-actions-db', 'actions');
const blobStore = createStore('agri-operator-blobs-db', 'blobs');

export type OperatorActionType = 'start' | 'finish';

export interface OperatorAction {
  id: string;
  serviceId: string;
  operatorId: string | null;
  type: OperatorActionType;
  blobKey?: string;            // referência da foto no IndexedDB (se houver)
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;          // ISO — momento real da ação
}

export interface EnqueueInput {
  serviceId: string;
  operatorId: string | null;
  type: OperatorActionType;
  photoBlob?: Blob | null;
  latitude?: number | null;
  longitude?: number | null;
}

export async function enqueueOperatorAction(input: EnqueueInput): Promise<OperatorAction> {
  const id = crypto.randomUUID();
  let blobKey: string | undefined;
  if (input.photoBlob) {
    blobKey = `blob-${id}`;
    await set(blobKey, input.photoBlob, blobStore);
  }
  const action: OperatorAction = {
    id,
    serviceId: input.serviceId,
    operatorId: input.operatorId,
    type: input.type,
    blobKey,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    capturedAt: new Date().toISOString(),
  };
  await set(id, action, actionStore);
  return action;
}

export async function getPendingActions(): Promise<OperatorAction[]> {
  const ks = await keys(actionStore);
  const out: OperatorAction[] = [];
  for (const k of ks) {
    const a = await get<OperatorAction>(k as string, actionStore);
    if (a) out.push(a);
  }
  // ordem cronológica — garante Iniciar antes de Finalizar do mesmo serviço
  return out.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
}

export async function getActionBlob(blobKey: string): Promise<Blob | undefined> {
  return get<Blob>(blobKey, blobStore);
}

export async function deleteOperatorAction(action: OperatorAction): Promise<void> {
  if (action.blobKey) await del(action.blobKey, blobStore);
  await del(action.id, actionStore);
}

export async function countPendingActions(): Promise<number> {
  return (await keys(actionStore)).length;
}
