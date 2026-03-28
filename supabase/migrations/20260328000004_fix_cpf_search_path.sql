-- Fix: pgp_sym_encrypt/decrypt are in the 'extensions' schema (Supabase default).
-- The original functions had SET search_path = public, private — missing 'extensions'.
-- This migration recreates all three functions with the correct search path.

-- 1. encrypt_cpf
CREATE OR REPLACE FUNCTION public.encrypt_cpf(plain_cpf text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  _key text;
BEGIN
  IF plain_cpf IS NULL OR plain_cpf = '' THEN
    RETURN NULL;
  END IF;
  SELECT value INTO _key FROM private.secrets WHERE name = 'cpf_encryption_key';
  IF _key IS NULL THEN
    RAISE EXCEPTION 'Chave de criptografia de CPF não encontrada';
  END IF;
  RETURN extensions.pgp_sym_encrypt(plain_cpf, _key);
END;
$$;

-- 2. decrypt_cpf
CREATE OR REPLACE FUNCTION public.decrypt_cpf(encrypted_cpf bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
DECLARE
  _key text;
BEGIN
  IF encrypted_cpf IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem descriptografar CPF';
  END IF;
  SELECT value INTO _key FROM private.secrets WHERE name = 'cpf_encryption_key';
  IF _key IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_decrypt(encrypted_cpf, _key);
END;
$$;

-- 3. trg_encrypt_cpf (trigger function)
CREATE OR REPLACE FUNCTION public.trg_encrypt_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    NEW.cpf_encrypted = public.encrypt_cpf(NEW.cpf);
  ELSE
    NEW.cpf_encrypted = NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Recreate trigger (in case it wasn't created correctly before)
DROP TRIGGER IF EXISTS encrypt_cpf_trigger ON public.producers;
CREATE TRIGGER encrypt_cpf_trigger
  BEFORE INSERT OR UPDATE OF cpf ON public.producers
  FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_cpf();

-- 5. Re-encrypt any existing producers (runs safely even if table is empty)
UPDATE public.producers
SET cpf = cpf
WHERE cpf IS NOT NULL AND cpf <> '';

-- 6. Restore grants
REVOKE EXECUTE ON FUNCTION public.encrypt_cpf(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_cpf(bytea) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.encrypt_cpf(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrypt_cpf(bytea) TO authenticated;
