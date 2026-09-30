-- Dados FICTÍCIOS para o teste de ponta a ponta (Supabase temporário do CI).
-- Variáveis (psql -v): admin_id, op_id — ids criados pela API de autenticação.
insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci')
on conflict (name) do nothing;

insert into public.profiles (id, email, name) values
  (:'admin_id', 'admin.e2e@teste.local', 'Admin E2E'),
  (:'op_id', 'operador.e2e@teste.local', 'Operador E2E')
on conflict (id) do nothing;
delete from public.user_roles where user_id in (:'admin_id', :'op_id');
insert into public.user_roles (user_id, role) values (:'admin_id', 'admin'), (:'op_id', 'operator');

insert into public.settlements (id, name) values ('e2e00000-0000-0000-0000-000000000001', 'PA Ficticio E2E');
insert into public.demand_types (id, name, category) values ('e2e00000-0000-0000-0000-000000000002', 'Gradagem E2E', 'patrulha_mecanizada');
insert into public.operator_settlements (operator_id, settlement_id) values (:'op_id', 'e2e00000-0000-0000-0000-000000000001');
insert into public.operator_demand_types (operator_id, demand_type_id) values (:'op_id', 'e2e00000-0000-0000-0000-000000000002');

insert into public.producers (id, name, cpf, settlement_id, latitude, longitude) values
  ('e2e00000-0000-0000-0000-000000000003', 'Produtor Ficticio E2E', '52998224725', 'e2e00000-0000-0000-0000-000000000001', null, null);

insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, operator_id) values
  ('e2e00000-0000-0000-0000-000000000004', 'e2e00000-0000-0000-0000-000000000003', 'e2e00000-0000-0000-0000-000000000002',
   'e2e00000-0000-0000-0000-000000000001', current_date, 'pending', :'op_id');

-- Atendimento ATRIBUÍDO ao operador num assentamento FORA do cadastro dele
-- (caso real de 28/09): precisa aparecer na tela do operador.
insert into public.settlements (id, name) values ('e2e00000-0000-0000-0000-000000000011', 'PA Fora E2E');
insert into public.producers (id, name, cpf, settlement_id) values
  ('e2e00000-0000-0000-0000-000000000013', 'Produtor Fora E2E', '11144477735', 'e2e00000-0000-0000-0000-000000000011');
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, operator_id) values
  ('e2e00000-0000-0000-0000-000000000014', 'e2e00000-0000-0000-0000-000000000013', 'e2e00000-0000-0000-0000-000000000002',
   'e2e00000-0000-0000-0000-000000000011', current_date, 'pending', :'op_id');

-- SEFAZ: produtor fictício (o atendimento Boleto GTA é lançado pela tela no e2e).
insert into public.sefaz_producers (id, name) values ('e2e00000-0000-0000-0000-000000000021', 'PRODUTOR SEFAZ E2E');

-- Logística (calcário): Início (odômetro) → Carregamento → Entrega → Finalização.
insert into public.demand_types (id, name, category) values ('e2e00000-0000-0000-0000-000000000032', 'Calcario E2E', 'calcario');
insert into public.producers (id, name, cpf, settlement_id, latitude, longitude) values
  ('e2e00000-0000-0000-0000-000000000033', 'Produtor Logistica E2E', '39053344705', 'e2e00000-0000-0000-0000-000000000001', null, null);
insert into public.services (id, producer_id, demand_type_id, settlement_id, scheduled_date, status, operator_id) values
  ('e2e00000-0000-0000-0000-000000000034', 'e2e00000-0000-0000-0000-000000000033', 'e2e00000-0000-0000-0000-000000000032',
   'e2e00000-0000-0000-0000-000000000001', current_date, 'pending', :'op_id');

-- Entregas: entrega realizada SEM termo (o termo é anexado pela tela no e2e).
insert into public.demand_types (id, name, category) values ('e2e00000-0000-0000-0000-000000000042', 'Entrega Alevinos E2E', 'entregas');
insert into public.deliveries (id, producer_id, demand_type_id, settlement_id, quantity, delivery_date_start, delivery_date_end, status, completed_at) values
  ('e2e00000-0000-0000-0000-000000000044', 'e2e00000-0000-0000-0000-000000000003', 'e2e00000-0000-0000-0000-000000000042',
   'e2e00000-0000-0000-0000-000000000001', 10, current_date, current_date, 'completed', now());
