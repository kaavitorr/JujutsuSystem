// -*- coding: utf-8 -*-
// PARTE 2 — RECOMPILAÇÃO (exige Foundry FECHADO)
// Compila os ymls já editados (modules/jujutsu-compendium/_work/*) de volta
// para os LevelDB dos packs e valida o resultado.
import fs from "node:fs";
import path from "node:path";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

const MODULE = "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/jujutsu-compendium";
const PACKS = ["equipamento-pdn", "equipamentos"];

const LOCK = path.join(MODULE, "packs", "equipamento-pdn", "LOCK");
if ( fs.existsSync(LOCK) ) {
  try {
    // tentativa de abrir exclusivamente: se conseguir, Foundry fechado
    const fd = fs.openSync(LOCK, "r+");
    fs.closeSync(fd);
  } catch (e) {
    console.error("✗ O Foundry parece estar ABERTO (LOCK em uso). Feche-o e rode de novo.");
    process.exit(1);
  }
}

for (const pack of PACKS) {
  const srcPath = path.join(MODULE, "_work", pack);
  if ( !fs.existsSync(srcPath) ) { console.error(`✗ sem ymls editados em ${srcPath}`); process.exit(1); }
  const dbPath = path.join(MODULE, "packs", pack);
  console.log(`compilando ${pack}...`);
  await compilePack(srcPath, dbPath, { recursive: true, log: true });

  // validação: re-extrai e confere
  const checkPath = path.join(MODULE, "_check", pack);
  fs.rmSync(checkPath, { recursive: true, force: true });
  await extractPack(dbPath, checkPath, { log: false, recursive: true });
  let weapons = 0, ok = 0, problemas = [];
  const walk = dir => {
    for ( const f of fs.readdirSync(dir, { withFileTypes: true }) ) {
      const fp = path.join(dir, f.name);
      if ( f.isDirectory() ) { walk(fp); continue; }
      if ( path.extname(f.name) !== ".yml" ) continue;
      const data = (await import("js-yaml")).default.load(fs.readFileSync(fp, "utf8"));
      if ( data.type !== "weapon" ) continue;
      weapons++;
      const custo = /^Mordida/i.test(data.name ?? "") || /^Chifre/i.test(data.name ?? "") || /^Ferr/i.test(data.name ?? "") ? 3 : 2;
      const ataques = Object.values(data.system?.activities ?? {}).filter(a => a.type === "attack");
      const custos = ataques.map(a => Number(a.activation?.cost));
      const energia = ataques.some(a => (a.consumption?.targets ?? []).some(t => t.target === "energy.generated"));
      if ( ataques.length && custos.every(c => c === custo) && !energia ) ok++;
      else problemas.push(`${data.name}: custos=${custos} energia=${energia}`);
    }
  };
  walk(checkPath);
  console.log(`>>> ${pack}: ${weapons} armas | ${ok} corretas | ${problemas.length} problemas`);
  problemas.forEach(p => console.log("    ✗", p));
  fs.rmSync(checkPath, { recursive: true, force: true });
}
console.log("\nCONCLUÍDO — recarregue o Foundry para ver os custos.");
