-- ============================================================
-- Restrição opcional de operadores por GLEBA (dentro de um assentamento).
--   A gleba refina o acesso ao assentamento: se o operador NÃO tem nenhuma
--   gleba de um assentamento, ele opera o assentamento inteiro; se tem glebas
--   selecionadas, fica restrito a elas. Espelha operator_settlements.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operator_glebas (
  operator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gleba_id    uuid NOT NULL REFERENCES public.glebas(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (operator_id, gleba_id)
);

ALTER TABLE public.operator_glebas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_glebas' AND policyname = 'operator_glebas_select'
  ) THEN
    CREATE POLICY "operator_glebas_select" ON public.operator_glebas
      FOR SELECT TO authenticated
      USING (operator_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'operator_glebas' AND policyname = 'operator_glebas_admin_write'
  ) THEN
    CREATE POLICY "operator_glebas_admin_write" ON public.operator_glebas
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_operator_glebas_operator_id
  ON public.operator_glebas(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_glebas_gleba_id
  ON public.operator_glebas(gleba_id);

NOTIFY pgrst, 'reload schema';
