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
