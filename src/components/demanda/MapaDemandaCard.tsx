// Seção recolhível "Mapa da demanda" (Análises). O mapa só é baixado e
// consultado quando a seção é aberta — não pesa na abertura da página.
import { lazy, Suspense, useState } from 'react';
import { ChevronRight, Flame } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const MapaDemanda = lazy(() => import('./MapaDemanda'));

export function MapaDemandaCard() {
  const [aberto, setAberto] = useState(false);
  return (
    <div className="rounded-lg border mb-4">
      <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/40 rounded-lg">
        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-90')} />
        <Flame className="h-4 w-4 text-orange-600" />
        <span className="font-semibold text-sm flex-1">Mapa da demanda</span>
        <span className="text-[11px] text-muted-foreground">{aberto ? 'recolher' : 'onde há mais pedidos e mais espera'}</span>
      </button>
      {aberto && (
        <div className="p-3 pt-0">
          <Suspense fallback={<Skeleton className="h-[460px] w-full" />}>
            <MapaDemanda />
          </Suspense>
        </div>
      )}
    </div>
  );
}
