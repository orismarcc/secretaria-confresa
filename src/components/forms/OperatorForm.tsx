import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

export interface OperatorDemandTypeOption {
  id: string;
  name: string;
}

const createSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});

const editSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
});

interface OperatorMachineryOption {
  id: string;
  name: string;
}

interface OperatorFormProps {
  defaultValues?: { name: string; email?: string };
  onSubmit: (
    data:
      | { name: string; email: string; password: string; demandTypeIds: string[]; machineryIds: string[] }
      | { name: string; demandTypeIds: string[]; machineryIds: string[] }
  ) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  mode: 'create' | 'edit';
  /** Tipos de serviço disponíveis para conceder acesso */
  demandTypes?: OperatorDemandTypeOption[];
  /** Tipos já atribuídos ao operador (modo edição) */
  initialDemandTypeIds?: string[];
  /** Maquinários disponíveis para vincular ao operador */
  machinery?: OperatorMachineryOption[];
  /** Maquinários já vinculados ao operador (modo edição) */
  initialMachineryIds?: string[];
}

export function OperatorForm({
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  mode,
  demandTypes = [],
  initialDemandTypeIds = [],
  machinery = [],
  initialMachineryIds = [],
}: OperatorFormProps) {
  const [name, setName] = useState(defaultValues?.name || '');
  const [email, setEmail] = useState(defaultValues?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [demandTypeIds, setDemandTypeIds] = useState<string[]>(initialDemandTypeIds);
  const [machineryIds, setMachineryIds] = useState<string[]>(initialMachineryIds);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDemandType = (id: string) => {
    setDemandTypeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };
  const toggleMachinery = (id: string) => {
    setMachineryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (mode === 'create') {
      const result = createSchema.safeParse({ name, email, password, confirmPassword });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      await onSubmit({ name, email, password, demandTypeIds, machineryIds });
    } else {
      const result = editSchema.safeParse({ name });
      if (!result.success) {
        const fieldErrors: Record<string, string> = {};
        result.error.errors.forEach(err => {
          if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
        });
        setErrors(fieldErrors);
        return;
      }
      await onSubmit({ name, demandTypeIds, machineryIds });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do operador"
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>

      {mode === 'create' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmar Senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
          </div>
        </>
      )}

      {mode === 'edit' && defaultValues?.email && (
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={defaultValues.email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">O email não pode ser alterado</p>
        </div>
      )}

      {/* Tipos de serviço que o operador pode atender */}
      {demandTypes.length > 0 && (
        <div className="space-y-2">
          <Label>Tipos de serviço com acesso</Label>
          <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1.5">
            {demandTypes.map((dt) => (
              <label
                key={dt.id}
                htmlFor={`dt-${dt.id}`}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`dt-${dt.id}`}
                  checked={demandTypeIds.includes(dt.id)}
                  onCheckedChange={() => toggleDemandType(dt.id)}
                />
                <span className="text-sm">{dt.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {demandTypeIds.length === 0
              ? 'Nenhum selecionado — o operador terá acesso a todos os tipos.'
              : `${demandTypeIds.length} tipo(s) selecionado(s). O operador só verá esses no login.`}
          </p>
        </div>
      )}

      {/* Veículo(s)/maquinário(s) que o operador utiliza */}
      {machinery.length > 0 && (
        <div className="space-y-2">
          <Label>Veículo / Maquinário utilizado</Label>
          <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1.5">
            {machinery.map((m) => (
              <label
                key={m.id}
                htmlFor={`mach-${m.id}`}
                className="flex items-center gap-2.5 px-1.5 py-1 rounded hover:bg-muted/50 cursor-pointer"
              >
                <Checkbox
                  id={`mach-${m.id}`}
                  checked={machineryIds.includes(m.id)}
                  onCheckedChange={() => toggleMachinery(m.id)}
                />
                <span className="text-sm">{m.name}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {machineryIds.length === 0
              ? 'Opcional — registre o(s) maquinário(s) que este operador utiliza.'
              : `${machineryIds.length} maquinário(s) vinculado(s).`}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {mode === 'create' ? 'Criar Operador' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
