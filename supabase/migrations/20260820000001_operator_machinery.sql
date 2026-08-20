-- ============================================================
-- Vínculo operador ↔ maquinário (vários maquinários por operador).
--   Registra o(s) veículo(s)/maquinário(s) que o operador utiliza.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_machinery (
  operator_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  machinery_id uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, machinery_id)
);

ALTER TABLE public.operator_machinery ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Leitura: o próprio operador vê os seus; admin vê todos
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_machinery' AND policyname = 'operator_machinery_select'
  ) THEN
    CREATE POLICY "operator_machinery_select" ON public.operator_machinery
      FOR SELECT TO authenticated
      USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  -- Escrita (atribuição): somente admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_machinery' AND policyname = 'operator_machinery_admin_write'
  ) THEN
    CREATE POLICY "operator_machinery_admin_write" ON public.operator_machinery
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operator_machinery_operator_id
  ON public.operator_machinery(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_machinery_machinery_id
  ON public.operator_machinery(machinery_id);

NOTIFY pgrst, 'reload schema';
