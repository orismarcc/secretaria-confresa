-- Entregas e resumo dos lotes: só a equipe interna (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm11@teste.local'),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op11@teste.local'),
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'semfuncao11@teste.local');
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000000ab', '00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000cb');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ab', 'admin'), ('00000000-0000-0000-0000-0000000000bb', 'operator');

insert into public.demand_types (id, name, category) values ('bb000000-0000-0000-0000-000000000002', 'Entrega Teste 11', 'entregas');
insert into public.producers (id, name, cpf) values ('bb000000-0000-0000-0000-000000000003', 'Produtor 11', '52998224725');
insert into public.delivery_lots (id, demand_type_id, name, initial_quantity, unit) values
  ('bb000000-0000-0000-0000-000000000010', 'bb000000-0000-0000-0000-000000000002', 'Lote 11', 100, 'unidade');
insert into public.deliveries (id, producer_id, demand_type_id, quantity, delivery_date_start, delivery_date_end, status) values
  ('bb000000-0000-0000-0000-000000000020', 'bb000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000002', 5, current_date, current_date, 'pending');

-- visitante sem login
set local role anon;
select throws_ok($$ select count(*) from public.delivery_lot_summary $$, '42501', null, 'visitante sem login NÃO lê o resumo dos lotes');
reset role;

-- conta logada SEM função (fora da equipe)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000cb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.delivery_lot_summary where id = 'bb000000-0000-0000-0000-000000000010'), 0, 'conta fora da equipe NÃO vê o resumo dos lotes');
select is((select count(*)::int from public.deliveries where id = 'bb000000-0000-0000-0000-000000000020'), 0, 'conta fora da equipe NÃO vê entregas');
reset role;

-- operador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.delivery_lot_summary where id = 'bb000000-0000-0000-0000-000000000010'), 1, 'operador vê o resumo dos lotes');
select is((select count(*)::int from public.deliveries where id = 'bb000000-0000-0000-0000-000000000020'), 1, 'operador vê entregas');
reset role;

-- administrador
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ab","role":"authenticated"}', true);
set local role authenticated;
select is((select reserved_quantity from public.delivery_lot_summary where id = 'bb000000-0000-0000-0000-000000000010'), 0::numeric, 'administrador vê o resumo (com os cálculos)');
select lives_ok($$ update public.deliveries set notes = 'ok' where id = 'bb000000-0000-0000-0000-000000000020' $$, 'administrador continua editando entregas');
reset role;

select * from finish();
rollback;
