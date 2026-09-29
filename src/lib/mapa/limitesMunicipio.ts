// Limite oficial do município (IBGE) + municípios vizinhos, desenhados por
// BAIXO dos pontos. Usado nos mapas de Produtores, Conecta Confresa e Mapa da
// demanda.
//
// Cuidados para não atrapalhar nada:
//   * pane próprio ABAIXO dos marcadores (tiles 200 < limites 350 < pontos 400);
//   * interactive:false — nunca recebe clique (popups, "Adicionar à rota" e o
//     "marcar posição" no mapa seguem iguais);
//   * não mexe no enquadramento (fitBounds) de cada mapa;
//   * controle no canto para mostrar/ocultar (lembrado neste aparelho).
// Futuro (outros municípios): trocar o arquivo por uma configuração do município.
import L from 'leaflet';
import limites from '@/data/limites/confresa.json';

const PANE = 'limites-municipio';
const CHAVE = 'mapa:limites';

type Preferencias = { municipio: boolean; vizinhos: boolean };

function lerPreferencias(): Preferencias {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    if (v && typeof v.municipio === 'boolean' && typeof v.vizinhos === 'boolean') return v;
  } catch { /* sem storage: usa o padrão */ }
  return { municipio: true, vizinhos: true };
}
function salvarPreferencias(p: Preferencias) {
  try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch { /* ok */ }
}

/** Nome do município principal (para legendas). */
export const NOME_MUNICIPIO =
  (limites.features.find((f) => f.properties.tipo === 'municipio')?.properties.nome as string) || 'Município';

/**
 * Adiciona o limite do município e dos vizinhos ao mapa. Devolve uma função
 * para remover tudo (chamar no cleanup do componente).
 */
export function adicionarLimitesMunicipio(map: L.Map): () => void {
  if (!map.getPane(PANE)) {
    const pane = map.createPane(PANE);
    pane.style.zIndex = '350';
    pane.style.pointerEvents = 'none';
  }

  const municipio = L.geoJSON(
    { type: 'FeatureCollection', features: limites.features.filter((f) => f.properties.tipo === 'municipio') } as any,
    { pane: PANE, interactive: false, style: { color: '#2d5a27', weight: 3, fillColor: '#2d5a27', fillOpacity: 0.05 } },
  );

  const vizinhos = L.layerGroup();
  L.geoJSON(
    { type: 'FeatureCollection', features: limites.features.filter((f) => f.properties.tipo === 'vizinho') } as any,
    {
      pane: PANE,
      interactive: false,
      style: { color: '#9ca3af', weight: 1.5, dashArray: '5 5', fillOpacity: 0 },
      onEachFeature: (f, camada) => {
        const centro = (camada as L.Polygon).getBounds().getCenter();
        const el = document.createElement('div');
        el.textContent = String(f.properties?.nome ?? '');
        el.setAttribute('style', 'font:600 11px system-ui,sans-serif;color:#6b7280;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff;transform:translate(-50%,-50%);pointer-events:none');
        L.marker(centro, { pane: PANE, interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: el, iconSize: [0, 0] }) }).addTo(vizinhos);
      },
    },
  ).addTo(vizinhos);

  const pref = lerPreferencias();
  const aplicar = () => {
    if (pref.municipio) municipio.addTo(map); else map.removeLayer(municipio);
    if (pref.vizinhos) vizinhos.addTo(map); else map.removeLayer(vizinhos);
  };
  aplicar();

  // Controle "mostrar/ocultar" (canto inferior esquerdo — não cobre os balões).
  const Controle = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create('div', 'leaflet-bar');
      box.setAttribute('style', 'background:#fff;padding:4px 8px;font:12px system-ui,sans-serif;line-height:1.7');
      const opcao = (rotulo: string, chave: keyof Preferencias) => {
        const lbl = L.DomUtil.create('label', '', box);
        lbl.setAttribute('style', 'display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap');
        const cb = L.DomUtil.create('input', '', lbl) as HTMLInputElement;
        cb.type = 'checkbox';
        cb.checked = pref[chave];
        const txt = document.createElement('span');
        txt.textContent = rotulo;
        lbl.appendChild(txt);
        cb.addEventListener('change', () => { pref[chave] = cb.checked; salvarPreferencias(pref); aplicar(); });
      };
      opcao(`Limite de ${NOME_MUNICIPIO}`, 'municipio');
      opcao('Municípios vizinhos', 'vizinhos');
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    },
  });
  const controle = new Controle({ position: 'bottomleft' });
  controle.addTo(map);

  return () => {
    try { map.removeControl(controle); } catch { /* mapa já removido */ }
    try { map.removeLayer(municipio); map.removeLayer(vizinhos); } catch { /* ok */ }
  };
}
