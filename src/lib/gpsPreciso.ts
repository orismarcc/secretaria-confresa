// Leitura de GPS com controle de PRECISÃO, para o Iniciar/Finalizar do operador.
//
// Motivo (29/09/2026): no Android, a primeira posição entregue pode ser uma
// estimativa pela rede/IP da operadora (ex.: o centro de Rio Branco-AC, a
// 1.700 km). Agora:
//   * aceita na hora a primeira leitura PRECISA (≤ precisaoMaxM) e DENTRO da
//     região de Confresa — normalmente em 1–5 s;
//   * espera no máximo `esperaMs` (padrão 8 s — o operador tem pressa);
//   * se só vierem leituras ruins, devolve null (melhor sem localização do que
//     com localização errada). O Finalizar tenta de novo.
// Nunca rejeita: sem permissão/sem GPS também devolve null.

export interface LeituraGps {
  latitude: number;
  longitude: number;
  precisaoM: number | null;
}

export interface OpcoesGps {
  esperaMs?: number;
  precisaoMaxM?: number;
}

// Região de Confresa/MT com folga (mesma faixa usada no banco).
export const dentroDaRegiao = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= -13 && lat <= -8 && lng >= -54 && lng <= -49;

export function lerPosicaoPrecisa(opcoes: OpcoesGps = {}): Promise<LeituraGps | null> {
  const esperaMs = opcoes.esperaMs ?? 8000;
  const precisaoMaxM = opcoes.precisaoMaxM ?? 150;

  return new Promise((resolve) => {
    const geo = typeof navigator !== 'undefined' ? navigator.geolocation : undefined;
    if (!geo) { resolve(null); return; }

    let fim = false;
    let watchId: number | null = null;
    const terminar = (r: LeituraGps | null) => {
      if (fim) return;
      fim = true;
      clearTimeout(timer);
      if (watchId !== null) { try { geo.clearWatch(watchId); } catch { /* ok */ } }
      resolve(r);
    };
    const timer = setTimeout(() => terminar(null), esperaMs);

    try {
      watchId = geo.watchPosition(
        (pos) => {
          const { latitude, longitude, accuracy } = pos.coords;
          const precisao = Number.isFinite(accuracy) ? accuracy : null;
          const preciso = precisao !== null && precisao <= precisaoMaxM;
          if (preciso && dentroDaRegiao(latitude, longitude)) {
            terminar({ latitude, longitude, precisaoM: precisao });
          }
          // leitura imprecisa ou fora da região: ignora e continua esperando
        },
        (erro) => { if (erro.code === erro.PERMISSION_DENIED) terminar(null); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: esperaMs },
      );
    } catch {
      terminar(null);
    }
  });
}
