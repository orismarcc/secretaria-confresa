// Fila offline das ações do operador (Iniciar / Entrega / Finalizar) com foto e GPS.
// Guarda tudo no IndexedDB (idb-keyval): se o operador perder sinal no campo,
// a ação fica pendente e é sincronizada automaticamente ao voltar a conexão.
import { get, set, del, keys, createStore } from 'idb-keyval';

// Bancos separados: o idb-keyval cria apenas UM object store por banco,
// então cada store precisa do seu próprio nome de banco.
const actionStore = createStore('agri-operator-actions-db', 'actions');
const blobStore = createStore('agri-operator-blobs-db', 'blobs');

// 'load' = etapa "Entrega" da logística: foto do carregamento + GPS do local.
export type OperatorActionType = 'start' | 'load' | 'finish';

export interface OperatorAction {
  id: string;
  serviceId: string;
  operatorId: string | null;
  type: OperatorActionType;
  blobKey?: string;            // foto principal (finish: término; load: carregamento; start: —)
  startBlobKey?: string;       // no finalizar: foto de INÍCIO do serviço (opcional)
  latitude: number | null;
  longitude: number | null;
  capturedAt: string;          // ISO — momento real da ação
}

export interface EnqueueInput {
  serviceId: string;
  operatorId: string | null;
  type: OperatorActionType;
  photoBlob?: Blob | null;         // finish: foto de término; load: foto do carregamento
  startPhotoBlob?: Blob | null;    // finish: foto de início (opcional)
  latitude?: number | null;
  longitude?: number | null;
}

export async function enqueueOperatorAction(input: EnqueueInput): Promise<OperatorAction> {
  const id = crypto.randomUUID();
  // Guardamos a imagem como ArrayBuffer (não como Blob): em vários navegadores
  // Android, Blobs no IndexedDB podem se invalidar entre sessões — a foto some
  // e o upload "não acontece" mesmo tendo sido inserida. ArrayBuffer é estável.
  let blobKey: string | undefined;
  if (input.photoBlob) {
    blobKey = `blob-${id}`;
    await set(blobKey, await input.photoBlob.arrayBuffer(), blobStore);
  }
  let startBlobKey: string | undefined;
  if (input.startPhotoBlob) {
    startBlobKey = `blob-${id}-start`;
    await set(startBlobKey, await input.startPhotoBlob.arrayBuffer(), blobStore);
  }
  const action: OperatorAction = {
    id,
    serviceId: input.serviceId,
    operatorId: input.operatorId,
    type: input.type,
    blobKey,
    startBlobKey,
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
  const stored = await get<ArrayBuffer | Blob>(blobKey, blobStore);
  if (!stored) return undefined;
  // Novo formato: ArrayBuffer -> reconstrói o Blob. Compatível com o formato
  // antigo (Blob), caso haja alguma ação pendente gravada antes desta mudança.
  if (stored instanceof Blob) return stored;
  return new Blob([stored], { type: 'image/jpeg' });
}

export async function deleteOperatorAction(action: OperatorAction): Promise<void> {
  if (action.blobKey) await del(action.blobKey, blobStore);
  if (action.startBlobKey) await del(action.startBlobKey, blobStore);
  await del(action.id, actionStore);
}

export async function countPendingActions(): Promise<number> {
  return (await keys(actionStore)).length;
}
