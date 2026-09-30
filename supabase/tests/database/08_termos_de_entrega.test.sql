-- Entregas: termo/comprovante anexado por produtor (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm8@teste.local'),
  ('00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op8@teste.local');
insert into public.profiles (id, email, name) values
  ('00000000-0000-0000-0000-0000000000a8', 'adm8@teste.local', 'Adm'), ('00000000-0000-0000-0000-0000000000b8', 'op8@teste.local', 'Op')
on conflict (id) do nothing;
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000b8');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000a8', 'admin'), ('00000000-0000-0000-0000-0000000000b8', 'operator');

insert into public.demand_types (id, name, category) values ('b8000000-0000-0000-0000-000000000002', 'Entrega Teste', 'entregas');
insert into public.producers (id, name, cpf) values ('b8000000-0000-0000-0000-000000000003', 'Produtor Termo', '11144477735');
insert into public.deliveries (id, producer_id, demand_type_id, quantity, delivery_date_start, delivery_date_end, status) values
  ('b8000000-0000-0000-0000-000000000010', 'b8000000-0000-0000-0000-000000000003', 'b8000000-0000-0000-0000-000000000002', 1, current_date, current_date, 'completed');

select throws_ok($$ insert into public.delivery_documents (delivery_id, file_path, file_name, mime_type)
  values ('b8000000-0000-0000-0000-000000000010', 'x/y.exe', 'y.exe', 'application/x-msdownload') $$,
  '23514', null, 'só aceita imagem ou PDF');

insert into public.delivery_documents (delivery_id, file_path, file_name, mime_type)
  values ('b8000000-0000-0000-0000-000000000010', 'b8000000-0000-0000-0000-000000000010/termo.pdf', 'termo.pdf', 'application/pdf');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b8","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.delivery_documents), 0, 'operador NÃO vê os termos');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a8","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.delivery_documents), 1, 'administrador vê os termos');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.delivery_documents $$, '42501', null, 'visitante sem login NÃO acessa');
reset role;

select is((select public from storage.buckets where id = 'delivery-documents'), false, 'bucket dos termos é privado');

delete from public.deliveries where id = 'b8000000-0000-0000-0000-000000000010';
select is((select count(*)::int from public.delivery_documents where delivery_id = 'b8000000-0000-0000-0000-000000000010'), 0,
  'excluir a entrega remove os registros dos termos dela');

select * from finish();
rollback;
