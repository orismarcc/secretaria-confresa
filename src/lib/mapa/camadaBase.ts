// Fundo dos mapas (Leaflet): "Mapa" (OpenStreetMap — o de sempre, padrão),
// "Satélite" (imagens Esri World Imagery) e "Satélite + estradas" (imagens com
// estradas e nomes por cima). Usado nos mapas de Produtores, Conecta Confresa
// e Mapa da demanda.
//
// Cuidados para não atrapalhar nada:
//   * o padrão continua sendo o OpenStreetMap;
//   * as camadas ficam no pane de tiles (abaixo de limites e pontos) — cliques,
//     balões, "Adicionar à rota" e "marcar posição" seguem iguais;
//   * a escolha fica lembrada neste aparelho (sem storage, usa o padrão).
// Sem chave nem Google Cloud: as imagens vêm do serviço público da Esri.
import L from 'leaflet';

const CHAVE = 'mapa:fundo';
type Fundo = 'mapa' | 'satelite' | 'hibrido';

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const ATRIB_ESRI = 'Imagens &copy; Esri, Maxar, Earthstar Geographics';

function lerFundo(): Fundo {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === 'mapa' || v === 'satelite' || v === 'hibrido') return v;
  } catch { /* sem storage: usa o padrão */ }
  return 'mapa';
}
function salvarFundo(f: Fundo) {
  try { localStorage.setItem(CHAVE, f); } catch { /* ok */ }
}

/**
 * Adiciona o fundo do mapa (OpenStreetMap por padrão) e o seletor
 * Mapa / Satélite. Devolve uma função para remover (chamar no cleanup).
 */
export function adicionarCamadaBase(map: L.Map): () => void {
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; colaboradores do OpenStreetMap',
  });
  const imagens = L.tileLayer(`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, {
    maxZoom: 18,
    attribution: ATRIB_ESRI,
  });
  const estradas = L.tileLayer(`${ESRI}/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18 });
  const nomes = L.tileLayer(`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 18 });

  let atual = lerFundo();
  const aplicar = () => {
    [osm, imagens, estradas, nomes].forEach((c) => { if (map.hasLayer(c)) map.removeLayer(c); });
    if (atual === 'mapa') osm.addTo(map);
    else {
      imagens.addTo(map);
      if (atual === 'hibrido') { estradas.addTo(map); nomes.addTo(map); }
    }
  };
  aplicar();

  // Seletor no canto superior direito (os limites ficam no inferior esquerdo).
  const Controle = L.Control.extend({
    onAdd() {
      const box = L.DomUtil.create('div', 'leaflet-bar');
      box.setAttribute('style', 'background:#fff;padding:4px 8px;font:12px system-ui,sans-serif;line-height:1.7');
      const nome = `fundo-${Math.random().toString(36).slice(2)}`;
      const opcao = (rotulo: string, valor: Fundo) => {
        const lbl = L.DomUtil.create('label', '', box);
        lbl.setAttribute('style', 'display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap');
        const rb = L.DomUtil.create('input', '', lbl) as HTMLInputElement;
        rb.type = 'radio';
        rb.name = nome;
        rb.checked = atual === valor;
        const txt = document.createElement('span');
        txt.textContent = rotulo;
        lbl.appendChild(txt);
        rb.addEventListener('change', () => { if (rb.checked) { atual = valor; salvarFundo(valor); aplicar(); } });
      };
      opcao('Mapa', 'mapa');
      opcao('Satélite', 'satelite');
      opcao('Satélite + estradas', 'hibrido');
      L.DomEvent.disableClickPropagation(box);
      L.DomEvent.disableScrollPropagation(box);
      return box;
    },
  });
  const controle = new Controle({ position: 'topright' });
  controle.addTo(map);

  return () => {
    try { map.removeControl(controle); } catch { /* mapa já removido */ }
    [osm, imagens, estradas, nomes].forEach((c) => { try { map.removeLayer(c); } catch { /* ok */ } });
  };
}
