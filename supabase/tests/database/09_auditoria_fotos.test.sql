-- Fotos dos atendimentos: troca e remoção ficam na auditoria (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into public.settlements (id, name) values ('b9000000-0000-0000-0000-000000000001', 'PA Fotos Teste');
insert into public.demand_types (id, name, category) values ('b9000000-0000-0000-0000-000000000002', 'Tipo Fotos', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf) values ('b9000000-0000-0000-0000-000000000003', 'Produtor Fotos', '52998224725');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, completed_at) values
  ('b9000000-0000-0000-0000-000000000010', 'b9000000-0000-0000-0000-000000000003', 'b9000000-0000-0000-0000-000000000002',
   'b9000000-0000-0000-0000-000000000001', current_date, 'completed', now());

insert into public.service_photos (id, service_id, storage_path, latitude, longitude, captured_at, event_type) values
  ('b9000000-0000-0000-0000-000000000020', 'b9000000-0000-0000-0000-000000000010', 'x/finish-a.jpg', -10.6, -51.6, now(), 'finish'),
  ('b9000000-0000-0000-0000-000000000021', 'b9000000-0000-0000-0000-000000000010', 'x/start-a.jpg', null, null, now(), 'start');

select is((select count(*)::int from public.audit_log where record_id = 'b9000000-0000-0000-0000-000000000020'), 0,
  'envio de foto (INSERT) não gera registro na auditoria');

-- Trocar a foto
update public.service_photos set storage_path = 'x/admin-b.jpg' where id = 'b9000000-0000-0000-0000-000000000020';
select is((select old_data->>'storage_path' from public.audit_log
           where record_id = 'b9000000-0000-0000-0000-000000000020' and action = 'UPDATE'), 'x/finish-a.jpg',
  'troca registra o caminho da foto antiga');
select is((select latitude::float from public.service_photos where id = 'b9000000-0000-0000-0000-000000000020'), -10.6::float,
  'troca mantém o GPS do registro');

-- Remover a foto (registro sem GPS)
delete from public.service_photos where id = 'b9000000-0000-0000-0000-000000000021';
select is((select old_data->>'storage_path' from public.audit_log
           where record_id = 'b9000000-0000-0000-0000-000000000021' and action = 'DELETE'), 'x/start-a.jpg',
  'remoção registra a foto removida');

-- Atualização sem mudança real não gera ruído
update public.service_photos set storage_path = storage_path where id = 'b9000000-0000-0000-0000-000000000020';
select is((select count(*)::int from public.audit_log where record_id = 'b9000000-0000-0000-0000-000000000020'), 1,
  'atualização sem mudança não gera registro');

select * from finish();
rollback;
