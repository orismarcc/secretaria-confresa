import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Associacao, DocumentoAssociacao, ItemChecklist } from '@/lib/associacoes';
import { calcularRegularidade } from '@/lib/associacoes';

const salvarAssoc = vi.fn(async (_a: Record<string, unknown>) => ({ assoc: { id: 'nova', nome: 'X' }, novo: true }));
const dispensar = vi.fn(async (_a: Record<string, unknown>) => true);
vi.mock('@/hooks/useAssociacoes', () => ({
  useSalvarAssociacao: () => ({ mutateAsync: salvarAssoc, isPending: false }),
  useDispensarItem: () => ({ mutateAsync: dispensar, mutate: dispensar, isPending: false }),
  useExcluirDocumento: () => ({ mutate: vi.fn(), isPending: false }),
  useSalvarDocumento: () => ({ mutateAsync: vi.fn(), isPending: false }),
  abrirArquivoAssociacao: vi.fn(),
}));
vi.mock('@/hooks/useSupabaseData', () => ({
  useSettlements: () => ({ data: [{ id: 's1', name: 'PA Teste' }] }),
  useMachinery: () => ({ data: [] }),
  useDemandTypes: () => ({ data: [] }),
  useProducers: () => ({ data: [] }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ canDelete: true, isFullAdmin: true }) }));
vi.mock('@/lib/movimento', () => ({
  Contador: ({ valor, formatar }: { valor: number; formatar: (v: number) => string }) => <span>{formatar(valor)}</span>,
  Revelar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };

import { AssociacaoFormDialog } from './AssociacaoFormDialog';
import { ChecklistRegularizacao } from './ChecklistRegularizacao';
import { PainelAssociacoes } from './PainelAssociacoes';

const dia = (delta: number) => { const d = new Date(); d.setDate(d.getDate() + delta); return d.toISOString().slice(0, 10); };
const assoc = (p: Partial<Associacao> = {}): Associacao => ({
  id: 'A', nome: 'Associação Teste', sigla: 'AT', cnpj: '11222333000181', situacao: 'ativa', tipo: 'rural', data_fundacao: null,
  settlement_id: null, endereco: null, telefone: null, email: null, presidente_nome: 'Presidente Teste', presidente_telefone: null,
  mandato_inicio: null, mandato_fim: dia(-2), numero_associados: 30, observacoes: null, created_at: '', updated_at: '', ...p,
});
const itens: ItemChecklist[] = [
  { id: 'cnd', codigo: 'cnd_federal', nome: 'CND Federal', categoria: 'fiscal', descricao: 'Certidão federal', como_obter: 'Emitir no site da Receita Federal.', link_oficial: 'https://exemplo.gov.br', obrigatorio: true, tem_validade: true, ordem: 1, ativo: true },
  { id: 'est', codigo: 'estatuto', nome: 'Estatuto social', categoria: 'constituicao', descricao: null, como_obter: null, link_oficial: null, obrigatorio: true, tem_validade: false, ordem: 2, ativo: true },
];
const docs: DocumentoAssociacao[] = [
  { id: 'd1', associacao_id: 'A', item_id: 'cnd', titulo: 'CND Federal 2026', numero: null, data_emissao: dia(-200), data_validade: dia(-5), arquivo_path: 'x.pdf', arquivo_nome: 'cnd.pdf', arquivo_tamanho: 10, observacao: null, enviado_por: null, created_at: '2026-01-01' },
];

describe('Associações — cadastro', () => {
  beforeEach(() => salvarAssoc.mockClear());
  it('CNPJ é formatado, validado e não pode repetir; salva só os números', async () => {
    render(<AssociacaoFormDialog aberto associacao={null} existentes={[assoc()]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Nome da associação *'), { target: { value: 'Nova Associação' } });
    const cnpj = screen.getByLabelText('CNPJ');
    fireEvent.change(cnpj, { target: { value: '11222333000182' } });
    expect((cnpj as HTMLInputElement).value).toBe('11.222.333/0001-82');
    expect(screen.getByText(/CNPJ inválido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar associação' })).toBeDisabled();
    fireEvent.change(cnpj, { target: { value: '11222333000181' } });
    expect(screen.getByText(/Já existe uma associação com este CNPJ/)).toBeInTheDocument();
    fireEvent.change(cnpj, { target: { value: '' } });
    fireEvent.click(screen.getByRole('radio', { name: /Ativa/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar associação' }));
    await waitFor(() => expect(salvarAssoc).toHaveBeenCalled());
    const dados = (salvarAssoc.mock.calls[0][0] as { dados: { nome: string; cnpj: string | null; situacao: string } }).dados;
    expect(dados).toMatchObject({ nome: 'Nova Associação', cnpj: null, situacao: 'ativa' });
  });
});

describe('Associações — checklist', () => {
  it('mostra pendências, "como obter" com link oficial e marca "não se aplica" com motivo', async () => {
    const reg = calcularRegularidade('A', itens, docs, []);
    render(<ChecklistRegularizacao associacaoId="A" itens={itens} regularidade={reg} documentos={docs} />);
    expect(screen.getByText('0 de 2 itens obrigatórios em dia')).toBeInTheDocument();
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /CND Federal Vencido/ }));
    expect(screen.getByText('Emitir no site da Receita Federal.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir site oficial/ })).toHaveAttribute('href', 'https://exemplo.gov.br');
    expect(screen.getByText('(vale este)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Não se aplica a esta associação/ }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Motivo *'), { target: { value: 'Isenta' } });
    fireEvent.click(confirmar);
    await waitFor(() => expect(dispensar).toHaveBeenCalledWith({ associacao_id: 'A', item_id: 'cnd', motivo: 'Isenta' }));
  });
});

describe('Associações — painel', () => {
  it('sem associações mostra os primeiros passos', () => {
    render(<PainelAssociacoes associacoes={[]} regularidades={new Map()} cessoes={[]} atendimentos={[]} onAbrir={vi.fn()} onNova={vi.fn()} />);
    expect(screen.getByText('Comece por aqui')).toBeInTheDocument();
  });
  it('lista o que precisa de atenção (vencidos e mandato) e abre a associação', () => {
    const onAbrir = vi.fn();
    const a = assoc();
    const reg = new Map([[a.id, calcularRegularidade(a.id, itens, docs, [])]]);
    render(<PainelAssociacoes associacoes={[a]} regularidades={reg} cessoes={[]} atendimentos={[]} onAbrir={onAbrir} onNova={vi.fn()} />);
    expect(screen.getByText(/CND Federal: vencido em/)).toBeInTheDocument();
    expect(screen.getByText(/Mandato da diretoria venceu/)).toBeInTheDocument();
    expect(screen.getByText(/Estatuto social: pendente/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Mandato da diretoria venceu/));
    expect(onAbrir).toHaveBeenCalledWith('A');
  });
});
