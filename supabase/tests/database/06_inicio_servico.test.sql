-- Início do serviço (started_at): gravação e regras (dados fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into public.settlements (id, name) values ('b6000000-0000-0000-0000-000000000001', 'PA Inicio Teste');
insert into public.demand_types (id, name, category) values ('b6000000-0000-0000-0000-000000000002', 'Tipo Inicio', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf) values ('b6000000-0000-0000-0000-000000000003', 'Produtor Inicio', '47425672700');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status) values
  ('b6000000-0000-0000-0000-000000000010', 'b6000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001', current_date, 'pending'),
  ('b6000000-0000-0000-0000-000000000011', 'b6000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001', current_date, 'pending');

select is((select started_at from public.services where id = 'b6000000-0000-0000-0000-000000000010'), null, 'pendente não tem início');

-- App manda o horário exato do toque (ex.: estava sem sinal)
update public.services set status = 'in_progress', started_at = '2026-09-25 10:51:00-04' where id = 'b6000000-0000-0000-0000-000000000010';
select is((select started_at from public.services where id = 'b6000000-0000-0000-0000-000000000010'), '2026-09-25 10:51:00-04'::timestamptz,
  'guarda o horário enviado pelo app');

-- Iniciado sem informar (ex.: pelo escritório): o banco grava
update public.services set status = 'in_progress' where id = 'b6000000-0000-0000-0000-000000000011';
select ok((select started_at is not null from public.services where id = 'b6000000-0000-0000-0000-000000000011'), 'sem horário enviado, o banco grava o início');

-- Finalizar não mexe no início
update public.services set status = 'completed', completed_at = '2026-09-25 13:14:00-04' where id = 'b6000000-0000-0000-0000-000000000010';
select is((select started_at from public.services where id = 'b6000000-0000-0000-0000-000000000010'), '2026-09-25 10:51:00-04'::timestamptz,
  'finalizar mantém o início');

-- Editar outro campo não mexe no início
update public.services set notes = 'x' where id = 'b6000000-0000-0000-0000-000000000010';
select is((select started_at from public.services where id = 'b6000000-0000-0000-0000-000000000010'), '2026-09-25 10:51:00-04'::timestamptz,
  'editar outros campos mantém o início');

-- Voltar para pendente limpa o início
update public.services set status = 'pending' where id = 'b6000000-0000-0000-0000-000000000011';
select is((select started_at from public.services where id = 'b6000000-0000-0000-0000-000000000011'), null, 'voltar para pendente limpa o início');

select * from finish();
rollback;
