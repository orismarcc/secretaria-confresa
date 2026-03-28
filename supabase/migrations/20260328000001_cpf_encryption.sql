-- =====================================================
-- CPF ENCRYPTION — AES-256 via pgcrypto
-- Chave gerada aleatoriamente no momento da migração
-- e armazenada em schema privado (não exposto via REST)
-- =====================================================

-- 1. Extensão pgcrypto (AES-256 / OpenPGP symmetric)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Schema privado — não exposto pelo PostgREST
CREATE SCHEMA IF NOT EXISTS private;

-- Revogar acesso público ao schema privado
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon;
REVOKE ALL ON SCHEMA private FROM authenticated;

-- 3. Tabela de segredos (somente acessível via funções SECURITY DEFINER)
CREATE TABLE IF NOT EXISTS private.secrets (
  name  text PRIMARY KEY,
  value text NOT NULL
);

-- Revogar acesso direto à tabela
REVOKE ALL ON private.secrets FROM PUBLIC;
REVOKE ALL ON private.secrets FROM anon;
REVOKE ALL ON private.secrets FROM authenticated;

-- 4. Gerar chave de 32 bytes (256 bits) aleatória — executado apenas se não existir
INSERT INTO private.secrets (name, value)
SELECT
  'cpf_encryption_key',
  encode(gen_random_bytes(32), 'hex')
WHERE NOT EXISTS (
  SELECT 1 FROM private.secrets WHERE name = 'cpf_encryption_key'
);

-- 5. Coluna para CPF criptografado (substitui o plaintext no futuro)
ALTER TABLE public.producers
  ADD COLUMN IF NOT EXISTS cpf_encrypted bytea;

-- 6. Função de criptografia (SECURITY DEFINER acessa private.secrets)
CREATE OR REPLACE FUNCTION public.encrypt_cpf(plain_cpf text)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
STABLE AS $$
DECLARE
  _key text;
BEGIN
  SELECT value INTO _key FROM private.secrets WHERE name = 'cpf_encryption_key';
  IF _key IS NULL THEN
    RAISE EXCEPTION 'Chave de criptografia de CPF não encontrada';
  END IF;
  -- pgp_sym_encrypt usa AES-256-CBC internamente
  RETURN pgp_sym_encrypt(plain_cpf, _key);
END;
$$;

-- 7. Função de descriptografia — somente admins
CREATE OR REPLACE FUNCTION public.decrypt_cpf(encrypted_cpf bytea)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
STABLE AS $$
DECLARE
  _key text;
BEGIN
  IF encrypted_cpf IS NULL THEN
    RETURN NULL;
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem descriptografar CPF';
  END IF;
  SELECT value INTO _key FROM private.secrets WHERE name = 'cpf_encryption_key';
  IF _key IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN pgp_sym_decrypt(encrypted_cpf, _key);
END;
$$;

-- 8. Mascaramento público: retorna "***.***.***-XX" para não-admins
CREATE OR REPLACE FUNCTION public.mask_cpf(plain_cpf text)
RETURNS text
LANGUAGE sql
IMMUTABLE AS $$
  SELECT
    CASE
      WHEN plain_cpf IS NULL OR plain_cpf = '' THEN '***.***.***-**'
      ELSE '***.***.***-' || right(regexp_replace(plain_cpf, '[^0-9]', '', 'g'), 2)
    END;
$$;

-- 9. Trigger: criptografa CPF automaticamente em INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.trg_encrypt_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    NEW.cpf_encrypted = public.encrypt_cpf(NEW.cpf);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS encrypt_cpf_trigger ON public.producers;
CREATE TRIGGER encrypt_cpf_trigger
  BEFORE INSERT OR UPDATE OF cpf ON public.producers
  FOR EACH ROW EXECUTE FUNCTION public.trg_encrypt_cpf();

-- 10. Criptografar dados existentes (execução imediata, chave já está disponível)
UPDATE public.producers
SET cpf_encrypted = public.encrypt_cpf(cpf)
WHERE cpf IS NOT NULL
  AND cpf <> ''
  AND cpf_encrypted IS NULL;

-- 11. View segura de CPF por papel
--   Admin  → CPF descriptografado via decrypt_cpf()
--   Outros → CPF mascarado via mask_cpf()
CREATE OR REPLACE VIEW public.producers_cpf_view
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  CASE
    WHEN public.has_role(auth.uid(), 'admin')
    THEN public.decrypt_cpf(p.cpf_encrypted)
    ELSE public.mask_cpf(p.cpf)
  END AS cpf_display,
  p.phone,
  p.settlement_id,
  p.location_id,
  p.location_name,
  p.latitude,
  p.longitude,
  p.property_name,
  p.property_size,
  p.dap_cap,
  p.created_at
FROM public.producers p;

-- 12. Revogar execução pública das funções sensíveis
REVOKE EXECUTE ON FUNCTION public.encrypt_cpf(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_cpf(bytea) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.encrypt_cpf(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.decrypt_cpf(bytea) TO authenticated;
