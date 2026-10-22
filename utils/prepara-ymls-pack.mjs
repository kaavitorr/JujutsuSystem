// -*- coding: utf-8 -*-
// PARTE 1 (roda com Foundry aberto): backup sem LOCK + extract + edições nos ymls.
// A compilação final (PARTE 2) exige Foundry fechado — script separado.
import fs from "node:fs";
import path from "node:path";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

const MODULE = "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/jujutsu-compendium";
const PACKS = ["equipamento-pdn", "equipamentos"];
const CUSTO_EXTRA = [/^Mordida/i, /^Chifre/i, /^Ferr/i];
const custoDe = nome => CUSTO_EXTRA.some(rx => rx.test(nome)) ? 3 : 2;
const YAML = (await import("js-yaml")).default;

const ARQUIVOS = ["CURRENT", "MANIFEST-000332"]; // preenchido dinamicamente abaixo

for (const pack of PACKS) {
  const dbPath = path.join(MODULE, "packs", pack);
  const bakPath = path.join(MODULE, "packs", "_backup", `${pack}-pre-v3`);
  fs.rmSync(bakPath, { recursive: true, force: true });
  fs.mkdirSync(bakPath, { recursive: true });
  for (const f of fs.readdirSync(dbPath)) {
    if ( f === "LOCK" ) continue; // LOCK é exclusivo do processo
    try {
      fs.copyFileSync(path.join(dbPath, f), path.join(bakPath, f));
    } catch (e) {
      console.warn(`  (ignorado no backup: ${f}: ${e.code})`);
    }
  }
  console.log(`backup: ${pack} -> ${bakPath}`);
  const bakFiles = fs.readdirSync(bakPath);
  console.log(`  arquivos no backup: ${bakFiles.join(", ")}`);
  if ( !bakFiles.some(f => f.startsWith("MANIFEST")) || !bakFiles.some(f => f.endsWith(".ldb")) )
    throw new Error("backup incompleto — pare antes de prosseguir");

  const srcPath = path.join(MODULE, "_work", pack);
  fs.rmSync(srcPath, { recursive: true, force: true });
  console.log(`extraindo ${pack}...`);
  await extractPack(dbPath, srcPath, { log: false, recursive: true });

  let weapons = 0, alteradas = 0, armaduras = 0, sem_act = 0;
  const walk = dir => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, f.name);
      if ( f.isDirectory() ) { walk(fp); continue; }
      if ( path.extname(f.name) !== ".yml" ) continue;
      const data = YAML.load(fs.readFileSync(fp, "utf8"));
      if ( data.type !== "weapon" ) { if ( data.type ) armaduras++; continue; }
      weapons++;
      const acts = data.system?.activities;
      if ( !acts || typeof acts !== "object" ) { sem_act++; console.warn(`  ⚠ ${data.name}: sem activities`); continue; }
      const custo = custoDe(data.name ?? "");
      let mudou = false;
      for ( const a of Object.values(acts) ) {
        if ( a.type !== "attack" ) continue;
        a.activation = a.activation ?? {};
        if ( !a.activation.type ) a.activation.type = "action";
        if ( Number(a.activation.cost) !== custo ) { a.activation.cost = custo; mudou = true; }
        const tg = a.consumption?.targets;
        if ( Array.isArray(tg) && tg.some(t => t.target === "energy.generated") ) {
          a.consumption.targets = tg.filter(t => t.target !== "energy.generated");
          mudou = true;
        }
      }
      const desc = data.system?.description?.value ?? "";
      const frase = `<p><strong>Custo de uso:</strong> ${custo} Pontos de Ação por ataque.</p>`;
      if ( !desc.includes("Custo de uso") ) {
        data.system.description.value = desc + frase; mudou = true;
      } else if ( !desc.includes(`${custo} Pontos de Ação`) ) {
        data.system.description.value = desc.replace(
          /Custo de uso:<\/strong>\s*\d+ Pontos de Ação por ataque\.?/,
          `Custo de uso:</strong> ${custo} Pontos de Ação por ataque.`);
        mudou = true;
      }
      if ( mudou ) {
        fs.writeFileSync(fp, YAML.dump(data), { mode: 0o664 });
        alteradas++;
      }
    }
  };
  walk(srcPath);
  console.log(`>>> ${pack}: ${weapons} armas | ${alteradas} ymls editados | ${sem_act} sem activities | ${armaduras} não-weapon ignorados\n`);
}
console.log("PARTE 1 concluída — ymls prontos em modules/jujutsu-compendium/_work/.");
console.log("PARTE 2 (recompilar) requer Foundry FECHADO: node utils/compila-packs.mjs");
