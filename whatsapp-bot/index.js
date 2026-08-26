// ============================================================================
// Bot de WhatsApp (NÃO OFICIAL — Baileys) para envio diário do resumo de
// atendimentos do Dashboard (Próximos + Em Execução), organizado por operador.
//
// Conecta como "aparelho vinculado" do WhatsApp (igual WhatsApp Web), mantém a
// sessão viva e, no horário definido (SEND_AT), envia a cada colaborador do
// recipients.json a sua parte. Rode num computador que fique sempre ligado.
//
// ⚠️ Uso não oficial: baixo volume reduz o risco, mas o número pode ser
//    bloqueado pelo WhatsApp. Use um número dedicado da secretaria.
// ============================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { renderGroupImage } = require('./imageRender');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEND_AT = process.env.SEND_AT || '07:00';               // HH:MM (24h)
const TIMEZONE = process.env.TIMEZONE || 'America/Cuiaba';
const RECIPIENTS_FILE = process.env.RECIPIENTS_FILE || path.join(__dirname, 'recipients.json');
// Número da secretaria (só dígitos: 55 DDD número) para parear por CÓDIGO em vez de QR.
const PAIR_PHONE = process.env.PAIR_PHONE || '';
// Modo "enviar uma vez": conecta, envia o resumo e encerra (para testes/manual).
const ONCE = process.argv.includes('--once') || process.env.RUN_MODE === 'once';
// Modo "diário inteligente": garante 1 envio por dia — às SEND_AT (fuso TIMEZONE)
// se o PC já estiver ligado, ou no 1º acesso depois desse horário. Não repete.
const DAILY = process.argv.includes('--daily') || process.env.RUN_MODE === 'daily';
const STATE_FILE = path.join(__dirname, 'state.json');

function readState() { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function writeState(s) { try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch (e) { console.error('Não gravei state.json:', e.message); } }
function nowInTZ(tz) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const g = (t) => p.find((x) => x.type === t).value;
  const hh = Number(g('hour')) % 24;
  return { date: `${g('year')}-${g('month')}-${g('day')}`, hh, mm: Number(g('minute')) };
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const jidFromPhone = (phone) => `${onlyDigits(phone)}@s.whatsapp.net`;
const fmtDate = (raw) => {
  if (!raw) return '';
  const d = new Date(String(raw).replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};

// ── Monta o resumo agrupado por operador ────────────────────────────────────
async function buildGroups() {
  const { data: services, error } = await supabase
    .from('services')
    .select('id, status, scheduled_date, appointment_date, operator_id, worked_hours, producers(name), demand_types(name)')
    .in('status', ['proximo', 'in_progress']);
  if (error) throw error;

  const { data: profiles } = await supabase.from('profiles').select('id, name');
  const opName = new Map((profiles || []).map((p) => [p.id, p.name]));

  const groups = new Map(); // key -> { name, proximos:[], exec:[] }
  for (const s of services || []) {
    const key = s.operator_id || '__none__';
    const name = s.operator_id ? (opName.get(s.operator_id) || 'Operador') : 'Sem operador';
    if (!groups.has(key)) groups.set(key, { name, proximos: [], exec: [] });
    const item = {
      producer: s.producers?.name || 'N/A',
      demand: s.demand_types?.name || '',
      appt: s.appointment_date,
      sched: s.scheduled_date,
      hours: Number(s.worked_hours) || 0,
    };
    (s.status === 'proximo' ? groups.get(key).proximos : groups.get(key).exec).push(item);
  }
  // Próximos: agendados (appointment_date) primeiro por data; demais por data agendada.
  for (const g of groups.values()) {
    g.proximos.sort((a, b) => {
      const ta = a.appt ? +new Date(String(a.appt).replace(' ', 'T')) : Infinity;
      const tb = b.appt ? +new Date(String(b.appt).replace(' ', 'T')) : Infinity;
      if (ta !== tb) return ta - tb;
      return +new Date(a.sched + 'T12:00:00') - +new Date(b.sched + 'T12:00:00');
    });
  }
  return groups;
}

const hLine = (h) => `${(Number(h) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
const LEGENDA = '_Legenda: 🔵 em execução · 🟣 próximos_';

function formatGroup(g) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  let m = `🌾 *Atendimentos — ${g.name}*\n_${hoje}_\n`;
  m += `\n🔵 *Em execução (${g.exec.length})*\n`;
  m += g.exec.length
    ? g.exec.map((it) => `🔵 ${it.producer} — ${it.demand} · ⏱️ ${hLine(it.hours)}`).join('\n')
    : '— nenhum —';
  m += `\n\n🟣 *Próximos (${g.proximos.length})*\n`;
  m += g.proximos.length
    ? g.proximos.map((it) => `🟣 ${it.producer} — ${it.demand}${it.appt ? ` 📅 ${fmtDate(it.appt)}` : ''} · ⏱️ ${hLine(it.hours)}`).join('\n')
    : '— nenhum —';
  m += `\n\n${LEGENDA}`;
  return m;
}

function formatAll(groups) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  let m = `🌾 *Resumo de atendimentos — ${hoje}*\n${LEGENDA}`;
  const ordered = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const g of ordered) {
    if (g.proximos.length === 0 && g.exec.length === 0) continue;
    m += `\n\n*${g.name}*  🔵 ${g.exec.length} · 🟣 ${g.proximos.length}`;
    g.exec.forEach((it) => { m += `\n  🔵 ${it.producer} — ${it.demand} · ⏱️ ${hLine(it.hours)}`; });
    g.proximos.forEach((it) => { m += `\n  🟣 ${it.producer} — ${it.demand}${it.appt ? ` 📅 ${fmtDate(it.appt)}` : ''} · ⏱️ ${hLine(it.hours)}`; });
  }
  return m;
}

// ── Envio diário ────────────────────────────────────────────────────────────
async function sendDaily(sock) {
  let recipients;
  try {
    recipients = JSON.parse(fs.readFileSync(RECIPIENTS_FILE, 'utf8'));
  } catch (e) {
    console.error('Não consegui ler recipients.json:', e.message);
    return;
  }
  const groups = await buildGroups();
  const findByName = (needle) => {
    const n = String(needle || '').toLowerCase();
    for (const g of groups.values()) if (g.name.toLowerCase().includes(n)) return g;
    return null;
  };

  const ordered = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  for (const r of recipients) {
    if (!r.phone) continue;

    // Resolve o JID real no WhatsApp (trata o "9" extra dos celulares BR).
    let jid = jidFromPhone(r.phone);
    try {
      const found = await sock.onWhatsApp(onlyDigits(r.phone));
      if (found && found[0] && found[0].exists) {
        jid = found[0].jid;
      } else {
        console.error(`[erro] ${r.phone}: número não encontrado no WhatsApp`);
        continue;
      }
    } catch (e) {
      console.error(`[aviso] não resolvi ${r.phone} (${e.message}); tentando assim mesmo.`);
    }

    // Quais operadores enviar: all => todos com conteúdo; senão => o operador do destinatário.
    let toSend;
    if (r.all) {
      toSend = ordered.filter((g) => g.exec.length || g.proximos.length);
    } else {
      const g = findByName(r.match || r.name);
      toSend = [g || { name: r.match || r.name || 'Operador', exec: [], proximos: [] }];
    }

    for (const g of toSend) {
      try {
        const img = await renderGroupImage(g);
        await sock.sendMessage(jid, { image: img });
        console.log(`[ok] ${r.match || r.name || r.phone} <- ${g.name} (${jid})`);
      } catch (e) {
        console.error(`[erro] imagem ${g.name} -> ${r.phone}: ${e.message}`);
      }
      await new Promise((res) => setTimeout(res, 2500)); // pausa entre envios
    }
  }
}

// ── Conexão WhatsApp (com reconexão) ────────────────────────────────────────
let sock = null;
let ready = false;

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }) });

  // Pareamento por CÓDIGO (opcional): se PAIR_PHONE estiver definido e ainda não
  // houver sessão, gera um código de 8 dígitos para digitar no celular.
  if (PAIR_PHONE && !sock.authState.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(onlyDigits(PAIR_PHONE));
        console.log(`\n🔑 Código de pareamento: ${code}`);
        console.log('   No WhatsApp da secretaria: Aparelhos conectados → Conectar aparelho →');
        console.log('   "Conectar com número de telefone" → digite este código.\n');
      } catch (e) {
        console.error('Falha ao gerar código de pareamento:', e.message);
      }
    }, 3000);
  }

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr && !PAIR_PHONE) {
      console.log('\n📲 Abra o WhatsApp no celular → Aparelhos conectados → Conectar aparelho e escaneie:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') { ready = true; console.log('✔ WhatsApp conectado.'); }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Conexão caiu, reconectando...');
        setTimeout(connect, 3000);
      } else {
        console.error('Sessão encerrada (loggedOut). Apague a pasta "auth/" e rode de novo para reconectar.');
      }
    }
  });
}

// Espera conectar, envia e encerra (usado pelos modos --once e --daily).
function sendOnceThenExit(onSent) {
  const started = Date.now();
  const t = setInterval(async () => {
    if (ready && sock) {
      clearInterval(t);
      console.log('Conectado. Enviando resumo...');
      await sendDaily(sock).catch((e) => console.error('Falha no envio:', e.message));
      if (onSent) onSent();
      console.log('Concluído. Encerrando.');
      setTimeout(() => process.exit(0), 1500);
    } else if (Date.now() - started > 180000) {
      clearInterval(t);
      console.error('Não conectou em 3 min. Se for a 1ª vez, faça o pareamento com "npm start".');
      process.exit(1);
    }
  }, 1000);
}

async function main() {
  await connect();

  // Modo diário inteligente: 1 envio por dia, às SEND_AT ou no 1º acesso depois.
  if (DAILY) {
    const today = nowInTZ(TIMEZONE).date;
    const state = readState();
    if (state.lastSent === today) {
      console.log(`Já enviei hoje (${today}). Nada a fazer.`);
      setTimeout(() => process.exit(0), 800);
      return;
    }
    const [sh, sm] = SEND_AT.split(':').map(Number);
    const sendMin = sh * 60 + sm;
    const now = nowInTZ(TIMEZONE);
    const nowMin = now.hh * 60 + now.mm;
    const fire = () => sendOnceThenExit(() => writeState({ lastSent: today }));
    if (nowMin >= sendMin) {
      console.log(`Agora são ${now.hh}:${String(now.mm).padStart(2, '0')} (${TIMEZONE}) — já passou de ${SEND_AT}; enviando ao conectar.`);
      fire();
    } else {
      const wait = sendMin - nowMin;
      console.log(`Aguardando até ${SEND_AT} (${TIMEZONE}) — ~${wait} min — para enviar...`);
      setTimeout(fire, wait * 60 * 1000);
    }
    return;
  }

  // Modo "uma vez": espera conectar, envia e encerra.
  if (ONCE) { sendOnceThenExit(); return; }

  const [hh, mm] = SEND_AT.split(':');
  cron.schedule(`${Number(mm)} ${Number(hh)} * * *`, () => {
    if (!ready || !sock) { console.warn('Ainda não conectado; pulando envio deste horário.'); return; }
    console.log(`\n[${new Date().toISOString()}] Enviando resumo diário...`);
    sendDaily(sock).catch((e) => console.error('Falha no envio:', e.message));
  }, { timezone: TIMEZONE });

  console.log(`Bot no ar. Envio diário às ${SEND_AT} (${TIMEZONE}).`);

  // Teste imediato: node index.js --now
  if (process.argv.includes('--now')) {
    const wait = setInterval(() => {
      if (ready && sock) { clearInterval(wait); sendDaily(sock).catch((e) => console.error(e.message)); }
    }, 1000);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
