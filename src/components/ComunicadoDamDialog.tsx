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
  const [numero, setNumero] = useState('');
  const [valorLitro, setValorLitro] = useState('');
  const [combustivel, setCombustivel] = useState(0);
  const [upfm, setUpfm] = useState('71,15');
  const [gerando, setGerando] = useState(false);

  // Reinicia ao abrir
  useEffect(() => {
    if (open) {
      setNumero('');
      setValorLitro('');
      setCombustivel(0);
      setUpfm('71,15');
    }
  }, [open]);

  if (!source) return null;

  const litros = source.litros || 0;
  const upfmNum = parseNum(upfm);
  const total = combustivel + upfmNum;

  // valor/L × litros → combustível (editável depois)
  const handleValorLitro = (v: string) => {
    setValorLitro(v);
    setCombustivel(parseNum(v) * litros);
  };

  const handleGerar = async () => {
    if (!numero.trim()) {
      toast({ title: 'Informe o número do comunicado', variant: 'destructive' });
      return;
    }
    setGerando(true);
    try {
      const dados: ComunicadoData = {
        numero: numero.trim(),
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
      toast({ title: 'Comunicado gerado!' });
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
          <div className="space-y-1.5">
            <Label htmlFor="com-numero">Nº do Comunicado *</Label>
            <Input
              id="com-numero"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 13"
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="com-valor-litro">Valor do combustível (R$/L)</Label>
              <Input
                id="com-valor-litro"
                value={valorLitro}
                onChange={(e) => handleValorLitro(e.target.value)}
                placeholder="7,50"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="com-combustivel">Combustível (R$)</Label>
              <Input
                id="com-combustivel"
                value={combustivel ? combustivel.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                onChange={(e) => setCombustivel(parseNum(e.target.value))}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Combustível = valor por litro × {formatLitros(litros)} (ajustável)
          </p>

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
          <Button onClick={handleGerar} disabled={gerando}>
            <FileDown className="h-4 w-4 mr-2" />
            {gerando ? 'Gerando...' : 'Gerar Comunicado'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
