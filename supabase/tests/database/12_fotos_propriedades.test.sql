-- Fotos das propriedades: só a equipe interna (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into auth.users (id, instance_id, aud, role, email) values
  ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'adm12@teste.local'),
  ('00000000-0000-0000-0000-0000000000bc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'op12@teste.local');
delete from public.user_roles where user_id in ('00000000-0000-0000-0000-0000000000ac', '00000000-0000-0000-0000-0000000000bc');
insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-0000000000ac', 'admin'), ('00000000-0000-0000-0000-0000000000bc', 'operator');

insert into public.settlements (id, name) values ('bc000000-0000-0000-0000-000000000001', 'PA Fotos 12');
insert into public.producers (id, name, cpf, settlement_id) values ('bc000000-0000-0000-0000-000000000003', 'Produtor 12', '52998224725', 'bc000000-0000-0000-0000-000000000001');

select lives_ok($$ insert into public.producer_property_photos (producer_id, file_path, file_name, mime_type)
  values ('bc000000-0000-0000-0000-000000000003', 'p/principal.jpg', 'principal.jpg', 'image/jpeg') $$, 'foto da propriedade principal (sem property_id)');
select throws_ok($$ insert into public.producer_property_photos (producer_id, file_path, file_name, mime_type)
  values ('bc000000-0000-0000-0000-000000000003', 'p/doc.pdf', 'doc.pdf', 'application/pdf') $$, '23514', null, 'só aceita imagem');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bc","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.producer_property_photos), 0, 'operador NÃO vê fotos das propriedades');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000ac","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.producer_property_photos), 1, 'administrador vê as fotos');
reset role;
select is((select public from storage.buckets where id = 'property-photos'), false, 'pasta das fotos é privada');

delete from public.producers where id = 'bc000000-0000-0000-0000-000000000003';
select is((select count(*)::int from public.producer_property_photos where producer_id = 'bc000000-0000-0000-0000-000000000003'), 0,
  'excluir o produtor remove os registros das fotos');

select * from finish();
rollback;
