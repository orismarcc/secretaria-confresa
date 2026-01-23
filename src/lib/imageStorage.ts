import { get, set, del, keys, createStore } from 'idb-keyval';
import { ServicePhoto } from '@/types';
import { generateId } from './storage';

// Create dedicated stores for images and photo metadata
const imageStore = createStore('agri-images-db', 'images');
const photoMetaStore = createStore('agri-photos-db', 'photo-metadata');

// Save a photo blob to IndexedDB
export async function savePhotoBlob(
  blob: Blob,
  serviceId: string,
  producerId: string,
  demandTypeId: string
): Promise<ServicePhoto> {
  const photoId = generateId();
  const blobKey = `photo-${photoId}`;
  
  // Save the actual blob
  await set(blobKey, blob, imageStore);
  
  // Create and save metadata
  const photo: ServicePhoto = {
    id: photoId,
    serviceId,
    producerId,
    demandTypeId,
    localBlobKey: blobKey,
    capturedAt: new Date(),
    syncStatus: 'pending',
  };
  
  await set(photoId, photo, photoMetaStore);
  
  return photo;
}

// Get a photo blob from IndexedDB
export async function getPhotoBlob(blobKey: string): Promise<Blob | undefined> {
  return get<Blob>(blobKey, imageStore);
}

// Get photo as object URL for display
export async function getPhotoUrl(blobKey: string): Promise<string | null> {
  const blob = await getPhotoBlob(blobKey);
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

// Get photo metadata by ID
export async function getPhotoMeta(photoId: string): Promise<ServicePhoto | undefined> {
  return get<ServicePhoto>(photoId, photoMetaStore);
}

// Get all photos for a specific service
export async function getPhotosByService(serviceId: string): Promise<ServicePhoto[]> {
  const allKeys = await keys(photoMetaStore);
  const photos: ServicePhoto[] = [];
  
  for (const key of allKeys) {
    const photo = await get<ServicePhoto>(key, photoMetaStore);
    if (photo && photo.serviceId === serviceId) {
      photos.push(photo);
    }
  }
  
  return photos;
}

// Get all pending photos (for sync)
export async function getPendingPhotos(): Promise<ServicePhoto[]> {
  const allKeys = await keys(photoMetaStore);
  const pending: ServicePhoto[] = [];
  
  for (const key of allKeys) {
    const photo = await get<ServicePhoto>(key, photoMetaStore);
    if (photo && photo.syncStatus === 'pending') {
      pending.push(photo);
    }
  }
  
  return pending;
}

// Update photo sync status
export async function updatePhotoSyncStatus(
  photoId: string,
  syncStatus: 'pending' | 'synced' | 'error',
  remoteUrl?: string
): Promise<void> {
  const photo = await getPhotoMeta(photoId);
  if (photo) {
    photo.syncStatus = syncStatus;
    if (remoteUrl) {
      photo.remoteUrl = remoteUrl;
    }
    await set(photoId, photo, photoMetaStore);
  }
}

// Delete a photo (both blob and metadata)
export async function deletePhoto(photoId: string): Promise<void> {
  const photo = await getPhotoMeta(photoId);
  if (photo) {
    await del(photo.localBlobKey, imageStore);
    await del(photoId, photoMetaStore);
  }
}

// Get count of pending photos
export async function getPendingPhotosCount(): Promise<number> {
  const pending = await getPendingPhotos();
  return pending.length;
}

// Clean up synced photos older than X days (optional, for storage management)
export async function cleanupSyncedPhotos(daysOld: number = 30): Promise<number> {
  const allKeys = await keys(photoMetaStore);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  let deletedCount = 0;
  
  for (const key of allKeys) {
    const photo = await get<ServicePhoto>(key, photoMetaStore);
    if (
      photo &&
      photo.syncStatus === 'synced' &&
      new Date(photo.capturedAt) < cutoffDate
    ) {
      await deletePhoto(photo.id);
      deletedCount++;
    }
  }
  
  return deletedCount;
}
