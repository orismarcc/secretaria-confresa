import { SyncQueueItem } from '@/types';

const SYNC_QUEUE_KEY = 'agri_sync_queue';

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

export const syncQueueStorage = {
  getAll: (): SyncQueueItem[] => getFromStorage<SyncQueueItem>(SYNC_QUEUE_KEY),
  add: (item: SyncQueueItem): void => {
    const all = syncQueueStorage.getAll();
    all.push(item);
    setToStorage(SYNC_QUEUE_KEY, all);
  },
  remove: (id: string): void => {
    const all = syncQueueStorage.getAll().filter(i => i.id !== id);
    setToStorage(SYNC_QUEUE_KEY, all);
  },
  clear: (): void => {
    setToStorage(SYNC_QUEUE_KEY, []);
  },
  getPendingCount: (): number => syncQueueStorage.getAll().length,
};

export function generateId(): string {
  return crypto.randomUUID();
}
