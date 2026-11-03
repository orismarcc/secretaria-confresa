import { describe, it, expect } from 'vitest';
import { calcularEconomia, custoProdutor, PREMISSAS_PADRAO } from './economiaProdutor';

const tipos: Record<string, string> = { g: 'Grade', p: 'PC', a: 'Assistência Técnica' };
const nome = (id: string) => tipos[id];

describe('economia do produtor', () => {
  it('custo pela Secretaria = litros × diesel + UPFM', () => {
    expect(custoProdutor({ fuel_liters: 40 }, PREMISSAS_PADRAO)).toBeCloseTo(40 * 7.5 + 71.15);
    // sem litros: usa a DAM (que já inclui a UPFM)
    expect(custoProdutor({ fuel_liters: null, dam_value: 371.15 }, PREMISSAS_PADRAO)).toBeCloseTo(371.15);
    // sem litros nem DAM: só a UPFM
    expect(custoProdutor({}, PREMISSAS_PADRAO)).toBeCloseTo(71.15);
  });

  it('soma particular × pago por categoria e por mês, só finalizados de Grade/PC com horas', () => {
    const r = calcularEconomia([
      { status: 'completed', completed_at: '2026-03-10T12:00:00Z', demand_type_id: 'g', worked_hours: 4, fuel_liters: 20 },
      { status: 'completed', completed_at: '2026-03-20 12:00:00+00', demand_type_id: 'p', worked_hours: 5, fuel_liters: 100, producer_id: 'x' },
      { status: 'completed', completed_at: '2026-04-02T12:00:00Z', demand_type_id: 'p', worked_hours: 2, fuel_liters: 40, producer_id: 'x' },
      { status: 'pending', completed_at: null, demand_type_id: 'p', worked_hours: 9 },
      { status: 'completed', completed_at: '2026-04-02T12:00:00Z', demand_type_id: 'a', worked_hours: 3 },
      { status: 'completed', completed_at: '2026-04-02T12:00:00Z', demand_type_id: 'g', worked_hours: 0 },
    ], nome);
    expect(r.total.atendimentos).toBe(3);
    expect(r.total.horas).toBe(11);
    expect(r.porCategoria.grade.mercadoMin).toBe(800);
    expect(r.porCategoria.grade.mercadoMax).toBe(1200);
    expect(r.porCategoria.grade.mercado).toBe(1000);
    expect(r.porCategoria.pc.mercado).toBe(7 * 400);
    expect(r.porCategoria.pc.produtor).toBeCloseTo(140 * 7.5 + 2 * 71.15);
    expect(r.porCategoria.pc.produtores.size).toBe(1); // mesmo produtor, 2 atendimentos
    expect(r.porMes.map((m) => [m.chave, m.atendimentos])).toEqual([['2026-03', 2], ['2026-04', 1]]);
  });
});
