import { Producer, Settlement, Location, DemandType } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, MapPin, Phone, User, FileText, Home } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ProducerDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producer: Producer | null;
  settlement?: Settlement;
  location?: Location;
  demandTypes: DemandType[];
  onEdit: (producer: Producer) => void;
  onDelete: (producer: Producer) => void;
}

export function ProducerDetailSheet({
  open,
  onOpenChange,
  producer,
  settlement,
  location,
  demandTypes,
  onEdit,
  onDelete,
}: ProducerDetailSheetProps) {
  if (!producer) return null;

  const producerDemandTypes = demandTypes.filter(d => 
    producer.demandTypeIds.includes(d.id)
  );

  const handleEdit = () => {
    onOpenChange(false);
    onEdit(producer);
  };

  const handleDelete = () => {
    onOpenChange(false);
    onDelete(producer);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-left">Detalhes do Produtor</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Info principal */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{producer.name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium">{producer.cpf}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{producer.phone || 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Assentamento</p>
                <p className="font-medium">{settlement?.name || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Localidade</p>
                <p className="font-medium">{producer.locationName || 'Não informada'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Tipos de demanda */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">Tipos de Demanda</p>
            <div className="flex flex-wrap gap-2">
              {producerDemandTypes.length > 0 ? (
                producerDemandTypes.map(d => (
                  <span
                    key={d.id}
                    className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-md"
                  >
                    {d.name}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground text-sm">Nenhum tipo vinculado</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Ações */}
          <div className="flex flex-col gap-2">
            <Button onClick={handleEdit} className="w-full">
              <Pencil className="h-4 w-4 mr-2" />
              Editar Produtor
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Produtor
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
