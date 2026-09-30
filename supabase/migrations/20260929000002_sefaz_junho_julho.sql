-- ============================================================================
-- SEFAZ: atendimentos de JUNHO e JULHO/2026 que não tinham sido lançados.
-- Conferidos pela Secretaria na lista ASSINADA (29/09/2026): os 23 primeiros da
-- lista dos mais atendidos em 2026 — 22 pessoas, pois um produtor tem dois
-- cadastros na SEFAZ (mesmo CPF/telefone) e entra UMA vez, no cadastro principal.
--   * junho: 30/06/2026 (não havia nenhum lançamento em junho);
--   * julho: 30/07/2026 (mesma data dos lançamentos já existentes); SOMAM aos 16.
-- Tipo "Nota Fiscal", lista assinada = sim. Todos marcados na observação para
-- serem localizados/desfeitos. Idempotente: não duplica se rodar de novo.
-- ============================================================================
DO $$
DECLARE
  _obs constant text := 'Lançado em 29/09/2026 a partir da lista assinada (conferida pela Secretaria)';
  _n int;
BEGIN
  CREATE TEMP TABLE _pessoas (id uuid) ON COMMIT DROP;
  INSERT INTO _pessoas (id) VALUES
    ('0b672300-136c-45a0-b9ba-c072f4f4d2c4'::uuid),
    ('a0873dff-e45a-4d91-bf18-cfa65cfbee4e'::uuid),
    ('a10237e5-0b8c-4888-87fd-a481e3d97de4'::uuid),
    ('6cec86b4-889f-4c26-ac60-b2a1cf94c72a'::uuid),
    ('3010ed1b-ad16-4bb6-92de-761a96408fd9'::uuid),
    ('2fed9f20-97a1-4e8c-be7f-aa07e8729b03'::uuid),
    ('7e1d3d61-5e08-4279-8397-43fc4ddc3457'::uuid),
    ('3c8a1970-156c-4b0c-a075-ebe02390efa9'::uuid),
    ('3bcddf4f-f08c-4ec1-9fb6-93846bbb689f'::uuid),
    ('461aba81-dfff-4a52-8b8e-f33dd9cd8621'::uuid),
    ('90448c78-f5d7-4e52-93bf-6bdfc2abda4f'::uuid),
    ('08f28388-2d04-45cc-ae4e-b85ec0a3ba12'::uuid),
    ('cbe1072c-4162-46f8-966e-f416e40f179f'::uuid),
    ('829514d4-1d77-4bd2-a06f-5bb7fe57bf76'::uuid),
    ('e072c29c-47fc-460a-89e4-77d07eb59c16'::uuid),
    ('6d76a646-5005-4e83-a5d5-1fba02c43701'::uuid),
    ('3383d1c4-8179-41f5-b2cc-5a6c67cee204'::uuid),
    ('2bded832-4c46-43f1-a969-eb21d6a8bdd5'::uuid),
    ('a7a9ad3e-f347-4af1-9d5b-90f1421194c5'::uuid),
    ('342de7a0-e2d0-4462-b16a-7359347a3232'::uuid),
    ('33b65340-f174-4048-8409-706f043b9733'::uuid),
    ('0117bb72-8f9e-4e95-aabf-729569cbe95a'::uuid);

  IF (SELECT count(*) FROM public.sefaz_producers WHERE id IN (SELECT id FROM _pessoas)) <> 22 THEN
    RAISE NOTICE 'Cadastros de referência não encontrados — nada lançado.';
    RETURN;
  END IF;

  INSERT INTO public.sefaz_services (sefaz_producer_id, service_type, signed_list, service_date, notes)
  SELECT p.id, 'Nota Fiscal', true, d.dia, _obs
  FROM _pessoas p CROSS JOIN (VALUES ('2026-06-30'::date), ('2026-07-30'::date)) AS d(dia)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sefaz_services s
    WHERE s.sefaz_producer_id = p.id AND s.service_date = d.dia AND s.notes = _obs);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RAISE NOTICE 'Atendimentos SEFAZ lançados (junho + julho): %', _n;
END $$;
