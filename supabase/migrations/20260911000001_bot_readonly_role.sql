-- ============================================================================
-- Usuário de banco SÓ-LEITURA para o bot de avisos de finalização (celular).
--   Princípio do menor privilégio: SELECT apenas nas COLUNAS estritamente
--   necessárias, em 4 tabelas. Sem escrita, sem CPF/telefone, sem outras tabelas.
--
--   A SENHA NÃO fica aqui (repositório é público). Após aplicar esta migração,
--   defina a senha UMA vez no SQL Editor do Supabase:
--       ALTER ROLE bot_readonly WITH PASSWORD 'uma-senha-forte-aqui';
--   Essa senha vai só para o .env do celular — nunca para o Git.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bot_readonly') THEN
    CREATE ROLE bot_readonly LOGIN;
  END IF;
END $$;

GRANT CONNECT ON DATABASE postgres TO bot_readonly;
GRANT USAGE ON SCHEMA public TO bot_readonly;

-- Só o necessário para montar o aviso de finalização:
GRANT SELECT (id, status, completed_at, worked_hours, producer_id, demand_type_id, operator_id)
  ON public.services TO bot_readonly;
GRANT SELECT (id, name) ON public.producers TO bot_readonly;
GRANT SELECT (id, name) ON public.demand_types TO bot_readonly;
GRANT SELECT (id, name) ON public.profiles TO bot_readonly;

-- Garante que NÃO herda acessos futuros amplos (defensivo).
ALTER ROLE bot_readonly NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
