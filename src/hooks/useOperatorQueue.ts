import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  getPendingActions, getActionBlob, deleteOperatorAction, countPendingActions,
  type OperatorAction,
} from '@/lib/operatorQueue';

// Sobe um blob de foto e devolve o caminho no storage (ou null se não houver).
async function uploadPhoto(serviceId: string, blobKey: string | undefined, tag: string): Promise<string | null> {
  if (!blobKey) return null;
  const blob = await getActionBlob(blobKey);
  if (!blob) return null;
  const filename = `${serviceId}/${tag}-${blobKey}.jpg`;
  const { error } = await supabase.storage
    .from('service-photos')
    .upload(filename, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: true });
  if (error) throw error; // offline/rede -> mantém pendente
  return filename;
}

// Envia UMA ação (Iniciar/Carregamento/Entrega/Finalizar) para o Supabase: foto(s) -> storage,
// registro em service_photos e atualização do status do atendimento.
async function pushAction(action: OperatorAction): Promise<void> {
  if (action.type === 'start') {
    // Iniciar: GPS (e, na logística, a foto do odômetro — km inicial). Grava as
    // coordenadas no atendimento para o mapa já aparecer "em execução".
    const odometroPath = await uploadPhoto(action.serviceId, action.blobKey, 'start');
    if (odometroPath) {
      // id da ação: se o envio for repetido, não duplica (ON CONFLICT DO NOTHING).
      const { error: pErr } = await supabase.from('service_photos').upsert({
        id: action.id,
        service_id: action.serviceId,
        storage_path: odometroPath,
        latitude: action.latitude,
        longitude: action.longitude,
        ...(action.accuracy != null ? { accuracy_m: action.accuracy } : {}),
        captured_at: action.capturedAt,
        event_type: 'start',
      } as any, { onConflict: 'id', ignoreDuplicates: true });
      if (pErr) throw pErr;
    } else if (action.latitude != null) {
      const { error: pErr } = await supabase.from('service_photos').insert({
        service_id: action.serviceId,
        storage_path: null,
        latitude: action.latitude,
        longitude: action.longitude,
        ...(action.accuracy != null ? { accuracy_m: action.accuracy } : {}),
        captured_at: action.capturedAt,
        event_type: 'start',
      } as any);
      if (pErr) throw pErr;
    }
    const { error: sErr } = await supabase.from('services').update({
      status: 'in_progress',
      // horário do toque em "Iniciar" (mesmo que tenha sincronizado depois)
      started_at: action.capturedAt,
      operator_id: action.operatorId,
      latitude: action.latitude,
      longitude: action.longitude,
    }).eq('id', action.serviceId);
    if (sErr) throw sErr;
    return;
  }

  if (action.type === 'load' || action.type === 'deliver') {
    // Logística — Carregamento (foto do caminhão sendo carregado + GPS do local)
    // ou Entrega (foto da entrega + GPS da propriedade). O atendimento segue em
    // execução. O registro usa o id da ação: se o envio cair no meio e for
    // repetido, não duplica (ON CONFLICT DO NOTHING).
    const isLoad = action.type === 'load';
    const eventType = isLoad ? 'loading' : 'delivery';
    const loadPath = await uploadPhoto(action.serviceId, action.blobKey, eventType);
    const { error: pErr } = await supabase.from('service_photos').upsert({
      id: action.id,
      service_id: action.serviceId,
      storage_path: loadPath,
      latitude: action.latitude,
      longitude: action.longitude,
      ...(action.accuracy != null ? { accuracy_m: action.accuracy } : {}),
      captured_at: action.capturedAt,
      event_type: eventType,
    } as any, { onConflict: 'id', ignoreDuplicates: true });
    if (pErr) throw pErr;
    const { error: sErr } = await supabase.from('services')
      // delivered_at entra nos tipos gerados após a migração 20260930000002.
      .update((isLoad ? { loaded_at: action.capturedAt } : { delivered_at: action.capturedAt }) as any)
      .eq('id', action.serviceId);
    if (sErr) throw sErr;
    return;
  }

  // Finalizar: até duas fotos (início e término), ambas opcionais.
  // Na logística vem a foto do odômetro (km final) e o GPS do local onde foi
  // finalizado (a entrega na propriedade já foi registrada no passo 'deliver');
  // no fluxo normal latitude/longitude chegam nulos (sem mudança).
  const finishPath = await uploadPhoto(action.serviceId, action.blobKey, 'finish');
  const startPath = await uploadPhoto(action.serviceId, action.startBlobKey, 'start');
  const finishGps = action.latitude != null
    ? { latitude: action.latitude, longitude: action.longitude, ...(action.accuracy != null ? { accuracy_m: action.accuracy } : {}) }
    : {};

  const rows: any[] = [];
  if (finishPath || action.latitude != null) rows.push({
    service_id: action.serviceId, storage_path: finishPath,
    captured_at: action.capturedAt, event_type: 'finish', ...finishGps,
  });
  if (startPath) rows.push({
    service_id: action.serviceId, storage_path: startPath,
    captured_at: action.capturedAt, event_type: 'start',
  });
  if (rows.length > 0) {
    const { error: pErr } = await supabase.from('service_photos').insert(rows);
    if (pErr) throw pErr;
  }

  // Em regra NÃO sobrescreve latitude/longitude — foram gravadas ao Iniciar.
  // Exceção: o Iniciar ficou sem localização precisa → a leitura feita agora,
  // ao finalizar, vai para o atendimento (e daí para o cadastro da propriedade).
  // Quem finaliza passa a ser o operador do atendimento (operadores que dividem
  // o assentamento podem concluir o serviço iniciado/cadastrado pelo colega).
  const coordsDoFinal = action.setServiceCoords && action.latitude != null && action.longitude != null
    ? { latitude: action.latitude, longitude: action.longitude }
    : {};
  const { error: sErr } = await supabase.from('services').update({
    status: 'completed',
    completed_at: action.capturedAt,
    sync_status: 'synced',
    ...coordsDoFinal,
    ...(action.operatorId ? { operator_id: action.operatorId } : {}),
  }).eq('id', action.serviceId);
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
      queryClient.invalidateQueries({ queryKey: ['operator_queue_actions'] });
      if (synced > 0) {
        queryClient.invalidateQueries({ queryKey: ['services'] });
        queryClient.invalidateQueries({ queryKey: ['services', 'pending'] });
        queryClient.invalidateQueries({ queryKey: ['operator_completed_services'] });
        queryClient.invalidateQueries({ queryKey: ['operator_own_stats'] });
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
