// Reatribuição de operador: qual MÁQUINA acompanha o atendimento.
//
// Regra ("quando for possível"):
//   1. operador de destino com UMA máquina vinculada  → essa máquina;
//   2. com VÁRIAS → a que ele mais usou naquele tipo de serviço (histórico de
//      atendimentos finalizados); sem histórico que decida → mantém a atual;
//   3. SEM máquina vinculada → mantém a atual.
// Vínculos: tabela operator_machinery (Colaboradores / Frotas).

export type MotivoMaquina = 'unica' | 'historico' | 'ja_igual' | 'sem_vinculo' | 'indefinida';

export interface EscolhaMaquina {
  /** Máquina a gravar; null = manter a atual. */
  machineryId: string | null;
  motivo: MotivoMaquina;
}

type Servico = { demand_type_id?: string | null; machinery_id?: string | null };
type Historico = { operator_id?: string | null; demand_type_id?: string | null; machinery_id?: string | null; status?: string | null };

/** operador|tipo → máquina mais usada (só entre as máquinas vinculadas ao operador). */
export function historicoDeMaquinas(servicos: Historico[], vinculos: Record<string, string[]>): Record<string, string> {
  const cont = new Map<string, Map<string, number>>();
  servicos.forEach((s) => {
    if (s.status !== 'completed' || !s.operator_id || !s.demand_type_id || !s.machinery_id) return;
    if (!(vinculos[s.operator_id] || []).includes(s.machinery_id)) return;
    const k = `${s.operator_id}|${s.demand_type_id}`;
    const m = cont.get(k) ?? new Map<string, number>();
    m.set(s.machinery_id, (m.get(s.machinery_id) || 0) + 1);
    cont.set(k, m);
  });
  const out: Record<string, string> = {};
  cont.forEach((m, k) => {
    const ord = [...m.entries()].sort((a, b) => b[1] - a[1]);
    // empate entre as mais usadas = não dá para decidir com segurança
    if (ord.length === 1 || ord[0][1] > ord[1][1]) out[k] = ord[0][0];
  });
  return out;
}

export function escolherMaquina(
  servico: Servico,
  paraOperador: string,
  vinculos: Record<string, string[]>,
  historico: Record<string, string>,
): EscolhaMaquina {
  const maquinas = vinculos[paraOperador] || [];
  let alvo: string | null = null;
  let motivo: MotivoMaquina;
  if (maquinas.length === 0) motivo = 'sem_vinculo';
  else if (maquinas.length === 1) { alvo = maquinas[0]; motivo = 'unica'; }
  else {
    const h = servico.demand_type_id ? historico[`${paraOperador}|${servico.demand_type_id}`] : undefined;
    if (h) { alvo = h; motivo = 'historico'; } else motivo = 'indefinida';
  }
  if (alvo && servico.machinery_id === alvo) return { machineryId: null, motivo: 'ja_igual' };
  return { machineryId: alvo, motivo };
}
