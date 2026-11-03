// Economia do produtor rural: quanto custaria contratar o serviço particular
// (preço de mercado da hora em Confresa/MT) × quanto ele paga pela Secretaria
// (só o combustível + 1 UPFM por atendimento).
//
// Base: atendimentos FINALIZADOS de Grade e PC com horas trabalhadas.
// Custo pela Secretaria = horas × valor da hora pela Secretaria (combustível +
// UPFM), informado pela Secretaria em 03/11/2026: Grade R$ 165,22/h e
// PC R$ 267,15/h.

export interface PremissasEconomia {
  /** Hora pela Secretaria (R$/h) — o que o produtor paga. */
  gradeSecretaria: number;
  pcSecretaria: number;
  /** Hora de trator com grade no mercado (R$/h): faixa mínima e máxima. */
  gradeMin: number;
  gradeMax: number;
  /** Hora de PC no mercado (R$/h). */
  pc: number;
}

export const PREMISSAS_PADRAO: PremissasEconomia = {
  gradeSecretaria: 165.22,
  pcSecretaria: 267.15,
  gradeMin: 200,
  gradeMax: 300,
  pc: 400,
};

export type CategoriaEconomia = 'grade' | 'pc';

export function categoriaDoTipo(nome: string | null | undefined): CategoriaEconomia | null {
  const n = (nome || '').trim().toLowerCase();
  if (n === 'grade') return 'grade';
  if (n === 'pc') return 'pc';
  return null;
}

export interface TotaisEconomia {
  atendimentos: number;
  horas: number;
  /** Particular: faixa (mín/máx) e referência (média da faixa). */
  mercadoMin: number;
  mercadoMax: number;
  mercado: number;
  /** Pago pelo produtor (combustível + UPFM). */
  produtor: number;
  /** Produtores distintos atendidos (para a média por produtor). */
  produtores: Set<string>;
}

export interface MesEconomia extends TotaisEconomia {
  chave: string; // yyyy-MM
}

export interface ResultadoEconomia {
  total: TotaisEconomia;
  porCategoria: Record<CategoriaEconomia, TotaisEconomia>;
  porMes: MesEconomia[];
}

const vazio = (): TotaisEconomia => ({ atendimentos: 0, horas: 0, mercadoMin: 0, mercadoMax: 0, mercado: 0, produtor: 0, produtores: new Set() });

function somar(t: TotaisEconomia, horas: number, min: number, max: number, produtor: number, produtorId?: string | null) {
  if (produtorId) t.produtores.add(produtorId);
  t.atendimentos += 1;
  t.horas += horas;
  t.mercadoMin += min;
  t.mercadoMax += max;
  t.mercado += (min + max) / 2;
  t.produtor += produtor;
}

export function calcularEconomia(
  services: any[],
  nomeDoTipo: (demandTypeId: string) => string | null | undefined,
  p: PremissasEconomia = PREMISSAS_PADRAO,
): ResultadoEconomia {
  const total = vazio();
  const porCategoria: Record<CategoriaEconomia, TotaisEconomia> = { grade: vazio(), pc: vazio() };
  const meses = new Map<string, MesEconomia>();

  for (const s of services) {
    if (s?.status !== 'completed' || !s.completed_at) continue;
    const cat = categoriaDoTipo(nomeDoTipo(s.demand_type_id) ?? s.demand_types?.name);
    const horas = Number(s.worked_hours) || 0;
    if (!cat || horas <= 0) continue;
    const min = horas * (cat === 'grade' ? p.gradeMin : p.pc);
    const max = horas * (cat === 'grade' ? p.gradeMax : p.pc);
    const prod = horas * (cat === 'grade' ? p.gradeSecretaria : p.pcSecretaria);
    const chave = String(s.completed_at).replace(' ', 'T').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(chave)) continue;
    const mes = meses.get(chave) ?? { chave, ...vazio() };
    somar(mes, horas, min, max, prod, s.producer_id);
    meses.set(chave, mes);
    somar(total, horas, min, max, prod, s.producer_id);
    somar(porCategoria[cat], horas, min, max, prod, s.producer_id);
  }

  return {
    total,
    porCategoria,
    porMes: Array.from(meses.values()).sort((a, b) => a.chave.localeCompare(b.chave)),
  };
}
