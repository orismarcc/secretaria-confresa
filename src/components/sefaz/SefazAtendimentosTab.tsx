// SEFAZ → aba "Atendimentos": atendimentos agrupados por MÊS; em cada mês, os
// comprovantes (folhas de atendimento assinadas — imagem ou PDF).
import { useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ChevronRight, Paperclip, FileText, Image as ImageIcon, Upload, Trash2, Loader2, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  useSefazComprovantes, useUploadSefazComprovantes, useDeleteSefazComprovante, abrirSefazComprovante,
  LIMITE_COMPROVANTE_MB, type SefazComprovante,
} from '@/hooks/useSupabaseData';

const COR_TIPO: Record<string, string> = {
  'Nota Fiscal': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Boleto GTA': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Declaração de Posse': 'bg-violet-100 text-violet-700 border-violet-200',
  'Outros': 'bg-orange-100 text-orange-700 border-orange-200',
};
const nomeMes = (ym: string) => {
  const t = format(parseISO(`${ym}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fmtData = (d?: string | null) => (d ? format(parseISO(d.slice(0, 10)), 'dd/MM/yyyy') : '—');
const fmtTamanho = (b?: number | null) => (b == null ? '' : b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export function SefazAtendimentosTab({ services, tipos }: { services: any[]; tipos: readonly string[] }) {
  const { toast } = useToast();
  const { canDelete } = useAuth();
  const { data: comprovantes = [] } = useSefazComprovantes();
  const enviar = useUploadSefazComprovantes();
  const remover = useDeleteSefazComprovante();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [aRemover, setARemover] = useState<SefazComprovante | null>(null);
  const [enviandoMes, setEnviandoMes] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mesAlvo = useRef<string>('');

  // Meses com atendimento OU com comprovante (do mais recente ao mais antigo).
  const meses = useMemo(() => {
    const porMes = new Map<string, any[]>();
    services.forEach((s) => {
      const ym = String(s.service_date || s.created_at || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      if (!porMes.has(ym)) porMes.set(ym, []);
      porMes.get(ym)!.push(s);
    });
    comprovantes.forEach((c) => { const ym = c.mes.slice(0, 7); if (!porMes.has(ym)) porMes.set(ym, []); });
    return [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ym, lista]) => ({
        ym,
        lista: [...lista].sort((a, b) => String(a.service_date).localeCompare(String(b.service_date))
          || String(a.sefaz_producers?.name || '').localeCompare(String(b.sefaz_producers?.name || ''), 'pt-BR')),
        arquivos: comprovantes.filter((c) => c.mes.slice(0, 7) === ym),
      }));
  }, [services, comprovantes]);

  const alternar = (ym: string) => setAbertos((s) => { const n = new Set(s); if (n.has(ym)) n.delete(ym); else n.add(ym); return n; });
  const escolherArquivos = (ym: string) => { mesAlvo.current = ym; inputRef.current?.click(); };
  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!arquivos.length || !mesAlvo.current) return;
    setEnviandoMes(mesAlvo.current);
    try { await enviar.mutateAsync({ mes: mesAlvo.current, arquivos }); } catch { /* aviso já exibido */ } finally { setEnviandoMes(null); }
  };
  const abrir = async (c: SefazComprovante) => {
    try { await abrirSefazComprovante(c); } catch { toast({ title: 'Não foi possível abrir o arquivo', variant: 'destructive' }); }
  };

  if (meses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
        <ClipboardList className="h-12 w-12 opacity-30" />
        <p>Nenhum atendimento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={aoEscolher} />
      <p className="text-xs text-muted-foreground">
        Atendimentos agrupados por mês. Em cada mês, anexe as folhas de atendimento assinadas (imagem ou PDF, até {LIMITE_COMPROVANTE_MB} MB cada).
      </p>

      {meses.map(({ ym, lista, arquivos }) => {
        const aberto = abertos.has(ym);
        const porTipo = tipos.map((t) => ({ t, n: lista.filter((s) => s.service_type === t).length })).filter((x) => x.n > 0);
        const produtores = new Set(lista.map((s) => s.sefaz_producer_id)).size;
        return (
          <div key={ym} className="rounded-xl border bg-card">
            <button type="button" onClick={() => alternar(ym)} aria-expanded={aberto}
              className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left hover:bg-muted/40 rounded-xl">
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-90')} />
              <span className="font-semibold">{nomeMes(ym)}</span>
              <Badge variant="secondary" className="text-xs">{lista.length} atend.</Badge>
              <span className="text-xs text-muted-foreground">{produtores} produtor(es)</span>
              <span className={cn('ml-auto inline-flex items-center gap-1 text-xs', arquivos.length ? 'text-success font-medium' : 'text-amber-600')}>
                <Paperclip className="h-3.5 w-3.5" />
                {arquivos.length ? `${arquivos.length} comprovante(s)` : 'sem comprovante'}
              </span>
            </button>

            {aberto && (
              <div className="space-y-3 border-t px-4 py-3">
                {/* Comprovantes do mês */}
                <div className="rounded-lg border border-dashed p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> Folhas de atendimento assinadas</p>
                    <Button size="sm" variant="outline" className="ml-auto h-8" disabled={enviandoMes === ym} onClick={() => escolherArquivos(ym)}>
                      {enviandoMes === ym ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                      {enviandoMes === ym ? 'Enviando…' : 'Anexar imagem ou PDF'}
                    </Button>
                  </div>
                  {arquivos.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum comprovante anexado neste mês.</p>
                  ) : (
                    <ul className="space-y-1">
                      {arquivos.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5 text-sm">
                          {c.mime_type === 'application/pdf' ? <FileText className="h-4 w-4 text-red-600 shrink-0" /> : <ImageIcon className="h-4 w-4 text-blue-600 shrink-0" />}
                          <button type="button" onClick={() => abrir(c)} className="min-w-0 flex-1 truncate text-left text-primary hover:underline">{c.file_name}</button>
                          <span className="text-[11px] text-muted-foreground shrink-0">{fmtTamanho(c.size_bytes)}</span>
                          {canDelete && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive shrink-0" title="Remover" onClick={() => setARemover(c)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Resumo por tipo */}
                {porTipo.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {porTipo.map(({ t, n }) => <Badge key={t} variant="outline" className={cn('text-xs', COR_TIPO[t])}>{t}: {n}</Badge>)}
                  </div>
                )}

                {/* Atendimentos do mês */}
                {lista.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhum atendimento lançado neste mês.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs">
                        <tr className="text-left">
                          <th className="px-3 py-2 font-medium w-[100px]">Data</th>
                          <th className="px-3 py-2 font-medium">Produtor</th>
                          <th className="px-3 py-2 font-medium">Serviço</th>
                          <th className="px-3 py-2 font-medium hidden md:table-cell">Observações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((s) => (
                          <tr key={s.id} className="border-t">
                            <td className="px-3 py-1.5 tabular-nums">{fmtData(s.service_date)}</td>
                            <td className="px-3 py-1.5">{s.sefaz_producers?.name || '—'}</td>
                            <td className="px-3 py-1.5"><Badge variant="outline" className={cn('text-[11px]', COR_TIPO[s.service_type])}>{s.service_type}</Badge></td>
                            <td className="px-3 py-1.5 text-xs text-muted-foreground hidden md:table-cell">{s.notes || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <ConfirmDialog
        open={!!aRemover}
        onOpenChange={(o) => { if (!o) setARemover(null); }}
        title="Remover comprovante"
        description={aRemover ? `Remover "${aRemover.file_name}"? O arquivo será apagado.` : ''}
        onConfirm={() => { if (aRemover) remover.mutate(aRemover); setARemover(null); }}
        confirmLabel="Remover"
        variant="destructive"
      />
    </div>
  );
}
