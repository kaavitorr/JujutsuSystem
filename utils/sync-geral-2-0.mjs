// Sincroniza o pack geral-2-0 compilado do sistema com o módulo jujutsu-compendium
// (onde a árvore 2.0 realmente lê). Uso:
//
//   node utils/sync-geral-2-0.mjs --autorizo    # backup + publica
//
// ⚠️ O PACK DO MÓDULO (LevelDB) É O MODELO — o autor o edita in-game
// (ícones, itens novos). Snapshot de referência: packs/_source/geral-2-0/_MODELO-atual.json.
// Antes de qualquer publicação: extrair o modelo para o _source e comparar.
//
// ⚠️ NUNCA rode sem pedido EXPLÍCITO do usuário — sobrescrever o pack apaga
// edições feitas in-game (ícones, textos etc.). Sem a flag --autorizo o
// script se recusa a rodar. Sempre grava um backup do pack atual do módulo
// antes de sobrescrever. Mundo aberto trava o LevelDB — a cópia aborta sem
// corromper nada.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACK = "geral-2-0";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, "..", "packs", PACK);
const moduleDir = path.join(here, "..", "..", "..", "modules", "jujutsu-compendium", "packs");
const dest = path.join(moduleDir, PACK);
const backupRoot = path.join(moduleDir, "_backup");

if ( !process.argv.includes("--autorizo") ) {
  console.error("✗ RECUSADO: publicar sobrescreve o pack do módulo e apaga edições in-game.");
  console.error("  Só rode com --autorizo e apenas quando o usuário pedir explicitamente.");
  process.exit(1);
}

if ( !fs.existsSync(src) ) {
  console.error(`✗ Pack compilado não encontrado: ${src}\n  Rode antes: node utils/packs.mjs package pack ${PACK}`);
  process.exit(1);
}
if ( !fs.existsSync(dest) ) {
  console.error(`✗ Pack do módulo não encontrado: ${dest}`);
  process.exit(1);
}

// 1. Backup (mantém os 5 mais recentes). Mundo aberto trava até a LEITURA
//    dos arquivos do LevelDB — aborta aqui, antes de qualquer mudança.
fs.mkdirSync(backupRoot, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backup = path.join(backupRoot, `${PACK}-${stamp}`);
try {
  fs.cpSync(dest, backup, { recursive: true, force: false, errorOnExist: true });
} catch (err) {
  fs.rmSync(backup, { recursive: true, force: true });
  console.error(`✗ Não consegui nem ler o pack do módulo — o mundo está aberto? (${err.code ?? err.message})`);
  console.error("  Feche o mundo no Foundry e rode de novo. Nada foi alterado.");
  process.exit(1);
}
const olds = fs.readdirSync(backupRoot)
  .filter(d => d.startsWith(`${PACK}-`))
  .sort();
while ( olds.length > 5 ) fs.rmSync(path.join(backupRoot, olds.shift()), { recursive: true, force: true });
console.log(`Backup: ${path.relative(process.cwd(), backup)}`);

// 2. Cópia via diretório temporário + rename (se o mundo estiver aberto o
//    rename falha e nada é sobrescrito pela metade).
const tmp = path.join(moduleDir, `${PACK}.sync-tmp`);
fs.rmSync(tmp, { recursive: true, force: true });
fs.cpSync(src, tmp, { recursive: true });
try {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(tmp, dest);
  console.log(`✓ ${PACK} publicado no módulo jujutsu-compendium. Reinicie o mundo (F5) para recarregar.`);
} catch (err) {
  fs.rmSync(tmp, { recursive: true, force: true });
  console.error(`✗ Falhou (mundo aberto?): ${err.code ?? err.message}`);
  console.error("  Feche o mundo no Foundry e rode de novo. O pack atual segue intacto.");
  process.exit(1);
}
