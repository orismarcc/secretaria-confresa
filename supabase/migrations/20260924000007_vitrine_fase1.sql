-- ============================================================================
-- VITRINE DA AGRICULTURA FAMILIAR — Fase 1 (uso interno da equipe)
--
-- Módulo INDEPENDENTE. Garantias de isolamento:
--   * Só cria objetos NOVOS com prefixo vitrine_ (tabelas, funções, gatilhos,
--     políticas) e um bucket novo e privado (vitrine-docs).
--   * NÃO altera nenhuma tabela, política, função, gatilho ou enum existente.
--   * Ligações apenas DA vitrine PARA o sistema (producers, settlements), com
--     ON DELETE SET NULL — excluir um produtor/assentamento nunca é bloqueado.
--   * RLS em todas as tabelas desde a criação: só administradores (equipe
--     interna) leem e escrevem. Operadores de campo não têm acesso.
--   * Não guarda CPF: quando necessário, vem do cadastro rural vinculado
--     (producers), onde já é protegido.
--
-- Modelo: FORNECEDOR (quem é) ≠ OFERTA (o que tem para fornecer). Catálogo
-- padronizado de produtos/variedades. Histórico de preço automático.
-- Aditivo e idempotente.
-- ============================================================================

-- 1) Catálogo ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vitrine_produtos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  categoria      text NOT NULL CHECK (categoria IN
                   ('hortalica','fruta','raiz_tuberculo','grao','origem_animal','processado','outro')),
  unidade_padrao text NOT NULL DEFAULT 'kg',
  ativo          boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vitrine_produtos_nome ON public.vitrine_produtos (lower(nome));

CREATE TABLE IF NOT EXISTS public.vitrine_variedades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid NOT NULL REFERENCES public.vitrine_produtos(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  ativo      boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vitrine_variedades_nome ON public.vitrine_variedades (produto_id, lower(nome));

-- 2) Fornecedor (produtor na vitrine) ---------------------------------------
CREATE TABLE IF NOT EXISTS public.vitrine_fornecedores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producer_id        uuid REFERENCES public.producers(id) ON DELETE SET NULL, -- vínculo opcional ao cadastro rural
  nome               text NOT NULL,
  telefone           text,
  whatsapp           text,
  email              text,
  settlement_id      uuid REFERENCES public.settlements(id) ON DELETE SET NULL,
  localidade         text,
  data_nascimento    date,
  genero             text CHECK (genero IS NULL OR genero IN ('feminino','masculino','outro','nao_informado')),
  perfis             text[] NOT NULL DEFAULT '{}' CHECK (perfis <@ ARRAY[
                       'agricultor_familiar','assentado','pequeno_produtor','cooperado','associacao',
                       'quilombola','indigena','outro']::text[]),
  programas          text[] NOT NULL DEFAULT '{}' CHECK (programas <@ ARRAY[
                       'pnae','paa','feiras','hospitais','assistencia_social','outros_programas',
                       'venda_institucional']::text[]),
  aceita_contato     boolean NOT NULL DEFAULT true,
  status             text NOT NULL DEFAULT 'em_analise' CHECK (status IN
                       ('recebido','em_analise','pendencia','validado','inativo')),
  origem             text NOT NULL DEFAULT 'equipe' CHECK (origem IN ('equipe','autocadastro')),
  observacao_interna text,
  validado_por       uuid,
  validado_em        timestamptz,
  created_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
-- Um cadastro rural vira no máximo UM fornecedor na vitrine.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vitrine_fornecedores_producer
  ON public.vitrine_fornecedores (producer_id) WHERE producer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vitrine_fornecedores_status ON public.vitrine_fornecedores (status);
CREATE INDEX IF NOT EXISTS idx_vitrine_fornecedores_settlement ON public.vitrine_fornecedores (settlement_id);

-- 3) Oferta (o coração do módulo) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.vitrine_ofertas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id       uuid NOT NULL REFERENCES public.vitrine_fornecedores(id) ON DELETE CASCADE,
  produto_id          uuid NOT NULL REFERENCES public.vitrine_produtos(id),
  variedade_id        uuid REFERENCES public.vitrine_variedades(id) ON DELETE SET NULL,
  unidade             text NOT NULL DEFAULT 'kg' CHECK (unidade IN
                        ('kg','unidade','caixa','duzia','maco','saco','litro','bandeja','pacote','pote','outra')),
  qtd_mensal          numeric(12,2) CHECK (qtd_mensal IS NULL OR qtd_mensal >= 0),   -- disponível para venda/mês
  capacidade_mensal   numeric(12,2) CHECK (capacidade_mensal IS NULL OR capacidade_mensal >= 0), -- opcional (técnico)
  meses               smallint[] NOT NULL DEFAULT '{}' CHECK (meses <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::smallint[]),
  forma               text CHECK (forma IS NULL OR forma IN
                        ('in_natura','beneficiado','processado','congelado','resfriado')),
  embalagem           text,
  preco               numeric(12,2) CHECK (preco IS NULL OR preco >= 0),
  preco_entregue      boolean NOT NULL DEFAULT false,  -- preço já com entrega no destino?
  preco_inclui        text[] NOT NULL DEFAULT '{}' CHECK (preco_inclui <@ ARRAY[
                        'embalagem','selecao','higienizacao','processamento']::text[]),
  frequencia          text CHECK (frequencia IS NULL OR frequencia IN
                        ('semanal','quinzenal','mensal','sob_demanda')),
  entrega_propria     boolean,
  emite_nota          boolean,
  validade_dias       integer CHECK (validade_dias IS NULL OR validade_dias > 0), -- processados
  registro_sanitario  text,                                                      -- processados / origem animal
  observacao          text,
  ativo               boolean NOT NULL DEFAULT true,
  preco_atualizado_em timestamptz,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitrine_ofertas_fornecedor ON public.vitrine_ofertas (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_vitrine_ofertas_produto    ON public.vitrine_ofertas (produto_id);

-- 4) Histórico de preço (gravado automaticamente) ------------------------------
CREATE TABLE IF NOT EXISTS public.vitrine_precos_hist (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id      uuid NOT NULL REFERENCES public.vitrine_ofertas(id) ON DELETE CASCADE,
  preco          numeric(12,2),
  preco_entregue boolean,
  unidade        text,
  registrado_em  timestamptz NOT NULL DEFAULT now(),
  registrado_por uuid
);
CREATE INDEX IF NOT EXISTS idx_vitrine_precos_hist_oferta ON public.vitrine_precos_hist (oferta_id, registrado_em);

-- 5) Documentos -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vitrine_documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid NOT NULL REFERENCES public.vitrine_fornecedores(id) ON DELETE CASCADE,
  tipo          text NOT NULL CHECK (tipo IN
                  ('caf','dap','rg','comprovante_endereco','documento_propriedade','inscricao_estadual',
                   'cnpj','certidao','sanitario','licenca','outro')),
  numero        text,
  validade      date,
  file_path     text,  -- no bucket privado vitrine-docs
  situacao      text NOT NULL DEFAULT 'enviado' CHECK (situacao IN ('enviado','validado','recusado')),
  observacao    text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vitrine_documentos_fornecedor ON public.vitrine_documentos (fornecedor_id);

-- 6) Gatilhos PRÓPRIOS do módulo (só nas tabelas vitrine_) ---------------------
CREATE OR REPLACE FUNCTION public.vitrine_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- Preço: marca quando foi atualizado e registra no histórico.
CREATE OR REPLACE FUNCTION public.vitrine_oferta_preco()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.preco IS DISTINCT FROM OLD.preco
     OR NEW.preco_entregue IS DISTINCT FROM OLD.preco_entregue
     OR NEW.unidade IS DISTINCT FROM OLD.unidade THEN
    IF NEW.preco IS NOT NULL THEN
      NEW.preco_atualizado_em := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.vitrine_oferta_preco_hist()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.preco IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.preco IS DISTINCT FROM OLD.preco
       OR NEW.preco_entregue IS DISTINCT FROM OLD.preco_entregue
       OR NEW.unidade IS DISTINCT FROM OLD.unidade) THEN
    INSERT INTO public.vitrine_precos_hist (oferta_id, preco, preco_entregue, unidade, registrado_por)
    VALUES (NEW.id, NEW.preco, NEW.preco_entregue, NEW.unidade, auth.uid());
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vitrine_fornecedores','vitrine_ofertas','vitrine_documentos'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_%1$s_updated_at BEFORE UPDATE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.vitrine_touch_updated_at();', t);
    -- Auditoria (mesma função do restante do sistema; só ANEXADA às tabelas novas).
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%1$s ON public.%1$s;', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s
                    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_vitrine_oferta_preco ON public.vitrine_ofertas;
CREATE TRIGGER trg_vitrine_oferta_preco
  BEFORE INSERT OR UPDATE ON public.vitrine_ofertas
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_oferta_preco();

DROP TRIGGER IF EXISTS trg_vitrine_oferta_preco_hist ON public.vitrine_ofertas;
CREATE TRIGGER trg_vitrine_oferta_preco_hist
  AFTER INSERT OR UPDATE ON public.vitrine_ofertas
  FOR EACH ROW EXECUTE FUNCTION public.vitrine_oferta_preco_hist();

-- 7) RLS — só administradores (equipe interna) --------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vitrine_produtos','vitrine_variedades','vitrine_fornecedores',
                           'vitrine_ofertas','vitrine_precos_hist','vitrine_documentos'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_admin', t);
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR ALL TO authenticated
                      USING (public.has_role(auth.uid(), 'admin'::app_role))
                      WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));$f$, t || '_admin', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
  END LOOP;
END $$;

-- 8) Bucket privado dos documentos — só admin lê/grava/apaga -------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('vitrine-docs', 'vitrine-docs', false, 15728640,
        ARRAY['image/jpeg','image/jpg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vitrine_docs_insert') THEN
    CREATE POLICY "vitrine_docs_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'vitrine-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vitrine_docs_select') THEN
    CREATE POLICY "vitrine_docs_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'vitrine-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='vitrine_docs_delete') THEN
    CREATE POLICY "vitrine_docs_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'vitrine-docs' AND public.has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
