// Editor de ofícios (como Word / Google Docs): barra de ferramentas e folha
// A4 com o timbrado da Prefeitura. Baseado no TipTap (ProseMirror): o texto
// é sempre normalizado pelo editor (não aceita HTML/scripts livres).
import { useEditor, EditorContent, Extension, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Braces, Columns3, Eraser, IndentIncrease, Italic,
  List, ListOrdered, Minus, Redo2, Rows3, Strikethrough, Table2, Trash2, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CSS_TEXTO_OFICIO, TIMBRADO, cabecalhoSvg } from '@/lib/oficioEditor';
import { CAMPOS_MODELO } from '@/lib/oficios';

// Tamanho da fonte (marca textStyle) e recuo de primeira linha (parágrafo).
const TamanhoFonte = Extension.create({
  name: 'tamanhoFonte',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
          renderHTML: (a) => (a.fontSize ? { style: `font-size: ${a.fontSize}` } : {}),
        },
      },
    }];
  },
});
const RecuoParagrafo = Extension.create({
  name: 'recuoParagrafo',
  addGlobalAttributes() {
    return [{
      types: ['paragraph'],
      attributes: {
        recuo: {
          default: false,
          parseHTML: (el) => (el as HTMLElement).getAttribute('data-recuo') === 'true',
          renderHTML: (a) => (a.recuo ? { 'data-recuo': 'true' } : {}),
        },
      },
    }];
  },
});

export function useEditorOficio(conteudoInicial: string, onAlterar: (html: string) => void) {
  return useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, code: false, codeBlock: false }),
      Underline,
      TextStyle,
      TamanhoFonte,
      RecuoParagrafo,
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'] }),
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      Placeholder.configure({ placeholder: 'Escreva o ofício aqui…' }),
    ],
    content: conteudoInicial,
    editorProps: { attributes: { class: 'texto-oficio focus:outline-none min-h-[120mm]', spellcheck: 'true', lang: 'pt-BR' } },
    onUpdate: ({ editor: e }) => onAlterar(e.getHTML()),
  }, []); // criado uma vez: a página só monta o editor com o conteúdo pronto
}

const TAMANHOS = ['9pt', '10pt', '11pt', '12pt', '14pt', '16pt', '18pt'];

function Botao({ ativo, onClick, titulo, children, desabilitado }: {
  ativo?: boolean; onClick: () => void; titulo: string; children: React.ReactNode; desabilitado?: boolean;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      aria-pressed={ativo}
      disabled={desabilitado}
      onMouseDown={(e) => e.preventDefault()} // não tira o foco do texto
      onClick={onClick}
      className={cn(
        'h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-md text-sm shrink-0 transition-colors',
        'hover:bg-muted disabled:opacity-40 disabled:pointer-events-none',
        ativo && 'bg-primary/15 text-primary',
      )}
    >
      {children}
    </button>
  );
}
const Sep = () => <span className="w-px h-6 bg-border mx-1 shrink-0" aria-hidden />;
const selCls = 'h-8 rounded-md border border-input bg-background px-1.5 text-sm shrink-0 focus:outline-none focus:ring-2 focus:ring-ring';

export function BarraFerramentas({ editor, comCampos }: { editor: Editor | null; comCampos?: boolean }) {
  if (!editor) return null;
  const c = () => editor.chain().focus();
  const estilo = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p';
  const tamanho = (editor.getAttributes('textStyle').fontSize as string) || '';
  const naTabela = editor.isActive('table');
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1 px-1 [scrollbar-width:thin]" role="toolbar" aria-label="Formatação">
      <Botao titulo="Desfazer (Ctrl+Z)" onClick={() => c().undo().run()} desabilitado={!editor.can().undo()}><Undo2 className="h-4 w-4" /></Botao>
      <Botao titulo="Refazer (Ctrl+Y)" onClick={() => c().redo().run()} desabilitado={!editor.can().redo()}><Redo2 className="h-4 w-4" /></Botao>
      <Sep />
      <select aria-label="Estilo do parágrafo" className={selCls} value={estilo} onChange={(e) => {
        const v = e.target.value;
        if (v === 'p') c().setParagraph().run();
        else c().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
      }}>
        <option value="p">Texto normal</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <select aria-label="Tamanho da fonte" className={selCls} value={tamanho} onChange={(e) => {
        const v = e.target.value;
        if (!v) c().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        else c().setMark('textStyle', { fontSize: v }).run();
      }}>
        <option value="">11 (padrão)</option>
        {TAMANHOS.filter((t) => t !== '11pt').map((t) => <option key={t} value={t}>{t.replace('pt', '')}</option>)}
      </select>
      <Sep />
      <Botao titulo="Negrito (Ctrl+B)" ativo={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></Botao>
      <Botao titulo="Itálico (Ctrl+I)" ativo={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></Botao>
      <Botao titulo="Sublinhado (Ctrl+U)" ativo={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Botao>
      <Botao titulo="Tachado" ativo={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Botao>
      <Sep />
      <Botao titulo="Alinhar à esquerda" ativo={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Botao>
      <Botao titulo="Centralizar" ativo={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Botao>
      <Botao titulo="Alinhar à direita" ativo={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Botao>
      <Botao titulo="Justificar" ativo={editor.isActive({ textAlign: 'justify' })} onClick={() => c().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Botao>
      <Botao titulo="Recuo da primeira linha" ativo={!!editor.getAttributes('paragraph').recuo}
        onClick={() => c().updateAttributes('paragraph', { recuo: !editor.getAttributes('paragraph').recuo }).run()}>
        <IndentIncrease className="h-4 w-4" />
      </Botao>
      <Sep />
      <Botao titulo="Lista com marcadores" ativo={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></Botao>
      <Botao titulo="Lista numerada" ativo={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Botao>
      <Botao titulo="Linha horizontal" onClick={() => c().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Botao>
      <Sep />
      <Botao titulo="Inserir tabela (3×3)" onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 className="h-4 w-4" /></Botao>
      {naTabela && (
        <>
          <Botao titulo="Adicionar linha abaixo" onClick={() => c().addRowAfter().run()}><Rows3 className="h-4 w-4" /></Botao>
          <Botao titulo="Adicionar coluna à direita" onClick={() => c().addColumnAfter().run()}><Columns3 className="h-4 w-4" /></Botao>
          <Botao titulo="Excluir linha" onClick={() => c().deleteRow().run()}><span className="text-xs font-semibold">−L</span></Botao>
          <Botao titulo="Excluir coluna" onClick={() => c().deleteColumn().run()}><span className="text-xs font-semibold">−C</span></Botao>
          <Botao titulo="Excluir tabela" onClick={() => c().deleteTable().run()}><Trash2 className="h-4 w-4 text-destructive" /></Botao>
        </>
      )}
      <Sep />
      <Botao titulo="Limpar formatação" onClick={() => c().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></Botao>
      {comCampos && (
        <>
          <Sep />
          <Braces className="h-4 w-4 text-muted-foreground shrink-0 ml-1" aria-hidden />
          <select aria-label="Inserir campo" className={selCls} value="" onChange={(e) => {
            if (e.target.value) c().insertContent(e.target.value).run();
          }}>
            <option value="">Inserir campo…</option>
            {CAMPOS_MODELO.map((f) => <option key={f.tag} value={f.tag}>{f.tag} — {f.descricao}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

/** Folha A4 com timbrado (cabeçalho e rodapé do modelo oficial). */
export function FolhaOficio({ editor }: { editor: Editor | null }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white text-black shadow-lg ring-1 ring-black/5 flex flex-col min-h-[297mm]">
      <style>{`${CSS_TEXTO_OFICIO}
        .folha-oficio .ProseMirror p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; float: left; height: 0; pointer-events: none; }
        .folha-oficio .ProseMirror .selectedCell { background: rgba(22,163,74,.12); }
        .folha-oficio .ProseMirror table { position: relative; }`}
      </style>
      {/* SVG gerado pelo próprio sistema (sem dados de usuário) */}
      <div aria-hidden dangerouslySetInnerHTML={{ __html: cabecalhoSvg('') }} />
      <div className="folha-oficio flex-1 px-[8%] sm:pl-[20mm] sm:pr-[15mm] pt-[8mm] pb-[6mm] cursor-text" onClick={() => editor?.chain().focus().run()}>
        <EditorContent editor={editor} />
      </div>
      <img src={TIMBRADO.rodape} alt="" aria-hidden className="block w-full h-auto select-none pointer-events-none" />
    </div>
  );
}
