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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SEND_AT = process.env.SEND_AT || '07:00';               // HH:MM (24h)
const TIMEZONE = process.env.TIMEZONE || 'America/Cuiaba';
const RECIPIENTS_FILE = process.env.RECIPIENTS_FILE || path.join(__dirname, 'recipients.json');

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
    .select('id, status, scheduled_date, appointment_date, operator_id, producers(name), demand_types(name)')
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

function formatGroup(g) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  let m = `🌾 *Atendimentos — ${g.name}*\n_${hoje}_\n`;
  m += `\n🟣 *Próximos (${g.proximos.length})*\n`;
  m += g.proximos.length
    ? g.proximos.map((it, i) => `${i + 1}. ${it.producer} — ${it.demand}${it.appt ? ` 📅 ${fmtDate(it.appt)}` : ''}`).join('\n')
    : '— nenhum —';
  m += `\n\n🔵 *Em execução (${g.exec.length})*\n`;
  m += g.exec.length
    ? g.exec.map((it) => `• ${it.producer} — ${it.demand}`).join('\n')
    : '— nenhum —';
  return m;
}

function formatAll(groups) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  let m = `🌾 *Resumo de atendimentos — ${hoje}*`;
  const ordered = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  for (const g of ordered) {
    if (g.proximos.length === 0 && g.exec.length === 0) continue;
    m += `\n\n*${g.name}*  🟣 ${g.proximos.length} · 🔵 ${g.exec.length}`;
    g.proximos.forEach((it, i) => { m += `\n  ${i + 1}. ${it.producer} — ${it.demand}${it.appt ? ` 📅 ${fmtDate(it.appt)}` : ''}`; });
    g.exec.forEach((it) => { m += `\n  ▶ ${it.producer} — ${it.demand}`; });
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

  for (const r of recipients) {
    if (!r.phone) continue;
    let text;
    if (r.all) {
      text = formatAll(groups);
    } else {
      const g = findByName(r.match || r.name);
      text = g ? formatGroup(g) : `🌾 Sem atendimentos em aberto para *${r.match || r.name || 'você'}* hoje.`;
    }
    try {
      await sock.sendMessage(jidFromPhone(r.phone), { text });
      console.log(`[ok] ${r.match || r.name || r.phone}`);
    } catch (e) {
      console.error(`[erro] ${r.phone}: ${e.message}`);
    }
    await new Promise((res) => setTimeout(res, 2500)); // pausa entre envios
  }
}

// ── Conexão WhatsApp (com reconexão) ────────────────────────────────────────
let sock = null;
let ready = false;

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }) });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) {
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

async function main() {
  await connect();

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
