 import { useState, useEffect } from 'react';
 import { useQuery } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { getPhotosByService, getPhotoUrl } from '@/lib/imageStorage';
 
 interface ServicePhotoData {
   id: string;
   storage_path: string;
   latitude?: number | null;
   longitude?: number | null;
   captured_at?: string | null;
   url?: string;
 }
 
 // Fetch photos from Supabase for a service
 export function useServicePhotos(serviceId: string | null) {
   return useQuery({
     queryKey: ['service_photos', serviceId],
     queryFn: async () => {
       if (!serviceId) return [];
       
       const { data, error } = await supabase
         .from('service_photos')
         .select('*')
         .eq('service_id', serviceId)
         .order('created_at', { ascending: false });
       
       if (error) throw error;
       
       // Generate signed URLs for each photo
       const photosWithUrls: ServicePhotoData[] = await Promise.all(
         (data || []).map(async (photo) => {
           const { data: signedUrlData } = await supabase.storage
             .from('service-photos')
             .createSignedUrl(photo.storage_path, 3600); // 1 hour validity
           
           return {
             ...photo,
             url: signedUrlData?.signedUrl,
           };
         })
       );
       
       return photosWithUrls;
     },
     enabled: !!serviceId,
   });
 }
 
 // Check for local photos (from IndexedDB) that need to be synced
 export function useLocalServicePhotos(serviceId: string | null) {
   const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
   const [isLoading, setIsLoading] = useState(false);
 
   useEffect(() => {
     if (!serviceId) {
       setPhotos([]);
       return;
     }
 
     const loadLocalPhotos = async () => {
       setIsLoading(true);
       try {
         const localPhotos = await getPhotosByService(serviceId);
         const photosWithUrls = await Promise.all(
           localPhotos.map(async (photo) => {
             const url = await getPhotoUrl(photo.localBlobKey);
             return { id: photo.id, url: url || '' };
           })
         );
         setPhotos(photosWithUrls.filter(p => p.url));
       } catch {
         // noop
       } finally {
         setIsLoading(false);
       }
     };
 
     loadLocalPhotos();
   }, [serviceId]);
 
   return { photos, isLoading };
 }
 
 // Combined hook that checks both Supabase and local storage
 export function useCombinedServicePhotos(serviceId: string | null) {
   const { data: supabasePhotos = [], isLoading: supabaseLoading } = useServicePhotos(serviceId);
   const { photos: localPhotos, isLoading: localLoading } = useLocalServicePhotos(serviceId);
   
   // Combine photos, preferring Supabase (synced) over local (pending)
   const allPhotos = [...supabasePhotos.map(p => ({ id: p.id, url: p.url || '' })), ...localPhotos];
   
   // Remove duplicates by ID
   const uniquePhotos = allPhotos.filter((photo, index, self) => 
     index === self.findIndex(p => p.id === photo.id)
   );
   
   return {
     photos: uniquePhotos,
     isLoading: supabaseLoading || localLoading,
   };
 }