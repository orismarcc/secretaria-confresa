import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNextComunicadoNumber, useIncrementComunicadoNumber } from '@/hooks/useSupabaseData';
import {
  gerarComunicadoDam,
  formatHoras,
  formatLitros,
  type ComunicadoData,
} from '@/lib/comunicado';

export interface ComunicadoSource {
  nome: string;
  cpf: string;
  tipo: string;
  horas: number;
  litros: number;
}

interface ComunicadoDamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ComunicadoSource | null;
}

function parseNum(v: string): number {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function ComunicadoDamDialog({ open, onOpenChange, source }: ComunicadoDamDialogProps) {
  const { toast } = useToast();
  const { data: proximoNumero } = useNextComunicadoNumber();
  const incrementNumero = useIncrementComunicadoNumber();
  const [valorLitro, setValorLitro] = useState('');
  const [upfm, setUpfm] = useState('71,15');
  const [gerando, setGerando] = useState(false);

  // Reinicia ao abrir
  useEffect(() => {
    if (open) {
      setValorLitro('');
      setUpfm('71,15');
    }
  }, [open]);

  if (!source) return null;

  const litros = source.litros || 0;
  const upfmNum = parseNum(upfm);
  // Combustível = valor por litro × litros (não editável)
  const combustivel = parseNum(valorLitro) * litros;
  const total = combustivel + upfmNum;

  const handleGerar = async () => {
    setGerando(true);
    try {
      // Consome o próximo número de forma atômica só ao gerar
      const numero = await incrementNumero.mutateAsync();
      const dados: ComunicadoData = {
        numero: String(numero),
        data: new Date(),
        tipo: source.tipo,
        nome: source.nome,
        cpf: source.cpf,
        horas: source.horas || 0,
        litros,
        valorCombustivel: combustivel,
        valorUpfm: upfmNum,
      };
      await gerarComunicadoDam(dados);
      toast({ title: `Comunicado Nº ${numero} gerado!` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar comunicado', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Emitir Comunicado de DAM
          </DialogTitle>
        </DialogHeader>

        {/* Dados do atendimento (preenchidos automaticamente) */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Produtor</span>
            <span className="font-medium text-right">{source.nome}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">CPF/CNPJ</span>
            <span className="font-medium">{source.cpf || '—'}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Atendimento com</span>
            <span className="font-medium text-right">{source.tipo}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Tempo de máquina</span>
            <span className="font-medium">{formatHoras(source.horas || 0)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">Combustível</span>
            <span className="font-medium">{formatLitros(litros)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/40 border px-3 py-2">
            <span className="text-sm text-muted-foreground">Nº do Comunicado</span>
            <span className="font-semibold">{proximoNumero ?? '—'} <span className="text-xs font-normal text-muted-foreground">(automático)</span></span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="com-valor-litro">Valor do combustível por litro (R$/L) *</Label>
            <Input
              id="com-valor-litro"
              value={valorLitro}
              onChange={(e) => setValorLitro(e.target.value)}
              placeholder="7,50"
              inputMode="decimal"
            />
          </div>

          {/* Combustível — calculado (não editável) */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 border px-3 py-2">
            <div>
              <span className="text-sm font-medium">Combustível</span>
              <p className="text-[11px] text-muted-foreground">valor/L × {formatLitros(litros)}</p>
            </div>
            <span className="font-semibold">{fmtBRL(combustivel)}</span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="com-upfm">Taxa referente a 1 UPFM (R$)</Label>
            <Input
              id="com-upfm"
              value={upfm}
              onChange={(e) => setUpfm(e.target.value)}
              placeholder="71,15"
              inputMode="decimal"
            />
          </div>

          {/* Total */}
          <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
            <span className="text-sm font-medium">Total</span>
            <span className="text-lg font-black text-primary">{fmtBRL(total)}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGerar} disabled={gerando || combustivel <= 0}>
            <FileDown className="h-4 w-4 mr-2" />
            {gerando ? 'Gerando...' : 'Gerar Comunicado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
