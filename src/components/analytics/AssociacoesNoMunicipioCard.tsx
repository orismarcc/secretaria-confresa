// Análises: atendimentos de patrulha do município = Secretaria + associações.
// Os atendimentos das associações também contam para o município.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Handshake } from 'lucide-react';
import { useAtendimentosAssociacoes } from '@/hooks/useAssociacoes';
import { calcularMetricas } from '@/lib/associacoes';

const fmt = (v: number, c = 1) => v.toLocaleString('pt-BR', { maximumFractionDigits: c });

/** `servicosSecretaria`: atendimentos da Secretaria já filtrados pelo exercício. */
export function AssociacoesNoMunicipioCard({ servicosSecretaria, exercicio, exercicioLabel }: {
  servicosSecretaria: { status?: string; worked_hours?: number | string | null; worked_area?: number | string | null }[];
  exercicio: string; // 'all' ou ano
  exercicioLabel: string;
}) {
  const navigate = useNavigate();
  const { data: atendimentos = [] } = useAtendimentosAssociacoes();
  const dados = useMemo(() => {
    const assoc = exercicio === 'all' ? atendimentos : atendimentos.filter((a) => a.data_atendimento.startsWith(exercicio));
    const finalizados = servicosSecretaria.filter((s) => s.status === 'completed');
    const sec = {
      atendimentos: finalizados.length,
      horas: finalizados.reduce((t, s) => t + (Number(s.worked_hours) || 0), 0),
      area: finalizados.reduce((t, s) => t + (Number(s.worked_area) || 0), 0),
    };
    const as = calcularMetricas(assoc).total;
    return { sec, as, total: { atendimentos: sec.atendimentos + as.atendimentos, horas: sec.horas + as.horas, area: sec.area + as.area } };
  }, [atendimentos, servicosSecretaria, exercicio]);

  if (!atendimentos.length) return null; // só aparece quando as associações começarem a lançar
  const pct = (v: number, t: number) => (t ? Math.round((v / t) * 100) : 0);
  const linhas = [
    { rot: 'Atendimentos', s: fmt(dados.sec.atendimentos, 0), a: fmt(dados.as.atendimentos, 0), t: fmt(dados.total.atendimentos, 0), p: pct(dados.as.atendimentos, dados.total.atendimentos) },
    { rot: 'Horas de máquina', s: `${fmt(dados.sec.horas)} h`, a: `${fmt(dados.as.horas)} h`, t: `${fmt(dados.total.horas)} h`, p: pct(dados.as.horas, dados.total.horas) },
    { rot: 'Área trabalhada', s: `${fmt(dados.sec.area)} ha`, a: `${fmt(dados.as.area)} ha`, t: `${fmt(dados.total.area)} ha`, p: pct(dados.as.area, dados.total.area) },
  ];
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2"><Handshake className="h-4 w-4 text-primary" /> Patrulha no município: Secretaria + associações</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/associacoes')}>Ver associações</Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{exercicioLabel} · Secretaria considera só atendimentos finalizados.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[480px]">
            <thead className="text-muted-foreground border-b">
              <tr><th className="py-1.5 text-left font-medium" /><th className="py-1.5 text-right font-medium">Secretaria</th><th className="py-1.5 text-right font-medium">Associações</th><th className="py-1.5 text-right font-medium">Município</th><th className="py-1.5 text-right font-medium">Parte das associações</th></tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rot} className="border-b last:border-0">
                  <td className="py-2 font-medium">{l.rot}</td>
                  <td className="py-2 text-right tabular-nums">{l.s}</td>
                  <td className="py-2 text-right tabular-nums">{l.a}</td>
                  <td className="py-2 text-right tabular-nums font-semibold">{l.t}</td>
                  <td className="py-2 text-right tabular-nums">{l.p}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
