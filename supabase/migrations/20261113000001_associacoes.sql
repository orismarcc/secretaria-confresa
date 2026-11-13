-- ============================================================================
-- ASSOCIAÇÕES (rurais e/ou de trabalhadores rurais) — ETAPA 1 (equipe interna)
--
--  * associacoes                  — cadastro: CNPJ, situação, tipo, presidente.
--  * associacao_checklist_itens   — checklist de regularização (configurável),
--                                   com "como obter" para orientar a equipe.
--  * associacao_documentos        — documentos de cada associação (com validade
--                                   e arquivo), ligados a um item do checklist.
--  * associacao_dispensas         — item que "não se aplica" àquela associação.
--  * associacao_cessoes           — maquinário das Frotas cedido (termo, devolução).
--  * associacao_atendimentos      — atendimentos de patrulha que a associação
--                                   faz com seus associados (contam p/ o município).
--  * bucket PRIVADO 'associacoes'.
--
-- Etapa 2 (login dos presidentes) vai ACRESCENTAR políticas para o presidente
-- ver/editar só a própria associação — por isso todas as tabelas-filhas têm
-- associacao_id. Aqui: só a equipe interna (admin, exceto Assistente de Campo);
-- excluir só admin pleno. Só ACRESCENTA. Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pode_gerir_associacoes(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _uid AND ur.role = 'admin'
      AND COALESCE(p.job_title, '') <> 'Assistente de Campo'
  );
$$;
GRANT EXECUTE ON FUNCTION public.pode_gerir_associacoes(uuid) TO authenticated;

-- ── Associações ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.associacoes (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 text NOT NULL CHECK (length(trim(nome)) > 0),
  sigla                text,
  cnpj                 text CHECK (cnpj IS NULL OR cnpj ~ '^\d{14}$'),
  situacao             text NOT NULL DEFAULT 'em_regularizacao'
                       CHECK (situacao IN ('ativa', 'inativa', 'em_regularizacao')),
  tipo                 text NOT NULL DEFAULT 'rural'
                       CHECK (tipo IN ('rural', 'trabalhadores_rurais', 'rural_e_trabalhadores')),
  data_fundacao        date,
  settlement_id        uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  endereco             text,
  telefone             text,
  email                text,
  presidente_nome      text,
  presidente_telefone  text,
  mandato_inicio       date,
  mandato_fim          date,
  numero_associados    integer CHECK (numero_associados IS NULL OR numero_associados >= 0),
  observacoes          text,
  created_by           uuid DEFAULT auth.uid(),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT associacoes_mandato_ordem CHECK (mandato_fim IS NULL OR mandato_inicio IS NULL OR mandato_fim >= mandato_inicio)
);
CREATE UNIQUE INDEX IF NOT EXISTS associacoes_cnpj_key ON public.associacoes (cnpj) WHERE cnpj IS NOT NULL;

-- ── Checklist de regularização (configurável) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.associacao_checklist_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text UNIQUE,                 -- itens padrão (para a semente não duplicar)
  nome          text NOT NULL CHECK (length(trim(nome)) > 0),
  categoria     text NOT NULL CHECK (categoria IN ('constituicao', 'diretoria', 'fiscal', 'trabalhista', 'funcionamento', 'outros')),
  descricao     text,
  como_obter    text,
  link_oficial  text,
  obrigatorio   boolean NOT NULL DEFAULT true,
  tem_validade  boolean NOT NULL DEFAULT false,
  ordem         integer NOT NULL DEFAULT 100,
  ativo         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Documentos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.associacao_documentos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associacao_id    uuid NOT NULL REFERENCES public.associacoes(id) ON DELETE CASCADE,
  item_id          uuid REFERENCES public.associacao_checklist_itens(id) ON DELETE SET NULL,
  titulo           text NOT NULL CHECK (length(trim(titulo)) > 0),
  numero           text,
  data_emissao     date,
  data_validade    date,
  arquivo_path     text UNIQUE,
  arquivo_nome     text,
  arquivo_tamanho  bigint CHECK (arquivo_tamanho IS NULL OR arquivo_tamanho >= 0),
  observacao       text,
  enviado_por      uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT associacao_documentos_datas CHECK (data_validade IS NULL OR data_emissao IS NULL OR data_validade >= data_emissao)
);
CREATE INDEX IF NOT EXISTS idx_associacao_documentos_assoc ON public.associacao_documentos (associacao_id);

-- ── Itens que não se aplicam a uma associação ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.associacao_dispensas (
  associacao_id  uuid NOT NULL REFERENCES public.associacoes(id) ON DELETE CASCADE,
  item_id        uuid NOT NULL REFERENCES public.associacao_checklist_itens(id) ON DELETE CASCADE,
  motivo         text NOT NULL CHECK (length(trim(motivo)) > 0),
  criado_por     uuid DEFAULT auth.uid(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (associacao_id, item_id)
);

-- ── Maquinário cedido (Frotas) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.associacao_cessoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associacao_id    uuid NOT NULL REFERENCES public.associacoes(id) ON DELETE CASCADE,
  machinery_id     uuid NOT NULL REFERENCES public.machinery(id) ON DELETE RESTRICT,
  data_cessao      date NOT NULL,
  data_devolucao   date,
  termo_path       text UNIQUE,
  termo_nome       text,
  observacao       text,
  created_by       uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT associacao_cessoes_datas CHECK (data_devolucao IS NULL OR data_devolucao >= data_cessao)
);
-- Uma máquina só pode estar cedida a UMA associação por vez.
CREATE UNIQUE INDEX IF NOT EXISTS associacao_cessoes_maquina_ativa
  ON public.associacao_cessoes (machinery_id) WHERE data_devolucao IS NULL;

-- ── Atendimentos de patrulha feitos pela associação ─────────────────────────
CREATE TABLE IF NOT EXISTS public.associacao_atendimentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  associacao_id       uuid NOT NULL REFERENCES public.associacoes(id) ON DELETE CASCADE,
  producer_id         uuid REFERENCES public.producers(id) ON DELETE SET NULL,
  produtor_nome       text,            -- associado ainda sem cadastro de produtor
  demand_type_id      uuid NOT NULL REFERENCES public.demand_types(id),
  machinery_id        uuid REFERENCES public.machinery(id) ON DELETE SET NULL,
  settlement_id       uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  data_atendimento    date NOT NULL,
  horas               numeric(8,2) CHECK (horas IS NULL OR horas >= 0),
  area_ha             numeric(10,2) CHECK (area_ha IS NULL OR area_ha >= 0),
  combustivel_litros  numeric(10,2) CHECK (combustivel_litros IS NULL OR combustivel_litros >= 0),
  observacao          text,
  created_by          uuid DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT associacao_atendimentos_produtor CHECK (producer_id IS NOT NULL OR length(trim(COALESCE(produtor_nome, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS idx_associacao_atendimentos_assoc ON public.associacao_atendimentos (associacao_id, data_atendimento DESC);

-- ── updated_at ──────────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['associacoes', 'associacao_checklist_itens', 'associacao_documentos', 'associacao_cessoes', 'associacao_atendimentos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t);
  END LOOP;
END $$;

-- ── Permissões (RLS) ────────────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['associacoes', 'associacao_checklist_itens', 'associacao_documentos', 'associacao_dispensas', 'associacao_cessoes', 'associacao_atendimentos'] LOOP
    EXECUTE format('ALTER TABLE public.%1$s ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%1$s FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$s TO authenticated;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated USING (public.pode_gerir_associacoes(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.pode_gerir_associacoes(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated USING (public.pode_gerir_associacoes(auth.uid())) WITH CHECK (public.pode_gerir_associacoes(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated USING (public.pode_gerir_associacoes(auth.uid()) AND NOT public.is_coordenador(auth.uid()));', t);
    -- Auditoria, como nas demais tabelas.
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();', t);
  END LOOP;
END $$;

-- Coordenador não exclui associações (entidade de topo).
DROP TRIGGER IF EXISTS trg_block_coord_del_associacoes ON public.associacoes;
CREATE TRIGGER trg_block_coord_del_associacoes
  BEFORE DELETE ON public.associacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();

-- ── Armazenamento privado ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('associacoes', 'associacoes', false, 20971520, ARRAY[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='associacoes_select') THEN
    CREATE POLICY "associacoes_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'associacoes' AND public.pode_gerir_associacoes(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='associacoes_insert') THEN
    CREATE POLICY "associacoes_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'associacoes' AND public.pode_gerir_associacoes(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='associacoes_delete') THEN
    CREATE POLICY "associacoes_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'associacoes' AND public.pode_gerir_associacoes(auth.uid())
             AND NOT public.is_coordenador(auth.uid()));
  END IF;
END $$;

-- ── Checklist padrão (pode ser ajustado na tela) ────────────────────────────
INSERT INTO public.associacao_checklist_itens (codigo, nome, categoria, descricao, como_obter, link_oficial, obrigatorio, tem_validade, ordem) VALUES
  ('cnpj', 'Cartão CNPJ com situação ATIVA', 'constituicao',
   'Comprovante de Inscrição e de Situação Cadastral emitido pela Receita Federal, mostrando a situação "ATIVA".',
   'No site da Receita Federal, em "Emitir Comprovante de Inscrição e de Situação Cadastral", informe o CNPJ e salve em PDF. Confira a situação cadastral e a data.',
   'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp', true, false, 10),
  ('estatuto', 'Estatuto social registrado (e alterações)', 'constituicao',
   'Estatuto vigente registrado no Cartório de Registro Civil de Pessoas Jurídicas, com as alterações averbadas.',
   'Pedir cópia ao cartório onde a associação foi registrada ou usar a via registrada guardada pela diretoria.', null, true, false, 20),
  ('ata_fundacao', 'Ata de fundação / constituição registrada', 'constituicao',
   'Ata da assembleia de fundação, registrada em cartório.',
   'Via registrada guardada pela associação ou certidão de inteiro teor no cartório de registro.', null, true, false, 30),
  ('ata_diretoria', 'Ata de eleição e posse da diretoria vigente', 'diretoria',
   'Ata da última eleição e posse da diretoria, registrada em cartório. Vale enquanto durar o mandato.',
   'Via registrada da última assembleia de eleição. Informe como validade a data de fim do mandato.', null, true, true, 40),
  ('docs_presidente', 'Documentos pessoais do presidente (RG e CPF)', 'diretoria',
   'Documento de identidade com CPF do presidente em exercício.',
   'Cópia do documento com foto e CPF do presidente atual.', null, true, false, 50),
  ('relacao_associados', 'Relação atualizada de associados', 'diretoria',
   'Lista de associados com nome e CPF, assinada pelo presidente.',
   'Atualizar ao menos uma vez por ano, assinada pela diretoria.', null, true, true, 60),
  ('endereco_sede', 'Comprovante de endereço da sede', 'funcionamento',
   'Conta de consumo, contrato ou declaração do endereço da sede da associação.',
   'Documento recente (de preferência dos últimos 3 meses) em nome da associação ou com declaração.', null, true, true, 70),
  ('cnd_federal', 'CND Federal (Receita Federal / PGFN)', 'fiscal',
   'Certidão de Débitos Relativos a Créditos Tributários Federais e à Dívida Ativa da União.',
   'Emitir no site da Receita Federal (Certidão de Débitos — Pessoa Jurídica). A validade vem impressa na certidão.',
   'https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir', true, true, 80),
  ('cnd_estadual', 'CND Estadual (SEFAZ-MT)', 'fiscal',
   'Certidão negativa (ou positiva com efeito de negativa) de débitos estaduais.',
   'Emitir no portal da SEFAZ-MT. A validade vem impressa na certidão.', 'https://www.sefaz.mt.gov.br', true, true, 90),
  ('cnd_municipal', 'CND Municipal (Prefeitura de Confresa)', 'fiscal',
   'Certidão negativa de débitos municipais.',
   'Solicitar no setor de Tributos da Prefeitura. A validade vem impressa na certidão.', null, true, true, 100),
  ('crf_fgts', 'CRF — Regularidade do FGTS (Caixa)', 'trabalhista',
   'Certificado de Regularidade do FGTS emitido pela Caixa.',
   'Consultar e emitir no site da Caixa (Consulta Regularidade do Empregador). A validade vem impressa.',
   'https://consulta-crf.caixa.gov.br', true, true, 110),
  ('cndt', 'CNDT — Certidão Negativa de Débitos Trabalhistas (TST)', 'trabalhista',
   'Certidão emitida pelo Tribunal Superior do Trabalho.',
   'Emitir no site do TST informando o CNPJ. A validade vem impressa.', 'https://cndt-certidao.tst.jus.br', true, true, 120),
  ('alvara', 'Alvará de funcionamento', 'funcionamento',
   'Alvará de localização e funcionamento da sede, quando exigido.',
   'Solicitar na Prefeitura. Marque "não se aplica" se a associação não tiver sede com atividade que exija alvará.', null, false, true, 130),
  ('prestacao_contas', 'Prestação de contas do último exercício', 'funcionamento',
   'Balanço / prestação de contas do ano anterior, aprovada em assembleia.',
   'Ata da assembleia que aprovou as contas e o demonstrativo. Validade sugerida: até a próxima prestação (1 ano).', null, true, true, 140),
  ('ata_ultima_assembleia', 'Ata da última assembleia geral ordinária', 'diretoria',
   'Ata da assembleia geral ordinária mais recente.',
   'Via assinada (e registrada, se o estatuto exigir).', null, false, false, 150),
  ('caf_juridico', 'CAF Jurídico (antiga DAP Jurídica)', 'outros',
   'Cadastro Nacional da Agricultura Familiar da pessoa jurídica — necessário para PNAE/PAA e políticas da agricultura familiar.',
   'Emitir/consultar no sistema do CAF (Ministério do Desenvolvimento Agrário). Validade conforme o documento.', 'https://caf.mda.gov.br', false, true, 160),
  ('utilidade_publica', 'Declaração de utilidade pública municipal', 'outros',
   'Lei/decreto municipal que declara a associação de utilidade pública, quando houver.',
   'Cópia da lei ou do decreto municipal.', null, false, false, 170)
ON CONFLICT (codigo) DO NOTHING;

NOTIFY pgrst, 'reload schema';
