-- =============================================================================
-- SEFAZ: consolidar produtores duplicados (mesmo nome + mesmo CPF)
-- Idempotente: sem efeito se não há duplicatas.
-- =============================================================================

-- ─── 1. Reatribuir sefaz_services de duplicatas para o registro canônico ──────
-- Canônico = o registro mais antigo (menor created_at) do grupo (name, cpf).
-- Normalização: nome em maiúsculas sem espaços extras, CPF somente dígitos.

WITH ranked AS (
  SELECT
    id,
    TRIM(UPPER(name))                                AS norm_name,
    regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g') AS norm_cpf,
    ROW_NUMBER() OVER (
      PARTITION BY
        TRIM(UPPER(name)),
        regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.sefaz_producers
  WHERE cpf IS NOT NULL AND cpf <> ''
),
canonical AS (
  SELECT norm_name, norm_cpf, id AS canonical_id
  FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT r.id AS dup_id, c.canonical_id
  FROM ranked r
  JOIN canonical c ON r.norm_name = c.norm_name AND r.norm_cpf = c.norm_cpf
  WHERE r.rn > 1
)
UPDATE public.sefaz_services ss
SET sefaz_producer_id = d.canonical_id
FROM duplicates d
WHERE ss.sefaz_producer_id = d.dup_id;

-- ─── 2. Excluir os produtores duplicados (o canônico fica) ────────────────────

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        TRIM(UPPER(name)),
        regexp_replace(COALESCE(cpf,''), '[^0-9]', '', 'g')
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.sefaz_producers
  WHERE cpf IS NOT NULL AND cpf <> ''
)
DELETE FROM public.sefaz_producers
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- ─── 3. Unique constraint: impede novos duplicados (nome + cpf normalizado) ───
-- Usamos uma unique partial index em vez de constraint para poder normalizar.

DROP INDEX IF EXISTS uidx_sefaz_producers_name_cpf;

CREATE UNIQUE INDEX uidx_sefaz_producers_name_cpf
  ON public.sefaz_producers (
    TRIM(UPPER(name)),
    regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g')
  )
  WHERE cpf IS NOT NULL AND cpf <> '';

-- ─── 4. Recarregar cache do PostgREST ─────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
