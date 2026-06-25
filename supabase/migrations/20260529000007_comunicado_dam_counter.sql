-- ============================================================
-- Contador sequencial do Comunicado Interno de DAM
--   Incrementa a cada comunicado gerado (atômico via RPC).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_counters (
  key   text PRIMARY KEY,
  value integer NOT NULL DEFAULT 0
);

-- Modelo enviado estava em Nº 12 → próximo gerado deve ser 13
INSERT INTO public.app_counters (key, value)
VALUES ('comunicado_dam', 12)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'app_counters' AND policyname = 'app_counters_select'
  ) THEN
    CREATE POLICY "app_counters_select" ON public.app_counters
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- Incremento atômico — retorna o novo número
CREATE OR REPLACE FUNCTION public.next_comunicado_dam()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v integer;
BEGIN
  UPDATE public.app_counters
     SET value = value + 1
   WHERE key = 'comunicado_dam'
   RETURNING value INTO v;
  RETURN v;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_comunicado_dam() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_comunicado_dam() TO authenticated;

NOTIFY pgrst, 'reload schema';
