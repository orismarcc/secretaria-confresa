import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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

const producerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  cpf: z.string().min(11, 'CPF inválido').max(14, 'CPF inválido'),
  phone: z.string().min(10, 'Telefone inválido').max(15, 'Telefone inválido'),
  settlementId: z.string().min(1, 'Selecione um assentamento'),
  locationName: z.string().optional(),
  demandTypeIds: z.array(z.string()).min(1, 'Selecione pelo menos um tipo de demanda'),
});

type ProducerFormData = z.infer<typeof producerSchema>;

interface ProducerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producer?: Producer | null;
  settlements: Settlement[];
  locations: Location[];
  demandTypes: DemandType[];
  onSubmit: (data: ProducerFormData) => void;
}

export function ProducerForm({ 
  open, 
  onOpenChange, 
  producer, 
  settlements, 
  locations, 
  demandTypes,
  onSubmit 
}: ProducerFormProps) {
  const form = useForm<ProducerFormData>({
    resolver: zodResolver(producerSchema),
    defaultValues: {
      name: producer?.name || '',
      cpf: producer?.cpf || '',
      phone: producer?.phone || '',
      settlementId: producer?.settlementId || '',
      locationName: producer?.locationName || '',
      demandTypeIds: producer?.demandTypeIds || [],
    },
  });

  const selectedSettlementId = form.watch('settlementId');

  useEffect(() => {
    if (producer) {
      form.reset({
        name: producer.name,
        cpf: producer.cpf,
        phone: producer.phone,
        settlementId: producer.settlementId,
        locationName: producer.locationName || '',
        demandTypeIds: producer.demandTypeIds,
      });
    } else {
      form.reset({
        name: '',
        cpf: '',
        phone: '',
        settlementId: '',
        locationName: '',
        demandTypeIds: [],
      });
    }
  }, [producer, form]);

  const handleSubmit = (data: ProducerFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .slice(0, 14);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{producer ? 'Editar Produtor' : 'Novo Produtor'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Nome Completo *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do produtor" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="000.000.000-00" 
                        {...field} 
                        onChange={(e) => field.onChange(formatCPF(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="(00) 00000-0000" 
                        {...field}
                        onChange={(e) => field.onChange(formatPhone(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="settlementId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assentamento *</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {settlements.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localidade</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite a localidade" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="demandTypeIds"
              render={() => (
                <FormItem>
                  <FormLabel>Tipos de Demanda *</FormLabel>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {demandTypes.filter(d => d.isActive).map((dt) => (
                      <FormField
                        key={dt.id}
                        control={form.control}
                        name="demandTypeIds"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(dt.id)}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  if (checked) {
                                    field.onChange([...current, dt.id]);
                                  } else {
                                    field.onChange(current.filter((id) => id !== dt.id));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">{dt.name}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {producer ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
