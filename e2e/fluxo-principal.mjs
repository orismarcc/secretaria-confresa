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
// Imagem mínima válida (1x1 PNG) para as fotos da logística.
const FOTO = { name: 'foto.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') };

let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? '✓' : '✗'} ${msg}`); if (!c) falhas++; };

async function entrar(page, email) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
}

// Cartão (card) do atendimento de um produtor na tela do operador.
const cartao = (page, nome) => page.locator('.rounded-lg, [class*="card"]').filter({ hasText: nome })
  .filter({ has: page.getByRole('button') }).last();

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
  // Análises → Mapa da demanda: marcar a posição do assentamento com um clique.
  await pa.goto(`${BASE}/analytics`);
  await pa.getByText('Mapa da demanda').first().click();
  await pa.getByText('PA Ficticio E2E — marcar').first().waitFor({ timeout: 30000 }).catch(() => {});
  const marcar = pa.getByText('PA Ficticio E2E — marcar').first();
  ok(await marcar.isVisible().catch(() => false), 'Mapa da demanda: assentamento sem posição aparece para marcar');
  await marcar.click().catch(() => {});
  await pa.waitForTimeout(700);
  const mapa = pa.locator('.leaflet-container').first();
  await pa.locator('.leaflet-limites-municipio-pane path').first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
  ok((await pa.locator('.leaflet-limites-municipio-pane path').count()) >= 1, 'Mapa da demanda: limite do município (IBGE) desenhado');
  await mapa.scrollIntoViewIfNeeded();
  const box = await mapa.boundingBox();
  if (box) await mapa.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await pa.getByText('Posição do assentamento salva').first().waitFor({ timeout: 15000 }).catch(() => {});
  const avisos = await pa.locator('ol li').allInnerTexts().catch(() => []);
  console.log('  avisos após marcar:', JSON.stringify(avisos));
  ok(avisos.some((t) => t.includes('Posição do assentamento salva')), 'Mapa da demanda: clique no mapa salvou a posição');

  // ─── SEFAZ: Boleto GTA pela ficha + comprovante mensal (PDF) ─────────────
  await pa.goto(`${BASE}/sefaz`);
  await pa.getByText('PRODUTOR SEFAZ E2E').first().click();
  await pa.getByRole('button', { name: 'Adicionar Atendimento' }).click();
  const dlgS = pa.getByRole('dialog').filter({ hasText: 'Novo Atendimento SEFAZ' });
  await dlgS.waitFor({ timeout: 15000 });
  ok((await dlgS.getByText(/assinou a lista/i).count()) === 0, 'SEFAZ: formulário sem a marcação de assinatura');
  ok((await dlgS.locator('#s-type option', { hasText: 'Boleto GTA' }).count()) === 1, 'SEFAZ: tipo "Boleto GTA" disponível');
  await dlgS.locator('#s-type').selectOption('Boleto GTA');
  await dlgS.getByRole('button', { name: 'Registrar' }).click();
  await dlgS.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  // fecha a ficha do produtor (enquanto aberta, a página ao fundo fica inacessível)
  for (let i = 0; i < 3 && (await pa.getByRole('dialog').count()) > 0; i++) {
    await pa.keyboard.press('Escape');
    await pa.waitForTimeout(600);
  }
  await pa.getByRole('tab', { name: 'Atendimentos' }).click();
  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Cuiaba' });
  const rotuloMes = mesAtual.charAt(0).toUpperCase() + mesAtual.slice(1);
  await pa.getByText(rotuloMes).first().click();
  const [seletor] = await Promise.all([
    pa.waitForEvent('filechooser', { timeout: 15000 }),
    pa.getByRole('button', { name: /Anexar imagem ou PDF/ }).first().click(),
  ]);
  await seletor.setFiles({ name: 'folha-assinada.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste e2e %%EOF') });
  await pa.getByText('folha-assinada.pdf').first().waitFor({ timeout: 20000 }).catch(() => {});
  ok(await pa.getByText('folha-assinada.pdf').first().isVisible().catch(() => false), 'SEFAZ: comprovante PDF anexado ao mês');

  // ─── Entregas: anexar o termo de entrega que estava faltando ─────────────
  await pa.goto(`${BASE}/deliveries`);
  await pa.getByRole('tab', { name: /Realizadas/ }).click();
  await pa.getByText('Entrega Alevinos E2E').first().waitFor({ timeout: 30000 }).catch(() => {});
  ok(await pa.getByText('1 sem termo').first().isVisible().catch(() => false), 'Entregas: resumo aponta a entrega sem termo');
  await pa.getByText('Entrega Alevinos E2E').first().click();
  await pa.getByRole('button', { name: /Sem termo de entrega/ }).first().click();
  const dlgT = pa.getByRole('dialog').filter({ hasText: 'Termo de entrega' });
  await dlgT.waitFor({ timeout: 15000 });
  await dlgT.locator('input[type=file]').setInputFiles({ name: 'termo-e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 termo e2e %%EOF') });
  await dlgT.getByText('termo-e2e.pdf').first().waitFor({ timeout: 20000 }).catch(() => {});
  ok(await dlgT.getByText('termo-e2e.pdf').first().isVisible().catch(() => false), 'Entregas: termo (PDF) anexado à entrega do produtor');
  await pa.keyboard.press('Escape');
  await pa.getByRole('button', { name: /Termo de entrega anexado/ }).first().waitFor({ timeout: 15000 }).catch(() => {});
  ok(await pa.getByRole('button', { name: /Termo de entrega anexado/ }).first().isVisible().catch(() => false), 'Entregas: card mostra o termo anexado');
  await adm.close();

  // ─── Visitante sem login: painel público de transparência ────────────────
  const pub = await browser.newContext();
  const pp = await pub.newPage();
  let errosPublico = 0;
  pp.on('pageerror', (e) => { errosPublico++; console.log('  [erro na página pública]', e.message); });
  await pp.goto(`${BASE}/transparencia`);
  await pp.getByText('Atendimentos realizados').first().waitFor({ timeout: 30000 }).catch(() => {});
  ok(await pp.getByText('Atendimentos realizados').first().isVisible().catch(() => false), 'Transparência abre SEM login');
  ok(!pp.url().includes('/login'), 'Transparência não redireciona para o login');
  const textoPublico = await pp.locator('body').innerText();
  ok(!/Produtor Ficticio|52998224725|529\.982/.test(textoPublico), 'Transparência não mostra nome nem CPF');
  ok(errosPublico === 0, 'Transparência sem erros na página');
  await pub.close();

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
  ok(await po.getByText('Produtor Fora E2E').first().isVisible().catch(() => false),
    'operador vê atendimento ATRIBUÍDO a ele fora dos assentamentos do cadastro');

  await cartao(po, PRODUTOR).getByRole('button', { name: 'Iniciar' }).click();
  await cartao(po, PRODUTOR).getByRole('button', { name: 'Finalizar' }).waitFor({ timeout: 30000 });
  ok(true, 'operador iniciou (botão Finalizar liberado)');

  await cartao(po, PRODUTOR).getByRole('button', { name: 'Finalizar' }).click();
  const dialogo = po.getByRole('dialog');
  await dialogo.getByText('Finalizar Atendimento').waitFor({ timeout: 15000 });
  await dialogo.getByRole('button', { name: 'Finalizar' }).click();
  // Aguarda a sincronização da fila (o atendimento some da lista de pendentes).
  await po.getByText(PRODUTOR).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await po.waitForTimeout(3000);
  ok(!(await po.getByText(PRODUTOR).first().isVisible().catch(() => false)), 'operador finalizou (saiu dos pendentes)');

  // ─── CASO REAL 29/09: GPS impreciso (Rio Branco-AC) ao iniciar ────────────
  const FORA = 'Produtor Fora E2E';
  await opc.setGeolocation({ latitude: -9.9756602, longitude: -67.2104895, accuracy: 25000 });
  const t0 = Date.now();
  await cartao(po, FORA).getByRole('button', { name: 'Iniciar' }).click();
  await cartao(po, FORA).getByRole('button', { name: 'Finalizar' }).waitFor({ timeout: 30000 });
  const segs = (Date.now() - t0) / 1000;
  console.log(`  iniciar com GPS ruim levou ${segs.toFixed(1)} s`);
  ok(segs <= 14, 'GPS impreciso: iniciar não trava o operador (espera curta)');
  // Agora o GPS responde bem: ao finalizar, nova leitura vai para o atendimento
  await opc.setGeolocation({ latitude: -10.62, longitude: -51.62, accuracy: 15 });
  await cartao(po, FORA).getByRole('button', { name: 'Finalizar' }).click();
  const dlg2 = po.getByRole('dialog');
  await dlg2.getByText('Finalizar Atendimento').waitFor({ timeout: 15000 });
  await dlg2.getByRole('button', { name: 'Finalizar' }).click();
  await po.getByText(FORA).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await po.waitForTimeout(3000);
  ok(!(await po.getByText(FORA).first().isVisible().catch(() => false)), 'GPS impreciso: finalizou normalmente');

  // ─── Logística: Início (odômetro) → Carregamento → Entrega → Finalização ──
  const LOG = 'Produtor Logistica E2E';
  const etapa = async (botao, titulo, confirmar, gps) => {
    await opc.setGeolocation({ ...gps, accuracy: 10 });
    await cartao(po, LOG).getByRole('button', { name: botao, exact: true }).click();
    const d = po.getByRole('dialog').filter({ hasText: titulo });
    await d.waitFor({ timeout: 15000 });
    await d.locator('input[type=file]').setInputFiles(FOTO);
    await d.getByRole('button', { name: confirmar, exact: true }).click();
    await d.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
  };
  const botaoLog = (nome) => cartao(po, LOG).getByRole('button', { name: nome, exact: true });
  await po.getByText(LOG).first().waitFor({ timeout: 30000 }).catch(() => {});
  await etapa('Iniciar', 'Iniciar — odômetro', 'Iniciar', { latitude: -10.60, longitude: -51.60 });
  await botaoLog('Carregamento').waitFor({ timeout: 30000 }).catch(() => {});
  ok(await botaoLog('Carregamento').isVisible().catch(() => false), 'Logística: iniciou com foto do odômetro → Carregamento');
  await etapa('Carregamento', 'Carregamento', 'Registrar carregamento', { latitude: -10.55, longitude: -51.55 });
  await botaoLog('Entrega').waitFor({ timeout: 30000 }).catch(() => {});
  ok(await botaoLog('Entrega').isVisible().catch(() => false), 'Logística: carregamento → Entrega');
  ok((await botaoLog('Finalizar').count()) === 0, 'Logística: Finalizar só depois da entrega');
  await etapa('Entrega', 'Entrega na propriedade', 'Registrar entrega', { latitude: -10.66, longitude: -51.66 });
  await botaoLog('Finalizar').waitFor({ timeout: 30000 }).catch(() => {});
  ok(await botaoLog('Finalizar').isVisible().catch(() => false), 'Logística: entrega NÃO finaliza (segue em execução)');
  await etapa('Finalizar', 'Finalizar — odômetro', 'Finalizar', { latitude: -10.64, longitude: -51.57 });
  await po.getByText(LOG).first().waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {});
  await po.waitForTimeout(3000);
  ok(!(await po.getByText(LOG).first().isVisible().catch(() => false)), 'Logística: finalizou com foto do odômetro');
  await opc.close();
} catch (e) {
  falhas++;
  console.log('✗ erro inesperado:', e.message);
} finally {
  await browser.close();
}
console.log(falhas ? `\n${falhas} falha(s)` : '\nFluxo principal OK');
process.exit(falhas ? 1 : 0);
