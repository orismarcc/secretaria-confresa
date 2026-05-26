-- =============================================================================
-- Wave 5 — Security hardening: function search_path fixes + CPF encryption
-- Auditoria de 2026-05-26. Todas as instruções são idempotentes.
-- =============================================================================

-- ─── 1. B-06: Add SECURITY DEFINER to update_updated_at_column (M-09 pattern)
-- Without SECURITY DEFINER the trigger runs with the row-modifier's privileges.
-- Consistent with handle_new_user and trg_encrypt_cpf patterns.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- ─── 2. B-07: Add SET search_path to mask_cpf ────────────────────────────────
-- IMMUTABLE SQL functions without a pinned search_path could theoretically be
-- affected by a caller-manipulated search_path in older PG versions.

CREATE OR REPLACE FUNCTION public.mask_cpf(plain_cpf text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN plain_cpf IS NULL OR plain_cpf = '' THEN '***.***.***-**'
      ELSE '***.***.***-' || right(regexp_replace(plain_cpf, '[^0-9]', '', 'g'), 2)
    END;
$$;

-- ─── 3. M-06: CPF encryption for sefaz_producers ─────────────────────────────
-- Add cpf_encrypted column (idempotent) and wire up the existing trg_encrypt_cpf
-- trigger. trg_encrypt_cpf() sets NEW.cpf_encrypted generically for any table
-- that has both cpf and cpf_encrypted columns.

ALTER TABLE public.sefaz_producers
  ADD COLUMN IF NOT EXISTS cpf_encrypted bytea;

DROP TRIGGER IF EXISTS encrypt_cpf_trigger ON public.sefaz_producers;
CREATE TRIGGER encrypt_cpf_trigger
  BEFORE INSERT OR UPDATE OF cpf ON public.sefaz_producers
  FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_cpf();

-- Backfill: re-trigger the encryption on existing rows
UPDATE public.sefaz_producers
SET cpf = cpf
WHERE cpf IS NOT NULL AND cpf <> '';

-- ─── 4. M-06: CPF encryption for responsible_technicians ─────────────────────

ALTER TABLE public.responsible_technicians
  ADD COLUMN IF NOT EXISTS cpf_encrypted bytea;

DROP TRIGGER IF EXISTS encrypt_cpf_trigger ON public.responsible_technicians;
CREATE TRIGGER encrypt_cpf_trigger
  BEFORE INSERT OR UPDATE OF cpf ON public.responsible_technicians
  FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_cpf();

-- Backfill
UPDATE public.responsible_technicians
SET cpf = cpf
WHERE cpf IS NOT NULL AND cpf <> '';

-- ─── 5. Reload PostgREST schema cache ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
