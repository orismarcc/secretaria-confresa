// EcoAção — DEMONSTRAÇÃO pública (sem login) de denúncia de descarte irregular
// de lixo. Projeto idealizado por alunos da comunidade Bridão Brasileiro.
// Reaproveita a lógica dos atendimentos dos operadores: foto + GPS de alta
// precisão na hora da foto, GPS gravado na foto (galeria) e "Procurar no mapa".
// Nada é enviado ao banco do sistema: as denúncias ficam só neste aparelho.
import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Camera, ImagePlus, MapPin, Trash2, ArrowLeft, ArrowRight, Check, Leaf, Loader2,
  ClipboardList, Info, LocateFixed, Pencil, RotateCcw, ShieldCheck, Smartphone, X,
} from 'lucide-react';
import { EscolherNoMapaDialog } from '@/components/mapa/EscolherNoMapaDialog';
import { adicionarCamadaBase } from '@/lib/mapa/camadaBase';
import { lerExifFoto } from '@/lib/exifFoto';
import { cn } from '@/lib/utils';
import {
  type Denuncia, ROTULO_TIPO, ROTULO_ORIGEM, LIMITE_DESCRICAO,
  gerarProtocolo, pendencias, coordenadaValida, salvarDenuncia, listarDenuncias, apagarDenuncia,
  reduzirFoto, lerGpsDenuncia, alternarSugestao,
} from '@/lib/ecoacao';

type Tela = 'inicio' | 'tipo' | 'foto' | 'descricao' | 'revisao' | 'enviado' | 'lista';
const PASSOS: { tela: Tela; rotulo: string }[] = [
  { tela: 'tipo', rotulo: 'Tipo' },
  { tela: 'foto', rotulo: 'Foto e local' },
  { tela: 'descricao', rotulo: 'Descrição' },
  { tela: 'revisao', rotulo: 'Enviar' },
];
const SUGESTOES = ['Entulho de obra', 'Lixo doméstico', 'Pneus', 'Móveis velhos', 'Galhos e podas', 'Perto de rio ou córrego', 'Mau cheiro', 'Lixo queimado'];

type Rascunho = Omit<Denuncia, 'id' | 'protocolo' | 'criadaEm'>;
const RASCUNHO_VAZIO: Rascunho = {
  tipo: 'descarte_lixo', fotoDataUrl: '', latitude: null, longitude: null, precisaoM: null,
  origemLocal: null, endereco: '', descricao: '',
};

const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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

// ── Página ───────────────────────────────────────────────────────────────────
export default function EcoAcaoPage() {
  const [tela, setTela] = useState<Tela>('inicio');
  const [r, setR] = useState<Rascunho>(RASCUNHO_VAZIO);
  const [nota, setNota] = useState<string | null>(null);
  const [processando, setProcessando] = useState<'foto' | 'gps' | null>(null);
  const [mapaAberto, setMapaAberto] = useState(false);
  const [lista, setLista] = useState<Denuncia[]>(() => listarDenuncias());
  const [enviada, setEnviada] = useState<Denuncia | null>(null);
  const [aberta, setAberta] = useState<Denuncia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const topoRef = useRef<HTMLDivElement>(null);

  useEffect(() => { document.title = 'EcoAção — Denúncia ambiental'; }, []);
  useEffect(() => { topoRef.current?.scrollIntoView({ block: 'start' }); }, [tela]);

  const temLocal = coordenadaValida(r.latitude, r.longitude);
  const falta = useMemo(() => pendencias(r), [r]);

  const novaDenuncia = () => { setR(RASCUNHO_VAZIO); setNota(null); setErro(null); setTela('tipo'); };

  async function aoEscolherFoto(arquivo: File | undefined, origem: 'camera' | 'galeria') {
    if (!arquivo) return;
    if (!/^image\//.test(arquivo.type)) { setErro('Escolha um arquivo de imagem (foto).'); return; }
    setErro(null);
    setProcessando('foto');
    // Câmera: lê o GPS AGORA, junto com a foto (como no atendimento do operador).
    const gpsAgora = origem === 'camera' ? lerGpsDenuncia() : null;
    try {
      const [dataUrl, exif] = await Promise.all([reduzirFoto(arquivo), origem === 'galeria' ? lerExifFoto(arquivo) : Promise.resolve(null)]);
      setR((x) => ({ ...x, fotoDataUrl: dataUrl }));
      setProcessando('gps');
      if (origem === 'galeria' && exif && coordenadaValida(exif.latitude, exif.longitude)) {
        setR((x) => ({ ...x, latitude: exif.latitude, longitude: exif.longitude, precisaoM: null, origemLocal: 'foto' }));
        setNota('Localização gravada na própria foto.');
        return;
      }
      const leitura = await (gpsAgora ?? lerGpsDenuncia());
      if (leitura) {
        setR((x) => ({ ...x, latitude: leitura.latitude, longitude: leitura.longitude, precisaoM: leitura.precisaoM, origemLocal: 'gps' }));
        setNota(origem === 'galeria'
          ? 'A foto não trazia localização: usamos a sua posição atual. Se a foto foi tirada em outro lugar, ajuste no mapa.'
          : null);
      } else {
        setNota('Não conseguimos a localização automática. Marque no mapa ou escreva o endereço abaixo.');
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível usar esta foto.');
    } finally {
      setProcessando(null);
    }
  }

  async function tentarGpsDeNovo() {
    setProcessando('gps');
    const leitura = await lerGpsDenuncia();
    setProcessando(null);
    if (leitura) {
      setR((x) => ({ ...x, latitude: leitura.latitude, longitude: leitura.longitude, precisaoM: leitura.precisaoM, origemLocal: 'gps' }));
      setNota(null);
    } else {
      setNota('O GPS não respondeu. Verifique se a localização do celular está ligada e permitida para o navegador — ou marque no mapa.');
    }
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
            <div className="h-10 w-10 -ml-1 rounded-2xl bg-[#1f5a35] grid place-items-center"><Leaf className="h-5 w-5 text-[#b8e07a]" /></div>
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
                <svg className="absolute -right-10 -top-10 h-48 w-48 opacity-20" viewBox="0 0 200 200" aria-hidden>
                  <path d="M100 10c50 20 80 60 70 110-8 40-45 65-80 65C55 185 25 150 30 110 37 60 70 25 100 10z" fill="#b8e07a" />
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
                    ['Tire a foto', 'A localização é registrada sozinha. Dá para ajustar no mapa ou escrever o endereço.'],
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
                onClick={() => { setR((x) => ({ ...x, tipo: 'descarte_lixo' })); setTela('foto'); }}
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

          {/* ── 2. FOTO E LOCAL ── */}
          {tela === 'foto' && (
            <div className="flex flex-col gap-4 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Fotografe o local</h2>

              <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { aoEscolherFoto(e.target.files?.[0], 'camera'); e.target.value = ''; }} />
              <input ref={galRef} type="file" accept="image/*" className="hidden" onChange={(e) => { aoEscolherFoto(e.target.files?.[0], 'galeria'); e.target.value = ''; }} />

              {!r.fotoDataUrl ? (
                <>
                  <button type="button" onClick={() => camRef.current?.click()} disabled={!!processando}
                    className="rounded-[1.6rem] border-2 border-dashed border-[#9cc79a] bg-[#f3f9ef] h-56 flex flex-col items-center justify-center gap-3 text-[#1f5a35] hover:bg-[#eaf5e4]">
                    {processando ? <Loader2 className="h-10 w-10 animate-spin" /> : <span className="h-16 w-16 rounded-full bg-[#1f5a35] grid place-items-center"><Camera className="h-8 w-8 text-white" /></span>}
                    <span className="font-bold text-[15px]">{processando ? 'Preparando a foto…' : 'Tirar foto agora'}</span>
                    <span className="text-[12px] text-[#5d7a61]">A localização é registrada junto</span>
                  </button>
                  <button type="button" onClick={() => galRef.current?.click()} disabled={!!processando} className="h-12 rounded-2xl border-2 border-[#cfe0cf] text-[#1f5a35] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#f1f6ee]">
                    <ImagePlus className="h-4 w-4" /> Escolher da galeria
                  </button>
                  <Dica>Mostre bem o lixo e, se der, algo que ajude a reconhecer o lugar (uma placa, uma casa, uma árvore).</Dica>
                </>
              ) : (
                <>
                  <div className="relative">
                    <img src={r.fotoDataUrl} alt="Foto do local" className="w-full max-h-72 object-cover rounded-[1.6rem]" />
                    <button type="button" onClick={() => camRef.current?.click()} className="absolute bottom-3 right-3 rounded-full bg-white/95 text-[#1f5a35] text-xs font-semibold px-3 py-2 flex items-center gap-1.5 shadow">
                      <RotateCcw className="h-3.5 w-3.5" /> Trocar foto
                    </button>
                  </div>

                  <section className="rounded-[1.6rem] border border-[#dce7d9] bg-white p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#e4572e]" />
                      <p className="font-bold text-[14px] text-[#17301f] flex-1">Localização</p>
                      {processando === 'gps' && <span className="text-[12px] text-[#5d7a61] flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Localizando…</span>}
                    </div>
                    {temLocal ? (
                      <>
                        <MiniMapa lat={r.latitude!} lng={r.longitude!} />
                        <p className="text-[12px] text-[#5d6f60]">
                          <Check className="inline h-3.5 w-3.5 text-[#3f8f4a] -mt-0.5" /> {r.origemLocal ? ROTULO_ORIGEM[r.origemLocal] : 'Ponto'}
                          {r.precisaoM != null ? ` · precisão de ${Math.round(r.precisaoM)} m` : ''}
                        </p>
                      </>
                    ) : processando !== 'gps' && (
                      <p className="text-[13px] text-[#5d6f60]">Ainda sem localização.</p>
                    )}
                    {nota && <p className="text-[12px] text-[#8a5a00] bg-[#fff6e3] rounded-xl px-3 py-2">{nota}</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => setMapaAberto(true)} className="h-10 rounded-xl bg-[#eef6e9] text-[#1f5a35] text-[13px] font-semibold flex items-center justify-center gap-1.5">
                        <Pencil className="h-3.5 w-3.5" /> {temLocal ? 'Ajustar no mapa' : 'Marcar no mapa'}
                      </button>
                      <button type="button" onClick={tentarGpsDeNovo} disabled={processando === 'gps'} className="h-10 rounded-xl bg-[#eef6e9] text-[#1f5a35] text-[13px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
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
                <BotaoPrincipal onClick={() => setTela('descricao')} disabled={!r.fotoDataUrl || (!temLocal && r.endereco.trim().length < 5) || processando === 'foto'}>
                  Continuar <ArrowRight className="h-5 w-5" />
                </BotaoPrincipal>
                {r.fotoDataUrl && !temLocal && r.endereco.trim().length < 5 && processando !== 'gps' && (
                  <p className="text-center text-[12px] text-[#8a9a8c] mt-2">Marque no mapa ou escreva o endereço para continuar.</p>
                )}
              </div>
            </div>
          )}

          {/* ── 3. DESCRIÇÃO ── */}
          {tela === 'descricao' && (
            <div className="flex flex-col gap-4 flex-1">
              <h2 className="text-[22px] font-extrabold tracking-tight text-[#17301f] leading-tight">Conte o que você viu</h2>
              <div>
                <p className="text-[12px] font-semibold text-[#3d5341] mb-2">Toque para adicionar:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => {
                    const ja = r.descricao.toLowerCase().includes(s.toLowerCase());
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
                {r.fotoDataUrl && <img src={r.fotoDataUrl} alt="Foto do local" className="w-full h-44 object-cover" />}
                <dl className="divide-y divide-[#edf2eb] text-[14px]">
                  {[
                    ['Tipo', ROTULO_TIPO[r.tipo], 'tipo'],
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
                    <button key={d.id} type="button" onClick={() => setAberta(d)} className="text-left rounded-2xl border border-[#dce7d9] bg-white p-2.5 flex gap-3 hover:bg-[#f6faf3]">
                      <img src={d.fotoDataUrl} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
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
              <img src={aberta.fotoDataUrl} alt="Foto do local" className="w-full h-56 object-cover" />
              <button type="button" onClick={() => setAberta(null)} aria-label="Fechar" className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 grid place-items-center"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="font-mono text-[15px] font-bold text-[#1f5a35]">{aberta.protocolo}</p>
              <p className="text-[12px] text-[#6b8270]">{ROTULO_TIPO[aberta.tipo]} · {fmtData(aberta.criadaEm)}</p>
              <p className="text-[14px] text-[#17301f] whitespace-pre-wrap">{aberta.descricao}</p>
              {coordenadaValida(aberta.latitude, aberta.longitude) && <MiniMapa lat={aberta.latitude!} lng={aberta.longitude!} />}
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
        inicial={temLocal ? { lat: r.latitude!, lng: r.longitude! } : null}
        onConfirm={(p) => { setR((x) => ({ ...x, latitude: p.lat, longitude: p.lng, precisaoM: null, origemLocal: 'mapa' })); setNota(null); }}
      />
    </div>
  );
}
