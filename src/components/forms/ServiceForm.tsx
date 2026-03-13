import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Producer, Settlement, Location, DemandType } from '@/types';
import { format } from 'date-fns';

const serviceSchema = z.object({
  producerId: z.string().min(1, 'Selecione um produtor'),
  demandTypeId: z.string().min(1, 'Selecione o tipo de demanda'),
  workedArea: z.coerce.number().min(0, 'Área não pode ser negativa').optional(),
  scheduledDate: z.string().min(1, 'Selecione a data'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  notes: z.string().max(1000, 'Observações muito longas').optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: {
    producerId: string;
    demandTypeId: string;
    workedArea?: number;
    scheduledDate: Date;
    status: string;
    notes?: string;
    priority?: string;
  } | null;
  producers: Producer[];
  settlements: Settlement[];
  locations: Location[];
  demandTypes: DemandType[];
  onSubmit: (data: ServiceFormData) => void;
}

export function ServiceForm({ 
  open, 
  onOpenChange, 
  service, 
  producers, 
  settlements, 
  locations, 
  demandTypes,
  onSubmit 
}: ServiceFormProps) {
  const form = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      producerId: '',
      demandTypeId: '',
      workedArea: 0,
      scheduledDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'pending',
      notes: '',
      priority: 'medium',
    },
  });

  const selectedProducerId = form.watch('producerId');
  const selectedProducer = producers.find(p => p.id === selectedProducerId);

  useEffect(() => {
    if (service) {
      form.reset({
        producerId: service.producerId,
        demandTypeId: service.demandTypeId,
        workedArea: service.workedArea || 0,
        scheduledDate: format(new Date(service.scheduledDate), 'yyyy-MM-dd'),
        status: service.status as 'pending' | 'in_progress' | 'completed',
        notes: service.notes || '',
        priority: (service.priority as 'low' | 'medium' | 'high') || 'medium',
      });
    } else {
      form.reset({
        producerId: '',
        demandTypeId: '',
        workedArea: 0,
        scheduledDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'pending',
        notes: '',
        priority: 'medium',
      });
    }
  }, [service, form]);

  const handleSubmit = (data: ServiceFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  // Get producer's available demand types
  const availableDemandTypes = selectedProducer 
    ? demandTypes.filter(d => selectedProducer.demandTypeIds.includes(d.id) && d.isActive)
    : demandTypes.filter(d => d.isActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{service ? 'Editar Atendimento' : 'Novo Atendimento'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Producer Selection */}
              <FormField
                control={form.control}
                name="producerId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Produtor *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o produtor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {producers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} - CPF: {p.cpf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Producer Info Display */}
              {selectedProducer && (
                <div className="md:col-span-2 p-3 bg-muted rounded-lg text-sm">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div><strong>Telefone:</strong> {selectedProducer.phone}</div>
                    <div><strong>Assentamento:</strong> {settlements.find(s => s.id === selectedProducer.settlementId)?.name}</div>
                    <div><strong>Localidade:</strong> {selectedProducer.locationName || 'Não informada'}</div>
                  </div>
                </div>
              )}

              {/* Demand Type */}
              <FormField
                control={form.control}
                name="demandTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Demanda *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableDemandTypes.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Status */}
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="in_progress">Em Execução</SelectItem>
                        <SelectItem value="completed">Finalizado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Priority */}
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prioridade</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduled Date */}
              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Agendada *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Worked Area */}
              <FormField
                control={form.control}
                name="workedArea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Área Trabalhada (ha)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Observações</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Observações adicionais..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {service ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
