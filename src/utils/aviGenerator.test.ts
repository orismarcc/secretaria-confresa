import { describe, it, expect } from 'vitest';
import { descricaoAvi } from './aviGenerator';

const base = { produtor: 'Produtor Teste', assentamento: 'PA Teste' };

describe('descrição da atividade no AVI', () => {
  it('patrulha mecanizada → ASSISTÊNCIA TÉCNICA', () => {
    expect(descricaoAvi({ ...base, categoria: 'patrulha_mecanizada', tipo: 'Grade', finalidade: 'Plantio de mandioca' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA PLANTIO DE MANDIOCA A PRODUTOR TESTE EM PA TESTE');
    expect(descricaoAvi({ ...base, categoria: 'patrulha_mecanizada', tipo: 'Grade', finalidade: '' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA GRADE A PRODUTOR TESTE EM PA TESTE');
  });

  it('PC → ASSISTÊNCIA TÉCNICA PARA IMPLANTAÇÃO DE …', () => {
    expect(descricaoAvi({ ...base, categoria: 'patrulha_mecanizada', tipo: 'PC', finalidade: 'bebedouro' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA IMPLANTAÇÃO DE BEBEDOURO A PRODUTOR TESTE EM PA TESTE');
  });

  it('calcário → ASSISTÊNCIA TÉCNICA PARA CORREÇÃO DE SOLO PARA … (sem repetir)', () => {
    expect(descricaoAvi({ ...base, categoria: 'calcario', tipo: 'Logística de Calcário', finalidade: 'Plantio de pastagens' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA CORREÇÃO DE SOLO PARA PLANTIO DE PASTAGENS A PRODUTOR TESTE EM PA TESTE');
    expect(descricaoAvi({ ...base, categoria: 'calcario', tipo: 'Logística de Calcário', finalidade: 'Correção de solo' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA CORREÇÃO DE SOLO A PRODUTOR TESTE EM PA TESTE');
    expect(descricaoAvi({ ...base, categoria: 'calcario', tipo: 'Logística de Calcário', finalidade: '' }))
      .toBe('ASSISTÊNCIA TÉCNICA PARA CORREÇÃO DE SOLO A PRODUTOR TESTE EM PA TESTE');
  });

  it('demais categorias continuam como antes', () => {
    expect(descricaoAvi({ ...base, categoria: 'logistica_insumos', tipo: 'Logística de insumos', finalidade: 'Sementes' }))
      .toBe('LOGÍSTICA DE INSUMOS PARA SEMENTES A PRODUTOR TESTE EM PA TESTE');
  });
});
