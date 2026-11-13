import { describe, it, expect } from 'vitest';
import {
  cnpjValido, formatarCnpj, calcularRegularidade, calcularMetricas, situacaoMandato, cessoesAtivas, problemaArquivo,
  type ItemChecklist, type DocumentoAssociacao, type AtendimentoAssociacao, type Cessao,
} from './associacoes';

const dia = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10); };
const item = (p: Partial<ItemChecklist>): ItemChecklist => ({
  id: p.id ?? Math.random().toString(36).slice(2), codigo: null, nome: 'Item', categoria: 'fiscal', descricao: null,
  como_obter: null, link_oficial: null, obrigatorio: true, tem_validade: true, ordem: 1, ativo: true, ...p,
});
const doc = (p: Partial<DocumentoAssociacao>): DocumentoAssociacao => ({
  id: Math.random().toString(36).slice(2), associacao_id: 'A', item_id: null, titulo: 'Doc', numero: null,
  data_emissao: null, data_validade: null, arquivo_path: null, arquivo_nome: null, arquivo_tamanho: null,
  observacao: null, enviado_por: null, created_at: '2026-01-01T00:00:00Z', ...p,
});

describe('associações — CNPJ', () => {
  it('valida e formata', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11222333000182')).toBe(false);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCnpj('112223')).toBe('11.222.3');
  });
});

describe('associações — checklist e regularidade', () => {
  const itens = [
    item({ id: 'cnd', nome: 'CND', tem_validade: true }),
    item({ id: 'estatuto', nome: 'Estatuto', tem_validade: false }),
    item({ id: 'crf', nome: 'CRF', tem_validade: true }),
    item({ id: 'alvara', nome: 'Alvará', obrigatorio: false }),
    item({ id: 'velho', nome: 'Inativo', ativo: false }),
  ];

  it('sem documentos: tudo pendente, irregular', () => {
    const r = calcularRegularidade('A', itens, [], []);
    expect(r.obrigatorios).toBe(3);
    expect(r.percentual).toBe(0);
    expect(r.regular).toBe(false);
    expect(r.itens.map((i) => i.item.id)).not.toContain('velho');
  });

  it('em dia, vencendo, vencido, sem validade e dispensa', () => {
    const docs = [
      doc({ item_id: 'cnd', data_validade: dia(10) }),          // vencendo (conta como em dia)
      doc({ item_id: 'estatuto' }),                              // ok (sem validade exigida)
      doc({ item_id: 'crf', data_validade: dia(-1), data_emissao: '2026-01-01' }), // vencido
      doc({ associacao_id: 'B', item_id: 'crf', data_validade: dia(90) }),        // de outra associação
    ];
    const r = calcularRegularidade('A', itens, docs, []);
    const st = Object.fromEntries(r.itens.map((i) => [i.item.id, i.status]));
    expect(st).toMatchObject({ cnd: 'vencendo', estatuto: 'ok', crf: 'vencido', alvara: 'pendente' });
    expect(r.obrigatoriosEmDia).toBe(2);
    expect(r.percentual).toBe(67);
    expect(r.regular).toBe(false);
    expect(r.pendencias.map((p) => p.item.id)).toEqual(['crf']);
    expect(r.vencendo.map((p) => p.item.id)).toEqual(['cnd']);

    // novo CRF em dia substitui o vencido (vale o mais recente); alvará opcional não pesa
    const r2 = calcularRegularidade('A', itens, [...docs, doc({ item_id: 'crf', data_validade: dia(120), data_emissao: '2026-05-01' })], []);
    expect(r2.regular).toBe(true);
    expect(r2.percentual).toBe(100);
    const crf = r2.itens.find((i) => i.item.id === 'crf')!;
    expect(crf.historico).toHaveLength(2);

    // documento sem validade num item que exige validade
    const r3 = calcularRegularidade('A', itens, [doc({ item_id: 'cnd' })], []);
    expect(r3.itens.find((i) => i.item.id === 'cnd')!.status).toBe('sem_validade');

    // "não se aplica" tira o item da conta
    const r4 = calcularRegularidade('A', [itens[0]], [], [{ associacao_id: 'A', item_id: 'cnd', motivo: 'x', created_at: '' }]);
    expect(r4.obrigatorios).toBe(0);
    expect(r4.regular).toBe(true);
  });

  it('mandato e cessões ativas', () => {
    expect(situacaoMandato(null)).toBe('sem_data');
    expect(situacaoMandato(dia(-3))).toBe('vencido');
    expect(situacaoMandato(dia(5))).toBe('vencendo');
    const c = (p: Partial<Cessao>): Cessao => ({ id: '1', associacao_id: 'A', machinery_id: 'm', data_cessao: '2026-01-01', data_devolucao: null, termo_path: null, termo_nome: null, observacao: null, ...p });
    expect(cessoesAtivas([c({}), c({ data_devolucao: '2026-02-01' })])).toHaveLength(1);
  });
});

describe('associações — métricas de atendimentos', () => {
  it('soma horas, área, combustível e produtores por mês, máquina, tipo e associação', () => {
    const at = (p: Partial<AtendimentoAssociacao>): AtendimentoAssociacao => ({
      id: Math.random().toString(36).slice(2), associacao_id: 'A', producer_id: null, produtor_nome: 'Fulano', demand_type_id: 'grade',
      machinery_id: 'm1', settlement_id: null, data_atendimento: '2026-03-10', horas: 2, area_ha: 1, combustivel_litros: 10, observacao: null, created_at: '', ...p,
    });
    const m = calcularMetricas([
      at({}), at({ produtor_nome: 'fulano ', horas: '3', data_atendimento: '2026-04-02' }),
      at({ producer_id: 'p1', produtor_nome: null, machinery_id: 'm2', associacao_id: 'B', demand_type_id: 'pc', horas: 6 }),
    ]);
    expect(m.total).toEqual({ atendimentos: 3, horas: 11, area: 3, combustivel: 30, produtores: 2 });
    expect(m.porMes.map((x) => [x.mes, x.atendimentos])).toEqual([['2026-03', 2], ['2026-04', 1]]);
    expect(m.porMaquina[0]).toMatchObject({ chave: 'm2', horas: 6 });
    expect(m.porAssociacao.find((x) => x.chave === 'A')!.horas).toBe(5);
  });
  it('valida arquivos', () => {
    expect(problemaArquivo(new File(['x'], 'cnd.pdf'))).toBeNull();
    expect(problemaArquivo(new File(['x'], 'foto.jpg'))).toBeNull();
    expect(problemaArquivo(new File(['x'], 'planilha.xlsx'))).toMatch(/PDF/);
  });
});
