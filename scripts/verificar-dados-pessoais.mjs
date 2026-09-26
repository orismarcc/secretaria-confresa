// Trava contra dados pessoais dentro do código (o repositório e o JavaScript do
// site são públicos). Procura, em src/, CPFs com dígito verificador válido e
// telefones celulares com cara de reais. Placeholders ("000.000.000-00",
// "(66) 99999-9999") não disparam.
//
// Uso: node scripts/verificar-dados-pessoais.mjs   (sai com código 1 se achar)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Arquivos com exceção TEMPORÁRIA — cada um precisa de justificativa e prazo.
const EXCECOES = new Set([
  // Planilha SEFAZ 2026 embutida no código: remoção já decidida, aguardando
  // autorização (junto com a limpeza do histórico e tornar o repo privado).
  'src/data/sefaz2026Import.ts',
]);

const RAIZ = 'src';
const EXT = /\.(ts|tsx|js|jsx|json|html|css|md)$/;

function cpfValido(d) {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

function arquivos(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : EXT.test(n) ? [p] : [];
  });
}

const achados = [];
for (const arq of arquivos(RAIZ)) {
  const rel = relative('.', arq).replace(/\\/g, '/');
  if (EXCECOES.has(rel)) continue;
  const linhas = readFileSync(arq, 'utf8').split(/\r?\n/);
  linhas.forEach((linha, i) => {
    for (const m of linha.matchAll(/\b(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})\b/g)) {
      const d = m.slice(1).join('');
      if (cpfValido(d)) achados.push(`${rel}:${i + 1}  possível CPF real`);
    }
    for (const m of linha.matchAll(/\(\d{2}\)\s?9\s?(\d{4})-?(\d{4})/g)) {
      const d = m[1] + m[2];
      if (!/^(\d)\1{7}$/.test(d)) achados.push(`${rel}:${i + 1}  possível telefone real`);
    }
  });
}

if (achados.length) {
  console.error('Dados pessoais encontrados no código (não publique CPF/telefone reais):');
  achados.forEach((a) => console.error('  ' + a));
  process.exit(1);
}
console.log(`OK — nenhum CPF/telefone real no código (${EXCECOES.size} exceção temporária).`);
