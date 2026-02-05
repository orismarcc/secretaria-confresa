import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
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
import { Service, Producer, Settlement, Location, DemandType, ServiceStatus } from '@/types';
import { format } from 'date-fns';

const serviceSchema = z.object({
  producerId: z.string().min(1, 'Selecione um produtor'),
  demandTypeId: z.string().min(1, 'Selecione o tipo de demanda'),
  purpose: z.string().min(3, 'Informe a finalidade').max(500, 'Finalidade muito longa'),
  workedArea: z.number().min(0.01, 'Área deve ser maior que 0'),
  machinery: z.string().min(2, 'Informe o maquinário'),
  operatorName: z.string().min(3, 'Informe o nome do operador'),
  chassisCode: z.string().min(2, 'Informe o código do patrimônio'),
  termSigned: z.boolean(),
  scheduledDate: z.string().min(1, 'Selecione a data'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  notes: z.string().max(1000, 'Observações muito longas').optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type ServiceFormData = z.infer<typeof serviceSchema>;

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
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
      producerId: service?.producerId || '',
      demandTypeId: service?.demandTypeId || '',
      purpose: service?.purpose || '',
      workedArea: service?.workedArea || 0,
      machinery: service?.machinery || '',
      operatorName: service?.operatorName || '',
      chassisCode: service?.chassisCode || '',
      termSigned: service?.termSigned || false,
      scheduledDate: service?.scheduledDate 
        ? format(new Date(service.scheduledDate), 'yyyy-MM-dd') 
        : format(new Date(), 'yyyy-MM-dd'),
      status: service?.status || 'pending',
      notes: service?.notes || '',
      latitude: service?.latitude,
      longitude: service?.longitude,
    },
  });

  const selectedProducerId = form.watch('producerId');
  const selectedProducer = producers.find(p => p.id === selectedProducerId);

  useEffect(() => {
    if (service) {
      form.reset({
        producerId: service.producerId,
        demandTypeId: service.demandTypeId,
        purpose: service.purpose,
        workedArea: service.workedArea,
        machinery: service.machinery,
        operatorName: service.operatorName,
        chassisCode: service.chassisCode,
        termSigned: service.termSigned,
        scheduledDate: format(new Date(service.scheduledDate), 'yyyy-MM-dd'),
        status: service.status,
        notes: service.notes || '',
        latitude: service.latitude,
        longitude: service.longitude,
      });
    } else {
      form.reset({
        producerId: '',
        demandTypeId: '',
        purpose: '',
        workedArea: 0,
        machinery: '',
        operatorName: '',
        chassisCode: '',
        termSigned: false,
        scheduledDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'pending',
        notes: '',
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                    <FormLabel>Área Trabalhada (ha) *</FormLabel>
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

              {/* Purpose */}
              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Finalidade *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva a finalidade do atendimento..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Machinery */}
              <FormField
                control={form.control}
                name="machinery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maquinário *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Trator John Deere" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Operator Name */}
              <FormField
                control={form.control}
                name="operatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operador Responsável *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do operador" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Chassis Code */}
              <FormField
                control={form.control}
                name="chassisCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Chassi/Código do Patrimônio *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: PAT-001234" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Term Signed */}
              <FormField
                control={form.control}
                name="termSigned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Termo Assinado</FormLabel>
                      <FormDescription>O produtor assinou o termo?</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Coordinates (read-only display) */}
              <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Coordenadas GPS:</strong>{' '}
                  {form.watch('latitude') && form.watch('longitude') 
                    ? `${form.watch('latitude')?.toFixed(6)}, ${form.watch('longitude')?.toFixed(6)}`
                    : 'Não capturadas'}
                </p>
              </div>

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
