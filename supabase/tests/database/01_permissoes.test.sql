-- Testes de permissões e regras críticas do banco (pgTAP).
-- Rodam no Supabase TEMPORÁRIO do GitHub Actions (supabase start + test db),
-- com usuários e dados fictícios. Nunca tocam a produção.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- ─── Usuários fictícios ─────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@teste.local', '{"name":"Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op1@teste.local',   '{"name":"Operador Um"}'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op2@teste.local',   '{"name":"Operador Dois"}');
insert into public.profiles (id, email, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local', 'Admin Teste'),
  ('00000000-0000-0000-0000-0000000000b1', 'op1@teste.local', 'Operador Um'),
  ('00000000-0000-0000-0000-0000000000b2', 'op2@teste.local', 'Operador Dois')
on conflict (id) do nothing;
delete from public.user_roles where user_id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'operator'),
  ('00000000-0000-0000-0000-0000000000b2', 'operator');

-- ─── Dados fictícios ────────────────────────────────────────────────────────
-- A estrutura copiada da produção não traz dados: chave de CPF de TESTE.
insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci')
on conflict (name) do nothing;
insert into public.settlements (id, name) values ('10000000-0000-0000-0000-000000000001', 'PA Teste');
insert into public.demand_types (id, name, category) values ('20000000-0000-0000-0000-000000000001', 'Gradagem Teste', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf, settlement_id, latitude, longitude) values
  ('30000000-0000-0000-0000-000000000001', 'Produtor Sem Local', '52998224725', '10000000-0000-0000-0000-000000000001', null, null),
  ('30000000-0000-0000-0000-000000000002', 'Produtor Com Local', '11144477735', '10000000-0000-0000-0000-000000000001', -10.50, -51.50);
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, operator_id, latitude, longitude) values
  -- do operador 1, em execução, GPS na propriedade
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 'in_progress', '00000000-0000-0000-0000-0000000000b1', -10.61, -51.61),
  -- do operador 1, em execução, produtor já localizado
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', current_date, 'in_progress', '00000000-0000-0000-0000-0000000000b1', -10.99, -51.99);

-- ─── Visitante sem login (anon) ─────────────────────────────────────────────
set local role anon;
select throws_ok($$ select count(*) from public.producers $$, '42501', null,
  'visitante sem login NÃO lê produtores');
select is((select count(*)::int from public.services), 0,
  'visitante sem login NÃO vê atendimentos');
reset role;

-- ─── Operador ───────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;

select is(has_column_privilege('authenticated', 'public.producers', 'cpf', 'SELECT'), false,
  'CPF não pode ser lido direto da tabela por usuários logados');

update public.producers set latitude = 1, longitude = 1 where id = '30000000-0000-0000-0000-000000000001';
reset role;
select is((select latitude::float from public.producers where id = '30000000-0000-0000-0000-000000000001'), null::float,
  'operador NÃO consegue editar cadastro de produtor diretamente');

-- operador 2 tenta finalizar atendimento em execução do operador 1
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
set local role authenticated;
update public.services set status = 'completed', completed_at = now() where id = '40000000-0000-0000-0000-000000000001';
reset role;
select is((select status from public.services where id = '40000000-0000-0000-0000-000000000001'), 'in_progress',
  'operador NÃO finaliza atendimento em execução de outro operador');

-- operador 1 finaliza os próprios
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
set local role authenticated;
update public.services set status = 'completed', completed_at = now()
  where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.backup_localizacao_produtor), 0,
  'operador NÃO enxerga a tabela de backup de localização');
select is((select count(*)::int from public.vitrine_fornecedores), 0,
  'operador NÃO enxerga fornecedores do Conecta Confresa');
reset role;

select is((select status from public.services where id = '40000000-0000-0000-0000-000000000001'), 'completed',
  'operador finaliza o próprio atendimento');
select is((select completed_at is not null from public.services where id = '40000000-0000-0000-0000-000000000001'), true,
  'finalização grava a data de conclusão');

-- ─── Cópia da localização para o cadastro ───────────────────────────────────
select is((select latitude::float || ',' || longitude::float from public.producers where id = '30000000-0000-0000-0000-000000000001'),
  '-10.61,-51.61', 'produtor SEM localização recebe o GPS do atendimento finalizado');
select is((select latitude::float || ',' || longitude::float from public.producers where id = '30000000-0000-0000-0000-000000000002'),
  '-10.5,-51.5', 'produtor COM localização NÃO é sobrescrito');

-- ─── Administrador ──────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
set local role authenticated;
select ok((select count(*) from public.backup_localizacao_produtor) >= 1,
  'administrador enxerga o backup de localização (para desfazer)');
select is((select count(*)::int from public.producers where id::text like '30000000-%'), 2,
  'administrador lê os produtores');
select is((select count(*)::int from public.admin_producer_cpfs() where id::text like '30000000-%' and cpf is not null), 2,
  'administrador obtém os CPFs pela função protegida');
reset role;

select * from finish();
rollback;
