import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mutateAsync = vi.fn(async (_p: Record<string, unknown>) => ({}));
vi.mock('@/hooks/useSupabaseData', () => ({ useUpdateService: () => ({ mutateAsync, isPending: false }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const triggerDownload = vi.fn((..._a: unknown[]) => undefined);
vi.mock('@/lib/comunicado', async (orig) => ({ ...(await orig<typeof import('@/lib/comunicado')>()), triggerDownload: (...a: unknown[]) => triggerDownload(...a) }));
const buildDocx = vi.fn(async (_d: Record<string, unknown>) => ({ blob: new Blob(['x']), filename: 'oficio.docx' }));
vi.mock('@/lib/oficioRestituicao', async (orig) => ({
  ...(await orig<typeof import('@/lib/oficioRestituicao')>()),
  buildOficioRestituicaoDocx: (d: Record<string, unknown>) => buildDocx(d),
}));

import { CancelamentoRestituicaoDialog, type CancelamentoAlvo } from './CancelamentoRestituicaoDialog';

const alvo: CancelamentoAlvo = {
  id: 'svc-1',
  status: 'pending',
  dam_paid: true,
  dam_value: 1211.15,
  produtor: { nome: 'Produtor Teste', cpf: '000.000.000-00', telefone: '' },
  tipo: { nome: 'PC', categoria: 'patrulha_mecanizada' },
  comunidade: 'PA Teste',
};

const preencher = (label: RegExp, valor: string) => fireEvent.change(screen.getByLabelText(label), { target: { value: valor } });

describe('Cancelar atendimento com ofício de restituição', () => {
  beforeEach(() => { mutateAsync.mockClear(); triggerDownload.mockClear(); buildDocx.mockClear(); });

  it('cancelar sem ofício mantém o fluxo de antes (só status + motivo)', async () => {
    const onClose = vi.fn();
    render(<CancelamentoRestituicaoDialog alvo={{ ...alvo, dam_paid: false }} modo="cancelar" podeGerarOficio onClose={onClose} />);
    const confirmar = screen.getByRole('button', { name: /Confirmar Cancelamento/ });
    expect(confirmar).toBeDisabled(); // motivo obrigatório
    preencher(/^Motivo/, 'Produtor desistiu');
    fireEvent.click(confirmar);
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ id: 'svc-1', status: 'cancelled', cancellation_reason: 'Produtor desistiu' }));
    expect(onClose).toHaveBeenCalled();
    expect(triggerDownload).not.toHaveBeenCalled();
  });

  it('com DAM paga, o ofício vem marcado; cancela, deixa a restituição pendente e baixa o documento', async () => {
    render(<CancelamentoRestituicaoDialog alvo={alvo} modo="cancelar" podeGerarOficio onClose={vi.fn()} />);
    const gerarDoc = screen.getByRole('button', { name: /Cancelar \+ DOC/ });
    expect(gerarDoc).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Área sem condições adequadas/ }));
    expect((screen.getByLabelText(/^Motivo/) as HTMLTextAreaElement).value).toBe('Área sem condições adequadas');
    preencher(/Nº do ofício/, '473');
    preencher(/^Banco/, 'Banco Teste');
    preencher(/^Agência/, '0001');
    preencher(/^Conta/, '12345-6');
    expect(gerarDoc).not.toBeDisabled();
    fireEvent.click(gerarDoc);
    await waitFor(() => expect(triggerDownload).toHaveBeenCalled());
    const dados = buildDocx.mock.calls[0][0] as any;
    expect(dados.numero).toMatch(/^473\/\d{4}$/);
    expect(dados.motivo).toBe('area_inadequada');
    expect(dados.valor).toBeCloseTo(1211.15);
    expect(dados.servico).toBe('escavação com Patrulha Mecanizada (PC)');
    const payload = mutateAsync.mock.calls[0][0] as any;
    expect(payload).toMatchObject({
      id: 'svc-1', status: 'cancelled', cancellation_reason: 'Área sem condições adequadas',
      restituicao_status: 'pendente', restituicao_valor: 1211.15, restituicao_motivo: 'area_inadequada',
    });
    // dados bancários não vão para o banco
    expect(JSON.stringify(payload)).not.toMatch(/Banco Teste|12345-6/);
    // grava antes de baixar (iOS)
    expect(mutateAsync.mock.invocationCallOrder[0]).toBeLessThan(triggerDownload.mock.invocationCallOrder[0]);
  });

  it('Coordenador (sem acesso a DAM) não vê a opção do ofício', () => {
    render(<CancelamentoRestituicaoDialog alvo={alvo} modo="cancelar" podeGerarOficio={false} onClose={vi.fn()} />);
    expect(screen.queryByText(/Gerar ofício de solicitação/)).toBeNull();
    expect(screen.getByRole('button', { name: /Confirmar Cancelamento/ })).toBeInTheDocument();
  });

  it('modo ofício (já cancelado) não mexe no status', async () => {
    render(<CancelamentoRestituicaoDialog alvo={{ ...alvo, status: 'cancelled' }} modo="oficio" podeGerarOficio onClose={vi.fn()} />);
    preencher(/Nº do ofício/, '10/2026');
    preencher(/^Banco/, 'B');
    preencher(/^Agência/, '1');
    preencher(/^Conta/, '2');
    fireEvent.click(screen.getByRole('button', { name: /Gerar DOC/ }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const payload = mutateAsync.mock.calls[0][0] as any;
    expect(payload.status).toBeUndefined();
    expect(payload.restituicao_oficio).toBe('10/2026');
  });
});
