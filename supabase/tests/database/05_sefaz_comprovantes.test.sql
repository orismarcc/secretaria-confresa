-- SEFAZ: Boleto GTA, assinatura padrão e comprovantes mensais (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm5@teste.local'),
  ('00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op5@teste.local');
insert into public.profiles (id, email, name) values
  ('00000000-0000-0000-0000-0000000000a5', 'adm5@teste.local', 'Adm'), ('00000000-0000-0000-0000-0000000000b5', 'op5@teste.local', 'Op')
on conflict (id) do nothing;
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b5');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a5', 'admin'), ('00000000-0000-0000-0000-0000000000b5', 'operator');

insert into public.sefaz_producers (id, name) values ('a5000000-0000-0000-0000-000000000001', 'Produtor SEFAZ Teste');

select lives_ok($$ insert into public.sefaz_services (sefaz_producer_id, service_type, service_date)
  values ('a5000000-0000-0000-0000-000000000001', 'Boleto GTA', '2026-09-10') $$, 'aceita o tipo "Boleto GTA"');
select throws_ok($$ insert into public.sefaz_services (sefaz_producer_id, service_type, service_date)
  values ('a5000000-0000-0000-0000-000000000001', 'Tipo Inventado', '2026-09-10') $$, '23514', null, 'tipo fora da lista continua bloqueado');
select is((select signed_list from public.sefaz_services where service_type = 'Boleto GTA' and sefaz_producer_id = 'a5000000-0000-0000-0000-000000000001'),
  true, 'novo atendimento já nasce como assinado');
select throws_ok($$ insert into public.sefaz_comprovantes (mes, file_path, file_name, mime_type) values ('2026-09-15', 'x', 'x.pdf', 'application/pdf') $$,
  '23514', null, 'mês do comprovante é sempre o dia 1');
select throws_ok($$ insert into public.sefaz_comprovantes (mes, file_path, file_name, mime_type) values ('2026-09-01', 'y', 'y.exe', 'application/x-msdownload') $$,
  '23514', null, 'só aceita imagem ou PDF');

insert into public.sefaz_comprovantes (mes, file_path, file_name, mime_type) values ('2026-09-01', '2026-09/teste.pdf', 'folha.pdf', 'application/pdf');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b5","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sefaz_comprovantes), 0, 'operador NÃO vê comprovantes');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.sefaz_comprovantes), 1, 'administrador vê os comprovantes');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.sefaz_comprovantes $$, '42501', null, 'visitante sem login NÃO acessa');
reset role;

select * from finish();
rollback;
