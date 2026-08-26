// Renderiza a relação de atendimentos de um operador como imagem (PNG).
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const GREEN = '#2D5A27';
const BLUE = '#2563EB';
const PURPLE = '#7C3AED';
const DARK = '#1E1E1E';
const MUTED = '#6E6E6E';
const LINE = '#E2E8E2';
const ZEBRA = '#F5FAF5';

let _logo; // cache: undefined = não tentou, false = sem logo, Image = ok
async function getLogo() {
  if (_logo !== undefined) return _logo;
  try {
    const p = path.join(__dirname, '..', 'src', 'assets', 'logo-transparent.png');
    _logo = fs.existsSync(p) ? await loadImage(p) : false;
  } catch { _logo = false; }
  return _logo;
}

const fmtDate = (raw) => {
  if (!raw) return '';
  let s = String(raw).replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T12:00:00'; // evita deslocar o dia por fuso
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
};
const hStr = (h) => `${(Number(h) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
const fmtPhone = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('55') && d.length > 11) d = d.slice(2); // tira DDI
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(raw);
};

function ellipsize(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

async function renderGroupImage(g) {
  const W = 760;
  const pad = 28;
  const headerH = 100;
  const rowH = 48;
  const secTitleH = 40;
  const execN = Math.max(1, g.exec.length);
  const proxN = Math.max(1, g.proximos.length);
  const bodyH = secTitleH + execN * rowH + 16 + secTitleH + proxN * rowH + 16;
  const footerH = 44;
  const H = headerH + 12 + bodyH + footerH;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // ── Cabeçalho verde ──
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, headerH);
  let textX = pad;
  const logo = await getLogo();
  if (logo) {
    const lw = 70;
    const lh = lw * (logo.height / logo.width);
    ctx.drawImage(logo, pad, (headerH - lh) / 2, lw, lh);
    textX = pad + lw + 16;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 23px Arial';
  ctx.fillText(ellipsize(ctx, `Atendimentos — ${g.name}`, W - textX - pad), textX, 44);
  ctx.font = '15px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`Secretaria Municipal de Agricultura · ${new Date().toLocaleDateString('pt-BR')}`, textX, 70);

  // ── Seções ──
  let y = headerH + 12 + 26; // baseline da 1ª linha de título
  const drawSection = (title, color, items, isProx) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pad + 6, y - 6, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DARK;
    ctx.font = 'bold 17px Arial';
    ctx.fillText(`${title} (${items.length})`, pad + 22, y);
    y += secTitleH - 12;

    if (items.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = '15px Arial';
      ctx.fillText('— nenhum —', pad + 22, y);
      y += rowH;
    } else {
      items.forEach((it, i) => {
        if (i % 2 === 1) {
          ctx.fillStyle = ZEBRA;
          ctx.fillRect(pad, y - 19, W - 2 * pad, rowH);
        }
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pad + 8, y - 5, 4, 0, Math.PI * 2);
        ctx.fill();
        // horas à direita
        ctx.textAlign = 'right';
        ctx.fillStyle = color;
        ctx.font = 'bold 15px Arial';
        ctx.fillText(hStr(it.hours), W - pad, y);
        ctx.textAlign = 'left';
        // produtor — tipo (à esquerda, truncado)
        ctx.fillStyle = DARK;
        ctx.font = '15px Arial';
        let line = `${it.producer} — ${it.demand}`;
        if (isProx && it.appt) line += `  (${fmtDate(it.appt)})`;
        ctx.fillText(ellipsize(ctx, line, W - 2 * pad - 90), pad + 22, y);
        // telefone do produtor (linha secundária)
        const tel = fmtPhone(it.phone);
        ctx.fillStyle = MUTED;
        ctx.font = '13px Arial';
        ctx.fillText(tel ? `Tel: ${tel}` : 'sem contato', pad + 22, y + 18);
        y += rowH;
      });
    }
    y += 16;
  };

  drawSection('Em execução', BLUE, g.exec, false);
  drawSection('Próximos', PURPLE, g.proximos, true);

  // ── Rodapé / legenda ──
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, H - footerH + 8);
  ctx.lineTo(W - pad, H - footerH + 8);
  ctx.stroke();
  const fy = H - 16;
  ctx.fillStyle = BLUE;
  ctx.beginPath(); ctx.arc(pad + 6, fy - 5, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MUTED; ctx.font = '13px Arial';
  ctx.fillText('Em execução', pad + 18, fy);
  const off = pad + 18 + ctx.measureText('Em execução').width + 24;
  ctx.fillStyle = PURPLE;
  ctx.beginPath(); ctx.arc(off, fy - 5, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.fillText('Próximos', off + 12, fy);

  return canvas.toBuffer('image/png');
}

module.exports = { renderGroupImage };
