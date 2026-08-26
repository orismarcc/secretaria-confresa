// Helper de pareamento: conecta ao WhatsApp e salva o QR como imagem (qr.png).
// Reconecta em "restart required" (515) e encerra ao conectar (auth/ salvo).
const path = require('path');
const P = require('pino');
const QRCode = require('qrcode');
const {
  default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason,
} = require('@whiskeysockets/baileys');

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: P({ level: 'silent' }) });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (u) => {
    const { connection, qr, lastDisconnect } = u;
    if (qr) {
      await QRCode.toFile(path.join(__dirname, 'qr.png'), qr, { width: 420, margin: 2 });
      console.log('QR_SAVED ' + new Date().toISOString());
    }
    if (connection === 'open') {
      console.log('CONNECTED');
      setTimeout(() => process.exit(0), 2500);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('CLOSED code=' + code);
      if (code === DisconnectReason.loggedOut) { console.log('LOGGED_OUT'); process.exit(3); }
      setTimeout(start, 1500); // 515 restartRequired / timeouts -> reconecta
    }
  });
}
start();
