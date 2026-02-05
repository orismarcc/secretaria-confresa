 import { useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { getPhotoBlob, updatePhotoSyncStatus, getPendingPhotos } from '@/lib/imageStorage';
 import { useToast } from '@/hooks/use-toast';
 
 interface UploadPhotoParams {
   photoBlob: Blob;
   serviceId: string;
   localPhotoId?: string;
   latitude?: number;
   longitude?: number;
 }
 
 // Upload a single photo to Supabase Storage and create a record
 export function useUploadServicePhoto() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async ({ photoBlob, serviceId, localPhotoId, latitude, longitude }: UploadPhotoParams) => {
       // Generate unique filename
       const timestamp = Date.now();
       const filename = `${serviceId}/${timestamp}.jpg`;
       
       // Upload to Supabase Storage
       const { error: uploadError } = await supabase.storage
         .from('service-photos')
         .upload(filename, photoBlob, {
           contentType: 'image/jpeg',
           cacheControl: '3600',
         });
       
       if (uploadError) throw uploadError;
       
       // Create record in service_photos table
       const { data: photoRecord, error: dbError } = await supabase
         .from('service_photos')
         .insert({
           service_id: serviceId,
           storage_path: filename,
           latitude,
           longitude,
           captured_at: new Date().toISOString(),
         })
         .select()
         .single();
       
       if (dbError) throw dbError;
       
       // Update local photo sync status if it exists
       if (localPhotoId) {
         const { data: signedUrlData } = await supabase.storage
           .from('service-photos')
           .createSignedUrl(filename, 3600);
         
         await updatePhotoSyncStatus(localPhotoId, 'synced', signedUrlData?.signedUrl);
       }
       
       return photoRecord;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['service_photos'] });
     },
     onError: (error: Error) => {
       console.error('Photo upload error:', error);
       toast({ 
         title: 'Erro ao enviar foto', 
         description: error.message, 
         variant: 'destructive' 
       });
     },
   });
 }
 
 // Sync all pending photos from IndexedDB to Supabase
 export function useSyncPendingPhotos() {
   const uploadPhoto = useUploadServicePhoto();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async () => {
       const pendingPhotos = await getPendingPhotos();
       let syncedCount = 0;
       let errorCount = 0;
 
       for (const photo of pendingPhotos) {
         try {
           const blob = await getPhotoBlob(photo.localBlobKey);
           if (!blob) {
             await updatePhotoSyncStatus(photo.id, 'error');
             errorCount++;
             continue;
           }
 
           await uploadPhoto.mutateAsync({
             photoBlob: blob,
             serviceId: photo.serviceId,
             localPhotoId: photo.id,
           });
           
           syncedCount++;
         } catch (error) {
           console.error('Error syncing photo:', photo.id, error);
           await updatePhotoSyncStatus(photo.id, 'error');
           errorCount++;
         }
       }
 
       return { syncedCount, errorCount };
     },
     onSuccess: ({ syncedCount, errorCount }) => {
       if (syncedCount > 0) {
         toast({
           title: 'Fotos sincronizadas',
           description: `${syncedCount} foto(s) enviada(s) com sucesso.`,
         });
       }
       if (errorCount > 0) {
         toast({
           title: 'Algumas fotos falharam',
           description: `${errorCount} foto(s) não puderam ser enviadas.`,
           variant: 'destructive',
         });
       }
     },
   });
 }