-- ============================================================================
-- Produtores: CPF padronizado, aviso de cadastro parecido e "Unificar".
--
-- Nada nos 843 cadastros atuais é alterado:
--   * Todos os CPFs existentes já estão no formato 000.000.000-00. O padrão
--     passa a valer também para gravações futuras vindas de qualquer caminho
--     (importação, etc.): 11 dígitos → 000.000.000-00; 14 → 00.000.000/0000-00.
--   * Nova trava de duplicidade que compara SÓ os números (antes "12345678900"
--     e "123.456.789-00" passariam como diferentes). Verificado: 0 duplicados.
--   * produtores_parecidos(): consulta para o aviso no formulário (só admin).
--   * unificar_produtores()/desfazer_unificacao(): move tudo do cadastro
--     repetido para o principal, com backup completo para desfazer (só admin).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ─── 1. CPF: dígitos, formato padrão e trava por dígitos ────────────────────
CREATE OR REPLACE FUNCTION public.cpf_digitos(_v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$ SELECT regexp_replace(coalesce(_v, ''), '\D', '', 'g') $$;

CREATE OR REPLACE FUNCTION public.cpf_formatado(_v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT CASE length(public.cpf_digitos(_v))
    WHEN 11 THEN regexp_replace(public.cpf_digitos(_v), '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4')
    WHEN 14 THEN regexp_replace(public.cpf_digitos(_v), '^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$', '\1.\2.\3/\4-\5')
    ELSE _v   -- formato desconhecido: grava como veio (não bloqueia)
  END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS producers_cpf_digitos_key
  ON public.producers (public.cpf_digitos(cpf))
  WHERE public.cpf_digitos(cpf) <> '';

-- Roda ANTES da criptografia (triggers BEFORE executam em ordem alfabética:
-- "a_..." < "encrypt_cpf_trigger").
CREATE OR REPLACE FUNCTION public.trg_padronizar_cpf()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.cpf IS NOT NULL AND NEW.cpf <> '' THEN
    NEW.cpf := public.cpf_formatado(NEW.cpf);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS a_padronizar_cpf ON public.producers;
CREATE TRIGGER a_padronizar_cpf
  BEFORE INSERT OR UPDATE OF cpf ON public.producers
  FOR EACH ROW EXECUTE FUNCTION public.trg_padronizar_cpf();

-- ─── 2. Cadastros parecidos (aviso no formulário) ───────────────────────────
CREATE OR REPLACE FUNCTION public.nome_normalizado(_v text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT trim(regexp_replace(lower(translate(coalesce(_v, ''),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
    'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.produtores_parecidos(
  _nome text, _cpf text DEFAULT NULL, _telefone text DEFAULT NULL,
  _settlement_id uuid DEFAULT NULL, _ignorar_id uuid DEFAULT NULL)
RETURNS TABLE (id uuid, name text, settlement_name text, motivo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
  WITH p AS (
    SELECT pr.id, pr.name, s.name AS settlement_name, pr.settlement_id,
      public.cpf_digitos(pr.cpf) AS cpf_d, public.cpf_digitos(pr.phone) AS tel_d,
      extensions.similarity(public.nome_normalizado(pr.name), public.nome_normalizado(_nome)) AS sim
    FROM public.producers pr
    LEFT JOIN public.settlements s ON s.id = pr.settlement_id
    WHERE public.has_role(auth.uid(), 'admin'::app_role)
      AND (_ignorar_id IS NULL OR pr.id <> _ignorar_id)
  )
  SELECT p.id, p.name, p.settlement_name,
    CASE
      WHEN public.cpf_digitos(_cpf) <> '' AND p.cpf_d = public.cpf_digitos(_cpf) THEN 'mesmo CPF'
      WHEN length(public.cpf_digitos(_telefone)) >= 10 AND p.tel_d = public.cpf_digitos(_telefone) THEN 'mesmo telefone'
      ELSE 'nome parecido'
    END
  FROM p
  WHERE (public.cpf_digitos(_cpf) <> '' AND p.cpf_d = public.cpf_digitos(_cpf))
     OR (length(public.cpf_digitos(_telefone)) >= 10 AND p.tel_d = public.cpf_digitos(_telefone))
     OR (length(public.nome_normalizado(_nome)) >= 5 AND (
           p.sim >= 0.85
        OR (p.sim >= 0.6 AND _settlement_id IS NOT NULL AND p.settlement_id = _settlement_id)))
  ORDER BY (p.cpf_d = public.cpf_digitos(_cpf)) DESC, p.sim DESC
  LIMIT 5
$$;

REVOKE EXECUTE ON FUNCTION public.produtores_parecidos(text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.produtores_parecidos(text, text, text, uuid, uuid) TO authenticated;

-- ─── 3. Unificar cadastros (com backup para desfazer) ───────────────────────
CREATE TABLE IF NOT EXISTS public.backup_unificacao_produtores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manter_id     uuid NOT NULL,
  removido      jsonb NOT NULL,   -- cadastro repetido completo
  movidos       jsonb NOT NULL,   -- ids movidos por tabela + o que foi preenchido
  unificado_por uuid,
  unificado_em  timestamptz NOT NULL DEFAULT now(),
  desfeito_em   timestamptz
);
ALTER TABLE public.backup_unificacao_produtores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.backup_unificacao_produtores FROM anon;
DROP POLICY IF EXISTS "backup_unificacao_admin" ON public.backup_unificacao_produtores;
CREATE POLICY "backup_unificacao_admin" ON public.backup_unificacao_produtores
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.unificar_produtores(_manter uuid, _remover uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m public.producers%ROWTYPE;
  r public.producers%ROWTYPE;
  v_props uuid[]; v_serv uuid[]; v_deliv uuid[]; v_forn uuid[]; v_dem_add uuid[];
  v_preenchidos jsonb := '{}'::jsonb;
  v_backup uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) OR public.is_coordenador(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores podem unificar cadastros.' USING ERRCODE = '42501';
  END IF;
  IF _manter IS NULL OR _remover IS NULL OR _manter = _remover THEN
    RAISE EXCEPTION 'Escolha dois cadastros diferentes.';
  END IF;
  SELECT * INTO m FROM public.producers WHERE id = _manter FOR UPDATE;
  SELECT * INTO r FROM public.producers WHERE id = _remover FOR UPDATE;
  IF m.id IS NULL OR r.id IS NULL THEN
    RAISE EXCEPTION 'Cadastro não encontrado.';
  END IF;

  -- Propriedades primeiro (a trava dos atendimentos exige propriedade do mesmo produtor)
  WITH u AS (UPDATE public.producer_properties SET producer_id = _manter WHERE producer_id = _remover RETURNING id)
    SELECT array_agg(id) INTO v_props FROM u;
  WITH u AS (UPDATE public.services SET producer_id = _manter WHERE producer_id = _remover RETURNING id)
    SELECT array_agg(id) INTO v_serv FROM u;
  WITH u AS (UPDATE public.deliveries SET producer_id = _manter WHERE producer_id = _remover RETURNING id)
    SELECT array_agg(id) INTO v_deliv FROM u;
  -- Conecta Confresa: só move o vínculo se o principal ainda não tiver fornecedor
  IF NOT EXISTS (SELECT 1 FROM public.vitrine_fornecedores WHERE producer_id = _manter) THEN
    WITH u AS (UPDATE public.vitrine_fornecedores SET producer_id = _manter WHERE producer_id = _remover RETURNING id)
      SELECT array_agg(id) INTO v_forn FROM u;
  END IF;
  -- Tipos de demanda: acrescenta ao principal os que ele não tinha
  WITH ins AS (
    INSERT INTO public.producer_demands (producer_id, demand_type_id)
    SELECT _manter, demand_type_id FROM public.producer_demands WHERE producer_id = _remover
    ON CONFLICT (producer_id, demand_type_id) DO NOTHING
    RETURNING demand_type_id)
  SELECT array_agg(demand_type_id) INTO v_dem_add FROM ins;

  -- Campos vazios do principal recebem os do repetido (nunca sobrescreve)
  IF (m.phone IS NULL OR m.phone = '') AND coalesce(r.phone, '') <> '' THEN
    v_preenchidos := v_preenchidos || jsonb_build_object('phone', m.phone);
    UPDATE public.producers SET phone = r.phone WHERE id = _manter;
  END IF;
  IF (m.latitude IS NULL OR m.longitude IS NULL) AND r.latitude IS NOT NULL AND r.longitude IS NOT NULL THEN
    v_preenchidos := v_preenchidos || jsonb_build_object('latitude', m.latitude, 'longitude', m.longitude);
    UPDATE public.producers SET latitude = r.latitude, longitude = r.longitude WHERE id = _manter;
  END IF;
  IF (m.caf IS NULL OR m.caf = '') AND coalesce(r.caf, '') <> '' THEN
    v_preenchidos := v_preenchidos || jsonb_build_object('caf', m.caf);
    UPDATE public.producers SET caf = r.caf WHERE id = _manter;
  END IF;
  IF (m.dap_cap IS NULL OR m.dap_cap = '') AND coalesce(r.dap_cap, '') <> '' THEN
    v_preenchidos := v_preenchidos || jsonb_build_object('dap_cap', m.dap_cap);
    UPDATE public.producers SET dap_cap = r.dap_cap WHERE id = _manter;
  END IF;
  IF (m.location_name IS NULL OR m.location_name = '') AND coalesce(r.location_name, '') <> '' THEN
    v_preenchidos := v_preenchidos || jsonb_build_object('location_name', m.location_name);
    UPDATE public.producers SET location_name = r.location_name WHERE id = _manter;
  END IF;

  INSERT INTO public.backup_unificacao_produtores (manter_id, removido, movidos, unificado_por)
  VALUES (_manter,
    to_jsonb(r) || jsonb_build_object('_demandas', (SELECT coalesce(jsonb_agg(demand_type_id), '[]'::jsonb) FROM public.producer_demands WHERE producer_id = _remover)),
    jsonb_build_object(
      'propriedades', coalesce(to_jsonb(v_props), '[]'::jsonb),
      'atendimentos', coalesce(to_jsonb(v_serv), '[]'::jsonb),
      'entregas', coalesce(to_jsonb(v_deliv), '[]'::jsonb),
      'fornecedores', coalesce(to_jsonb(v_forn), '[]'::jsonb),
      'demandas_acrescentadas', coalesce(to_jsonb(v_dem_add), '[]'::jsonb),
      'preenchidos', v_preenchidos),
    auth.uid())
  RETURNING id INTO v_backup;

  DELETE FROM public.producers WHERE id = _remover;

  RETURN jsonb_build_object(
    'backup_id', v_backup,
    'atendimentos', coalesce(array_length(v_serv, 1), 0),
    'entregas', coalesce(array_length(v_deliv, 1), 0),
    'propriedades', coalesce(array_length(v_props, 1), 0),
    'fornecedor', coalesce(array_length(v_forn, 1), 0) > 0,
    'campos_preenchidos', (SELECT coalesce(jsonb_agg(k), '[]'::jsonb) FROM jsonb_object_keys(v_preenchidos) k));
END $$;

CREATE OR REPLACE FUNCTION public.desfazer_unificacao(_backup_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  b public.backup_unificacao_produtores%ROWTYPE;
  v_prod public.producers%ROWTYPE;
  k text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) OR public.is_coordenador(auth.uid()) THEN
    RAISE EXCEPTION 'Somente administradores podem desfazer a unificação.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO b FROM public.backup_unificacao_produtores WHERE id = _backup_id FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'Registro de unificação não encontrado.'; END IF;
  IF b.desfeito_em IS NOT NULL THEN RAISE EXCEPTION 'Esta unificação já foi desfeita.'; END IF;

  -- Recria o cadastro removido (mesmo id)
  v_prod := jsonb_populate_record(NULL::public.producers, b.removido - '_demandas');
  INSERT INTO public.producers SELECT v_prod.*;
  INSERT INTO public.producer_demands (producer_id, demand_type_id)
    SELECT v_prod.id, (x #>> '{}')::uuid FROM jsonb_array_elements(b.removido -> '_demandas') x
    ON CONFLICT (producer_id, demand_type_id) DO NOTHING;

  -- Devolve o que foi movido (só o que ainda está no principal)
  UPDATE public.producer_properties SET producer_id = v_prod.id
    WHERE producer_id = b.manter_id AND id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(b.movidos -> 'propriedades') x);
  UPDATE public.services SET producer_id = v_prod.id
    WHERE producer_id = b.manter_id AND id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(b.movidos -> 'atendimentos') x);
  UPDATE public.deliveries SET producer_id = v_prod.id
    WHERE producer_id = b.manter_id AND id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(b.movidos -> 'entregas') x);
  UPDATE public.vitrine_fornecedores SET producer_id = v_prod.id
    WHERE producer_id = b.manter_id AND id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(b.movidos -> 'fornecedores') x);
  DELETE FROM public.producer_demands
    WHERE producer_id = b.manter_id AND demand_type_id IN (SELECT (x #>> '{}')::uuid FROM jsonb_array_elements(b.movidos -> 'demandas_acrescentadas') x);

  -- Campos que tinham sido preenchidos voltam ao valor anterior
  FOR k IN SELECT jsonb_object_keys(b.movidos -> 'preenchidos') LOOP
    EXECUTE format('UPDATE public.producers SET %I = ($1 ->> %L)::%s WHERE id = $2', k, k,
      CASE WHEN k IN ('latitude', 'longitude') THEN 'numeric' ELSE 'text' END)
      USING b.movidos -> 'preenchidos', b.manter_id;
  END LOOP;

  UPDATE public.backup_unificacao_produtores SET desfeito_em = now() WHERE id = _backup_id;
  RETURN jsonb_build_object('produtor_restaurado', v_prod.id);
END $$;

REVOKE EXECUTE ON FUNCTION public.unificar_produtores(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.desfazer_unificacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unificar_produtores(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.desfazer_unificacao(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
