import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Producer, Settlement, Location } from '@/types';
import {
  isValidDocument,
  formatDocument,
  formatCpf,
  formatCnpj,
  detectDocType,
  documentPlaceholder,
  onlyDigits,
  type DocType,
} from '@/lib/documents';

const producerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  cpf: z
    .string()
    .min(11, 'Documento inválido')
    .max(18, 'Documento inválido')
    .refine(isValidDocument, 'CPF ou CNPJ inválido (dígitos verificadores incorretos)'),
  phone: z.string().min(10, 'Telefone inválido').max(15, 'Telefone inválido'),
  settlementId: z.string().min(1, 'Selecione um assentamento'),
  locationName: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  caf: z.string().optional(),
});

type ProducerFormData = z.infer<typeof producerSchema>;

interface ProducerFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  producer?: Producer | null;
  settlements: Settlement[];
  locations: Location[];
  onSubmit: (data: ProducerFormData) => void;
}

export function ProducerForm({ 
  open, 
  onOpenChange, 
  producer, 
  settlements, 
  locations, 
  onSubmit 
}: ProducerFormProps) {
  // Tipo de documento: detectado pelo nº de dígitos (14 = CNPJ, senão CPF)
  const [docType, setDocType] = useState<DocType>('cpf');

  const form = useForm<ProducerFormData>({
    resolver: zodResolver(producerSchema),
    defaultValues: {
      name: producer?.name?.toUpperCase() || '',
      cpf: producer?.cpf || '',
      phone: producer?.phone || '',
      settlementId: producer?.settlementId || '',
      locationName: producer?.locationName?.toUpperCase() || '',
      latitude: (producer as any)?.latitude?.toString() || '',
      longitude: (producer as any)?.longitude?.toString() || '',
      caf: (producer as any)?.caf || '',
    },
  });

  useEffect(() => {
    if (producer) {
      setDocType(detectDocType(producer.cpf));
      form.reset({
        name: producer.name?.toUpperCase() || '',
        cpf: producer.cpf,
        phone: producer.phone,
        settlementId: producer.settlementId,
        locationName: producer.locationName?.toUpperCase() || '',
        latitude: (producer as any)?.latitude?.toString() || '',
        longitude: (producer as any)?.longitude?.toString() || '',
        caf: (producer as any)?.caf || '',
      });
    } else {
      setDocType('cpf');
      form.reset({
        name: '',
        cpf: '',
        phone: '',
        settlementId: '',
        locationName: '',
        latitude: '',
        longitude: '',
        caf: '',
      });
    }
  }, [producer, form]);

  const handleSubmit = (data: ProducerFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  const formatDoc = (value: string) => formatDocument(value, docType);

  // Alterna o tipo e re-aplica a máscara aos dígitos já digitados
  const handleDocTypeChange = (type: DocType) => {
    if (type === docType) return;
    setDocType(type);
    const digits = onlyDigits(form.getValues('cpf') ?? '');
    form.setValue('cpf', type === 'cnpj' ? formatCnpj(digits) : formatCpf(digits));
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
                      <Input
                        placeholder="NOME DO PRODUTOR"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
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
                    <div className="flex items-center justify-between gap-2">
                      <FormLabel>{docType === 'cnpj' ? 'CNPJ' : 'CPF'} *</FormLabel>
                      <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
                        {(['cpf', 'cnpj'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleDocTypeChange(t)}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
                              docType === t
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                    <FormControl>
                      <Input
                        placeholder={documentPlaceholder(docType)}
                        inputMode="numeric"
                        {...field}
                        onChange={(e) => field.onChange(formatDoc(e.target.value))}
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                      <Input
                        placeholder="LOCALIDADE"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="caf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CAF — Cadastro do Agricultor Familiar (opcional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Número do CAF" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GPS Coordinates Section */}
            <div className="border rounded-lg p-4 bg-muted/30">
              <p className="text-sm font-medium mb-3">Coordenadas GPS (opcional)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="latitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Latitude</FormLabel>
                      <FormControl>
                        <Input placeholder="-12.345678" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="longitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Longitude</FormLabel>
                      <FormControl>
                        <Input placeholder="-45.678901" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Exemplo: Latitude: -12.345678, Longitude: -45.678901
              </p>
            </div>

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
