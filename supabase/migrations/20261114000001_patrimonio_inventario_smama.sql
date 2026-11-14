-- ============================================================================
-- Patrimônio: campo VALOR ATUAL + inventário de bens da SMAMA (planilha
-- "Bens_SMAMA", exceto as placas solares).
--  * Bens NOVOS: cadastrados com nome, descrição, categoria, nº municipal,
--    data e valor de aquisição e valor atual.
--  * Bens que JÁ existem com o mesmo nº: só preenche o que está VAZIO (data,
--    valores, descrição) — nome, foto, categoria e estado ficam como estão.
--  * Casos duvidosos (mesmo bem com outro nº) ficaram de fora para conferência.
-- Idempotente: não duplica se rodar de novo.
-- ============================================================================

ALTER TABLE public.patrimony
  ADD COLUMN IF NOT EXISTS current_value numeric(14,2);
ALTER TABLE public.patrimony DROP CONSTRAINT IF EXISTS patrimony_current_value_check;
ALTER TABLE public.patrimony ADD CONSTRAINT patrimony_current_value_check
  CHECK (current_value IS NULL OR current_value >= 0);

-- ── Bens novos ──────────────────────────────────────────────────────────────
INSERT INTO public.patrimony (patrimony_number, name, description, category, acquisition_date, value, current_value)
SELECT v.n, v.nome, v.descr, v.cat, v.dt::date, v.aq, v.atual
FROM (VALUES
  ('66', 'Oxímetro de água (kit completo)', 'Oxímetro para medição de oxigênio na água (piscicultura), kit completo.', 'Equipamento', '2019-12-31', 1695.00::numeric, 1389.90::numeric),
  ('67', 'Notebook Core Duo 3 GB', 'Notebook Intel Core Duo, 3 GB de memória, com gravador de CD/DVD.', 'Equipamento', '2019-12-31', 1087.02::numeric, 891.36::numeric),
  ('68', 'Notebook Core Duo 3 GB', 'Notebook Intel Core Duo, 3 GB de memória, com gravador de CD/DVD.', 'Equipamento', '2019-12-31', 1087.02::numeric, 891.36::numeric),
  ('69', 'Moto Yamaha XTZ 125 2012', 'Motocicleta Yamaha XTZ 125, ano/modelo 2012/2012.', 'Veículo', '2019-12-31', 4442.66::numeric, 3642.98::numeric),
  ('70', 'Câmera digital Samsung', 'Câmera fotográfica digital Samsung.', 'Equipamento', '2019-12-31', 423.70::numeric, 347.43::numeric),
  ('163', 'Perfurador de solo', 'Perfurador de solo.', 'Equipamento', '2019-12-20', 3600.00::numeric, 720.00::numeric),
  ('169', 'Bomba de engraxar Lumagi', 'Bomba de engraxar, marca Lumagi.', 'Equipamento', '2019-12-31', 320.00::numeric, 64.00::numeric),
  ('201', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('202', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('203', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('206', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('207', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('208', 'Carreta agrícola graneleira Acton', 'Carreta agrícola graneleira, marca Acton.', 'Implemento', '2019-12-31', 53662.50::numeric, 10732.50::numeric),
  ('209', 'Trator New Holland 7630', 'Trator agrícola New Holland 7630.', 'Veículo', '2019-12-31', 82000.00::numeric, 16400.00::numeric),
  ('210', 'Grade Tatu Marchesan', 'Grade, marca Tatu Marchesan.', 'Implemento', '2019-12-31', 11925.00::numeric, 2385.00::numeric),
  ('211', 'Ensiladeira colhedora e picadora', 'Ensiladeira (colhedora e picadora de forragem).', 'Implemento', '2019-12-31', 13000.00::numeric, 2600.00::numeric),
  ('212', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('213', 'Ensiladeira colhedora e picadora', 'Ensiladeira (colhedora e picadora de forragem).', 'Implemento', '2019-12-31', 13000.00::numeric, 2600.00::numeric),
  ('214', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('215', 'Distribuidor de calcário e adubo 6.000', 'Distribuidor de calcário e adubo, capacidade 6.000.', 'Implemento', '2019-12-31', 15098.60::numeric, 3019.72::numeric),
  ('217', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('218', 'Carreta agrícola para trator', 'Carreta agrícola para trator.', 'Implemento', '2019-12-31', 4968.75::numeric, 993.75::numeric),
  ('219', 'Trator New Holland', 'Trator agrícola New Holland.', 'Veículo', '2019-12-31', 56000.00::numeric, 11200.00::numeric),
  ('221', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('222', 'Ensiladeira colhedora e picadora', 'Ensiladeira (colhedora e picadora de forragem).', 'Implemento', '2019-12-31', 13000.00::numeric, 2600.00::numeric),
  ('223', 'Carreta agrícola de ferro', 'Carreta agrícola de ferro para trator.', 'Implemento', '2019-12-31', 4968.75::numeric, 993.75::numeric),
  ('224', 'Trator New Holland 7630', 'Trator agrícola New Holland 7630.', 'Veículo', '2019-12-31', 56000.00::numeric, 11200.00::numeric),
  ('225', 'Grade aradora 16 discos', 'Grade aradora com 16 discos.', 'Implemento', '2019-12-31', 11925.00::numeric, 2385.00::numeric),
  ('226', 'Resfriador de leite 2.000 L', 'Resfriador (tanque) de leite com capacidade de 2.000 litros.', 'Equipamento', '2019-12-31', 12700.00::numeric, 2540.00::numeric),
  ('229', 'Carreta agrícola para trator', 'Carreta agrícola para trator.', 'Implemento', '2019-12-31', 4968.75::numeric, 993.75::numeric),
  ('233', 'Trator Farmall 80', 'Trator agrícola de rodas, Farmall 80.', 'Veículo', '2019-12-31', 66782.22::numeric, 13356.44::numeric),
  ('234', 'Carreta para trator agrícola', 'Carreta para trator agrícola.', 'Implemento', '2019-12-31', 4968.75::numeric, 993.75::numeric),
  ('235', 'Ensiladeira colhedora e picadora', 'Ensiladeira (colhedora e picadora de forragem).', 'Implemento', '2019-12-31', 13000.00::numeric, 2600.00::numeric),
  ('236', 'Carreta de ferro para trator', 'Carreta de ferro para trator agrícola.', 'Implemento', '2019-12-31', 4968.75::numeric, 993.75::numeric),
  ('237', 'Grade aradora 16 discos', 'Grade aradora com 16 discos.', 'Implemento', '2019-12-31', 11925.00::numeric, 2385.00::numeric),
  ('238', 'Trator New Holland', 'Trator agrícola New Holland.', 'Veículo', '2019-12-31', 82000.00::numeric, 16400.00::numeric),
  ('241', 'Ensiladeira colhedora e picadora', 'Ensiladeira (colhedora e picadora de forragem).', 'Implemento', '2019-12-31', 8490.00::numeric, 1698.00::numeric),
  ('253', 'Notebook Dell Inspiron i5', 'Notebook Dell Inspiron, processador i5, tela de 15,6".', 'Equipamento', '2020-03-02', 4150.00::numeric, 2905.00::numeric),
  ('339', 'Trator Valtra BM100', 'Trator agrícola Valtra BM100.', 'Veículo', '2019-12-20', 56840.00::numeric, 11368.00::numeric),
  ('340', 'Grade aradora 16 discos', 'Grade aradora com 16 discos.', 'Implemento', '2019-12-31', 11925.00::numeric, 2385.00::numeric),
  ('341', 'Grade aradora 16 discos', 'Grade aradora com 16 discos.', 'Implemento', '2019-12-31', 11925.00::numeric, 2385.00::numeric),
  ('343', 'Botijão de sêmen 21 L', 'Botijão criogênico para armazenamento de sêmen, 21 litros.', 'Equipamento', '2019-12-31', 1513.00::numeric, 302.60::numeric),
  ('344', 'Carreta de ferro com assoalho de madeira', 'Carreta de ferro com assoalho de madeira.', 'Implemento', '2019-12-31', 3300.00::numeric, 660.00::numeric),
  ('348', 'Despolpadeira completa', 'Despolpadeira de frutas completa.', 'Equipamento', '2019-12-31', 23000.00::numeric, 4600.00::numeric),
  ('773', 'Escrivaninha de fórmica', 'Escrivaninha revestida em fórmica.', 'Móvel', '2019-12-31', 54.00::numeric, 44.28::numeric),
  ('2035', 'Computador Intel i7 8 GB', 'Microcomputador Intel i7, 8 GB de memória, 1 TB, com mouse.', 'Equipamento', '2019-12-31', 2199.12::numeric, 1803.28::numeric),
  ('5725', 'Mesa secretária com 2 gavetas', 'Mesa secretária com 2 gavetas, 1,50 m.', 'Móvel', '2019-12-31', 322.00::numeric, 264.04::numeric),
  ('5729', 'Mesa reta 1,20 m', 'Mesa reta de 1,20 m.', 'Móvel', '2019-12-31', 332.00::numeric, 272.24::numeric),
  ('5954', 'Cadeira secretária fixa', 'Cadeira modelo secretária, fixa (sem rodízios).', 'Móvel', '2019-12-31', 122.00::numeric, 100.04::numeric),
  ('5957', 'Arquivo de aço 4 gavetas', 'Arquivo de aço com 4 gavetas.', 'Móvel', '2019-12-31', 229.00::numeric, 187.78::numeric),
  ('5960', 'Cadeira de madeira', 'Cadeira de madeira.', 'Móvel', '2019-12-31', 150.00::numeric, 123.00::numeric),
  ('5962', 'Cadeira de madeira', 'Cadeira de madeira.', 'Móvel', '2019-12-31', 18.00::numeric, 131.25::numeric),
  ('6898', 'Ar-condicionado Elgin 12.000 BTUs', 'Ar-condicionado Elgin, 12.000 BTUs, 220 V.', 'Equipamento', '2019-12-31', 1216.00::numeric, 997.12::numeric),
  ('6900', 'Cadeira de plástico verde', 'Cadeira de plástico na cor verde.', 'Móvel', '2019-12-31', 122.00::numeric, 100.04::numeric),
  ('6904', 'Mesa de madeira', 'Mesa de madeira.', 'Móvel', '2019-12-31', 156.00::numeric, 127.92::numeric),
  ('6905', 'Monitor 15,6" LCD', 'Monitor LCD widescreen de 15,6".', 'Equipamento', '2019-12-31', 363.80::numeric, 298.32::numeric),
  ('7054', 'Projetor multimídia PowerLite S6', 'Projetor multimídia PowerLite S6.', 'Equipamento', '2019-12-31', 1026.00::numeric, 841.32::numeric),
  ('7060', 'Mesa escrivaninha', 'Mesa tipo escrivaninha.', 'Móvel', '2019-12-31', 156.00::numeric, 127.92::numeric),
  ('7065', 'Banco de madeira', 'Banco de madeira.', 'Móvel', '2019-12-31', 78.00::numeric, 63.96::numeric),
  ('7067', 'Purificador de água Soft', 'Purificador de água, modelo Soft.', 'Equipamento', '2019-12-31', 313.20::numeric, 256.82::numeric),
  ('7069', 'Revisteiro', 'Revisteiro.', 'Móvel', '2019-12-31', 140.00::numeric, 114.80::numeric),
  ('7116', 'Cadeira escolar adulto', 'Cadeira escolar tamanho adulto.', 'Móvel', '2019-12-31', 146.99::numeric, 120.53::numeric),
  ('7884', 'Bebedouro inox 2 torneiras', 'Bebedouro de aço inox com 2 torneiras.', 'Equipamento', '2019-12-20', 1318.91::numeric, 263.78::numeric),
  ('8331', 'Botijão de sêmen Semex XT', 'Botijão criogênico para armazenamento de sêmen, marca Semex, modelo XT.', 'Equipamento', '2019-12-20', 1513.00::numeric, 302.60::numeric),
  ('8332', 'Botijão de sêmen Semex YDS', 'Botijão criogênico para armazenamento de sêmen, marca Semex, modelo YDS.', 'Equipamento', '2019-12-20', 1666.63::numeric, 333.33::numeric),
  ('8342', 'Botijão de sêmen Semex XT 20', 'Botijão criogênico para armazenamento de sêmen, marca Semex, modelo XT 20.', 'Equipamento', '2019-12-20', 1612.00::numeric, 322.40::numeric),
  ('8343', 'Prensa para farinha', 'Prensa para massa de mandioca (produção de farinha).', 'Equipamento', '2019-12-31', 453.00::numeric, 90.60::numeric),
  ('8344', 'Ralador de mandioca', 'Ralador de mandioca.', 'Equipamento', '2019-12-31', 365.00::numeric, 73.00::numeric),
  ('8345', 'Forno para torrar farinha', 'Forno para torrar farinha de mandioca.', 'Equipamento', '2019-12-31', 350.00::numeric, 70.00::numeric),
  ('8346', 'Lavador de mandioca', 'Lavador de mandioca.', 'Equipamento', '2019-12-31', 3500.00::numeric, 700.00::numeric),
  ('8347', 'Triturador de mandioca', 'Triturador de mandioca.', 'Equipamento', '2019-12-31', 300.00::numeric, 60.00::numeric),
  ('8348', 'Lavadora de mandioca', 'Lavadora de mandioca.', 'Equipamento', '2019-12-31', 350.00::numeric, 70.00::numeric),
  ('8349', 'Lavadora de mandioca', 'Lavadora de mandioca.', 'Equipamento', '2019-12-31', 350.00::numeric, 70.00::numeric),
  ('9043', 'Ar-condicionado split inverter 18.000 BTUs', 'Ar-condicionado tipo split inverter, 18.000 BTUs.', 'Equipamento', '2020-07-21', 2210.00::numeric, 1812.20::numeric),
  ('10141', 'Ar-condicionado split 9.000 BTUs', 'Ar-condicionado tipo split, 9.000 BTUs.', 'Equipamento', '2021-05-13', 1570.00::numeric, 1390.72::numeric),
  ('10493', 'Computador completo com monitor', 'Computador completo com monitor.', 'Equipamento', '2021-09-23', 2515.00::numeric, 2391.76::numeric),
  ('10494', 'Computador completo com monitor', 'Computador completo com monitor.', 'Equipamento', '2021-09-23', 2515.00::numeric, 2391.76::numeric),
  ('10643', 'Ar-condicionado split 18.000 BTUs', 'Ar-condicionado tipo split, 18.000 BTUs.', 'Equipamento', '2021-11-30', 2080.00::numeric, 2048.80::numeric),
  ('12550', 'Grade aradora 16x28 controle remoto', 'Grade aradora 16 discos x 28", com controle remoto.', 'Implemento', '2022-06-30', 68750.00::numeric, 48125.00::numeric),
  ('12908', 'Pá carregadeira LW 300KV', 'Pá carregadeira modelo LW 300KV.', 'Veículo', '2022-11-17', 341014.01::numeric, 341014.01::numeric),
  ('13258', 'Distribuidora de sementes', 'Distribuidora de sementes.', 'Implemento', '2023-02-28', 5400.00::numeric, 3780.00::numeric),
  ('13288', 'Colhedora de forragens Cremasco', 'Colhedora de forragens, marca Cremasco.', 'Implemento', '2023-05-04', 44500.00::numeric, 31150.00::numeric),
  ('13308', 'Caminhão Hyundai HD 80 2022', 'Caminhão Hyundai HD 80, ano 2022.', 'Veículo', '2023-05-08', 274000.00::numeric, 274000.00::numeric),
  ('13315', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13316', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13317', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13318', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13319', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13320', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13321', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13322', 'Tanque resfriador de leite 1.000 L', 'Tanque resfriador de leite com capacidade de 1.000 litros.', 'Equipamento', '2023-05-22', 12300.00::numeric, 8610.00::numeric),
  ('13427', 'Grade aradora 14 discos controle remoto', 'Grade aradora com 14 discos e controle remoto.', 'Implemento', '2023-08-04', 37700.00::numeric, 26390.00::numeric),
  ('14849', 'Trator Budny 85 cv BDY-8540', 'Trator Budny 85 cv, modelo BDY-8540, com tomada de força.', 'Veículo', '2024-10-30', 177900.00::numeric, 124530.00::numeric),
  ('14856', 'Perfurador de solo com broca', 'Perfurador de solo com broca (PSI9).', 'Equipamento', '2024-11-19', 7000.00::numeric, 4900.00::numeric),
  ('14857', 'Grade aradora 14 discos', 'Grade aradora agrícola com 14 discos.', 'Implemento', '2024-11-27', 28900.00::numeric, 20230.00::numeric),
  ('14860', 'Semeadeira de grãos', 'Semeadeira de grãos (acoplamento hidráulico).', 'Implemento', '2024-12-03', 4500.00::numeric, 3150.00::numeric),
  ('14936', 'Caminhão cabine simples branco', 'Caminhão cabine simples, cor branca.', 'Veículo', '2025-01-21', 305721.87::numeric, 282792.77::numeric),
  ('15629', 'Kit pá carregadeira com concha articulada', 'Kit pá carregadeira com concha articulada (implemento para trator).', 'Implemento', '2025-03-31', 39900.00::numeric, 35920.00::numeric),
  ('15630', 'Carreta agrícola com tampa de ferro', 'Carreta agrícola com tampa de ferro.', 'Implemento', '2025-03-31', 14500.00::numeric, 12000.00::numeric),
  ('15631', 'Roçadeira de arrasto Algor', 'Roçadeira de arrasto, marca Algor.', 'Implemento', '2025-03-31', 19100.00::numeric, 16580.00::numeric),
  ('15835', 'Escavadeira hidráulica XE215BR', 'Escavadeira hidráulica, modelo XE215BR.', 'Veículo', '2025-06-23', 542857.14::numeric, 498071.44::numeric),
  ('15953', 'Distribuidor de calcário / esterco', 'Distribuidor de calcário e esterco.', 'Implemento', '2025-09-11', 32432.58::numeric, 28946.58::numeric),
  ('16923', 'Retroescavadeira monobloco', 'Retroescavadeira monobloco.', 'Veículo', '2026-01-21', 303500.00::numeric, 378010.00::numeric),
  ('16931', 'Motoniveladora', 'Motoniveladora (chassi iniciando em XUG01803ASP).', 'Veículo', '2026-02-12', 608487.99::numeric, 608487.99::numeric),
  ('16968', 'Trator New Holland', 'Trator agrícola New Holland.', 'Veículo', '2026-03-11', 136000.00::numeric, 136000.00::numeric),
  ('16969', 'Trator New Holland', 'Trator agrícola New Holland.', 'Veículo', '2026-03-11', 136000.00::numeric, 136000.00::numeric),
  ('17186', 'Toyota Hilux CD SRV 4x4 diesel', 'Caminhonete Toyota Hilux cabine dupla, diesel, 4x4, versão SRV, câmbio automático.', 'Veículo', '2026-03-31', 290890.00::numeric, 290890.00::numeric),
  ('17401', 'Enxada rotativa com encanteirador', 'Enxada rotativa com encanteirador.', 'Implemento', '2026-04-29', 18473.00::numeric, 18473.00::numeric)
) AS v(n, nome, descr, cat, dt, aq, atual)
WHERE NOT EXISTS (
  SELECT 1 FROM public.patrimony p
  WHERE ltrim(p.patrimony_number, '0') = ltrim(v.n, '0')
);

-- ── Bens já cadastrados: só completa o que está vazio ───────────────────────
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 85000.00), current_value = COALESCE(current_value, 69700.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Trator agrícola 80 cv, modelo U80, plataformado.') WHERE patrimony_number = '14';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 56000.00), current_value = COALESCE(current_value, 11200.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: TRATOR NEW HOLLAND TL 75E.') WHERE patrimony_number = '228';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 1533.37), current_value = COALESCE(current_value, 306.67), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: BOTIJÃO DE SEMEN MARCA MILLENNIUM 20.') WHERE patrimony_number = '230';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 288.00), current_value = COALESCE(current_value, 236.16), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Monitor AOC 19,5", modelo E2050SWN.') WHERE patrimony_number = '2047';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 64.50), current_value = COALESCE(current_value, 49.25), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5915';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 64.50), current_value = COALESCE(current_value, 49.25), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5916';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5949';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5950';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5952';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5953';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '5955';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 154.99), current_value = COALESCE(current_value, 127.09), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Estante de aço com 6 prateleiras.') WHERE patrimony_number = '5956';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 369.00), current_value = COALESCE(current_value, 269.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Balcão de recepção.') WHERE patrimony_number = '5963';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 229.95), current_value = COALESCE(current_value, 188.56), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: ARQUIVO DE AÇO C/ 4 GAVETA S.') WHERE patrimony_number = '6897';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 790.00), current_value = COALESCE(current_value, 647.80), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Escrivaninha de madeira com 3 gavetas.') WHERE patrimony_number = '6901';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira de plástico na cor verde.') WHERE patrimony_number = '6902';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 256.00), current_value = COALESCE(current_value, 209.92), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Mesa de madeira.') WHERE patrimony_number = '6903';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 265.00), current_value = COALESCE(current_value, 217.30), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Armário de aço com 2 portas.') WHERE patrimony_number = '7055';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 122.00), current_value = COALESCE(current_value, 100.04), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '7057';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 543.20), current_value = COALESCE(current_value, 445.42), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Escrivaninha de madeira com 2 gavetas.') WHERE patrimony_number = '7058';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 172.16), current_value = COALESCE(current_value, 141.17), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira giratória executiva sem braços.') WHERE patrimony_number = '7063';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2019-12-31'::date), value = COALESCE(value, 64.50), current_value = COALESCE(current_value, 52.89), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira modelo secretária, fixa (sem rodízios).') WHERE patrimony_number = '7064';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2021-03-22'::date), value = COALESCE(value, 3450.00), current_value = COALESCE(current_value, 2967.56), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Impressora multifuncional laser Brother.') WHERE patrimony_number = '9976';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2021-09-23'::date), value = COALESCE(value, 2515.00), current_value = COALESCE(current_value, 2391.76), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Computador completo com monitor.') WHERE patrimony_number = '10492';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2022-08-08'::date), value = COALESCE(value, 3990.00), current_value = COALESCE(current_value, 2793.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Notebook Asus, processador i5, 8 GB de memória, Windows 11.') WHERE patrimony_number = '12725';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2022-08-11'::date), value = COALESCE(value, 2755.00), current_value = COALESCE(current_value, 1928.50), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Refrigerador Consul 2 portas, 340 litros.') WHERE patrimony_number = '12726';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2023-08-04'::date), value = COALESCE(value, 206400.00), current_value = COALESCE(current_value, 206400.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: TRATOR AGRICOLA 85 CV MODELO BDY MA.') WHERE patrimony_number = '13426';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2023-12-12'::date), value = COALESCE(value, 300.00), current_value = COALESCE(current_value, 210.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Monitor de 19" com conexões VGA e HDMI.') WHERE patrimony_number = '13682';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2025-09-03'::date), value = COALESCE(value, 869.06), current_value = COALESCE(current_value, 695.25), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Mesa de trabalho em madeira revestida.') WHERE patrimony_number = '15992';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2025-09-03'::date), value = COALESCE(value, 869.06), current_value = COALESCE(current_value, 695.25), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Mesa de trabalho em madeira revestida.') WHERE patrimony_number = '15993';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2025-09-03'::date), value = COALESCE(value, 846.38), current_value = COALESCE(current_value, 677.10), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira executiva giratória com braços.') WHERE patrimony_number = '15994';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2025-09-03'::date), value = COALESCE(value, 846.38), current_value = COALESCE(current_value, 677.10), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Cadeira executiva giratória com braços.') WHERE patrimony_number = '15995';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-01-21'::date), value = COALESCE(value, 333330.00), current_value = COALESCE(current_value, 378010.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: Pá carregadeira (chassi iniciando em LSH0836NVRA).') WHERE patrimony_number = '16924';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-01-21'::date), value = COALESCE(value, 207700.00), current_value = COALESCE(current_value, 207700.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: TRATOR CABINADO 80 CV CHASSI FTTM3A.') WHERE patrimony_number = '16926';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-01-21'::date), value = COALESCE(value, 18421.00), current_value = COALESCE(current_value, 18421.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: CARRETA AGRÍCOLA BASCULANTE 6 TONE.') WHERE patrimony_number = '16927';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-02-04'::date), value = COALESCE(value, 214900.00), current_value = COALESCE(current_value, 214900.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: SEMI REBOQUE BASCULANTE 3 EIXOS PLA.') WHERE patrimony_number = '016930';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17392';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17393';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17394';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17395';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17396';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 11690.00), current_value = COALESCE(current_value, 11690.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 1000 LITROS.') WHERE patrimony_number = '17397';
UPDATE public.patrimony SET acquisition_date = COALESCE(acquisition_date, '2026-04-29'::date), value = COALESCE(value, 8640.00), current_value = COALESCE(current_value, 8640.00), description = COALESCE(NULLIF(trim(description), ''), 'Conforme inventário: RESFRIADOR DE LEITE 500 LITROS.') WHERE patrimony_number = '17398';

NOTIFY pgrst, 'reload schema';
