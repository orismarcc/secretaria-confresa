// Teste de ponta a ponta (robô de navegador) — roda SÓ no CI, contra o
// Supabase TEMPORÁRIO com dados fictícios (e2e/dados-ficticios.sql).
//
// Fluxo: admin entra e vê Atendimentos e Produtores; operador entra, inicia e
// finaliza o atendimento (GPS simulado). A conferência no banco é feita pelo
// próprio workflow depois deste script.
import { chromium } from 'playwright';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
const SENHA = process.env.E2E_SENHA;
const PRODUTOR = 'Produtor Ficticio E2E';
const GPS = { latitude: -10.61, longitude: -51.61 };

let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) falhas++; };

async function entrar(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

const browser = await chromium.launch();
try {
  // ─── Administrador ───────────────────────────────────────────────────────
  const adm = await browser.newContext();
  const pa = await adm.newPage();
  pa.on('pageerror', (e) => console.log('  [erro na página admin]', e.message));
  await entrar(pa, 'admin.e2e@teste.local');
  ok(true, 'admin entrou no sistema');

  await pa.goto(`${BASE}/services`);
  await pa.getByText(PRODUTOR).first().waitFor({ timeout: 30000 }).catch(() => {});
  ok(await pa.getByText(PRODUTOR).first().isVisible(), 'Atendimentos: lista mostra o atendimento fictício');

  await pa.goto(`${BASE}/producers`);
  await pa.getByText(PRODUTOR).first().waitFor({ timeout: 30000 }).catch(() => {});
  ok(await pa.getByText(PRODUTOR).first().isVisible(), 'Produtores: lista mostra o produtor fictício');
  await adm.close();

  // ─── Operador (celular, com GPS) ─────────────────────────────────────────
  const opc = await browser.newContext({
    geolocation: GPS, permissions: ['geolocation'],
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  const po = await opc.newPage();
  po.on('pageerror', (e) => console.log('  [erro na página operador]', e.message));
  await entrar(po, 'operador.e2e@teste.local');
  await po.waitForURL((u) => u.pathname.startsWith('/operator'), { timeout: 30000 }).catch(() => {});
  ok(po.url().includes('/operator'), 'operador cai direto na tela do operador');

  await po.getByText(PRODUTOR).first().waitFor({ timeout: 30000 }).catch(() => {});
  ok(await po.getByText(PRODUTOR).first().isVisible(), 'operador vê o atendimento pendente');

  await po.getByRole('button', { name: 'Iniciar' }).first().click();
  await po.getByRole('button', { name: 'Finalizar' }).first().waitFor({ timeout: 30000 });
  ok(true, 'operador iniciou (botão Finalizar liberado)');

  await po.getByRole('button', { name: 'Finalizar' }).first().click();
  const dialogo = po.getByRole('dialog');
  await dialogo.getByText('Finalizar Atendimento').waitFor({ timeout: 15000 });
  await dialogo.getByRole('button', { name: 'Finalizar' }).click();
  // Aguarda a sincronização da fila (o atendimento some da lista de pendentes).
  await po.getByText(PRODUTOR).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await po.waitForTimeout(3000);
  ok(!(await po.getByText(PRODUTOR).first().isVisible().catch(() => false)), 'operador finalizou (saiu dos pendentes)');
  await opc.close();
} catch (e) {
  falhas++;
  console.log('✗ erro inesperado:', e.message);
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nFluxo principal OK');
process.exit(falhas ? 1 : 0);
