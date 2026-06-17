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

// B-01: validate CPF using the standard modulo-11 digit-check algorithm.
function validateCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  // Reject all-same-digit CPFs (e.g. 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;
  const sum = (end: number) =>
    digits
      .slice(0, end)
      .split('')
      .reduce((acc, d, i) => acc + Number(d) * (end + 1 - i), 0);
  const rem1 = (sum(9) * 10) % 11;
  if ((rem1 === 10 ? 0 : rem1) !== Number(digits[9])) return false;
  const rem2 = (sum(10) * 10) % 11;
  return (rem2 === 10 ? 0 : rem2) === Number(digits[10]);
}

// validate CNPJ using the standard modulo-11 digit-check algorithm.
function validateCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len: number) => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = digits.slice(0, len).split('').reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  if (calc(12) !== Number(digits[12])) return false;
  return calc(13) === Number(digits[13]);
}

const producerSchema = z.object({
  name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100, 'Nome muito longo'),
  cpf: z
    .string()
    .min(11, 'Documento inválido')
    .max(18, 'Documento inválido')
    .refine(
      (v) => validateCpf(v) || validateCnpj(v),
      'CPF ou CNPJ inválido (dígitos verificadores incorretos)',
    ),
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
  const [docType, setDocType] = useState<'cpf' | 'cnpj'>('cpf');

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
      const docDigits = (producer.cpf ?? '').replace(/\D/g, '');
      setDocType(docDigits.length === 14 ? 'cnpj' : 'cpf');
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

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2');
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})/, '$1-$2');
  };

  const formatDoc = (value: string) =>
    docType === 'cnpj' ? formatCNPJ(value) : formatCPF(value);

  // Alterna o tipo e re-aplica a máscara aos dígitos já digitados
  const handleDocTypeChange = (type: 'cpf' | 'cnpj') => {
    if (type === docType) return;
    setDocType(type);
    const digits = (form.getValues('cpf') ?? '').replace(/\D/g, '');
    form.setValue('cpf', type === 'cnpj' ? formatCNPJ(digits) : formatCPF(digits));
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
                        placeholder={docType === 'cnpj' ? '00.000.000/0000-00' : '000.000.000-00'}
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
