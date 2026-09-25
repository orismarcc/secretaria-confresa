-- ============================================================================
-- CONECTA CONFRESA — situação da OFERTA (organização da seleção pela equipe)
--   disponivel → validada (conferida pela equipe) → aceita (selecionada para
--   um programa, com a quantidade aceita/mês) · suspensa (fora de uso).
-- Só altera vitrine_ofertas (tabela do módulo). Ofertas existentes ficam
-- 'disponivel'. Idempotente.
-- ============================================================================

ALTER TABLE public.vitrine_ofertas
  ADD COLUMN IF NOT EXISTS situacao    text NOT NULL DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS programa    text,           -- para qual programa foi aceita
  ADD COLUMN IF NOT EXISTS qtd_aceita  numeric(12,2),  -- quantidade aceita por mês
  ADD COLUMN IF NOT EXISTS situacao_em  timestamptz,
  ADD COLUMN IF NOT EXISTS situacao_por uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vitrine_ofertas_situacao_check') THEN
    ALTER TABLE public.vitrine_ofertas ADD CONSTRAINT vitrine_ofertas_situacao_check
      CHECK (situacao IN ('disponivel','validada','aceita','suspensa'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vitrine_ofertas_programa_check') THEN
    ALTER TABLE public.vitrine_ofertas ADD CONSTRAINT vitrine_ofertas_programa_check
      CHECK (programa IS NULL OR programa IN ('pnae','paa','feiras','hospitais','assistencia_social','outros_programas','venda_institucional'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vitrine_ofertas_qtd_aceita_check') THEN
    ALTER TABLE public.vitrine_ofertas ADD CONSTRAINT vitrine_ofertas_qtd_aceita_check
      CHECK (qtd_aceita IS NULL OR qtd_aceita >= 0);
  END IF;
END $$;

-- Marca quando/quem mudou a situação (sem depender da tela).
CREATE OR REPLACE FUNCTION public.vitrine_oferta_situacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    NEW.situacao_em  := now();
    NEW.situacao_por := auth.uid();
  END IF;
  -- Fora de "aceita", não há programa nem quantidade aceita.
  IF NEW.situacao <> 'aceita' THEN
    NEW.programa   := NULL;
    NEW.qtd_aceita := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_vitrine_oferta_situacao ON public.vitrine_ofertas;
CREATE TRIGGER trg_vitrine_oferta_situacao
  BEFORE INSERT OR UPDATE ON public.vitrine_ofertas
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_oferta_situacao();

CREATE INDEX IF NOT EXISTS idx_vitrine_ofertas_situacao ON public.vitrine_ofertas (situacao);

NOTIFY pgrst, 'reload schema';
