import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Oficio } from '@/lib/oficios';

const mutateAsync = vi.fn(async (_a: Record<string, unknown>) => ({ oficio: { id: 'novo', numero: 3, ano: 2026 } }));
vi.mock('@/hooks/useOficios', () => ({
  useSalvarOficio: () => ({ mutateAsync, isPending: false }),
  baixarConteudoOficio: vi.fn(),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
// Animação de entrada/contagem não roda no ambiente de teste: mostra o valor final.
vi.mock('@/lib/movimento', () => ({
  Contador: ({ valor, formatar }: { valor: number; formatar: (v: number) => string }) => <span>{formatar(valor)}</span>,
  Revelar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { PainelOficios } from './PainelOficios';
import { ListaOficios } from './ListaOficios';
import { OficioFormDialog } from './OficioFormDialog';

const of = (p: Partial<Oficio>): Oficio => ({
  id: Math.random().toString(36).slice(2), ano: 2026, numero: 1, data_oficio: '2026-03-10',
  destinatario: 'Câmara Municipal', assunto: 'Assunto', categoria: 'Solicitação', situacao: 'emitido',
  descricao: null, modelo_id: null, arquivo_path: null, arquivo_nome: null, arquivo_tamanho: null, arquivo_versao: 0,
  created_by: null, updated_by: null, created_at: '', updated_at: '', ...p,
});
const lista = [
  of({ id: 'a', numero: 1, assunto: 'Pedido de máquinas', arquivo_path: 'x.pdf' }),
  of({ id: 'b', numero: 2, assunto: 'Convite audiência', categoria: 'Convite', situacao: 'enviado', data_oficio: '2026-05-02' }),
  of({ id: 'c', numero: 7, ano: 2025, data_oficio: '2025-08-01', assunto: 'Restituição', destinatario: 'Finanças' }),
];

describe('Ofícios — Painel', () => {
  it('mostra o total, expande um indicador e abre o ofício pelo número', async () => {
    const onAbrir = vi.fn();
    render(<PainelOficios oficios={lista} carregando={false} onAbrir={onAbrir} onNovo={vi.fn()} podeCriar />);
    expect(screen.getByText('Ofícios cadastrados')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('3').length).toBeGreaterThan(0));
    // indicador "Por ano" → 2025 (1 ofício): expande e mostra o número
    fireEvent.click(screen.getByRole('button', { name: /^2025/ }));
    fireEvent.click(screen.getByRole('button', { name: '7/2025' }));
    expect(onAbrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));
  });
});

describe('Ofícios — Lista', () => {
  it('pesquisa por número/ano e filtra por categoria', () => {
    render(<MemoryRouter><ListaOficios oficios={lista} carregando={false} onAbrir={vi.fn()} onNovo={vi.fn()} podeCriar /></MemoryRouter>);
    expect(screen.getByText('3 de 3 ofício(s)')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Número/), { target: { value: '7/2025' } });
    expect(screen.getByText('1 de 3 ofício(s)')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Número/), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Convite' } });
    expect(screen.getByText('1 de 3 ofício(s)')).toBeInTheDocument();
  });
});

describe('Ofícios — Formulário', () => {
  beforeEach(() => mutateAsync.mockClear());

  it('número automático (próximo do ano) envia numero nulo para o banco definir', async () => {
    render(<OficioFormDialog aberto oficio={null} oficios={lista} modelos={[]} onClose={vi.fn()} />);
    expect(screen.getByText(/automático/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Data *'), { target: { value: '2026-06-01' } });
    expect(screen.getByText('3/2026')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Destinatário *'), { target: { value: 'Câmara' } });
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Teste' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar ofício' }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const arg = mutateAsync.mock.calls[0][0] as { dados: { numero: unknown; data_oficio: string } };
    expect(arg.dados.numero).toBeNull();
    expect(arg.dados.data_oficio).toBe('2026-06-01');
  });

  it('número manual repetido no ano é avisado e não deixa salvar', () => {
    render(<OficioFormDialog aberto oficio={null} oficios={lista} modelos={[]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Data *'), { target: { value: '2026-06-01' } });
    fireEvent.click(screen.getByLabelText('Próximo número livre do ano'));
    fireEvent.change(screen.getByLabelText('Número *'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Destinatário *'), { target: { value: 'Câmara' } });
    fireEvent.change(screen.getByLabelText('Assunto *'), { target: { value: 'Teste' } });
    expect(screen.getByText(/Já existe o Ofício Nº 2\/2026/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar ofício' })).toBeDisabled();
  });
});
