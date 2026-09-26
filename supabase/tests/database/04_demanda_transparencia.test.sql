-- Mapa da demanda e transparência pública (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a7', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm7@teste.local');
insert into public.profiles (id, email, name) values ('00000000-0000-0000-0000-0000000000a7', 'adm7@teste.local', 'Adm') on conflict (id) do nothing;
delete from public.user_roles where user_id = '00000000-0000-0000-0000-0000000000a7';
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a7', 'admin');

insert into public.settlements (id, name, latitude, longitude) values
  ('90000000-0000-0000-0000-000000000001', 'PA Grande Teste', -10.5, -51.5),
  ('90000000-0000-0000-0000-000000000002', 'PA Pequeno Teste', null, null);
insert into public.demand_types (id, name, category) values ('90000000-0000-0000-0000-000000000003', 'Grade Transp', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf, settlement_id) values
  ('91000000-0000-0000-0000-000000000001', 'Fulano Sigiloso Um', '71428793860', '90000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000002', 'Fulano Sigiloso Dois', '87748248800', '90000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000003', 'Fulano Sigiloso Tres', '53355455002', '90000000-0000-0000-0000-000000000001'),
  ('91000000-0000-0000-0000-000000000004', 'Beltrano Unico Pequeno', '14538220620', '90000000-0000-0000-0000-000000000002');
insert into public.services (producer_id, demand_type_id, settlement_id, scheduled_date, status, completed_at, worked_hours, worked_area, created_at) values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', '2031-03-01', 'completed', '2031-03-05 12:00-04', 4, 2, '2031-02-01'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', '2031-03-01', 'completed', '2031-03-06 12:00-04', 6, 3, '2031-02-01'),
  ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', '2031-04-01', 'completed', '2031-04-02 12:00-04', 2, 1, '2031-02-01'),
  ('91000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000002', '2031-04-01', 'completed', '2031-04-03 12:00-04', 3, 1, '2031-02-01'),
  -- em aberto (pedido há 10 dias, 5 h pedidas)
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000001', current_date, 'pending', null, 5, null, now() - interval '10 days');

-- ─── Público (sem login) ────────────────────────────────────────────────────
set local role anon;
select lives_ok($$ select public.transparencia_resumo(2031) $$, 'visitante sem login consulta a transparência');
create temp table t as select public.transparencia_resumo(2031) as j;
select is((select (j -> 'totais' ->> 'atendimentos')::int from t), 4, 'total de atendimentos concluídos no ano');
select is((select (j -> 'totais' ->> 'horas_maquina')::numeric from t), 15.0, 'horas-máquina somadas');
select ok((select j::text !~* '(sigiloso|beltrano|714\.?287|145\.?382)' from t), 'NENHUM nome ou CPF aparece no resumo público');
select ok((select j::text !~ 'PA Pequeno Teste' from t), 'assentamento com menos de 3 produtores NÃO aparece pelo nome');
select ok((select j::text ~ 'PA Grande Teste' from t), 'assentamento com 3+ produtores aparece');
select throws_ok($$ select * from public.demanda_por_assentamento('2031-01-01', '2031-12-31') $$, '42501', null,
  'visitante NÃO acessa o mapa da demanda (só a equipe)');
select throws_ok($$ select * from public.demanda_pontos() $$, '42501', null,
  'visitante NÃO acessa os pontos das propriedades');
reset role;

-- ─── Equipe ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
set local role authenticated;
create temp table d as select * from public.demanda_por_assentamento('2031-01-01', '2031-12-31')
  where settlement_id = '90000000-0000-0000-0000-000000000001';
select is((select abertos from d), 1, 'mapa: atendimentos em aberto do assentamento');
select is((select horas_pedidas from d), 5.0, 'mapa: horas pedidas em aberto');
select is((select espera_media_dias from d), 10::numeric, 'mapa: espera média em dias');
reset role;

select throws_ok($$ update public.settlements set latitude = -10.1 where id = '90000000-0000-0000-0000-000000000002' $$,
  '23514', null, 'posição do assentamento exige latitude E longitude');

select * from finish();
rollback;
