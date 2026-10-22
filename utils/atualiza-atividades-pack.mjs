// -*- coding: utf-8 -*-
// Atualiza activation.cost das armas/partes nos packs do módulo jujutsu-compendium
// via foundryvtt-cli: extract → editar yml → compile.
// Regra: base 2 ações · Mordida/Chifre/Ferrão 3 · sem consumo de energia.
import fs from "node:fs";
import path from "node:path";
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";

const MODULE = "C:/Users/kaa_v/Documents/FoundryVTT/Data/modules/jujutsu-compendium";
const PACKS = ["equipamento-pdn", "equipamentos"];
const CUSTO_EXTRA = [/^Mordida/i, /^Chifre/i, /^Ferr/i];
const custoDe = nome => CUSTO_EXTRA.some(rx => rx.test(nome)) ? 3 : 2;
const YAML = (await import("js-yaml")).default;

// backup antes de tudo
for (const pack of PACKS) {
  const src = path.join(MODULE, "packs", pack);
  const bak = path.join(MODULE, "packs", "_backup", `${pack}-${Date.now()}.zip`);
  fs.mkdirSync(path.dirname(bak), { recursive: true });
  // zip simples via powershell se disponível, senão copia a pasta
  fs.cpSync(src, bak.replace(".zip", ""), { recursive: true });
  console.log(`backup: ${bak.replace(".zip", "")}`);
}

for (const pack of PACKS) {
  const dbPath = path.join(MODULE, "packs", pack);
  const srcPath = path.join(MODULE, "_work", pack);

  console.log(`\n=== ${pack}: extraindo...`);
  await extractPack(dbPath, srcPath, { log: false, recursive: true });

  // caminha nos ymls e aplica
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
      if ( !acts || typeof acts !== "object" ) { sem_act++; continue; }
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
  console.log(`=== ${pack}: ${weapons} armas, ${alteradas} alteradas, ${sem_act} sem activities, ${armaduras} não-armas ignoradas`);

  console.log(`=== ${pack}: recompilando...`);
  await compilePack(srcPath, dbPath, { recursive: true, log: true });
  fs.rmSync(srcPath, { recursive: true, force: true });
}
console.log("\nCONCLUÍDO — packs recompilados.");
