-- ============================================================================
-- Fotos dos atendimentos: auditoria de TROCA e REMOÇÃO.
--
-- Administradores plenos (Secretário/Diretor/Supervisor) passam a poder editar
-- as fotos de atendimentos finalizados pela tela. Para rastrear e permitir
-- recuperar: toda alteração ou exclusão em service_photos fica registrada no
-- audit_log (quem, quando, caminho antigo da foto). Os arquivos antigos NÃO são
-- apagados do armazenamento pela tela.
--
-- Só UPDATE e DELETE (os envios normais dos operadores — INSERT — não geram
-- registro, para não encher a auditoria). Permissões não mudam.
-- fn_audit_log nunca bloqueia a operação (erros internos são ignorados).
-- Só ACRESCENTA. Idempotente.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_audit_service_photos ON public.service_photos;
CREATE TRIGGER trg_audit_service_photos
  AFTER UPDATE OR DELETE ON public.service_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_log();
