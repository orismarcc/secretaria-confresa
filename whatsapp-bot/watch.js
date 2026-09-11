// ============================================================================
// watch.js — "Vigia" de finalizações.
//   A cada ~60s consulta o banco (usuário SÓ-LEITURA bot_readonly) por
//   atendimentos que viraram "finalizado" e ainda não foram avisados, e envia
//   uma mensagem por finalização (operador · serviço · produtor · horas) aos
//   números da recipients.json, via WhatsApp (Baileys — mesma sessão do bot).
//
//   Segurança: NÃO usa a chave mestra do Supabase. Usa só uma conexão Postgres
//   com o usuário bot_readonly (apenas SELECT em colunas específicas).
//
//   Uso no celular (Termux): node watch.js
// ============================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const { Client } = require('pg');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL no .env (conexão do usuário bot_readonly).');
  process.exit(1);
}
const POLL_MS = Number(process.env.POLL_MS || 60000);
// Não avisa finalizações mais antigas que isto ao ligar (evita "enxurrada" se o
// celular ficou horas desligado). 0 = sem limite. Padrão: 12 horas.
const MAX_AGE_HOURS = Number(process.env.MAX_AGE_HOURS || 12);
const RECIPIENTS_FILE = path.join(__dirname, 'recipients.json');
const STATE_FILE = path.join(__dirname, 'watch-state.json');

const onlyDigits = (s) => String(s || '').replace(/\D/g, '');
const jidFromPhone = (phone) => `${onlyDigits(phone)}@s.whatsapp.net`;
const hLine = (h) => `${(Number(h) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return null; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch (e) { console.error('state:', e.message); }
}

// ── Postgres (só-leitura) ────────────────────────────────────────────────────
const pg = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function fetchNewFinalizacoes(since) {
  const { rows } = await pg.query(
    `SELECT s.id, s.completed_at, s.worked_hours,
            p.name AS produtor, dt.name AS demanda, op.name AS operador
       FROM public.services s
       LEFT JOIN public.producers    p  ON p.id  = s.producer_id
       LEFT JOIN public.demand_types dt ON dt.id = s.demand_type_id
       LEFT JOIN public.profiles     op ON op.id = s.operator_id
      WHERE s.status = 'completed' AND s.completed_at > $1
      ORDER BY s.completed_at ASC
      LIMIT 200`,
    [since],
  );
  return rows;
}

function formatMsg(r) {
  return '🌾 *Atendimento finalizado*\n'
    + `👷 Operador: *${r.operador || '—'}*  ·  🔧 *${r.demanda || '—'}*\n`
    + `👨‍🌾 Produtor: *${r.produtor || 'N/A'}*  ·  ⏱️ *${hLine(r.worked_hours)}*`;
}

// ── WhatsApp (Baileys) ───────────────────────────────────────────────────────
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
      console.log('\n📲 WhatsApp → Aparelhos conectados → Conectar aparelho e escaneie:\n');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'open') { ready = true; console.log('✔ WhatsApp conectado.'); }
    if (connection === 'close') {
      ready = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code !== DisconnectReason.loggedOut) {
        console.log('Conexão caiu, reconectando…');
        setTimeout(connect, 3000);
      } else {
        console.error('Sessão encerrada (loggedOut). Apague a pasta "auth/" e pareie de novo.');
      }
    }
  });
}

async function sendToAll(text) {
  let recipients = [];
  try { recipients = JSON.parse(fs.readFileSync(RECIPIENTS_FILE, 'utf8')); } catch (e) { console.error('recipients:', e.message); return; }
  for (const r of recipients) {
    if (!r.phone) continue;
    let jid = jidFromPhone(r.phone);
    try {
      const found = await sock.onWhatsApp(onlyDigits(r.phone)); // trata o "9" extra dos BR
      if (found && found[0] && found[0].exists) jid = found[0].jid;
      else { console.error(`[erro] ${r.phone}: não encontrado no WhatsApp`); continue; }
    } catch (e) { console.error(`[aviso] ${r.phone}: ${e.message}`); }
    try { await sock.sendMessage(jid, { text }); console.log(`[ok] -> ${jid}`); }
    catch (e) { console.error(`[erro] ${r.phone}: ${e.message}`); }
    await new Promise((res) => setTimeout(res, 1500));
  }
}

// ── Loop de polling ──────────────────────────────────────────────────────────
let polling = false;
async function poll() {
  if (!ready || polling) return;
  polling = true;
  try {
    let state = readState();
    if (!state) {
      // 1º boot: marca "agora" como base — não dispara histórico.
      state = { lastSeen: new Date().toISOString(), notified: [] };
      writeState(state);
      console.log('Base inicial definida — só finalizações a partir de agora.');
      return;
    }
    const rows = await fetchNewFinalizacoes(state.lastSeen);
    if (rows.length === 0) return;

    const notified = new Set(state.notified || []);
    const cutoff = MAX_AGE_HOURS > 0 ? Date.now() - MAX_AGE_HOURS * 3600 * 1000 : 0;
    let maxSeen = state.lastSeen;

    for (const r of rows) {
      const ts = new Date(r.completed_at).getTime();
      if (ts > new Date(maxSeen).getTime()) maxSeen = new Date(r.completed_at).toISOString();
      if (notified.has(r.id)) continue;
      if (cutoff && ts < cutoff) { notified.add(r.id); continue; } // muito antigo → só marca
      await sendToAll(formatMsg(r));
      notified.add(r.id);
    }

    // Mantém a lista de "avisados" enxuta (últimos 500).
    const trimmed = Array.from(notified).slice(-500);
    writeState({ lastSeen: maxSeen, notified: trimmed });
  } catch (e) {
    console.error('poll:', e.message);
  } finally {
    polling = false;
  }
}

(async () => {
  await pg.connect();
  console.log('Postgres (só-leitura) conectado.');
  await connect();
  setInterval(poll, POLL_MS);
  console.log(`Vigia no ar. Checando finalizações a cada ${Math.round(POLL_MS / 1000)}s.`);
})().catch((e) => { console.error(e); process.exit(1); });
