-- ============================================================================
-- VITRINE — catálogo inicial proposto (produtos típicos da agricultura
-- familiar da região do Araguaia/MT e de compras do PNAE/PAA). A equipe pode
-- incluir, renomear ou desativar itens pela tela "Catálogo".
-- Idempotente: não duplica produtos nem variedades já existentes.
-- ============================================================================

DO $$
DECLARE
  item record;
  v text;
  pid uuid;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      -- Hortaliças
      ('Alface',            'hortalica',      'maco',    ARRAY['Crespa','Americana','Lisa','Roxa','Mimosa']),
      ('Couve',             'hortalica',      'maco',    ARRAY['Manteiga']),
      ('Cheiro-verde',      'hortalica',      'maco',    ARRAY[]::text[]),
      ('Cebolinha',         'hortalica',      'maco',    ARRAY[]::text[]),
      ('Coentro',           'hortalica',      'maco',    ARRAY[]::text[]),
      ('Rúcula',            'hortalica',      'maco',    ARRAY[]::text[]),
      ('Repolho',           'hortalica',      'kg',      ARRAY['Verde','Roxo']),
      ('Tomate',            'hortalica',      'kg',      ARRAY['Italiano','Santa Cruz','Cereja']),
      ('Pepino',            'hortalica',      'kg',      ARRAY['Japonês','Aodai']),
      ('Abobrinha',         'hortalica',      'kg',      ARRAY['Italiana']),
      ('Abóbora',           'hortalica',      'kg',      ARRAY['Cabotiá','Moranga','Menina','Seca']),
      ('Quiabo',            'hortalica',      'kg',      ARRAY[]::text[]),
      ('Maxixe',            'hortalica',      'kg',      ARRAY[]::text[]),
      ('Jiló',              'hortalica',      'kg',      ARRAY[]::text[]),
      ('Pimentão',          'hortalica',      'kg',      ARRAY['Verde','Amarelo','Vermelho']),
      ('Berinjela',         'hortalica',      'kg',      ARRAY[]::text[]),
      ('Cenoura',           'hortalica',      'kg',      ARRAY[]::text[]),
      ('Beterraba',         'hortalica',      'kg',      ARRAY[]::text[]),
      ('Chuchu',            'hortalica',      'kg',      ARRAY[]::text[]),
      ('Vagem',             'hortalica',      'kg',      ARRAY[]::text[]),
      -- Raízes e tubérculos
      ('Mandioca',          'raiz_tuberculo', 'kg',      ARRAY['Branca','Amarela']),
      ('Batata-doce',       'raiz_tuberculo', 'kg',      ARRAY['Branca','Roxa','Amarela']),
      ('Inhame',            'raiz_tuberculo', 'kg',      ARRAY[]::text[]),
      -- Frutas
      ('Banana',            'fruta',          'kg',      ARRAY['Prata','Nanica','Maçã','Da terra']),
      ('Mamão',             'fruta',          'kg',      ARRAY['Formosa','Papaya']),
      ('Melancia',          'fruta',          'kg',      ARRAY[]::text[]),
      ('Abacaxi',           'fruta',          'unidade', ARRAY['Pérola']),
      ('Laranja',           'fruta',          'kg',      ARRAY['Pera','Lima']),
      ('Limão',             'fruta',          'kg',      ARRAY['Tahiti','Galego']),
      ('Tangerina',         'fruta',          'kg',      ARRAY['Ponkan']),
      ('Maracujá',          'fruta',          'kg',      ARRAY['Azedo']),
      ('Acerola',           'fruta',          'kg',      ARRAY[]::text[]),
      ('Goiaba',            'fruta',          'kg',      ARRAY['Vermelha','Branca']),
      ('Manga',             'fruta',          'kg',      ARRAY['Tommy','Palmer','Espada']),
      ('Caju',              'fruta',          'kg',      ARRAY[]::text[]),
      ('Cupuaçu',           'fruta',          'kg',      ARRAY[]::text[]),
      ('Pequi',             'fruta',          'kg',      ARRAY[]::text[]),
      -- Grãos
      ('Feijão',            'grao',           'kg',      ARRAY['Carioca','Preto','Caupi']),
      ('Milho verde',       'grao',           'unidade', ARRAY[]::text[]),
      ('Amendoim',          'grao',           'kg',      ARRAY[]::text[]),
      -- Origem animal
      ('Ovos',              'origem_animal',  'duzia',   ARRAY['Caipira','Granja']),
      ('Leite',             'origem_animal',  'litro',   ARRAY['Vaca']),
      ('Mel',               'origem_animal',  'kg',      ARRAY['Silvestre']),
      ('Frango caipira',    'origem_animal',  'kg',      ARRAY['Abatido']),
      ('Peixe',             'origem_animal',  'kg',      ARRAY['Tambaqui','Tilápia','Pintado']),
      -- Processados
      ('Farinha de mandioca','processado',    'kg',      ARRAY['Branca','Amarela']),
      ('Polvilho',          'processado',     'kg',      ARRAY['Doce','Azedo']),
      ('Goma de tapioca',   'processado',     'kg',      ARRAY[]::text[]),
      ('Polpa de fruta',    'processado',     'kg',      ARRAY['Acerola','Cupuaçu','Maracujá','Goiaba','Caju','Manga']),
      ('Doce caseiro',      'processado',     'kg',      ARRAY['Leite','Abóbora','Banana','Goiaba']),
      ('Rapadura',          'processado',     'unidade', ARRAY[]::text[]),
      ('Queijo',            'processado',     'kg',      ARRAY['Frescal','Muçarela']),
      ('Biscoito caseiro',  'processado',     'kg',      ARRAY['Polvilho','Queijo']),
      ('Pão caseiro',       'processado',     'unidade', ARRAY[]::text[])
    ) AS t(nome, categoria, unidade, variedades)
  LOOP
    INSERT INTO public.vitrine_produtos (nome, categoria, unidade_padrao)
    VALUES (item.nome, item.categoria, item.unidade)
    ON CONFLICT (lower(nome)) DO NOTHING;

    SELECT id INTO pid FROM public.vitrine_produtos WHERE lower(nome) = lower(item.nome);

    FOREACH v IN ARRAY item.variedades LOOP
      INSERT INTO public.vitrine_variedades (produto_id, nome)
      VALUES (pid, v)
      ON CONFLICT (produto_id, lower(nome)) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
