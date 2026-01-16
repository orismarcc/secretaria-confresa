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
import { Settlement } from '@/types';

const settlementSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
});

type SettlementFormData = z.infer<typeof settlementSchema>;

interface SettlementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settlement?: Settlement | null;
  onSubmit: (data: SettlementFormData) => void;
}

export function SettlementForm({ open, onOpenChange, settlement, onSubmit }: SettlementFormProps) {
  const form = useForm<SettlementFormData>({
    resolver: zodResolver(settlementSchema),
    defaultValues: {
      name: settlement?.name || '',
    },
  });

  const handleSubmit = (data: SettlementFormData) => {
    onSubmit(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{settlement ? 'Editar Assentamento' : 'Novo Assentamento'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Assentamento *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Assentamento Rural Norte" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                {settlement ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
