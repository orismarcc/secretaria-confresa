-- ============================================================================
-- Log de Auditoria (item 9): registra quem alterou o quê e quando.
--
-- Princípios de segurança:
--  * A auditoria NUNCA pode quebrar a operação principal — o trigger captura
--    qualquer exceção e a ignora (EXCEPTION WHEN OTHERS THEN NULL).
--  * Sem chaves estrangeiras que possam falhar e abortar a transação.
--  * RLS: apenas administradores leem; ninguém escreve pelo cliente (só o
--    trigger, que roda como SECURITY DEFINER / dono da tabela).
--  * PII: o CPF é removido do snapshot antes de gravar.
--  * Totalmente idempotente (pode ser reaplicada sem efeitos colaterais).
-- ============================================================================

-- 1) Tabela de auditoria ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     text        NOT NULL,
  record_id      uuid,
  action         text        NOT NULL,           -- INSERT | UPDATE | DELETE
  actor_id       uuid,                            -- auth.uid() de quem alterou
  changed_fields text[],                          -- campos alterados (UPDATE)
  old_data       jsonb,
  new_data       jsonb,
  changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at ON public.audit_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON public.audit_log (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log (actor_id);

-- 2) Função de trigger --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old     jsonb;
  v_new     jsonb;
  v_changed text[];
  v_record  uuid;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_new    := to_jsonb(NEW) - 'cpf';
      v_record := NEW.id;

    ELSIF TG_OP = 'UPDATE' THEN
      v_old    := to_jsonb(OLD) - 'cpf';
      v_new    := to_jsonb(NEW) - 'cpf';
      v_record := NEW.id;
      -- Campos que mudaram, ignorando ruído (updated_at, position)
      SELECT array_agg(key ORDER BY key) INTO v_changed
      FROM jsonb_each(v_new)
      WHERE key NOT IN ('updated_at', 'position')
        AND (v_new -> key) IS DISTINCT FROM (v_old -> key);
      -- Nada relevante mudou → não registra
      IF v_changed IS NULL THEN
        RETURN NULL;
      END IF;

    ELSIF TG_OP = 'DELETE' THEN
      v_old    := to_jsonb(OLD) - 'cpf';
      v_record := OLD.id;
    END IF;

    INSERT INTO public.audit_log
      (table_name, record_id, action, actor_id, changed_fields, old_data, new_data)
    VALUES
      (TG_TABLE_NAME, v_record, TG_OP, auth.uid(), v_changed, v_old, v_new);

  EXCEPTION WHEN OTHERS THEN
    -- A auditoria jamais deve afetar a operação principal.
    NULL;
  END;

  RETURN NULL; -- AFTER trigger
END;
$$;

-- 3) Anexa o trigger às tabelas principais ------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services', 'deliveries', 'patrimony', 'producers'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s;', t);
      EXECUTE format(
        'CREATE TRIGGER trg_audit_%1$s
           AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
           FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();', t);
    END IF;
  END LOOP;
END $$;

-- 4) Segurança de acesso (RLS) ------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins can view audit log" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Sem políticas de INSERT/UPDATE/DELETE: o cliente não escreve na auditoria.
GRANT SELECT ON public.audit_log TO authenticated;

NOTIFY pgrst, 'reload schema';
