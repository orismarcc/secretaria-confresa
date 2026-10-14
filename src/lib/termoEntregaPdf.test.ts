import { describe, it, expect } from 'vitest';
import { textoTermo, quantidadeComObjeto, montarTermoPdf } from './termoEntregaPdf';

const base = { objeto: 'mudas de açaí', quantidade: 50, unidade: 'unidade', produtor: 'Maria Teste da Silva', cpf: '52998224725', data: new Date(2026, 9, 14) };

describe('termo de entrega (modelo padrão)', () => {
  it('troca só o objeto, a quantidade e os dados do produtor', () => {
    const t = textoTermo(base);
    const tudo = t.blocos.map((b) => b.texto).join('\n');
    expect(t.blocos[0].texto).toBe('TERMO DE COMPROMISSO DE ENTREGA E USO DE MUDAS DE AÇAÍ');
    expect(tudo).toContain('entrega gratuita de mudas de açaí ao BENEFICIÁRIO(A)');
    expect(tudo).toContain('Serão entregues ao BENEFICIÁRIO(A) 50 mudas de açaí, em condições adequadas');
    expect(tudo).toContain('CNPJ nº 37.464.716/0001-50');
    expect(tudo).toContain('CLÁUSULA OITAVA – DO FORO');
    expect(t.produtor).toBe('MARIA TESTE DA SILVA');
    expect(t.cpf).toBe('529.982.247-25');
    expect(t.data).toBe('Confresa/MT, 14 de outubro de 2026.');
  });

  it('outro objeto muda o título e as cláusulas do objeto', () => {
    const t = textoTermo({ ...base, objeto: 'mudas de cacau', quantidade: 1200 });
    expect(t.blocos[0].texto).toBe('TERMO DE COMPROMISSO DE ENTREGA E USO DE MUDAS DE CACAU');
    expect(t.blocos.map((b) => b.texto).join('\n')).toContain('Serão entregues ao BENEFICIÁRIO(A) 1.200 mudas de cacau,');
  });

  it('quantidade com unidade de medida', () => {
    expect(quantidadeComObjeto(20, 'sementes de milho', 'kg')).toBe('20 kg de sementes de milho');
    expect(quantidadeComObjeto(2.5, 'calcário', 'ton')).toBe('2,5 ton de calcário');
    expect(quantidadeComObjeto(10, 'mudas de açaí', null)).toBe('10 mudas de açaí');
  });

  it('sem CPF deixa o espaço para preencher', () => {
    expect(textoTermo({ ...base, cpf: null }).cpf).toMatch(/^_+$/);
  });

  it('gera o PDF', () => {
    const doc = montarTermoPdf(base);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const out = doc.output();
    expect(out.startsWith('%PDF')).toBe(true);
  });
});
