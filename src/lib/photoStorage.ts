import { supabase } from '@/integrations/supabase/client';

/**
 * Get a signed URL for a photo stored in the private service-photos bucket.
 * URLs expire after 1 hour for security.
 */
export async function getSignedPhotoUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) return null;
  
  const { data, error } = await supabase.storage
    .from('service-photos')
    .createSignedUrl(storagePath, 3600); // 1 hour expiry
  
  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }
  
  return data?.signedUrl || null;
}

/**
 * Get multiple signed URLs at once for better performance.
 */
export async function getSignedPhotoUrls(storagePaths: string[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  
  if (storagePaths.length === 0) return urlMap;
  
  // Process in parallel for better performance
  const results = await Promise.allSettled(
    storagePaths.map(async (path) => {
      const url = await getSignedPhotoUrl(path);
      return { path, url };
    })
  );
  
  results.forEach((result) => {
    if (result.status === 'fulfilled' && result.value.url) {
      urlMap.set(result.value.path, result.value.url);
    }
  });
  
  return urlMap;
}

/**
 * Upload a photo to the service-photos bucket.
 * Returns the storage path for later retrieval.
 */
export async function uploadServicePhoto(
  file: File | Blob,
  serviceId: string,
  filename?: string
): Promise<{ path: string; error: Error | null }> {
  const ext = filename?.split('.').pop() || 'jpg';
  const path = `${serviceId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
  
  const { error } = await supabase.storage
    .from('service-photos')
    .upload(path, file, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
    });
  
  if (error) {
    console.error('Error uploading photo:', error);
    return { path: '', error };
  }
  
  return { path, error: null };
}

/**
 * Delete a photo from storage.
 */
export async function deleteServicePhoto(storagePath: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from('service-photos')
    .remove([storagePath]);
  
  if (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
  
  return true;
}
