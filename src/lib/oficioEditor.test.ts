import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PizZip from 'pizzip';
import {
  MODELO_PADRAO_HTML, editorParaWordXml, gerarDocxDoEditor, paginaImpressao, preencherCamposHtml, type NoEditor,
} from './oficioEditor';

const t = (text: string, marks: string[] = [], extra?: { type: string; attrs?: Record<string, unknown> }[]): NoEditor =>
  ({ type: 'text', text, marks: [...marks.map((type) => ({ type })), ...(extra ?? [])] });
const p = (content: NoEditor[], attrs: Record<string, unknown> = {}): NoEditor => ({ type: 'paragraph', attrs, content });

const lerBlob = (b: Blob) => new Promise<ArrayBuffer>((ok) => { const r = new FileReader(); r.onload = () => ok(r.result as ArrayBuffer); r.readAsArrayBuffer(b); });
const modelo = () => { const b = readFileSync(resolve(__dirname, '../../public/templates/oficio-padrao.docx')); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

describe('editor de ofícios — campos', () => {
  it('preenche os campos do modelo padrão escapando o texto', () => {
    const html = preencherCamposHtml(MODELO_PADRAO_HTML, {
      numero: '474/2026', data: '2026-11-12', destinatario: 'À Câmara <Municipal>', assunto: 'A & B',
      categoria: 'Convite', descricao: 'Linha 1\nLinha 2',
    });
    expect(html).toContain('OFÍCIO Nº 474/2026 – SMA');
    expect(html).toContain('12 de novembro de 2026');
    expect(html).toContain('À Câmara &lt;Municipal&gt;');
    expect(html).toContain('A &amp; B');
    expect(html).toContain('Linha 1<br>Linha 2');
    expect(html).not.toMatch(/\{(numero|data|destinatario|assunto|descricao)\}/);
  });
  it('sem descrição, deixa uma orientação para escrever', () => {
    const html = preencherCamposHtml('<p>{descricao}</p><p>{outro}</p>', { numero: '', data: '', destinatario: '', assunto: '', categoria: '', descricao: '' });
    expect(html).toContain('Escreva aqui o texto do ofício.');
    expect(html).toContain('{outro}');
  });
});

describe('editor de ofícios — Word', () => {
  it('converte formatação, alinhamento, recuo, tamanho, listas e tabela', () => {
    const xml = editorParaWordXml({
      type: 'doc', content: [
        p([t('Negrito', ['bold']), t(' itálico', ['italic']), t(' sub', ['underline']), t(' <&>')], { textAlign: 'justify', recuo: true }),
        p([t('Grande', [], [{ type: 'textStyle', attrs: { fontSize: '14pt' } }])], { textAlign: 'center' }),
        { type: 'bulletList', content: [{ type: 'listItem', content: [p([t('item A')])] }] },
        { type: 'orderedList', attrs: { start: 1 }, content: [{ type: 'listItem', content: [p([t('um')])] }, { type: 'listItem', content: [p([t('dois')])] }] },
        { type: 'table', content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', content: [p([t('Col')])] }, { type: 'tableHeader', content: [p([t('Val')])] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', content: [p([t('a')])] }, { type: 'tableCell', content: [p([])] }] },
        ] },
        { type: 'heading', attrs: { level: 1 }, content: [t('Título')] },
      ],
    });
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('<w:i/>');
    expect(xml).toContain('<w:u w:val="single"/>');
    expect(xml).toContain('&lt;&amp;&gt;');
    expect(xml).toContain('<w:jc w:val="both"/>');
    expect(xml).toContain('w:firstLine="709"');
    expect(xml).toContain('<w:sz w:val="28"/>');
    expect(xml).toContain('<w:jc w:val="center"/>');
    expect(xml).toContain('•\t');
    expect(xml).toContain('1.\t');
    expect(xml).toContain('2.\t');
    expect(xml.match(/<w:tc>/g)).toHaveLength(4);
    expect(xml).toContain('w:fill="EFEFEF"');
    expect(xml).toContain('<w:sz w:val="32"/>'); // título 1
    // cada célula tem parágrafo (Word exige)
    expect(xml).not.toMatch(/<w:tc><w:tcPr>[^]*?<\/w:tcPr><\/w:tc>/);
  });

  it('gera o .docx no modelo oficial: cabeçalho mantido, corpo trocado e rodapé no pé da página', async () => {
    const blob = gerarDocxDoEditor({ type: 'doc', content: [p([t('Texto do ofício')])] }, modelo());
    const z = new PizZip(await lerBlob(blob));
    const doc = z.file('word/document.xml')!.asText();
    expect(doc).toContain('Texto do ofício');
    expect(doc).not.toContain('{numero}');
    expect(doc).toContain('<w:headerReference');
    expect(doc).toMatch(/w:bottom="2400"/);
    expect(doc).not.toContain('<wp:anchor'); // rodapé não fica mais preso ao corpo
    const ftr = z.file('word/footer1.xml')!.asText();
    expect(ftr).toContain('relativeFrom="page"');
    expect(ftr).toContain('r:embed="rIdRodape"');
    expect(ftr.endsWith('</w:ftr>')).toBe(true);
    expect(z.file('word/_rels/footer1.xml.rels')!.asText()).toContain('media/image1.jpg');
    expect(z.file('word/header1.xml')).toBeTruthy();
  });
});

describe('editor de ofícios — impressão', () => {
  it('monta a página A4 com timbrado, rodapé e o texto', () => {
    const html = paginaImpressao('<p>Olá</p>', 'Oficio <1>', 'https://exemplo');
    expect(html).toContain('@page { size: A4; margin: 0; }');
    expect(html).toContain('https://exemplo/templates/timbrado/logo.png');
    expect(html).toContain('https://exemplo/templates/timbrado/rodape.jpg');
    expect(html).toContain('<div class="texto-oficio"><p>Olá</p></div>');
    expect(html).toContain('<title>Oficio &lt;1&gt;</title>');
  });
});
