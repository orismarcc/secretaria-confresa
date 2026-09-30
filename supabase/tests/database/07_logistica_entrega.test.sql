-- Logística: Entrega separada da Finalização (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into public.settlements (id, name) values ('b7000000-0000-0000-0000-000000000001', 'PA Logistica Teste');
insert into public.demand_types (id, name, category) values ('b7000000-0000-0000-0000-000000000002', 'Calcario Teste', 'calcario');
insert into public.producers (id, name, cpf) values
  ('b7000000-0000-0000-0000-000000000003', 'Produtor Fluxo Novo', '52998224725'),
  ('b7000000-0000-0000-0000-000000000004', 'Produtor Fluxo Antigo', '16899535009');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status) values
  ('b7000000-0000-0000-0000-000000000010', 'b7000000-0000-0000-0000-000000000003', 'b7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000001', current_date, 'in_progress'),
  ('b7000000-0000-0000-0000-000000000011', 'b7000000-0000-0000-0000-000000000004', 'b7000000-0000-0000-0000-000000000002', 'b7000000-0000-0000-0000-000000000001', current_date, 'in_progress');

-- Fluxo novo: entrega na propriedade (-10.70, -51.60); finalização na garagem (-10.64, -51.57)
update public.services set loaded_at = now() - interval '2 hours', delivered_at = now() - interval '1 hour'
 where id = 'b7000000-0000-0000-0000-000000000010';
insert into public.service_photos (service_id, storage_path, latitude, longitude, captured_at, event_type) values
  ('b7000000-0000-0000-0000-000000000010', null, -10.64, -51.57, now() - interval '3 hours', 'start'),
  ('b7000000-0000-0000-0000-000000000010', null, -10.50, -51.40, now() - interval '2 hours', 'loading'),
  ('b7000000-0000-0000-0000-000000000010', null, -10.70, -51.60, now() - interval '1 hour', 'delivery'),
  ('b7000000-0000-0000-0000-000000000010', null, -10.64, -51.57, now(), 'finish');
select is((select delivered_at is not null from public.services where id = 'b7000000-0000-0000-0000-000000000010'), true,
  'entrega registrada mantém o atendimento em execução com a marca de entrega');
select results_eq($$ select lat, lng from public.coordenada_propriedade_do_atendimento('b7000000-0000-0000-0000-000000000010') $$,
  $$ values (-10.70::numeric, -51.60::numeric) $$, 'fluxo novo: a propriedade é o local da ENTREGA, não o da finalização');

update public.services set status = 'completed', completed_at = now() where id = 'b7000000-0000-0000-0000-000000000010';
select results_eq($$ select latitude::numeric, longitude::numeric from public.producers where id = 'b7000000-0000-0000-0000-000000000003' $$,
  $$ values (-10.70::numeric, -51.60::numeric) $$, 'ao finalizar, o cadastro recebe o GPS da entrega');

-- Fluxo antigo (sem 'delivery'): continua usando a finalização
insert into public.service_photos (service_id, storage_path, latitude, longitude, captured_at, event_type) values
  ('b7000000-0000-0000-0000-000000000011', null, -10.80, -51.70, now(), 'finish');
select results_eq($$ select lat, lng from public.coordenada_propriedade_do_atendimento('b7000000-0000-0000-0000-000000000011') $$,
  $$ values (-10.80::numeric, -51.70::numeric) $$, 'fluxo antigo: usa o GPS da finalização, como antes');

-- Reaberto: limpa carregamento e entrega
update public.services set status = 'pending' where id = 'b7000000-0000-0000-0000-000000000010';
select is((select delivered_at from public.services where id = 'b7000000-0000-0000-0000-000000000010'), null, 'reaberto limpa a entrega');
select is((select loaded_at from public.services where id = 'b7000000-0000-0000-0000-000000000010'), null, 'reaberto limpa o carregamento');

select * from finish();
rollback;
