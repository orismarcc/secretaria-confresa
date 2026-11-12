-- ============================================================================
-- Ofícios da Secretaria: cadastro, numeração por ano, arquivo assinado (PDF)
-- com histórico de versões, e modelos de ofício.
--
--  * oficios          — um registro por ofício; (ano, numero) ÚNICO.
--                       Número vazio no cadastro = próximo do ano (sem corrida:
--                       trava por ano dentro da transação).
--  * oficio_arquivos  — histórico IMUTÁVEL dos PDFs assinados (versão 1, 2...).
--                       Substituir o arquivo cria uma nova versão; as antigas
--                       continuam guardadas.
--  * oficio_modelos   — modelos (.docx/.pdf) por finalidade/categoria.
--  * bucket PRIVADO 'oficios' (PDF e DOCX até 20 MB), acesso por link
--    temporário gerado na hora.
--
-- Acesso: equipe interna (admin), exceto Assistente de Campo. Excluir: só
-- admin pleno (Coordenador bloqueado, como nas demais tabelas).
-- Só ACRESCENTA. Nenhum dado existente é alterado. Idempotente.
-- ============================================================================

-- Quem gerencia ofícios: admin que não é Assistente de Campo.
CREATE OR REPLACE FUNCTION public.pode_gerir_oficios(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    LEFT JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _uid
      AND ur.role = 'admin'
      AND COALESCE(p.job_title, '') <> 'Assistente de Campo'
  );
$$;
GRANT EXECUTE ON FUNCTION public.pode_gerir_oficios(uuid) TO authenticated;

-- ── Modelos ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oficio_modelos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome             text NOT NULL CHECK (length(trim(nome)) > 0),
  categoria        text NOT NULL,
  finalidade       text,
  descricao        text,
  arquivo_path     text UNIQUE,
  arquivo_nome     text,
  arquivo_tamanho  bigint CHECK (arquivo_tamanho IS NULL OR arquivo_tamanho >= 0),
  ativo            boolean NOT NULL DEFAULT true,
  created_by       uuid DEFAULT auth.uid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ── Ofícios ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oficios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano              integer NOT NULL CHECK (ano BETWEEN 2000 AND 2100),
  numero           integer NOT NULL CHECK (numero > 0),
  data_oficio      date NOT NULL,
  destinatario     text NOT NULL CHECK (length(trim(destinatario)) > 0),
  assunto          text NOT NULL CHECK (length(trim(assunto)) > 0),
  categoria        text NOT NULL,
  situacao         text NOT NULL DEFAULT 'rascunho'
                   CHECK (situacao IN ('rascunho', 'emitido', 'enviado', 'respondido', 'arquivado', 'cancelado')),
  descricao        text,
  modelo_id        uuid REFERENCES public.oficio_modelos(id) ON DELETE SET NULL,
  arquivo_path     text,
  arquivo_nome     text,
  arquivo_tamanho  bigint CHECK (arquivo_tamanho IS NULL OR arquivo_tamanho >= 0),
  arquivo_versao   integer NOT NULL DEFAULT 0,
  created_by       uuid DEFAULT auth.uid(),
  updated_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oficios_ano_numero_key UNIQUE (ano, numero),
  CONSTRAINT oficios_ano_da_data CHECK (ano = EXTRACT(YEAR FROM data_oficio)::int)
);
CREATE INDEX IF NOT EXISTS idx_oficios_data ON public.oficios (data_oficio DESC);

-- ── Histórico dos arquivos assinados ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oficio_arquivos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio_id        uuid NOT NULL REFERENCES public.oficios(id) ON DELETE CASCADE,
  versao           integer NOT NULL CHECK (versao > 0),
  arquivo_path     text NOT NULL UNIQUE,
  arquivo_nome     text NOT NULL,
  arquivo_tamanho  bigint CHECK (arquivo_tamanho IS NULL OR arquivo_tamanho >= 0),
  acao             text NOT NULL CHECK (acao IN ('envio', 'substituicao')),
  motivo           text,
  enviado_por      uuid DEFAULT auth.uid(),
  enviado_em       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oficio_arquivos_versao_key UNIQUE (oficio_id, versao)
);

-- ── Numeração: ano pela data; número vazio = próximo do ano ─────────────────
CREATE OR REPLACE FUNCTION public.trg_oficios_numeracao()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.ano := EXTRACT(YEAR FROM NEW.data_oficio)::int;
  IF TG_OP = 'INSERT' AND NEW.numero IS NULL THEN
    -- Trava por ano: dois cadastros simultâneos não pegam o mesmo número.
    PERFORM pg_advisory_xact_lock(hashtext('oficios_numero_' || NEW.ano));
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero FROM public.oficios WHERE ano = NEW.ano;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_by := auth.uid();
    -- Campos do arquivo só mudam pela função registrar_arquivo_oficio.
    IF current_setting('oficios.registrando_arquivo', true) IS DISTINCT FROM 'sim' THEN
      NEW.arquivo_path := OLD.arquivo_path;
      NEW.arquivo_nome := OLD.arquivo_nome;
      NEW.arquivo_tamanho := OLD.arquivo_tamanho;
      NEW.arquivo_versao := OLD.arquivo_versao;
    END IF;
  ELSE
    NEW.arquivo_path := NULL;
    NEW.arquivo_nome := NULL;
    NEW.arquivo_tamanho := NULL;
    NEW.arquivo_versao := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oficios_numeracao ON public.oficios;
CREATE TRIGGER trg_oficios_numeracao
  BEFORE INSERT OR UPDATE ON public.oficios
  FOR EACH ROW EXECUTE FUNCTION public.trg_oficios_numeracao();

-- Próximo número livre do ano (sugestão para o formulário).
CREATE OR REPLACE FUNCTION public.proximo_numero_oficio(_ano integer)
RETURNS integer
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(MAX(numero), 0) + 1 FROM public.oficios WHERE ano = _ano;
$$;
GRANT EXECUTE ON FUNCTION public.proximo_numero_oficio(integer) TO authenticated;

-- Registra um PDF assinado (nova versão) de forma atômica: grava o histórico
-- e aponta o ofício para a versão nova. Roda com as permissões de quem chama
-- (RLS vale normalmente).
CREATE OR REPLACE FUNCTION public.registrar_arquivo_oficio(
  _oficio_id uuid, _path text, _nome text, _tamanho bigint, _motivo text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _versao integer;
  _atual integer;
BEGIN
  SELECT arquivo_versao INTO _atual FROM public.oficios WHERE id = _oficio_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ofício não encontrado.' USING ERRCODE = 'no_data_found';
  END IF;
  _versao := _atual + 1;
  INSERT INTO public.oficio_arquivos (oficio_id, versao, arquivo_path, arquivo_nome, arquivo_tamanho, acao, motivo)
  VALUES (_oficio_id, _versao, _path, _nome, _tamanho, CASE WHEN _atual = 0 THEN 'envio' ELSE 'substituicao' END, NULLIF(trim(COALESCE(_motivo, '')), ''));
  PERFORM set_config('oficios.registrando_arquivo', 'sim', true);
  UPDATE public.oficios
     SET arquivo_path = _path, arquivo_nome = _nome, arquivo_tamanho = _tamanho, arquivo_versao = _versao
   WHERE id = _oficio_id;
  PERFORM set_config('oficios.registrando_arquivo', 'nao', true);
  RETURN _versao;
END;
$$;
GRANT EXECUTE ON FUNCTION public.registrar_arquivo_oficio(uuid, text, text, bigint, text) TO authenticated;

-- ── updated_at ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS update_oficios_updated_at ON public.oficios;
CREATE TRIGGER update_oficios_updated_at
  BEFORE UPDATE ON public.oficios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_oficio_modelos_updated_at ON public.oficio_modelos;
CREATE TRIGGER update_oficio_modelos_updated_at
  BEFORE UPDATE ON public.oficio_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Permissões (RLS) ────────────────────────────────────────────────────────
ALTER TABLE public.oficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficio_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oficio_modelos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.oficios, public.oficio_arquivos, public.oficio_modelos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficios, public.oficio_modelos TO authenticated;
GRANT SELECT, INSERT ON public.oficio_arquivos TO authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['oficios', 'oficio_modelos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_select" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_select" ON public.%1$s FOR SELECT TO authenticated USING (public.pode_gerir_oficios(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_insert" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_insert" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (public.pode_gerir_oficios(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_update" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_update" ON public.%1$s FOR UPDATE TO authenticated USING (public.pode_gerir_oficios(auth.uid())) WITH CHECK (public.pode_gerir_oficios(auth.uid()));', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_delete" ON public.%1$s;', t);
    EXECUTE format('CREATE POLICY "%1$s_delete" ON public.%1$s FOR DELETE TO authenticated USING (public.pode_gerir_oficios(auth.uid()) AND NOT public.is_coordenador(auth.uid()));', t);
  END LOOP;
END $$;

-- Histórico: lê e acrescenta; não se altera nem se apaga (sai junto só se o
-- ofício inteiro for excluído).
DROP POLICY IF EXISTS "oficio_arquivos_select" ON public.oficio_arquivos;
CREATE POLICY "oficio_arquivos_select" ON public.oficio_arquivos
  FOR SELECT TO authenticated USING (public.pode_gerir_oficios(auth.uid()));
DROP POLICY IF EXISTS "oficio_arquivos_insert" ON public.oficio_arquivos;
CREATE POLICY "oficio_arquivos_insert" ON public.oficio_arquivos
  FOR INSERT TO authenticated WITH CHECK (public.pode_gerir_oficios(auth.uid()));

-- Coordenador não exclui (mesmo gatilho das demais tabelas).
DROP TRIGGER IF EXISTS trg_block_coord_del_oficios ON public.oficios;
CREATE TRIGGER trg_block_coord_del_oficios
  BEFORE DELETE ON public.oficios
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();
DROP TRIGGER IF EXISTS trg_block_coord_del_oficio_modelos ON public.oficio_modelos;
CREATE TRIGGER trg_block_coord_del_oficio_modelos
  BEFORE DELETE ON public.oficio_modelos
  FOR EACH ROW EXECUTE FUNCTION public.fn_block_coordenador_delete();

-- Auditoria, como nas demais tabelas.
DROP TRIGGER IF EXISTS trg_audit_oficios ON public.oficios;
CREATE TRIGGER trg_audit_oficios
  AFTER INSERT OR UPDATE OR DELETE ON public.oficios
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_oficio_arquivos ON public.oficio_arquivos;
CREATE TRIGGER trg_audit_oficio_arquivos
  AFTER INSERT OR UPDATE OR DELETE ON public.oficio_arquivos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_oficio_modelos ON public.oficio_modelos;
CREATE TRIGGER trg_audit_oficio_modelos
  AFTER INSERT OR UPDATE OR DELETE ON public.oficio_modelos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();

-- ── Armazenamento privado ───────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('oficios', 'oficios', false, 20971520, ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='oficios_select') THEN
    CREATE POLICY "oficios_select" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'oficios' AND public.pode_gerir_oficios(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='oficios_insert') THEN
    CREATE POLICY "oficios_insert" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'oficios' AND public.pode_gerir_oficios(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='oficios_delete') THEN
    CREATE POLICY "oficios_delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'oficios' AND public.pode_gerir_oficios(auth.uid())
             AND NOT public.is_coordenador(auth.uid()));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
