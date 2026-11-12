-- ============================================================================
-- Ofício de restituição da DAM passa a ser cadastrado na página Ofícios
-- (numeração única por ano). O atendimento guarda o vínculo com o ofício.
-- Só ACRESCENTA uma coluna opcional. Nenhum dado existente é alterado.
-- ============================================================================

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS restituicao_oficio_id uuid REFERENCES public.oficios(id) ON DELETE SET NULL;

-- Reativar o atendimento com a restituição pendente também desfaz o vínculo
-- (o ofício continua cadastrado na página Ofícios).
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
    NEW.restituicao_oficio_id := NULL;
    NEW.restituicao_solicitada_em := NULL;
  END IF;
  IF NEW.restituicao_status IS DISTINCT FROM 'confirmada' THEN
    NEW.restituicao_confirmada_em := NULL;
    NEW.restituicao_confirmada_por := NULL;
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
