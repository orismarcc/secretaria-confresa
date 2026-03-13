 import { format } from 'date-fns';
 import { ptBR } from 'date-fns/locale';
 import { Separator } from '@/components/ui/separator';
 import { StatusBadge } from '@/components/StatusBadge';
 import { Button } from '@/components/ui/button';
 import { Skeleton } from '@/components/ui/skeleton';
 import { useCombinedServicePhotos } from '@/hooks/useServicePhotos';
 import { 
   Pencil, 
   Trash2, 
   CheckCircle, 
   Calendar, 
   MapPin, 
   Navigation,
   Image,
   ExternalLink
 } from 'lucide-react';
 
 interface ServiceDetailViewProps {
  service: {
    id: string;
    producer_id: string;
    demand_type_id: string;
    settlement_id?: string | null;
    location_id?: string | null;
    status: string;
    scheduled_date: string;
    completed_at?: string | null;
    notes?: string | null;
    priority: string;
    worked_area?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    producers?: { name: string; cpf?: string } | null;
    demand_types?: { name: string } | null;
    settlements?: { name: string } | null;
    locations?: { name: string } | null;
  };
   producer?: { name: string; cpf: string; location_name?: string } | null;
   demandType?: { name: string } | null;
   settlement?: { name: string } | null;
   location?: { name: string } | null;
   onEdit: () => void;
   onDelete: () => void;
   onFinalize?: () => void;
 }
 
 export function ServiceDetailView({
   service,
   producer,
   demandType,
   settlement,
   location,
   onEdit,
   onDelete,
   onFinalize,
 }: ServiceDetailViewProps) {
   const { photos, isLoading: photosLoading } = useCombinedServicePhotos(service.id);
   const isCompleted = service.status === 'completed';
 
  const openInMaps = () => {
    if (service.latitude && service.longitude) {
      // Try geo: URI first (works on mobile), fallback to Google Maps web
      const geoUrl = `geo:${service.latitude},${service.longitude}?q=${service.latitude},${service.longitude}`;
      const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${service.latitude},${service.longitude}`;
      
      // Create a temporary link to test geo: support
      const link = document.createElement('a');
      link.href = geoUrl;
      
      // On mobile devices, geo: should work. On desktop, use Google Maps
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        window.location.href = geoUrl;
        // Fallback to Google Maps after a short delay if geo: doesn't work
        setTimeout(() => {
          window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
        }, 500);
      } else {
        window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
      }
    }
  };
 
   return (
     <div className="mt-6 space-y-4">
       <div className="flex items-center justify-between">
         <span className="text-sm text-muted-foreground">Status</span>
         <StatusBadge status={service.status as 'pending' | 'in_progress' | 'completed'} />
       </div>
 
       <Separator />
 
       <div className="space-y-3">
         <div>
           <p className="text-sm text-muted-foreground">Produtor</p>
           <p className="font-medium">{producer?.name || service.producers?.name || 'N/A'}</p>
           <p className="text-sm text-muted-foreground">{producer?.cpf}</p>
         </div>
 
         <div>
           <p className="text-sm text-muted-foreground">Tipo de Demanda</p>
           <p className="font-medium">{demandType?.name || service.demand_types?.name || 'N/A'}</p>
         </div>
 
         <div>
           <p className="text-sm text-muted-foreground">Localização</p>
           <p className="font-medium">{settlement?.name || service.settlements?.name || 'N/A'}</p>
           <p className="text-sm">{producer?.location_name || location?.name || service.locations?.name || 'N/A'}</p>
         </div>
 
         <div className="flex items-center gap-2">
           <Calendar className="h-4 w-4 text-muted-foreground" />
           <div>
             <p className="text-sm text-muted-foreground">Data Agendada</p>
             <p className="font-medium">
               {format(new Date(service.scheduled_date), 'dd/MM/yyyy', { locale: ptBR })}
             </p>
           </div>
         </div>
 
         {service.notes && (
           <div>
             <p className="text-sm text-muted-foreground">Observações</p>
             <p className="font-medium">{service.notes}</p>
           </div>
         )}
       </div>
 
       {/* Completion Info - Only for archived services */}
       {isCompleted && (
         <>
           <Separator />
           
           <div className="space-y-3">
             <h3 className="font-semibold text-sm text-primary">Informações da Finalização</h3>
             
             {/* Completion Date */}
             {service.completed_at && (
               <div className="flex items-center gap-2">
                 <CheckCircle className="h-4 w-4 text-success" />
                 <div>
                   <p className="text-sm text-muted-foreground">Finalizado em</p>
                   <p className="font-medium">
                     {format(new Date(service.completed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                   </p>
                 </div>
               </div>
             )}
 
             {/* GPS Location */}
             {service.latitude && service.longitude ? (
               <div className="flex items-center gap-2">
                 <Navigation className="h-4 w-4 text-blue-500" />
                 <div className="flex-1">
                   <p className="text-sm text-muted-foreground">Coordenadas GPS</p>
                   <p className="font-mono text-sm">
                     {service.latitude.toFixed(6)}, {service.longitude.toFixed(6)}
                   </p>
                 </div>
                 <Button variant="outline" size="sm" onClick={openInMaps}>
                   <ExternalLink className="h-3 w-3 mr-1" />
                   Mapa
                 </Button>
               </div>
             ) : (
               <div className="flex items-center gap-2 text-muted-foreground">
                 <Navigation className="h-4 w-4" />
                 <p className="text-sm">GPS não capturado</p>
               </div>
             )}
 
             {/* Photos */}
             <div>
               <div className="flex items-center gap-2 mb-2">
                 <Image className="h-4 w-4 text-muted-foreground" />
                 <p className="text-sm text-muted-foreground">Fotos do Atendimento</p>
               </div>
               
                {photosLoading ? (
                  <Skeleton className="h-48 w-32 rounded-lg" />
                ) : photos.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {photos.map((photo) => (
                      <div key={photo.id} className="aspect-[9/16] h-48 flex-shrink-0 rounded-lg overflow-hidden border">
                        <img 
                          src={photo.url} 
                          alt="Foto do atendimento"
                          className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => window.open(photo.url, '_blank')}
                        />
                      </div>
                    ))}
                  </div>
               ) : (
                 <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">
                   Nenhuma foto registrada
                 </div>
               )}
             </div>
           </div>
         </>
       )}
 
       <Separator />
 
       <div className="flex flex-col gap-2">
         {service.status !== 'completed' && onFinalize && (
           <Button 
             onClick={onFinalize}
             className="w-full bg-success hover:bg-success/90"
           >
             <CheckCircle className="h-4 w-4 mr-2" />
             Finalizar Atendimento
           </Button>
         )}
         <Button variant="outline" onClick={onEdit} className="w-full">
           <Pencil className="h-4 w-4 mr-2" />
           Editar
         </Button>
         <Button 
           variant="destructive" 
           onClick={onDelete}
           className="w-full"
         >
           <Trash2 className="h-4 w-4 mr-2" />
           Excluir
         </Button>
       </div>
     </div>
   );
 }