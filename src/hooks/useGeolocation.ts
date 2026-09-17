import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  isLoading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    isLoading: false,
  });

  const getCurrentPosition = useCallback((): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = 'Geolocalização não suportada pelo navegador';
        setState(prev => ({ ...prev, error, isLoading: false }));
        reject(new Error(error));
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const onSuccess = (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        setState({ latitude, longitude, error: null, isLoading: false });
        resolve({ latitude, longitude });
      };

      const describe = (error: GeolocationPositionError) => {
        switch (error.code) {
          case error.PERMISSION_DENIED: return 'Permissão de localização negada';
          case error.POSITION_UNAVAILABLE: return 'Localização indisponível';
          case error.TIMEOUT: return 'Tempo esgotado ao obter localização';
          default: return 'Erro ao obter localização';
        }
      };

      // ── ANDROID ────────────────────────────────────────────────────────────
      // No Android Chrome, getCurrentPosition costuma dar TIMEOUT mesmo com a
      // localização ligada; watchPosition pega o fix de forma confiável. Usamos
      // o PRIMEIRO ponto válido e encerramos. (No iOS o caminho abaixo permanece
      // exatamente como está — não é alterado.)
      const isAndroid = /Android/i.test(navigator.userAgent || '');
      if (isAndroid) {
        let done = false;
        let watchId = 0;
        const finish = (fn: () => void) => {
          if (done) return;
          done = true;
          try { navigator.geolocation.clearWatch(watchId); } catch { /* ok */ }
          clearTimeout(timer);
          fn();
        };
        // Sem fix em ~28s -> desiste (o Iniciar segue sem localização).
        const timer = setTimeout(() => {
          finish(() => {
            const msg = 'Tempo esgotado ao obter localização';
            setState(prev => ({ ...prev, error: msg, isLoading: false }));
            reject(new Error(msg));
          });
        }, 28000);
        watchId = navigator.geolocation.watchPosition(
          (position) => finish(() => onSuccess(position)),      // primeiro ponto válido
          (error) => {
            // Só desiste na hora se a permissão foi negada; os demais erros
            // (indisponível/timeout transitório) o watch tenta de novo sozinho.
            if (error.code === error.PERMISSION_DENIED) {
              finish(() => {
                const msg = describe(error);
                setState(prev => ({ ...prev, error: msg, isLoading: false }));
                reject(new Error(msg));
              });
            }
          },
          { enableHighAccuracy: true, timeout: 28000, maximumAge: 0 },
        );
        return;
      }

      // ── iOS / desktop (inalterado) ───────────────────────────────────────────
      // GPS "frio" no campo demora — damos mais tempo com alta precisão e, se
      // falhar por tempo/indisponível (não por permissão), tentamos de novo em
      // modo aproximado (rede/última posição), que costuma resolver na hora.
      navigator.geolocation.getCurrentPosition(
        onSuccess,
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            const msg = describe(error);
            setState(prev => ({ ...prev, error: msg, isLoading: false }));
            reject(new Error(msg));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            onSuccess,
            (error2) => {
              const msg = describe(error2);
              setState(prev => ({ ...prev, error: msg, isLoading: false }));
              reject(new Error(msg));
            },
            { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 },
          );
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
      );
    });
  }, []);

  return {
    ...state,
    getCurrentPosition,
  };
}
