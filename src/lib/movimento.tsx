// Movimento (animações) reutilizável — sem bibliotecas extras.
//   * <Revelar>   : surge (desliza + aparece) quando entra na tela;
//   * <Contador>  : número que "conta" até o valor quando entra na tela;
//   * useEmCena   : diz se o elemento já apareceu na tela;
//   * prefereMenosMovimento: respeita a configuração do aparelho
//     ("reduzir movimento") — aí tudo aparece direto, sem animação.
// Primeiro uso: Portal da Transparência. Pode ser usado em outras telas.
import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';

export const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** true a partir do momento em que o elemento entra na tela (uma vez só). */
export function useEmCena<T extends Element>(margem = '0px 0px -10% 0px') {
  const ref = useRef<T | null>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return;
    if (typeof IntersectionObserver === 'undefined' || prefereMenosMovimento()) { setVisto(true); return; }
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) { setVisto(true); obs.disconnect(); }
    }, { rootMargin: margem });
    obs.observe(el);
    return () => obs.disconnect();
  }, [visto, margem]);
  return { ref, visto };
}

/** Surge ao entrar na tela. `atraso` em ms (para efeito em cascata). */
export function Revelar({ children, atraso = 0, className, style }: {
  children: ReactNode; atraso?: number; className?: string; style?: CSSProperties;
}) {
  const { ref, visto } = useEmCena<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700 ease-out will-change-transform',
        visto ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6', className)}
      style={{ transitionDelay: visto ? `${atraso}ms` : '0ms', ...style }}
    >
      {children}
    </div>
  );
}

/** Número que conta de 0 até `valor` (≈1,2 s) quando entra na tela. */
export function Contador({ valor, formatar, duracao = 1200 }: {
  valor: number; formatar: (v: number) => string; duracao?: number;
}) {
  const { ref, visto } = useEmCena<HTMLSpanElement>();
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!visto) return;
    if (prefereMenosMovimento() || !Number.isFinite(valor) || valor === 0) { setAtual(valor || 0); return; }
    let raf = 0;
    const inicio = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3); // desacelera no fim
      setAtual(valor * suave);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [visto, valor, duracao]);
  return <span ref={ref}>{formatar(atual)}</span>;
}
