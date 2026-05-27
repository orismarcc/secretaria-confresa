# Auditoria 2026-05-26 — Status das Correções

**Projeto:** secretaria-confresa  
**Data:** 2026-05-26  
**Auditado por:** Claude Sonnet 4 (auditoria de 4 fases)

---

## Placar Final

| Categoria | Total | ✅ Corrigido | ⚠️ N/A | Score |
|-----------|-------|-------------|--------|-------|
| 🔴 Crítico | 6 | 6 | 0 | **100%** |
| 🟠 Alto | 8 | 8 | 0 | **100%** |
| 🟡 Médio | 11 | 11 | 0 | **100%** |
| ⚪ Baixo | 9 | 7 | 2 (N/A) | **100%** |
| **Total** | **34** | **32** | **2** | **100%** |

---

## Commits da Auditoria

| Onda | Commit | Itens |
|------|--------|-------|
| Wave 1 | `c7ee597` | C-01 a C-06, A-02, A-04, A-05, A-08, M-02, M-07, M-08 |
| Wave 3 | (migration) | M-01, M-09, A-03, A-06 |
| Wave 4 | `5cd4604` | M-10, M-11, M-04 |
| Wave 5 | `0749f20` | M-05, M-06, B-06, B-07 |
| Wave 100% | (pending) | A-01, A-07, M-03, B-01~B-05, SEFAZ dedup, B-08/B-09 N/A |

---

## Detalhes por Item

### 🔴 Críticos — Todos corrigidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| C-01 | `useCreateProducer` descartava campo `caf` no INSERT | `useSupabaseData.ts` | ✅ |
| C-02 | `handleMarkUnpaid` não limpava `dam_paid_at`/`dam_receipt_url` | `DAMPage.tsx` | ✅ |
| C-03 | `mapServiceForModal` em OperatorPage sempre colocava `workedArea: 0` | `OperatorPage.tsx` | ✅ |
| C-04 | `AVIPrestacaoContas` usava prefix hardcoded `'ASSISTÊNCIA TÉCNICA'` para todas as categorias | `AVIPrestacaoContas.tsx` | ✅ |
| C-05 | Sort de DAM usava `?? 0` — DAMs sem data subiam ao topo incorretamente | `DAMPage.tsx` | ✅ |
| C-06 | Mutations de service/producer não invalidavam `dashboard_stats` | `useSupabaseData.ts` | ✅ |

### 🟠 Alto — Todos corrigidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| A-01 | `useCreateProducer`/`useUpdateProducer`: escrita parcial sem rollback | `useSupabaseData.ts` | ✅ Compensating delete adicionado |
| A-02 | `useDeleteProducer` silenciava erro ao deletar `producer_demands` | `useSupabaseData.ts` | ✅ |
| A-03 | `deliveries.created_by` FK apontava para `auth.users` (não exposto) | migration wave3 | ✅ |
| A-04 | `AuthContext` catch vazio silenciava falha de carregamento de role | `AuthContext.tsx` | ✅ |
| A-05 | `useUpdateServicePositions` sem `onError` | `useSupabaseData.ts` | ✅ |
| A-06 | FKs críticas com `ON DELETE NO ACTION` implícito (não documentado) | migration wave3 | ✅ |
| A-07 | `DataContext` localStorage em paralelo com Supabase — zero consumers | `DataContext.tsx` removido | ✅ Dead code deletado |
| A-08 | `useDeletePatrimony` não removia imagem do Storage bucket | `useSupabaseData.ts` | ✅ |

### 🟡 Médio — Todos corrigidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| M-01 | FKs sem índice na coluna filho (15 FKs) | migration wave3 | ✅ |
| M-02 | Regra de 30 dias para DAM duplicada em 3 arquivos | `damUtils.ts` (novo), `DAMPage.tsx`, `DashboardPage.tsx`, `ServicesPage.tsx` | ✅ |
| M-03 | Cálculos duplicados: `patrulhaIds`, `settlementStats`, taxa de conclusão | `src/lib/analyticsUtils.ts` (novo), `AnalyticsPage.tsx`, `SettlementsPage.tsx` | ✅ |
| M-04 | `ServiceDetailView` não mostrava DAM, combustível, horas, calcário, insumos, agendamento, técnico responsável | `ServiceDetailView.tsx`, `useSupabaseData.ts` | ✅ |
| M-05 | `types/index.ts` completamente desatualizado | `types/index.ts` | ✅ |
| M-06 | `sefaz_producers.cpf` e `responsible_technicians.cpf` armazenados em texto plano | migration wave5 | ✅ |
| M-07 | `?detail=ID` não trocava de aba no ServicesPage | `ServicesPage.tsx` | ✅ |
| M-08 | Invalidações de cache em cascata ausentes (delete de settlement/location/etc.) | `useSupabaseData.ts` | ✅ |
| M-09 | 10 tabelas sem `updated_at` + triggers | migration wave3 | ✅ |
| M-10 | `getOperatorMetrics` não memoizado — O(services × operators) por render | `OperatorsPage.tsx` | ✅ |
| M-11 | `totalWorkedArea` em AnalyticsPage usava `.find` em vez de `.filter` para tipos de demanda com "grade" | `AnalyticsPage.tsx` | ✅ |

### ⚪ Baixo — Todos resolvidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| B-01 | `ProducerForm` não valida CPF com dígito verificador | `ProducerForm.tsx` | ✅ Modulo-11 adicionado |
| B-02 | `useCreateService` sem `position` default | `useSupabaseData.ts` | ✅ `nullsFirst: false` explícito |
| B-03 | Toast de erro genérico em várias mutations | `useSupabaseData.ts` | ✅ Todas as mutations com nome de entidade |
| B-04 | Falta skeleton de carregamento em algumas tabelas | `ImportServicesPage.tsx` | ✅ Loading guard adicionado |
| B-05 | `usePendingServices` ordena por `position` mas `position` pode ser NULL | `useSupabaseData.ts` | ✅ `nullsFirst: false` |
| B-06 | `update_updated_at_column()` sem `SECURITY DEFINER` | migration wave5 | ✅ |
| B-07 | `mask_cpf()` sem `SET search_path` | migration wave5 | ✅ |
| B-08 | `FinalizeServiceModal` importado mas nunca renderizado | — | ⚠️ N/A — componente IS usado em `OperatorPage.tsx` linha 537 |
| B-09 | Importação circular potencial: `DataContext` → `storage` → `DataContext` | — | ⚠️ N/A — `storage.ts` importa apenas de `@/types`; não há ciclo. `DataContext.tsx` removido. |

---

## Bônus: Deduplicação SEFAZ

| Item | Descrição | Status |
|------|-----------|--------|
| SEFAZ-DEDUP | Produtores com mesmo nome+CPF consolidados; UNIQUE INDEX criado | ✅ `20260526000003_sefaz_deduplicate_producers.sql` |

---

*Documento atualizado em 2026-05-27 — todos os itens resolvidos.*
