# Auditoria 2026-05-26 — Status das Correções

**Projeto:** secretaria-confresa  
**Data:** 2026-05-26  
**Auditado por:** Claude Sonnet 4 (auditoria de 4 fases)

---

## Placar Final

| Categoria | Total | ✅ Corrigido | ⏸ Deferido | Score |
|-----------|-------|-------------|------------|-------|
| 🔴 Crítico | 6 | 6 | 0 | **100%** |
| 🟠 Alto | 8 | 7 | 1 | **87.5%** |
| 🟡 Médio | 11 | 9 | 2 | **81.8%** |
| ⚪ Baixo | 9 | 2 | 7* | **22%** |
| **Total** | **34** | **24** | **10** | **70.6%** |

> \* Os itens ⚪ baixa prioridade (B-01 a B-05, B-08, B-09) são melhorias de DX/UX sem impacto funcional e foram conscientemente postergados.

---

## Commits da Auditoria

| Onda | Commit | Itens |
|------|--------|-------|
| Wave 1 | `c7ee597` | C-01 a C-06, A-02, A-04, A-05, A-08, M-02, M-07, M-08 |
| Wave 3 | (migration) | M-01, M-09, A-03, A-06 |
| Wave 4 | `5cd4604` | M-10, M-11, M-04 |
| Wave 5 | `0749f20` | M-05, M-06, B-06, B-07 |

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

### 🟠 Alto — 7/8 corrigidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| A-01 | `useCreateProducer`/`useUpdateProducer`: escrita parcial sem rollback | — | ⏸ Deferido (exige RPC) |
| A-02 | `useDeleteProducer` silenciava erro ao deletar `producer_demands` | `useSupabaseData.ts` | ✅ |
| A-03 | `deliveries.created_by` FK apontava para `auth.users` (não exposto) | migration wave3 | ✅ |
| A-04 | `AuthContext` catch vazio silenciava falha de carregamento de role | `AuthContext.tsx` | ✅ |
| A-05 | `useUpdateServicePositions` sem `onError` | `useSupabaseData.ts` | ✅ |
| A-06 | FKs críticas com `ON DELETE NO ACTION` implícito (não documentado) | migration wave3 | ✅ |
| A-07 | `DataContext` localStorage em paralelo com Supabase — consumidores não auditados | — | ⏸ Deferido (requer audit completa de consumidores) |
| A-08 | `useDeletePatrimony` não removia imagem do Storage bucket | `useSupabaseData.ts` | ✅ |

### 🟡 Médio — 9/11 corrigidos

| # | Descrição | Arquivo(s) | Status |
|---|-----------|-----------|--------|
| M-01 | FKs sem índice na coluna filho (15 FKs) | migration wave3 | ✅ |
| M-02 | Regra de 30 dias para DAM duplicada em 3 arquivos | `damUtils.ts` (novo), `DAMPage.tsx`, `DashboardPage.tsx`, `ServicesPage.tsx` | ✅ |
| M-03 | Cálculos duplicados: `patrulhaIds`, `settlementStats`, taxa de conclusão | — | ⏸ Postergado (refatoração de extração; sem impacto no usuário) |
| M-04 | `ServiceDetailView` não mostrava DAM, combustível, horas, calcário, insumos, agendamento, técnico responsável | `ServiceDetailView.tsx`, `useSupabaseData.ts` | ✅ |
| M-05 | `types/index.ts` completamente desatualizado | `types/index.ts` | ✅ |
| M-06 | `sefaz_producers.cpf` e `responsible_technicians.cpf` armazenados em texto plano | migration wave5 | ✅ |
| M-07 | `?detail=ID` não trocava de aba no ServicesPage | `ServicesPage.tsx` | ✅ |
| M-08 | Invalidações de cache em cascata ausentes (delete de settlement/location/etc.) | `useSupabaseData.ts` | ✅ |
| M-09 | 10 tabelas sem `updated_at` + triggers | migration wave3 | ✅ |
| M-10 | `getOperatorMetrics` não memoizado — O(services × operators) por render | `OperatorsPage.tsx` | ✅ |
| M-11 | `totalWorkedArea` em AnalyticsPage usava `.find` em vez de `.filter` para tipos de demanda com "grade" | `AnalyticsPage.tsx` | ✅ |

### ⚪ Baixo — 2/9 corrigidos

| # | Descrição | Status |
|---|-----------|--------|
| B-01 | `ProducerForm` não valida CPF com dígito verificador | ⏸ |
| B-02 | `useCreateService` sem `position` default | ⏸ |
| B-03 | Toast de erro genérico em várias mutations | ⏸ |
| B-04 | Falta skeleton de carregamento em algumas tabelas | ⏸ |
| B-05 | `usePendingServices` ordena por `position` mas `position` pode ser NULL | ⏸ |
| B-06 | `update_updated_at_column()` sem `SECURITY DEFINER` | ✅ (migration wave5) |
| B-07 | `mask_cpf()` sem `SET search_path` | ✅ (migration wave5) |
| B-08 | `FinalizeServiceModal` importado mas nunca renderizado | ⏸ |
| B-09 | Importação circular potencial: `DataContext` → `storage` → `DataContext` | ⏸ |

---

## Itens Deferidos (decisão consciente)

### A-01 — Escrita parcial em produtor
Criar/atualizar um produtor envolve dois UPSERTs sequenciais
(`producers` + `producer_demands`). Sem RPC/transação, uma falha no segundo
deixa o estado inconsistente. Correção exige nova função RPC no banco.
**Risco:** baixo em produção (tabela pequena, operação rápida).

### A-07 — DataContext localStorage
`DataContext` mantém uma camada de cache paralela ao React Query. Antes de
deprecar, é necessário identificar todos os consumers que ainda chamam
`useData()` e garantir que a migração para hooks Supabase esteja completa.

### M-03 — Cálculos duplicados
`patrulhaIds Set` aparece em 3 lugares, `settlementStats` em 2. Candidatos para
extração para `src/lib/analyticsUtils.ts`. Sem impacto funcional atual.

### B-01 a B-05, B-08, B-09
Melhorias de DX/UX/confiabilidade de baixo impacto. Podem ser tratadas em
sprints futuras.

---

*Documento gerado automaticamente pela auditoria de 2026-05-26.*
