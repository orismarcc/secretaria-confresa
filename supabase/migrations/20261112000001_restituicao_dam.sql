-- ============================================================================
-- Restituição da DAM de atendimento cancelado.
-- Ao cancelar (ex.: chuva / área sem condições), a Secretaria gera o ofício de
-- solicitação de restituição à Sec. de Finanças. A restituição fica PENDENTE
-- até alguém confirmar que o valor foi devolvido; confirmada, o valor sai do
-- total de DAMs do produtor e da arrecadação.
--
-- Só ACRESCENTA colunas opcionais (todas nulas nos atendimentos existentes).
-- Dados bancários do produtor NÃO são gravados: entram só no ofício gerado.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS restituicao_status text,
  ADD COLUMN IF NOT EXISTS restituicao_valor numeric(12,2),
  ADD COLUMN IF NOT EXISTS restituicao_motivo text,
  ADD COLUMN IF NOT EXISTS restituicao_oficio text,
  ADD COLUMN IF NOT EXISTS restituicao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS restituicao_confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS restituicao_confirmada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_restituicao_status_check;
ALTER TABLE public.services ADD CONSTRAINT services_restituicao_status_check
  CHECK (restituicao_status IS NULL OR restituicao_status IN ('pendente', 'confirmada'));

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_restituicao_motivo_check;
ALTER TABLE public.services ADD CONSTRAINT services_restituicao_motivo_check
  CHECK (restituicao_motivo IS NULL OR restituicao_motivo IN ('climatica', 'area_inadequada'));

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_restituicao_valor_check;
ALTER TABLE public.services ADD CONSTRAINT services_restituicao_valor_check
  CHECK (restituicao_valor IS NULL OR restituicao_valor >= 0);

-- Se o atendimento for REATIVADO com a restituição ainda pendente, o pedido
-- perde o sentido: limpa os campos. Restituição já CONFIRMADA é mantida (o
-- dinheiro foi devolvido e o registro precisa ficar).
CREATE OR REPLACE FUNCTION public.trg_services_restituicao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public AS $$
BEGIN
  IF NEW.status <> 'cancelled' AND NEW.restituicao_status = 'pendente' THEN
    NEW.restituicao_status := NULL;
    NEW.restituicao_valor := NULL;
    NEW.restituicao_motivo := NULL;
    NEW.restituicao_oficio := NULL;
    NEW.restituicao_solicitada_em := NULL;
  END IF;
  IF NEW.restituicao_status IS DISTINCT FROM 'confirmada' THEN
    NEW.restituicao_confirmada_em := NULL;
    NEW.restituicao_confirmada_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS services_restituicao_trigger ON public.services;
CREATE TRIGGER services_restituicao_trigger
  BEFORE UPDATE OF status, restituicao_status ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_restituicao();

NOTIFY pgrst, 'reload schema';
