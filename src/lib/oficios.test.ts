import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import {
  filtrarOficios, ordenarOficios, paginar, calcularIndicadores, proximoNumeroLocal,
  numeroCompleto, dataExtenso, dataBR, nomeSeguro, problemaPdf, problemaModelo,
  preencherModeloDocx, FILTROS_VAZIOS, type Oficio,
} from './oficios';

const of = (p: Partial<Oficio>): Oficio => ({
  id: Math.random().toString(36).slice(2), ano: 2026, numero: 1, data_oficio: '2026-01-10',
  destinatario: 'Secretaria de Finanças', assunto: 'Assunto', categoria: 'Solicitação', situacao: 'emitido',
  descricao: null, modelo_id: null, arquivo_path: null, arquivo_nome: null, arquivo_tamanho: null, arquivo_versao: 0,
  created_by: null, updated_by: null, created_at: '', updated_at: '', ...p,
});

const lista = [
  of({ numero: 473, data_oficio: '2026-11-06', assunto: 'Restituição de DAM', destinatario: 'Secretaria Municipal de Finanças', categoria: 'Restituição de DAM', arquivo_path: 'x.pdf' }),
  of({ numero: 12, data_oficio: '2026-02-03', assunto: 'Convite para audiência', destinatario: 'Câmara Municipal', categoria: 'Convite', situacao: 'enviado' }),
  of({ numero: 12, ano: 2025, data_oficio: '2025-05-20', assunto: 'Solicitação de máquinas', destinatario: 'Governo do Estado', situacao: 'respondido' }),
];

describe('ofícios — pesquisa e filtros', () => {
  it('pesquisa por número, número/ano, ano, assunto e destinatário (sem acento)', () => {
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: '473' })).toHaveLength(1);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: '12/2025' }).map((o) => o.ano)).toEqual([2025]);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: '12' })).toHaveLength(2);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: '2025' })).toHaveLength(1);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: 'restituicao' })).toHaveLength(1);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, busca: 'camara' })).toHaveLength(1);
  });
  it('filtra por período, categoria, situação e ano', () => {
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, de: '2026-01-01', ate: '2026-06-30' }).map((o) => o.numero)).toEqual([12]);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, categoria: 'Convite' })).toHaveLength(1);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, situacao: 'respondido' })).toHaveLength(1);
    expect(filtrarOficios(lista, { ...FILTROS_VAZIOS, ano: '2026' })).toHaveLength(2);
  });
  it('ordena e pagina', () => {
    expect(ordenarOficios(lista, 'numero', 'desc').map(numeroCompleto)).toEqual(['473/2026', '12/2026', '12/2025']);
    expect(ordenarOficios(lista, 'data', 'asc').map((o) => o.data_oficio)).toEqual(['2025-05-20', '2026-02-03', '2026-11-06']);
    const p = paginar([1, 2, 3, 4, 5], 3, 2);
    expect(p).toEqual({ itens: [5], total: 5, paginas: 3, pagina: 3 });
    expect(paginar([1, 2], 9, 10).pagina).toBe(1);
  });
});

describe('ofícios — indicadores e numeração', () => {
  it('conta total, por ano, situação e categoria, com os números de cada grupo', () => {
    const ind = calcularIndicadores(lista);
    expect(ind.total).toBe(3);
    expect(ind.comArquivo).toBe(1);
    expect(ind.porAno.map((g) => [g.chave, g.oficios.length])).toEqual([['2026', 2], ['2025', 1]]);
    expect(ind.porAno[0].oficios.map(numeroCompleto)).toEqual(['473/2026', '12/2026']);
    expect(ind.porSituacao.map((g) => g.rotulo)).toEqual(['Emitido', 'Enviado', 'Respondido']);
  });
  it('sugere o próximo número do ano', () => {
    expect(proximoNumeroLocal(lista, 2026)).toBe(474);
    expect(proximoNumeroLocal(lista, 2027)).toBe(1);
  });
});

describe('ofícios — arquivos e modelos', () => {
  it('datas, nomes e validação de arquivos', () => {
    expect(dataExtenso('2026-11-06')).toBe('06 de novembro de 2026');
    expect(dataBR('2026-11-06')).toBe('06/11/2026');
    expect(nomeSeguro('Ofício nº 473 assinado.pdf')).toBe('Oficio-n-473-assinado.pdf');
    expect(problemaPdf(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull();
    expect(problemaPdf(new File(['x'], 'a.docx'))).toMatch(/PDF/);
    expect(problemaModelo(new File(['x'], 'modelo.docx'))).toBeNull();
    expect(problemaModelo(new File(['x'], 'modelo.png', { type: 'image/png' }))).toMatch(/Word/);
  });

  it('preenche o modelo padrão mantendo o timbrado; campos desconhecidos ficam visíveis', () => {
    const buf = readFileSync(resolve(__dirname, '../../public/templates/oficio-padrao.docx'));
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const blob = preencherModeloDocx(ab, {
      numero: '474/2026', data: '2026-11-12', destinatario: 'À Câmara Municipal', assunto: 'Convite',
      categoria: 'Convite', descricao: 'Texto do ofício.',
    });
    expect(blob.size).toBeGreaterThan(0);
    const origem = new PizZip(ab);
    // modelo com campo desconhecido
    const xml = origem.file('word/document.xml')!.asText().replace('{assunto}', '{assunto} {campo_livre}');
    origem.file('word/document.xml', xml);
    const ab2 = origem.generate({ type: 'arraybuffer' });
    return new Promise<void>((ok) => {
      const r = new FileReader();
      r.onload = () => {
        const z = new PizZip(r.result as ArrayBuffer);
        const t = z.file('word/document.xml')!.asText();
        expect(t).toContain('OFÍCIO Nº 474/2026 – SMA');
        expect(t).toContain('12 de novembro de 2026');
        expect(t).toContain('Convite');
        expect(t).toContain('{campo_livre}');
        expect(t).toContain('w:drawing'); // timbrado (rodapé) preservado
        expect(z.file('word/header1.xml')).toBeTruthy();
        ok();
      };
      r.readAsArrayBuffer(preencherModeloDocx(ab2, {
        numero: '474/2026', data: '2026-11-12', destinatario: 'X', assunto: 'Convite', categoria: 'Convite', descricao: '',
      }));
    });
  });
});
