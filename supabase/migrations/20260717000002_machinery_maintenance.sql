-- ============================================================================
-- Manutenções / reparos de maquinários.
-- Registra quando um maquinário sai de operação para manutenção/conserto,
-- com data, horários (para contabilizar o tempo) e descrição do problema.
-- Uma manutenção com ended_at NULL está "em andamento" (aparece no Dashboard).
--
-- Segurança: mesmo padrão de machinery — admins gerenciam; autenticados leem.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.machinery_maintenance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id  uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  operator_id   uuid,                       -- operador que acompanhou (opcional)
  description   text NOT NULL,
  started_at    timestamptz NOT NULL,       -- data + hora de início
  ended_at      timestamptz,                -- data + hora de fim (NULL = em andamento)
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_machinery ON public.machinery_maintenance (machinery_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_started ON public.machinery_maintenance (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_ongoing ON public.machinery_maintenance (ended_at) WHERE ended_at IS NULL;

ALTER TABLE public.machinery_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage maintenance" ON public.machinery_maintenance;
CREATE POLICY "Admins can manage maintenance"
  ON public.machinery_maintenance FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Maintenance viewable by authenticated" ON public.machinery_maintenance;
CREATE POLICY "Maintenance viewable by authenticated"
  ON public.machinery_maintenance FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machinery_maintenance TO authenticated;

NOTIFY pgrst, 'reload schema';
