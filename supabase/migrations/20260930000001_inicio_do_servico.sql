-- ============================================================================
-- Início do serviço (services.started_at): quando o operador iniciou.
--
--   * Novo campo opcional. O app do operador grava o horário EXATO do toque em
--     "Iniciar" (vale também quando ele estava sem sinal e sincronizou depois).
--   * Garantia no banco: se o atendimento passar para "em execução" sem o campo
--     (ex.: iniciado pelo escritório), grava o horário da mudança.
--   * Voltar para pendente/próximo limpa o início (um novo início será gravado).
--   * Preenche os já iniciados/finalizados, nesta ordem de confiança:
--       1. registro de início do app (service_photos 'start' SEM foto e COM GPS
--          — é gravado no toque em "Iniciar"); as fotos de "início" enviadas na
--          finalização NÃO servem (têm o horário da finalização);
--       2. auditoria: primeira passagem para 'in_progress' (horário em que o
--          servidor recebeu o início).
--   Nenhum outro campo é alterado. Idempotente (só preenche o que está vazio).
-- ============================================================================

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS started_at timestamptz;

CREATE OR REPLACE FUNCTION public.trg_services_started_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'proximo') THEN
    NEW.started_at := NULL;
  ELSIF NEW.status = 'in_progress'
        AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'in_progress')
        AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS services_started_at ON public.services;
CREATE TRIGGER services_started_at
  BEFORE INSERT OR UPDATE OF status, started_at ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.trg_services_started_at();

-- Preenchimento dos já iniciados (em execução ou finalizados).
WITH app AS (
  SELECT sp.service_id, min(sp.captured_at) AS quando
  FROM public.service_photos sp
  WHERE sp.event_type = 'start' AND sp.storage_path IS NULL AND sp.latitude IS NOT NULL
  GROUP BY sp.service_id
), aud AS (
  SELECT a.record_id::text AS service_id, min(a.changed_at) AS quando
  FROM public.audit_log a
  WHERE a.table_name = 'services' AND a.action = 'UPDATE'
    AND a.new_data->>'status' = 'in_progress'
    AND coalesce(a.old_data->>'status', '') <> 'in_progress'
  GROUP BY a.record_id::text
)
UPDATE public.services s
SET started_at = coalesce(app.quando, aud.quando)
FROM public.services s2
LEFT JOIN app ON app.service_id = s2.id
LEFT JOIN aud ON aud.service_id = s2.id::text
WHERE s.id = s2.id
  AND s.started_at IS NULL
  AND s.status IN ('in_progress', 'completed')
  AND coalesce(app.quando, aud.quando) IS NOT NULL
  -- início nunca depois da finalização; exceção: finalização lançada só com a
  -- DATA (grava 12:00 UTC = "sem hora") e início no mesmo dia
  AND (s.completed_at IS NULL
       OR coalesce(app.quando, aud.quando) <= s.completed_at
       OR ((s.completed_at AT TIME ZONE 'UTC')::time = '12:00:00'
           AND (coalesce(app.quando, aud.quando) AT TIME ZONE 'America/Cuiaba')::date
               = (s.completed_at AT TIME ZONE 'America/Cuiaba')::date));

DO $$ BEGIN
  RAISE NOTICE 'Atendimentos com início preenchido: %', (SELECT count(*) FROM public.services WHERE started_at IS NOT NULL);
END $$;

NOTIFY pgrst, 'reload schema';
