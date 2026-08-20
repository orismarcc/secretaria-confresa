import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingActions, getActionBlob, deleteOperatorAction, countPendingActions,
  type OperatorAction,
} from '@/lib/operatorQueue';

// Envia UMA ação (Iniciar/Finalizar) para o Supabase: foto -> storage,
// registro em service_photos e atualização do status do atendimento.
async function pushAction(action: OperatorAction): Promise<void> {
  let storagePath: string | null = null;

  if (action.blobKey) {
    const blob = await getActionBlob(action.blobKey);
    if (blob) {
      const filename = `${action.serviceId}/${action.type}-${action.id}.jpg`;
      const { error } = await supabase.storage
        .from('service-photos')
        .upload(filename, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
      if (error) throw error; // offline/rede -> mantém pendente
      storagePath = filename;
    }
  }

  // Registro do evento (foto/coordenadas) — só se houver algo a registrar.
  if (storagePath || action.latitude != null) {
    const { error: pErr } = await supabase.from('service_photos').insert({
      service_id: action.serviceId,
      storage_path: storagePath,
      latitude: action.latitude,
      longitude: action.longitude,
      captured_at: action.capturedAt,
      event_type: action.type,
    });
    if (pErr) throw pErr;
  }

  // Atualiza o atendimento.
  const updates = action.type === 'start'
    ? { status: 'in_progress', operator_id: action.operatorId }
    : {
        status: 'completed',
        completed_at: action.capturedAt,
        latitude: action.latitude,
        longitude: action.longitude,
        sync_status: 'synced',
      };
  const { error: sErr } = await supabase.from('services').update(updates).eq('id', action.serviceId);
  if (sErr) throw sErr;
}

// Sincroniza toda a fila pendente. Item que falhar (ex.: sem sinal) permanece
// na fila e não bloqueia os demais; roda de novo ao reconectar.
export function useSyncOperatorActions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const actions = await getPendingActions();
      let synced = 0;
      for (const action of actions) {
        try {
          await pushAction(action);
          await deleteOperatorAction(action);
          synced++;
        } catch {
          // mantém pendente — tentaremos de novo depois
        }
      }
      return { synced, total: actions.length };
    },
    onSuccess: ({ synced }) => {
      queryClient.invalidateQueries({ queryKey: ['operator_queue_count'] });
      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['services'] });
        queryClient.invalidateQueries({ queryKey: ['services', 'pending'] });
      }
    },
  });
}

// Contador de ações pendentes de sincronização (para feedback na tela).
export function usePendingActionsCount() {
  return useQuery({
    queryKey: ['operator_queue_count'],
    queryFn: countPendingActions,
    refetchInterval: 15000,
  });
}
