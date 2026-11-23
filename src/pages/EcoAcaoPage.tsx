// EcoAção — DEMONSTRAÇÃO pública (sem login) de denúncia de descarte irregular
// de lixo. Projeto idealizado por alunos da comunidade Bridão Brasileiro.
// Reaproveita a lógica dos atendimentos dos operadores: foto + GPS de alta
// precisão, GPS gravado na foto (galeria) e "Procurar no mapa".
// O GPS começa a ser lido ao escolher o tipo (antes da câmera) — no iPhone a
// primeira posição demora e há o pedido de permissão.
// Nada é enviado ao banco do sistema: as denúncias ficam só neste aparelho.
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Camera, ImagePlus, MapPin, Trash2, ArrowLeft, ArrowRight, Check, Loader2,
  ClipboardList, Info, LocateFixed, Pencil, ShieldCheck, Smartphone, X, AlertTriangle, Plus, Navigation,
} from 'lucide-react';
import { EscolherNoMapaDialog } from '@/components/mapa/EscolherNoMapaDialog';
import { adicionarCamadaBase } from '@/lib/mapa/camadaBase';
import { lerExifFoto } from '@/lib/exifFoto';
import { cn } from '@/lib/utils';
import {
  type Denuncia, type EstadoGps, type LeituraGps, ROTULO_TIPO, ROTULO_ORIGEM, LIMITE_DESCRICAO, MAX_FOTOS,
  gerarProtocolo, pendencias, coordenadaValida, salvarDenuncia, listarDenuncias, apagarDenuncia,
  reduzirFoto, alternarSugestao, criarRastreioGps, leituraUtil, detectarPlataforma, navegadorDeApp, comoLiberarGps, linkDoMapa,
} from '@/lib/ecoacao';

type Tela = 'inicio' | 'tipo' | 'foto' | 'descricao' | 'revisao' | 'enviado' | 'lista';
const PASSOS: { tela: Tela; rotulo: string }[] = [
  { tela: 'tipo', rotulo: 'Tipo' },
  { tela: 'foto', rotulo: 'Fotos e local' },
  { tela: 'descricao', rotulo: 'Descrição' },
  { tela: 'revisao', rotulo: 'Enviar' },
];
const SUGESTOES = ['Entulho de obra', 'Lixo doméstico', 'Pneus', 'Móveis velhos', 'Galhos e podas', 'Perto de rio ou córrego', 'Mau cheiro', 'Lixo queimado'];

type Rascunho = Omit<Denuncia, 'id' | 'protocolo' | 'criadaEm'>;
const RASCUNHO_VAZIO: Rascunho = {
  tipo: 'descarte_lixo', fotos: [], latitude: null, longitude: null, precisaoM: null,
  origemLocal: null, endereco: '', descricao: '',
};

const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const PLATAFORMA = detectarPlataforma();
const EM_APP = navegadorDeApp();

// ── Mini mapa só para mostrar o ponto ────────────────────────────────────────
function MiniMapa({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false, keyboard: false })
      .setView([lat, lng], 16);
    const tirar = adicionarCamadaBase(map);
    L.circleMarker([lat, lng], { radius: 9, color: '#fff', weight: 3, fillColor: '#e4572e', fillOpacity: 1 }).addTo(map);
    setTimeout(() => map.invalidateSize(), 50);
    return () => { try { tirar(); map.remove(); } catch { /* ok */ } };
  }, [lat, lng]);
  return <div ref={ref} className="isolate h-36 w-full rounded-2xl overflow-hidden border border-[#cfe0cf] [&_.leaflet-control-container]:hidden" />;
}

/** Mapa tocável: abre o ponto no app de mapas do celular. */
function MapaComLink({ lat, lng }: { lat: number; lng: number }) {
  const href = linkDoMapa(lat, lng, PLATAFORMA);
  const externo = href.startsWith('http');
  return (
    <a href={href} target={externo ? '_blank' : undefined} rel="noopener noreferrer" className="block space-y-2 group" aria-label="Abrir o local no mapa">
      <div className="relative">
        <MiniMapa lat={lat} lng={lng} />
        <span className="absolute bottom-2 right-2 z-[500] rounded-full bg-white/95 text-[#1f5a35] text-[11px] font-semibold px-2.5 py-1 shadow">Toque para abrir</span>
      </div>
      <span className="w-full h-11 rounded-xl bg-[#1f5a35] text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 group-active:opacity-90">
        <Navigation className="h-4 w-4" /> {PLATAFORMA === 'iphone' ? 'Abrir no Mapas' : 'Abrir no mapa'} — como chegar
      </span>
    </a>
  );
}

/**
 * Marca do EcoAção: um "e" de traço contínuo que desemboca no marcador de
 * localização (a cor do ponto no mapa) — a inicial + o gesto de marcar o local.
 */
function LogoEcoAcao({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="EcoAção">
      <rect width="40" height="40" rx="12" fill="#1f5a35" />
      <path d="M11.2 20.2H27.4" stroke="#b8e07a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M27.4 20.2A8.2 8.2 0 1 0 25.66 25.25" fill="none" stroke="#b8e07a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M27.96 21.95a3.9 3.9 0 0 1 3.9 3.9c0 2.9-3.9 6.4-3.9 6.4s-3.9-3.5-3.9-6.4a3.9 3.9 0 0 1 3.9-3.9z" fill="#f0703f" stroke="#1f5a35" strokeWidth="1.3" />
      <circle cx="27.96" cy="25.85" r="1.35" fill="#1f5a35" />
    </svg>
  );
}

// ── Peças visuais ────────────────────────────────────────────────────────────
function Dica({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-2xl bg-[#eef6e9] px-3.5 py-3 text-[13px] leading-snug text-[#2d4a32]">
      <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#3f8f4a]" />
      <div>{children}</div>
    </div>
  );
}

function BotaoPrincipal({ children, onClick, disabled, className }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full h-14 rounded-2xl bg-[#1f5a35] text-white font-semibold text-[15px] flex items-center justify-center gap-2 shadow-[0_6px_0_#143d24] active:translate-y-[3px] active:shadow-[0_3px_0_#143d24] transition-all disabled:opacity-40 disabled:shadow-none disabled:translate-y-0',
        className,
      )}
    >
      {children}
    </button>
  );
}

function Passos({ atual }: { atual: Tela }) {
  const idx = PASSOS.findIndex((p) => p.tela === atual);
  if (idx < 0) return null;
  return (
    <div className="px-5 pt-1 pb-4">
      <div className="flex gap-1.5">
        {PASSOS.map((p, i) => (
          <div key={p.tela} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= idx ? 'bg-[#3f8f4a]' : 'bg-[#d9e4d6]')} />
        ))}
      </div>
      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#5d7a61]">
        Passo {idx + 1} de {PASSOS.length} · {PASSOS[idx].rotulo}
      </p>
    </div>
  );
}

/** Situação do GPS ao vivo, com o que fazer quando não funciona. */
function PainelGps({ estado, leitura, onTentar, onMapa }: { estado: EstadoGps; leitura: LeituraGps | null; onTentar: () => void; onMapa: () => void }) {
  const [verComo, setVerComo] = useState(false);
  if (estado === 'ok' && leitura) {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-[#eef6e9] px-3.5 py-2.5 text-[13px] text-[#2d4a32]">
        <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-[#3f8f4a] opacity-60 animate-ping" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3f8f4a]" /></span>
        <span className="flex-1">GPS ligado{leitura.precisaoM != null ? ` · precisão de ${Math.round(leitura.precisaoM)} m` : ''}</span>
      </div>
    );
  }
  if (estado === 'buscando' || estado === 'parado') {
    return (
      <div className="rounded-2xl bg-[#eef6e9] px-3.5 py-2.5 text-[13px] text-[#2d4a32]">
        <p className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#3f8f4a]" /> Procurando sua localização…</p>
        <p className="text-[12px] text-[#5d7a61] mt-1">
          {PLATAFORMA === 'iphone' ? 'Se o iPhone perguntar, toque em "Permitir". ' : 'Se o celular perguntar, toque em "Permitir". '}
          Ao ar livre o GPS fica mais rápido e preciso.
        </p>
      </div>
    );
  }
  // negado / indisponível
  return (
    <div className="rounded-2xl border border-[#f1c9a8] bg-[#fff6ee] px-3.5 py-3 text-[13px] text-[#6b3a12] space-y-2">
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#d9772b]" />
        {estado === 'negado' ? 'A localização está bloqueada para este site.' : 'O celular não informou a localização.'}
      </p>
      {EM_APP && <p className="text-[12px]">Você abriu o link dentro de um aplicativo (WhatsApp, Instagram…). Abra no {PLATAFORMA === 'iphone' ? 'Safari' : 'Chrome'} para o GPS funcionar.</p>}
      {verComo ? (
        <ol className="list-decimal pl-5 space-y-1 text-[12px]">
          {comoLiberarGps(PLATAFORMA).map((p) => <li key={p}>{p}</li>)}
        </ol>
      ) : (
        <button type="button" onClick={() => setVerComo(true)} className="text-[12px] font-semibold underline">Como liberar a localização</button>
      )}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onTentar} className="h-9 rounded-xl bg-white border border-[#f1c9a8] text-[12px] font-semibold flex items-center justify-center gap-1.5"><LocateFixed className="h-3.5 w-3.5" /> Tentar de novo</button>
        <button type="button" onClick={onMapa} className="h-9 rounded-xl bg-white border border-[#f1c9a8] text-[12px] font-semibold flex items-center justify-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Marcar no mapa</button>
      </div>
    </div>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function EcoAcaoPage() {
  const [tela, setTela] = useState<Tela>('inicio');
  const [r, setR] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [nota, setNota] = useState<string | null>(null);
  const [preparandoFoto, setPreparandoFoto] = useState(false);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [lista, setLista] = useState<Denuncia[]>(() => listarDenuncias());
  const [enviada, setEnviada] = useState<Denuncia | null>(null);
  const [aberta, setAberta] = useState<Denuncia | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [gps, setGps] = useState<{ estado: EstadoGps; leitura: LeituraGps | null }>({ estado: 'parado', leitura: null });
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const topoRef = useRef<HTMLDivElement>(null);
  const rastreio = useMemo(() => criarRastreioGps((estado, leitura) => setGps({ estado, leitura })), []);

  useEffect(() => { document.title = 'EcoAção — Denúncia ambiental'; }, []);
  useEffect(() => { topoRef.current?.scrollIntoView({ block: 'start' }); }, [tela]);
  useEffect(() => () => rastreio.parar(), [rastreio]);
  // GPS ligado só durante o preenchimento
  useEffect(() => {
    if (tela === 'tipo' || tela === 'foto') rastreio.iniciar();
    if (tela === 'inicio' || tela === 'enviado' || tela === 'lista') rastreio.parar();
  }, [tela, rastreio]);

  // Com foto e sem ponto escolhido à mão/da foto: usa (e vai melhorando) a posição do GPS.
  useEffect(() => {
    if (tela !== 'foto' || r.fotos.length === 0) return;
    if (r.origemLocal === 'mapa' || r.origemLocal === 'foto') return;
    const l = gps.leitura;
    if (!leituraUtil(l)) return;
    const atual = r.origemLocal === 'gps' ? r.precisaoM ?? 9999 : Infinity;
    if ((l.precisaoM ?? 9999) < atual || !coordenadaValida(r.latitude, r.longitude)) {
      setR((x) => ({ ...x, latitude: l.latitude, longitude: l.longitude, precisaoM: l.precisaoM, origemLocal: 'gps' }));
    }
  }, [gps.leitura, r.fotos.length, r.origemLocal, r.precisaoM, r.latitude, r.longitude, tela]);

  const temLocal = coordenadaValida(r.latitude, r.longitude);
  const falta = useMemo(() => pendencias(r), [r]);
  const podeMaisFotos = r.fotos.length < MAX_FOTOS;

  const novaDenuncia = () => { setR(RASCUNHO_VAZIO); setNota(null); setErro(null); setTela('tipo'); };

  async function aoEscolherFotos(arquivos: FileList | null, origem: 'camera' | 'galeria') {
    const lista = Array.from(arquivos ?? []).filter((f) => /^image\//.test(f.type));
    if (!lista.length) { if (arquivos?.length) setErro('Escolha um arquivo de imagem (foto).'); return; }
    const vagas = MAX_FOTOS - r.fotos.length;
    if (vagas <= 0) return;
    const usar = lista.slice(0, vagas);
    setErro(lista.length > vagas ? `Só cabem ${MAX_FOTOS} fotos — usamos as ${vagas === 1 ? 'primeira' : `${vagas} primeiras`}.` : null);
    setPreparandoFoto(true);
    try {
      const primeiraDaDenuncia = r.fotos.length === 0;
      const reduzidas = await Promise.all(usar.map((f) => reduzirFoto(f)));
      setR((x) => ({ ...x, fotos: [...x.fotos, ...reduzidas].slice(0, MAX_FOTOS) }));
      if (!primeiraDaDenuncia || r.origemLocal === 'mapa') return;
      // Galeria: tenta a localização gravada na própria foto
      if (origem === 'galeria') {
        for (const f of usar) {
          const exif = await lerExifFoto(f);
          if (exif && coordenadaValida(exif.latitude, exif.longitude)) {
            setR((x) => ({ ...x, latitude: exif.latitude, longitude: exif.longitude, precisaoM: null, origemLocal: 'foto' }));
            setNota('Localização gravada na própria foto.');
            return;
          }
        }
        setNota('A foto não trazia localização: usamos a sua posição atual. Se ela foi tirada em outro lugar, ajuste no mapa.');
      } else {
        setNota(null);
      }
      rastreio.iniciar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível usar esta foto.');
    } finally {
      setPreparandoFoto(false);
    }
  }

  function removerFoto(i: number) {
    setR((x) => {
      const fotos = x.fotos.filter((_, j) => j !== i);
      // sem fotos, a localização que veio da foto deixa de valer
      return fotos.length === 0 && x.origemLocal === 'foto'
        ? { ...x, fotos, latitude: null, longitude: null, precisaoM: null, origemLocal: null }
        : { ...x, fotos };
    });
    if (r.fotos.length === 1) setNota(null);
  }

  function usarMeuGps() {
    // volta a seguir o GPS (desfaz ponto do mapa/da foto)
    setR((x) => ({ ...x, latitude: null, longitude: null, precisaoM: null, origemLocal: null }));
    setNota(null);
    if (gps.estado === 'negado' || gps.estado === 'indisponivel') rastreio.reiniciar();
    else rastreio.iniciar();
  }

  function enviar() {
    if (falta.length) return;
    const d: Denuncia = { ...r, id: crypto.randomUUID?.() ?? String(Date.now()), protocolo: gerarProtocolo(), criadaEm: new Date().toISOString(), descricao: r.descricao.trim(), endereco: r.endereco.trim() };
    if (!salvarDenuncia(d)) { setErro('O armazenamento do navegador está cheio. Apague denúncias antigas em "Minhas denúncias".'); return; }
    setLista(listarDenuncias());
    setEnviada(d);
    setTela('enviado');
  }

  function apagar(id: string) {
    apagarDenuncia(id);
    setLista(listarDenuncias());
    setAberta(null);
  }

  const voltar: Partial<Record<Tela, Tela>> = { tipo: 'inicio', foto: 'tipo', descricao: 'foto', revisao: 'descricao', lista: 'inicio' };

  return (
    <div className="min-h-screen bg-[#e7eee3] sm:py-8" style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}>
      <div ref={topoRef} className="mx-auto w-full max-w-[440px] min-h-screen sm:min-h-[820px] bg-[#fbfcf8] sm:rounded-[2.2rem] sm:shadow-[0_30px_80px_-30px_rgba(20,61,36,.45)] sm:border-[10px] sm:border-[#17301f] overflow-hidden flex flex-col">

        {/* Barra superior */}
        <header className="flex items-center gap-3 px-5 pt-5 pb-3">
          {voltar[tela] ? (
            <button type="button" onClick={() => setTela(voltar[tela]!)} aria-label="Voltar" className="h-10 w-10 -ml-1 rounded-full grid place-items-center hover:bg-[#eef3ea] text-[#1f5a35]">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            <LogoEcoAcao className="h-10 w-10 -ml-1 shrink-0" />
          )}
          <div className="flex-1 leading-tight">
            <p className="font-extrabold text-[17px] tracking-tight text-[#17301f]">Eco<span className="text-[#3f8f4a]">Ação</span></p>
            <p className="text-[11px] text-[#6b8270]">Denúncia ambiental</p>
          </div>
          <span className="rounded-full bg-[#fff1d6] text-[#8a5a00] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1">Demonstração</span>
        </header>

        <Passos atual={tela} />

        <main className="flex-1 px-5 pb-6 flex flex-col">
          {/* ── INÍCIO ── */}
          {tela === 'inicio' && (
            <div className="flex flex-col gap-5">
              <div className="relative overflow-hidden rounded-[1.8rem] bg-[#1f5a35] text-white p-6 pb-7">
                <svg className="absolute -right-8 -top-6 h-44 w-44 opacity-[0.16]" viewBox="0 0 40 40" aria-hidden>
                  <path d="M11.2 20.2H27.4" stroke="#b8e07a" strokeWidth="3.4" strokeLinecap="round" />
                  <path d="M27.4 20.2A8.2 8.2 0 1 0 25.66 25.25" fill="none" stroke="#b8e07a" strokeWidth="3.4" strokeLinecap="round" />
                </svg>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b8e07a]">Cuidar da cidade é com a gente</p>
                <h1 className="mt-2 text-[28px] leading-[1.1] font-extrabold tracking-tight">Viu lixo jogado em lugar errado?</h1>
                <p className="mt-2 text-[14px] text-[#d7ead7] leading-snug">Tire uma foto, mostre onde é e conte o que viu. Leva menos de um minuto.</p>
              </div>

              <BotaoPrincipal onClick={novaDenuncia}><Camera className="h-5 w-5" /> Fazer uma denúncia</BotaoPrincipal>

              <button type="button" onClick={() => setTela('lista')} className="w-full h-12 rounded-2xl border-2 border-[#cfe0cf] text-[#1f5a35] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#f1f6ee]">
                <ClipboardList className="h-4 w-4" /> Minhas denúncias {lista.length > 0 && <span className="rounded-full bg-[#1f5a35] text-white text-[11px] px-2 py-0.5">{lista.length}</span>}
              </button>

              <section>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#5d7a61] mb-3">Como funciona</p>
                <ol className="space-y-3">
                  {[
                    ['Escolha o tipo', 'Descarte irregular de lixo.'],
                    ['Tire até 3 fotos', 'A localização é registrada sozinha. Dá para ajustar no mapa ou escrever o endereço.'],
                    ['Descreva', 'Conte rapidamente o que encontrou.'],
                    ['Envie', 'Você recebe um número de protocolo.'],
                  ].map(([t, d], i) => (
                    <li key={t} className="flex gap-3">
                      <span className="h-8 w-8 shrink-0 rounded-full bg-[#eef6e9] text-[#1f5a35] font-extrabold text-sm grid place-items-center">{i + 1}</span>
                      <div className="pt-0.5"><p className="font-semibold text-[14px] text-[#17301f]">{t}</p><p className="text-[13px] text-[#5d6f60] leading-snug">{d}</p></div>
                    </li>
                  ))}
                </ol>
              </section>

              <Dica>
                <b>Esta é uma versão de demonstração.</b> As denúncias ficam guardadas só neste aparelho e não são enviadas a nenhum órgão.
              </Dica>
            </div>
          )}

          {/* ── 1. TIPO ── */}
          {tela === 'tipo' && (
            <div className="flex flex-col gap-4 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">O que você quer denunciar?</h2>
              <button
                type="button"
                onClick={() => { rastreio.iniciar(); setR((x) => ({ ...x, tipo: 'descarte_lixo' })); setTela('foto'); }}
                className="group text-left rounded-[1.6rem] border-2 border-[#3f8f4a] bg-[#f3f9ef] p-5 flex items-center gap-4 hover:bg-[#eaf5e4] transition-colors"
              >
                <span className="h-14 w-14 rounded-2xl bg-[#1f5a35] grid place-items-center shrink-0">
                  <Trash2 className="h-7 w-7 text-[#b8e07a]" />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-[16px] text-[#17301f]">{ROTULO_TIPO.descarte_lixo}</span>
                  <span className="block text-[13px] text-[#5d6f60] leading-snug mt-0.5">Lixo, entulho, pneus ou móveis deixados em terrenos, ruas, calçadas ou perto de rios.</span>
                </span>
                <ArrowRight className="h-5 w-5 text-[#3f8f4a] group-hover:translate-x-0.5 transition-transform" />
              </button>
              <div className="rounded-[1.6rem] border-2 border-dashed border-[#d9e4d6] p-4 text-[13px] text-[#8a9a8c]">
                Outros tipos de denúncia (queimadas, desmatamento, poluição de água) poderão entrar no aplicativo definitivo.
              </div>
            </div>
          )}

          {/* ── 2. FOTOS E LOCAL ── */}
          {tela === 'foto' && (
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Fotografe o local</h2>
                <p className="text-[13px] text-[#5d6f60] mt-1">Até {MAX_FOTOS} fotos. A primeira deve mostrar bem o lixo.</p>
              </div>

              <PainelGps estado={gps.estado} leitura={gps.leitura} onTentar={() => rastreio.reiniciar()} onMapa={() => setMapaAberto(true)} />

              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { aoEscolherFotos(e.target.files, 'camera'); e.target.value = ''; }} />
              <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { aoEscolherFotos(e.target.files, 'galeria'); e.target.value = ''; }} />

              {r.fotos.length === 0 ? (
                <>
                  <button type="button" onClick={() => camRef.current?.click()} disabled={preparandoFoto}
                    className="rounded-[1.6rem] border-2 border-dashed border-[#9cc79a] bg-[#f3f9ef] h-52 flex flex-col items-center justify-center gap-3 text-[#1f5a35] hover:bg-[#eaf5e4]">
                    {preparandoFoto ? <Loader2 className="h-10 w-10 animate-spin" /> : <span className="h-16 w-16 rounded-full bg-[#1f5a35] grid place-items-center"><Camera className="h-8 w-8 text-white" /></span>}
                    <span className="font-bold text-[15px]">{preparandoFoto ? 'Preparando a foto…' : 'Tirar foto agora'}</span>
                    <span className="text-[12px] text-[#5d7a61]">A localização é registrada junto</span>
                  </button>
                  <button type="button" onClick={() => galRef.current?.click()} disabled={preparandoFoto} className="h-12 rounded-2xl border-2 border-[#cfe0cf] text-[#1f5a35] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#f1f6ee]">
                    <ImagePlus className="h-4 w-4" /> Escolher da galeria
                  </button>
                  <Dica>Mostre bem o lixo e, se der, algo que ajude a reconhecer o lugar (uma placa, uma casa, uma árvore).</Dica>
                </>
              ) : (
                <>
                  {/* Fotos */}
                  <div className="grid grid-cols-3 gap-2">
                    {r.fotos.map((f, i) => (
                      <div key={i} className={cn('relative', i === 0 && 'col-span-3')}>
                        <img src={f} alt={`Foto ${i + 1}`} className={cn('w-full object-cover rounded-2xl', i === 0 ? 'h-56' : 'h-24')} />
                        <button type="button" onClick={() => removerFoto(i)} aria-label={`Remover foto ${i + 1}`} className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/55 text-white grid place-items-center">
                          <X className="h-4 w-4" />
                        </button>
                        {i === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-black/55 text-white text-[11px] px-2 py-0.5">Principal</span>}
                      </div>
                    ))}
                    {podeMaisFotos && (
                      <>
                        <button type="button" onClick={() => camRef.current?.click()} disabled={preparandoFoto} className="h-24 rounded-2xl border-2 border-dashed border-[#9cc79a] bg-[#f3f9ef] text-[#1f5a35] text-[12px] font-semibold flex flex-col items-center justify-center gap-1">
                          {preparandoFoto ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />} Tirar mais
                        </button>
                        <button type="button" onClick={() => galRef.current?.click()} disabled={preparandoFoto} className="h-24 rounded-2xl border-2 border-dashed border-[#cfe0cf] text-[#1f5a35] text-[12px] font-semibold flex flex-col items-center justify-center gap-1">
                          <Plus className="h-5 w-5" /> Da galeria
                        </button>
                      </>
                    )}
                  </div>
                  <p className="text-[12px] text-[#8a9a8c] -mt-2">{r.fotos.length} de {MAX_FOTOS} fotos</p>

                  {/* Local */}
                  <section className="rounded-[1.6rem] border border-[#dce7d9] bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#e4572e]" />
                      <p className="font-bold text-[14px] text-[#17301f] flex-1">Local da denúncia</p>
                    </div>
                    {temLocal ? (
                      <>
                        <MiniMapa lat={r.latitude!} lng={r.longitude!} />
                        <p className="text-[12px] text-[#5d6f60]">
                          <Check className="inline h-3.5 w-3.5 text-[#3f8f4a] -mt-0.5" /> {r.origemLocal ? ROTULO_ORIGEM[r.origemLocal] : 'Ponto'}
                          {r.precisaoM != null ? ` · precisão de ${Math.round(r.precisaoM)} m` : ''}
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] text-[#5d6f60]">
                        {gps.estado === 'buscando' || gps.estado === 'parado'
                          ? <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Aguardando o GPS… o ponto aparece aqui sozinho.</span>
                          : 'Sem localização automática. Marque no mapa ou escreva o endereço.'}
                      </p>
                    )}
                    {nota && <p className="text-[12px] text-[#8a5a00] bg-[#fff6e3] rounded-xl px-3 py-2">{nota}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMapaAberto(true)} className="h-10 rounded-xl bg-[#eef6e9] text-[#1f5a35] text-[13px] font-semibold flex items-center justify-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> {temLocal ? 'Ajustar no mapa' : 'Marcar no mapa'}
                      </button>
                      <button type="button" onClick={usarMeuGps} className="h-10 rounded-xl bg-[#eef6e9] text-[#1f5a35] text-[13px] font-semibold flex items-center justify-center gap-1.5">
                        <LocateFixed className="h-3.5 w-3.5" /> Usar meu GPS
                      </button>
                    </div>
                    <label className="block">
                      <span className="text-[12px] font-semibold text-[#3d5341]">Endereço ou ponto de referência {temLocal ? '(opcional)' : ''}</span>
                      <input
                        value={r.endereco}
                        onChange={(e) => setR((x) => ({ ...x, endereco: e.target.value.slice(0, 160) }))}
                        placeholder="Ex.: Rua das Flores, perto da escola"
                        className="mt-1 w-full h-11 rounded-xl border border-[#cfe0cf] bg-[#fbfcf8] px-3 text-[14px] outline-none focus:border-[#3f8f4a] focus:ring-2 focus:ring-[#3f8f4a]/20"
                      />
                    </label>
                  </section>
                </>
              )}
              {erro && <p className="text-[13px] text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

              <div className="mt-auto pt-2">
                <BotaoPrincipal onClick={() => setTela('descricao')} disabled={r.fotos.length === 0 || (!temLocal && r.endereco.trim().length < 5) || preparandoFoto}>
                  Continuar <ArrowRight className="h-5 w-5" />
                </BotaoPrincipal>
                {r.fotos.length > 0 && !temLocal && r.endereco.trim().length < 5 && (
                  <p className="text-center text-[12px] text-[#8a9a8c] mt-2">Aguarde o GPS, marque no mapa ou escreva o endereço para continuar.</p>
                )}
              </div>
            </div>
          )}

          {/* ── 3. DESCRIÇÃO ── */}
          {tela === 'descricao' && (
            <div className="flex flex-col gap-4 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Conte o que você viu</h2>
              <div>
                <p className="text-[12px] font-semibold text-[#3d5341] mb-2">Toque para adicionar (toque de novo para tirar):</p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => {
                    const ja = new RegExp(`(^|,\\s*)${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s*(,|$))`, 'i').test(r.descricao.trim());
                    return (
                      <button key={s} type="button" aria-pressed={ja}
                        onClick={() => setR((x) => ({ ...x, descricao: alternarSugestao(x.descricao, s) }))}
                        className={cn('rounded-full px-3 py-1.5 text-[13px] border transition-colors', ja ? 'bg-[#1f5a35] text-white border-[#1f5a35]' : 'bg-white text-[#1f5a35] border-[#cfe0cf] hover:bg-[#f1f6ee]')}>
                        {ja && <Check className="inline h-3 w-3 mr-1 -mt-0.5" />}{s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <textarea
                  value={r.descricao}
                  onChange={(e) => setR((x) => ({ ...x, descricao: e.target.value.slice(0, LIMITE_DESCRICAO) }))}
                  rows={6}
                  placeholder="Ex.: Muito entulho e sacos de lixo jogados no terreno baldio, já faz uma semana."
                  className="w-full rounded-2xl border border-[#cfe0cf] bg-white p-3.5 text-[15px] leading-snug outline-none focus:border-[#3f8f4a] focus:ring-2 focus:ring-[#3f8f4a]/20 resize-none"
                />
                <span className="flex justify-between text-[11px] text-[#8a9a8c] mt-1">
                  <span>{r.descricao.trim().length < 10 ? 'Escreva pelo menos uma frase curta.' : 'Ótimo!'}</span>
                  <span>{r.descricao.length}/{LIMITE_DESCRICAO}</span>
                </span>
              </label>
              <Dica>Diga o que é, há quanto tempo está lá e se causa algum risco (mau cheiro, mosquitos, perto de água).</Dica>
              <div className="mt-auto pt-2">
                <BotaoPrincipal onClick={() => setTela('revisao')} disabled={r.descricao.trim().length < 10}>Revisar denúncia <ArrowRight className="h-5 w-5" /></BotaoPrincipal>
              </div>
            </div>
          )}

          {/* ── 4. REVISÃO ── */}
          {tela === 'revisao' && (
            <div className="flex flex-col gap-4 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Confira antes de enviar</h2>
              <div className="rounded-[1.6rem] border border-[#dce7d9] bg-white overflow-hidden">
                {r.fotos.length > 0 && (
                  <div className={cn('grid gap-0.5', r.fotos.length === 1 ? 'grid-cols-1' : 'grid-cols-[2fr_1fr]')}>
                    <img src={r.fotos[0]} alt="Foto principal" className="w-full h-44 object-cover" />
                    {r.fotos.length > 1 && (
                      <div className="grid gap-0.5" style={{ gridTemplateRows: `repeat(${r.fotos.length - 1}, 1fr)` }}>
                        {r.fotos.slice(1).map((f, i) => <img key={i} src={f} alt={`Foto ${i + 2}`} className="w-full h-full object-cover" />)}
                      </div>
                    )}
                  </div>
                )}
                <dl className="divide-y divide-[#edf2eb] text-[14px]">
                  {[
                    ['Tipo', ROTULO_TIPO[r.tipo], 'tipo'],
                    ['Fotos', `${r.fotos.length} de ${MAX_FOTOS}`, 'foto'],
                    ['Local', [temLocal ? `${r.latitude!.toFixed(5)}, ${r.longitude!.toFixed(5)} (${r.origemLocal ? ROTULO_ORIGEM[r.origemLocal] : ''})` : '', r.endereco.trim()].filter(Boolean).join(' · '), 'foto'],
                    ['Descrição', r.descricao.trim(), 'descricao'],
                  ].map(([k, v, t]) => (
                    <div key={k} className="px-4 py-3 flex gap-3">
                      <dt className="w-20 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[#6b8270] pt-0.5">{k}</dt>
                      <dd className="flex-1 text-[#17301f] break-words">{v}</dd>
                      <button type="button" onClick={() => setTela(t as Tela)} className="text-[12px] font-semibold text-[#3f8f4a] self-start">Editar</button>
                    </div>
                  ))}
                </dl>
              </div>
              {falta.length > 0 && <p className="text-[13px] text-[#8a5a00] bg-[#fff6e3] rounded-xl px-3 py-2">Falta: {falta.join(', ')}.</p>}
              {erro && <p className="text-[13px] text-red-700 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}
              <div className="mt-auto pt-2">
                <BotaoPrincipal onClick={enviar} disabled={falta.length > 0}><Check className="h-5 w-5" /> Enviar denúncia</BotaoPrincipal>
              </div>
            </div>
          )}

          {/* ── ENVIADA ── */}
          {tela === 'enviado' && enviada && (
            <div className="flex flex-col items-center text-center gap-4 flex-1 pt-6">
              <div className="h-24 w-24 rounded-full bg-[#eef6e9] grid place-items-center">
                <div className="h-16 w-16 rounded-full bg-[#3f8f4a] grid place-items-center"><Check className="h-9 w-9 text-white" strokeWidth={3} /></div>
              </div>
              <h2 className="text-[24px] font-extrabold tracking-tight text-[#17301f]">Denúncia registrada!</h2>
              <p className="text-[14px] text-[#5d6f60] max-w-[300px]">Obrigado por cuidar da nossa cidade. Guarde o número do protocolo:</p>
              <div className="rounded-2xl border-2 border-dashed border-[#9cc79a] bg-[#f3f9ef] px-6 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5d7a61]">Protocolo</p>
                <p className="font-mono text-[22px] font-bold text-[#1f5a35] tracking-wide">{enviada.protocolo}</p>
              </div>
              {coordenadaValida(enviada.latitude, enviada.longitude) && (
                <div className="w-full text-left"><MapaComLink lat={enviada.latitude!} lng={enviada.longitude!} /></div>
              )}
              <Dica>Na versão de demonstração a denúncia fica só neste aparelho. No aplicativo definitivo, ela seguirá para o órgão responsável.</Dica>
              <div className="w-full mt-auto space-y-2.5 pt-2">
                <BotaoPrincipal onClick={() => setTela('lista')}><ClipboardList className="h-5 w-5" /> Ver minhas denúncias</BotaoPrincipal>
                <button type="button" onClick={() => setTela('inicio')} className="w-full h-12 rounded-2xl text-[#1f5a35] font-semibold text-sm hover:bg-[#f1f6ee]">Voltar ao início</button>
              </div>
            </div>
          )}

          {/* ── MINHAS DENÚNCIAS ── */}
          {tela === 'lista' && (
            <div className="flex flex-col gap-3 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Minhas denúncias</h2>
              {lista.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-10">
                  <Smartphone className="h-10 w-10 text-[#9cb59e]" />
                  <p className="text-[14px] text-[#5d6f60] max-w-[260px]">Nenhuma denúncia feita neste aparelho ainda.</p>
                  <BotaoPrincipal onClick={novaDenuncia} className="mt-2"><Camera className="h-5 w-5" /> Fazer uma denúncia</BotaoPrincipal>
                </div>
              ) : (
                <>
                  {lista.map((d) => (
                    <button key={d.id} type="button" onClick={() => { setAberta(d); setFotoAmpliada(0); }} className="text-left rounded-2xl border border-[#dce7d9] bg-white p-2.5 flex gap-3 hover:bg-[#f6faf3]">
                      <div className="relative shrink-0">
                        {d.fotos[0] ? <img src={d.fotos[0]} alt="" className="h-16 w-16 rounded-xl object-cover" /> : <div className="h-16 w-16 rounded-xl bg-[#eef3ea]" />}
                        {d.fotos.length > 1 && <span className="absolute -bottom-1 -right-1 rounded-full bg-[#1f5a35] text-white text-[10px] font-bold px-1.5 py-0.5">{d.fotos.length}</span>}
                      </div>
                      <div className="flex-1 min-w-0 py-0.5">
                        <p className="font-mono text-[12px] font-bold text-[#1f5a35]">{d.protocolo}</p>
                        <p className="text-[13px] text-[#17301f] truncate">{d.descricao}</p>
                        <p className="text-[11px] text-[#8a9a8c] mt-0.5">{fmtData(d.criadaEm)} · <span className="text-[#8a5a00]">Recebida</span></p>
                      </div>
                    </button>
                  ))}
                  <p className="text-[11px] text-center text-[#8a9a8c] mt-1 flex items-center justify-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Guardadas só neste aparelho</p>
                </>
              )}
            </div>
          )}
        </main>

        <footer className="px-5 py-4 border-t border-[#edf2eb] text-center text-[11px] text-[#7d9080] leading-snug">
          Projeto idealizado por alunos da comunidade <b className="text-[#3d5341]">Bridão Brasileiro</b>
        </footer>
      </div>

      {/* Detalhe da denúncia */}
      {aberta && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setAberta(null)}>
          <div className="w-full max-w-[440px] bg-[#fbfcf8] rounded-t-[1.8rem] sm:rounded-[1.8rem] overflow-hidden max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              {aberta.fotos[fotoAmpliada] && <img src={aberta.fotos[fotoAmpliada]} alt="Foto do local" className="w-full h-56 object-cover" />}
              <button type="button" onClick={() => setAberta(null)} aria-label="Fechar" className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 grid place-items-center"><X className="h-4 w-4" /></button>
            </div>
            {aberta.fotos.length > 1 && (
              <div className="flex gap-2 px-5 pt-3">
                {aberta.fotos.map((f, i) => (
                  <button key={i} type="button" onClick={() => setFotoAmpliada(i)} className={cn('h-14 w-14 rounded-xl overflow-hidden border-2', i === fotoAmpliada ? 'border-[#3f8f4a]' : 'border-transparent opacity-70')}>
                    <img src={f} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="p-5 space-y-3">
              <p className="font-mono text-[15px] font-bold text-[#1f5a35]">{aberta.protocolo}</p>
              <p className="text-[12px] text-[#6b8270]">{ROTULO_TIPO[aberta.tipo]} · {fmtData(aberta.criadaEm)}</p>
              <p className="text-[14px] text-[#17301f] whitespace-pre-wrap">{aberta.descricao}</p>
              {coordenadaValida(aberta.latitude, aberta.longitude) && <MapaComLink lat={aberta.latitude!} lng={aberta.longitude!} />}
              {aberta.endereco && <p className="text-[13px] text-[#3d5341]"><MapPin className="inline h-3.5 w-3.5 -mt-0.5 text-[#e4572e]" /> {aberta.endereco}</p>}
              <button type="button" onClick={() => apagar(aberta.id)} className="w-full h-11 rounded-xl text-red-700 bg-red-50 text-[13px] font-semibold flex items-center justify-center gap-1.5">
                <Trash2 className="h-4 w-4" /> Apagar deste aparelho
              </button>
            </div>
          </div>
        </div>
      )}

      <EscolherNoMapaDialog
        open={mapaAberto}
        onOpenChange={setMapaAberto}
        inicial={temLocal ? { lat: r.latitude!, lng: r.longitude! } : (leituraUtil(gps.leitura) ? { lat: gps.leitura.latitude, lng: gps.leitura.longitude } : null)}
        onConfirm={(p) => { setR((x) => ({ ...x, latitude: p.lat, longitude: p.lng, precisaoM: null, origemLocal: 'mapa' })); setNota(null); }}
      />
    </div>
  );
}
