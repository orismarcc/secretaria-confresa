import { useEffect, useState, useMemo } from 'react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Producer, Settlement, Location, DemandType } from '@/types';
import { format } from 'date-fns';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const serviceSchema = z.object({
  producerId: z.string().min(1, 'Selecione um produtor'),
  demandTypeId: z.string().min(1, 'Selecione o tipo de demanda'),
  workedArea: z.coerce.number().min(0, 'Área não pode ser negativa').optional(),
  scheduledDate: z.string().min(1, 'Selecione a data'),
  status: z.enum(['pending', 'in_progress', 'completed']),
  notes: z.string().max(1000, 'Observações muito longas').optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  operatorId: z.string().optional(),
  machineryId: z.string().optional(),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

interface OperatorOption {
  id: string;
  name: string;
}

interface MachineryOption {
  id: string;
  name: string;
  patrimony_number: string;
}

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
    operatorId?: string;
    machineryId?: string;
  } | null;
  producers: Producer[];
  settlements: Settlement[];
  locations: Location[];
  demandTypes: DemandType[];
  operators?: OperatorOption[];
  machinery?: MachineryOption[];
  onSubmit: (data: ServiceFormData) => void;
}

function ProducerCombobox({
  producers,
  value,
  onChange,
}: {
  producers: Producer[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!searchTerm) return producers;
    const term = searchTerm.toLowerCase();
    return producers.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.cpf.includes(term)
    );
  }, [producers, searchTerm]);

  const selected = producers.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10"
        >
          <span className="truncate">
            {selected ? `${selected.name} - CPF: ${selected.cpf}` : 'Selecione o produtor'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar produtor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum produtor encontrado
            </p>
          ) : (
            filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setSearchTerm('');
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-accent text-left',
                  value === p.id && 'bg-accent'
                )}
              >
                <Check
                  className={cn(
                    'h-4 w-4 shrink-0',
                    value === p.id ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="truncate">
                  {p.name} - CPF: {p.cpf}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ServiceForm({
  open,
  onOpenChange,
  service,
  producers,
  settlements,
  locations,
  demandTypes,
  operators = [],
  machinery = [],
  onSubmit,
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
      operatorId: '',
      machineryId: '',
    },
  });

  const selectedProducerId = form.watch('producerId');
  const selectedProducer = producers.find((p) => p.id === selectedProducerId);

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
        operatorId: service.operatorId || '',
        machineryId: service.machineryId || '',
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
        operatorId: '',
        machineryId: '',
      });
    }
  }, [service, form]);

  const handleSubmit = (data: ServiceFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  const availableDemandTypes = selectedProducer
    ? demandTypes.filter(
        (d) => selectedProducer.demandTypeIds.includes(d.id) && d.isActive
      )
    : demandTypes.filter((d) => d.isActive);

  const activeOperators = operators;
  const activeMachinery = machinery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {service ? 'Editar Atendimento' : 'Novo Atendimento'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Producer Selection - Searchable */}
              <FormField
                control={form.control}
                name="producerId"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Produtor *</FormLabel>
                    <FormControl>
                      <ProducerCombobox
                        producers={producers}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Producer Info Display */}
              {selectedProducer && (
                <div className="md:col-span-2 p-3 bg-muted rounded-lg text-sm">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div>
                      <strong>Telefone:</strong> {selectedProducer.phone}
                    </div>
                    <div>
                      <strong>Assentamento:</strong>{' '}
                      {settlements.find(
                        (s) => s.id === selectedProducer.settlementId
                      )?.name}
                    </div>
                    <div>
                      <strong>Localidade:</strong>{' '}
                      {selectedProducer.locationName || 'Não informada'}
                    </div>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableDemandTypes.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
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

              {/* Operator Selection */}
              <FormField
                control={form.control}
                name="operatorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operador</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o operador" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {activeOperators.map((op) => (
                          <SelectItem key={op.id} value={op.id}>
                            {op.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Machinery Selection */}
              <FormField
                control={form.control}
                name="machineryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maquinário</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o maquinário" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {activeMachinery.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} — Nº {m.patrimony_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
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
                      <Textarea
                        placeholder="Observações adicionais..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
