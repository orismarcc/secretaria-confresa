import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { syncQueueStorage } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const isOnline = useOnlineStatus();
  const pendingCount = syncQueueStorage.getPendingCount();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2 safe-area-top',
        isOnline ? 'bg-warning text-warning-foreground' : 'bg-destructive text-destructive-foreground'
      )}
    >
      {isOnline ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Sincronizando {pendingCount} {pendingCount === 1 ? 'alteração' : 'alterações'}...</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>Sem conexão - Modo offline</span>
        </>
      )}
    </div>
  );
}

export function OnlineIndicator({ className }: { className?: string }) {
  const isOnline = useOnlineStatus();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4 text-success" />
          <span className="text-xs text-muted-foreground">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-destructive" />
          <span className="text-xs text-destructive">Offline</span>
        </>
      )}
    </div>
  );
}
