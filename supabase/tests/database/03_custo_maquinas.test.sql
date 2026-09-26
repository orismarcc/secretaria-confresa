-- Custo por hora-máquina: conta conferida com valores conhecidos (fictícios).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into private.secrets (name, value) values ('cpf_encryption_key', 'chave-de-teste-ci') on conflict (name) do nothing;
insert into public.settlements (id, name) values ('80000000-0000-0000-0000-000000000001', 'PA Custo Teste');
insert into public.demand_types (id, name, category) values ('80000000-0000-0000-0000-000000000002', 'Grade Custo', 'patrulha_mecanizada');
insert into public.producers (id, name, cpf) values ('80000000-0000-0000-0000-000000000003', 'Produtor Custo', '39053344705');
insert into public.machinery (id, name, patrimony_number) values ('80000000-0000-0000-0000-000000000010', 'Trator Teste Custo', 'PAT-TESTE-CUSTO');

-- Em setembro/2026: 2 atendimentos (4h + 6h = 10h; 3 + 5 = 8 ha)
insert into public.services (producer_id, demand_type_id, settlement_id, scheduled_date, status, completed_at, machinery_id, worked_hours, worked_area) values
  ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '2026-09-10', 'completed', '2026-09-10 15:00-04', '80000000-0000-0000-0000-000000000010', 4, 3),
  ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '2026-09-12', 'completed', '2026-09-12 15:00-04', '80000000-0000-0000-0000-000000000010', 6, 5),
  -- fora do período (agosto) e pendente: não entram
  ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '2026-08-10', 'completed', '2026-08-10 15:00-04', '80000000-0000-0000-0000-000000000010', 99, 99),
  ('80000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000001', '2026-09-20', 'pending', null, '80000000-0000-0000-0000-000000000010', 50, 50);
-- Abastecimentos: 100 L a R$ 6,00 (= 600) + 20 L sem preço
insert into public.machinery_refuels (machinery_id, liters, price_per_liter, refueled_at) values
  ('80000000-0000-0000-0000-000000000010', 100, 6.00, '2026-09-09 08:00-04'),
  ('80000000-0000-0000-0000-000000000010', 20, null, '2026-09-11 08:00-04');
-- Manutenções: R$ 400 + uma sem custo informado
insert into public.machinery_maintenance (machinery_id, description, started_at, cost) values
  ('80000000-0000-0000-0000-000000000010', 'Troca de óleo', '2026-09-15 08:00-04', 400),
  ('80000000-0000-0000-0000-000000000010', 'Revisão', '2026-09-16 08:00-04', null);

create temp table r as select * from public.custo_maquinas('2026-09-01', '2026-09-30')
  where machinery_id = '80000000-0000-0000-0000-000000000010';

select is((select atendimentos from r), 2, 'conta só atendimentos FINALIZADOS no período');
select is((select horas from r), 10.00, 'horas trabalhadas = 4 + 6');
select is((select hectares from r), 8.00, 'hectares = 3 + 5');
select is((select litros from r), 120.00, 'litros abastecidos = 100 + 20');
select is((select litros_sem_preco from r), 20.00, 'litros sem preço são sinalizados');
select is((select custo_combustivel from r), 600.00, 'combustível = 100 L × R$ 6,00 (sem preço não entra)');
select is((select custo_manutencao from r), 400.00, 'manutenção = R$ 400');
select is((select manutencoes_sem_custo from r), 1, 'manutenção sem custo é sinalizada');
select is((select custo_hora from r), 100.00, 'custo/hora = (600 + 400) / 10 h');
select is((select litros_hora from r), 12.00, 'consumo = 120 L / 10 h');

select * from finish();
rollback;
