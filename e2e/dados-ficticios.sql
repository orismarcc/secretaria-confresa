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
