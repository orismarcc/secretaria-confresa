-- ============================================================================
-- Módulo de TRÂNSITO da frota: condutores (servidores), termos de
-- responsabilidade (cessão de veículo), viagens programadas e multas — tudo
-- interligado por chaves estrangeiras. RLS: administradores gerenciam.
-- Aditivo e idempotente. Reusa o bucket privado 'fleet-docs' para anexos.
-- ============================================================================

-- 1) Condutores / servidores --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.condutores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  cpf           text,
  matricula     text,
  cnh_numero    text,
  cnh_categoria text,
  cnh_validade  date,
  telefone      text,
  operator_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- vínculo opcional a um operador existente
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 2) Termo de responsabilidade (cessão do veículo a um condutor) --------------
CREATE TABLE IF NOT EXISTS public.termos_responsabilidade (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  condutor_id  uuid NOT NULL REFERENCES public.condutores(id) ON DELETE CASCADE,
  data_inicio  date,
  data_fim     date,
  observacao   text,
  file_path    text,   -- termo assinado (anexo no bucket fleet-docs)
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 3) Viagens programadas ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.viagens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  condutor_id  uuid REFERENCES public.condutores(id) ON DELETE SET NULL,
  destino      text,
  nad          text,                 -- Nota de Autorização de Despesa/Diária
  finalidade   text,
  data_saida   date,
  data_retorno date,
  status       text NOT NULL DEFAULT 'programada'
               CHECK (status IN ('programada','em_andamento','concluida','cancelada')),
  observacao   text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 4) Multas de trânsito -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.multas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machinery_id         uuid NOT NULL REFERENCES public.machinery(id) ON DELETE CASCADE,
  condutor_id          uuid REFERENCES public.condutores(id) ON DELETE SET NULL,
  viagem_id            uuid REFERENCES public.viagens(id) ON DELETE SET NULL,
  termo_id             uuid REFERENCES public.termos_responsabilidade(id) ON DELETE SET NULL,
  data                 date,
  horario              text,
  local                text,
  placa                text,
  auto_infracao        text,
  orgao_autuador       text,
  infracao             text,
  valor                numeric(12,2),
  pontos               integer,
  condutor_identificado boolean NOT NULL DEFAULT false,
  data_limite_recurso  date,
  status               text NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','condutor_identificado','em_recurso','vencida','paga','cancelada')),
  observacao           text,
  file_path            text,   -- cópia do auto de infração (opcional)
  created_by           uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Índices das FKs
CREATE INDEX IF NOT EXISTS idx_termos_machinery ON public.termos_responsabilidade(machinery_id);
CREATE INDEX IF NOT EXISTS idx_termos_condutor  ON public.termos_responsabilidade(condutor_id);
CREATE INDEX IF NOT EXISTS idx_viagens_machinery ON public.viagens(machinery_id);
CREATE INDEX IF NOT EXISTS idx_viagens_condutor  ON public.viagens(condutor_id);
CREATE INDEX IF NOT EXISTS idx_multas_machinery ON public.multas(machinery_id);
CREATE INDEX IF NOT EXISTS idx_multas_condutor  ON public.multas(condutor_id);
CREATE INDEX IF NOT EXISTS idx_multas_status    ON public.multas(status);

-- RLS: administradores gerenciam; leitura autenticada (páginas admin).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['condutores','termos_responsabilidade','viagens','multas'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'admins_manage_'||t, t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                      USING (public.has_role(auth.uid(), 'admin'::app_role))
                      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));$f$, 'admins_manage_'||t, t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
