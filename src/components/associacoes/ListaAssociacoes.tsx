// Lista de associações em cards, com pesquisa e filtros.
import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/SearchInput';
import { AlertTriangle, CalendarClock, Plus, Tractor, User } from 'lucide-react';
import { normalizeText } from '@/lib/text';
import { useSettlements } from '@/hooks/useSupabaseData';
import { AnelRegularidade, SituacaoBadge, dataBR, selectCls } from './comum';
import { PrimeirosPassos } from './PainelAssociacoes';
import {
  SITUACOES_ASSOCIACAO, formatarCnpj, situacaoMandato, tipoAssociacao,
  type Associacao, type Cessao, type Regularidade,
} from '@/lib/associacoes';

export function ListaAssociacoes({ associacoes, regularidades, cessoes, onAbrir, onNova }: {
  associacoes: Associacao[];
  regularidades: Map<string, Regularidade>;
  cessoes: Cessao[];
  onAbrir: (id: string) => void;
  onNova: () => void;
}) {
  const { data: assentamentos = [] } = useSettlements();
  const [busca, setBusca] = useState('');
  const [situacao, setSituacao] = useState('');
  const [regular, setRegular] = useState('');
  const nomeAssent = (id: string | null) => (assentamentos as { id: string; name: string }[]).find((s) => s.id === id)?.name;

  const lista = useMemo(() => {
    const t = normalizeText(busca);
    const digitos = busca.replace(/\D/g, '');
    return associacoes.filter((a) => {
      if (situacao && a.situacao !== situacao) return false;
      const r = regularidades.get(a.id);
      if (regular === 'sim' && !r?.regular) return false;
      if (regular === 'nao' && r?.regular) return false;
      if (!t) return true;
      return normalizeText(a.nome).includes(t) || normalizeText(a.sigla).includes(t) || normalizeText(a.presidente_nome).includes(t)
        || (digitos.length >= 3 && (a.cnpj ?? '').includes(digitos));
    });
  }, [associacoes, regularidades, busca, situacao, regular]);

  if (!associacoes.length) return <PrimeirosPassos onNova={onNova} />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col lg:flex-row gap-2">
          <SearchInput value={busca} onChange={setBusca} placeholder="Nome, sigla, CNPJ ou presidente" className="flex-1" />
          <select value={situacao} onChange={(e) => setSituacao(e.target.value)} className={`${selectCls} lg:w-48`} aria-label="Situação">
            <option value="">Todas as situações</option>
            {SITUACOES_ASSOCIACAO.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
          </select>
          <select value={regular} onChange={(e) => setRegular(e.target.value)} className={`${selectCls} lg:w-48`} aria-label="Regularidade">
            <option value="">Toda regularidade</option>
            <option value="sim">Regulares</option>
            <option value="nao">Com pendências</option>
          </select>
          <Button onClick={onNova} className="gap-2"><Plus className="h-4 w-4" /> Nova</Button>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{lista.length} de {associacoes.length} associação(ões)</p>
      {lista.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma associação encontrada com esses filtros.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((a) => {
            const r = regularidades.get(a.id);
            const maq = cessoes.filter((c) => c.associacao_id === a.id && !c.data_devolucao).length;
            const mandato = situacaoMandato(a.mandato_fim);
            return (
              <button key={a.id} type="button" onClick={() => onAbrir(a.id)} className="text-left rounded-xl border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5"><SituacaoBadge situacao={a.situacao} />{a.sigla && <span className="text-xs font-semibold text-muted-foreground">{a.sigla}</span>}</div>
                    <p className="font-semibold leading-tight">{a.nome}</p>
                    <p className="text-xs text-muted-foreground">{a.cnpj ? `CNPJ ${formatarCnpj(a.cnpj)}` : 'CNPJ não informado'}</p>
                    <p className="text-xs text-muted-foreground">{tipoAssociacao(a.tipo)}{nomeAssent(a.settlement_id) ? ` · ${nomeAssent(a.settlement_id)}` : ''}</p>
                  </div>
                  {r && <AnelRegularidade percentual={r.percentual} regular={r.regular} tamanho={58} rotulo={false} />}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {a.presidente_nome && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {a.presidente_nome}</span>}
                  {maq > 0 && <span className="inline-flex items-center gap-1"><Tractor className="h-3.5 w-3.5" /> {maq} máquina(s)</span>}
                  {r && !r.regular && <span className="inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3.5 w-3.5" /> {r.pendencias.length} pendência(s)</span>}
                  {(mandato === 'vencido' || mandato === 'vencendo') && (
                    <span className={`inline-flex items-center gap-1 ${mandato === 'vencido' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'}`}>
                      <CalendarClock className="h-3.5 w-3.5" /> Mandato {mandato === 'vencido' ? 'vencido' : `até ${dataBR(a.mandato_fim)}`}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
