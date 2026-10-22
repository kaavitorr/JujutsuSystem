// Auditoria do compendium "Arquétipos e Taxonomias" — lê os JSONs extraídos
// por extractPack e valida: contagens, nomes, pesos, ordens (2 regras),
// vínculos de aspectos, resistências, proficiências e pastas.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.env.TEMP, "audit-arq-tax");
const arquivos = fs.readdirSync(DIR).filter(f => f.endsWith(".json"));
const docs = arquivos.map(f => ({ f, d: JSON.parse(fs.readFileSync(path.join(DIR, f), "utf-8")) }));

const VALID_RES = new Set(["bludgeoning", "piercing", "slashing", "poison", "acid", "fire",
  "cold", "lightning", "radiant", "psychic", "soul"]);
const SKILLS = new Set(["ath", "acr", "prc", "ste", "sur", "arc", "rel", "inv", "his", "ani", "dec", "per", "itm", "prf", "luc"]);
const SAVES = new Set(["str", "dex", "con", "int", "wis", "cha"]);
const ALT_SAVES = new Set(["fortitude", "vontade", "reflexo"]);

const itens = docs.filter(x => ["taxonomy", "archetype"].includes(x.d.type)).map(x => x.d);
const feats = docs.filter(x => x.d.type === "feat").map(x => d => d).length && docs.filter(x => x.d.type === "feat").map(x => x.d);
const folders = docs.filter(x => x.d.type === "Folder" || x.d.folder === undefined && x.d.name && x.d.type === "Folder").map(x => x.d);
// pastas no extractPack vêm como documentos com type "Folder"
const folderDocs = docs.filter(x => (x.d.type ?? "") === "Folder").map(x => x.d);

const problemas = [], avisos = [];
const add = (lista, msg) => lista.push(msg);

// ---- 1) contagens ----
const tax = itens.filter(i => i.type === "taxonomy"), arq = itens.filter(i => i.type === "archetype");
console.log(`== CONTAGENS ==`);
console.log(`itens: ${itens.length} (taxonomy ${tax.length}, archetype ${arq.length}) | feats (aspectos): ${feats.length} | pastas: ${folderDocs.length}`);

// ---- 2) duplicidade e caixa ----
const vistos = new Map();
for (const i of itens) {
  const k = i.name.trim().toLowerCase() + "::" + i.type;
  if (vistos.has(k)) add(problemas, `duplicado: ${i.name} (${i.type})`);
  vistos.set(k, i._id);
}
const caixaAlta = itens.filter(i => i.name === i.name.toUpperCase() && /[A-ZÀ-Ú]{3}/.test(i.name));
if (caixaAlta.length) add(problemas, `nomes em caixa alta: ${caixaAlta.map(i => i.name).join(", ")}`);

// ---- 3) pesos ----
const pesoRuim = itens.filter(i => {
  const p = i.system?.pesos ?? {};
  return Object.values(p).reduce((s, v) => s + v, 0) !== 12;
});
if (pesoRuim.length) add(problemas, `pesos != 12: ${pesoRuim.map(i => i.name).join(", ")}`);

// ---- 4) ordens de proficiência ----
let comOrdem = 0, semOrdem = [];
for (const i of itens) {
  const po = i.system?.proficiencyOrder ?? {};
  const o = po.original, a = po.alternative;
  if (Array.isArray(o) && o.length && Array.isArray(a) && a.length) {
    comOrdem++;
    const invalido = id => !((id.startsWith("skills.") && SKILLS.has(id.slice(7))) ||
      (id.startsWith("saves.") && SAVES.has(id.slice(6))) ||
      (id.startsWith("alternativeSaves.") && ALT_SAVES.has(id.slice(17))));
    o.forEach(id => { if (invalido(id)) add(problemas, `${i.name}: id inválido em original: ${id}`); });
    a.forEach(id => { if (invalido(id)) add(problemas, `${i.name}: id inválido em alternative: ${id}`); });
    // consistência do mapeamento alternative
    const altDe = { str: "fortitude", wis: "fortitude", con: "vontade", cha: "vontade", dex: "reflexo", int: "reflexo" };
    const esperado = [];
    const vistosA = new Set();
    for (const id of o) {
      if (id.startsWith("skills.")) esperado.push(id);
      else { const m = "alternativeSaves." + altDe[id.split(".")[1]]; if (!vistosA.has(m)) { vistosA.add(m); esperado.push(m); } }
    }
    if (JSON.stringify(esperado) !== JSON.stringify(a))
      add(avisos, `${i.name}: alternative difere do mapeamento esperado (${a.join(",")} vs ${esperado.join(",")})`);
  } else semOrdem.push(i.name + " (" + i.type + ")");
}
console.log(`\n== ORDENS ==`);
console.log(`com original+alternative: ${comOrdem}/${itens.length} | sem ordem: ${semOrdem.join(", ") || "nenhum"}`);

// ---- 5) aspectos e vínculos ----
const featPorId = new Map(feats.map(f => [f._id, f]));
const featSemDescricao = feats.filter(f => !(f.system?.description?.value ?? "").replace(/<[^>]+>/g, "").trim());
let vinculos = 0, uuidsQuebrados = [];
for (const i of tax) {
  for (const h of (i.system?.habilidades ?? [])) {
    vinculos++;
    const alvo = String(h.uuid ?? "").split(".").slice(-1)[0];
    if (!featPorId.has(alvo)) uuidsQuebrados.push(`${i.name} -> ${h.uuid}`);
    else if (h.nd !== 1) add(avisos, `${i.name}: aspecto com nd ${h.nd}`);
  }
}
const taxSemAspecto = tax.filter(i => !(i.system?.habilidades ?? []).length).map(i => i.name);
console.log(`\n== ASPECTOS ==`);
console.log(`vínculos: ${vinculos} | feats sem descrição: ${featSemDescricao.map(f => f.name).join(", ") || "nenhuma"}`);
console.log(`vínculos com uuid inexistente: ${uuidsQuebrados.join("; ") || "nenhum"}`);
console.log(`taxonomias sem aspecto: ${taxSemAspecto.join(", ") || "nenhuma"}`);

// ---- 6) resistências ----
let resRuins = 0;
for (const i of itens) {
  for (const [k, v] of Object.entries(i.system?.resistencias ?? {})) {
    if (!VALID_RES.has(k)) { add(problemas, `${i.name}: tipo de resistência inválido '${k}'`); resRuins++; }
    else if (v && (!Number.isInteger(v.value) || typeof v.immune !== "boolean")) { add(problemas, `${i.name}: resistência '${k}' malformada`); resRuins++; }
  }
}

// ---- 7) proficiências (ranks de sugestão) ----
const taxComRank = tax.filter(i => Object.values(i.system?.proficiencias?.skills ?? {}).some(v => v > 0)
  || Object.values(i.system?.proficiencias?.saves ?? {}).some(v => v > 0));
const arqSemRank = arq.filter(i => !Object.values(i.system?.proficiencias?.skills ?? {}).some(v => v > 0)
  && !Object.values(i.system?.proficiencias?.saves ?? {}).some(v => v > 0));
console.log(`\n== PROFICIÊNCIAS (ranks de sugestão) ==`);
console.log(`taxonomias com rank: ${taxComRank.length}/52 (esperado 0) | arquétipos sem rank: ${arqSemRank.map(i => i.name).join(", ") || "nenhum"}`);

// ---- 8) pastas ----
const folderIds = new Set(folderDocs.map(f => f._id));
const semPasta = itens.filter(i => i.folder && !folderIds.has(i.folder));
if (semPasta.length) add(problemas, `itens apontando para pasta inexistente: ${semPasta.map(i => i.name).join(", ")}`);
const orfa = folderDocs.filter(f => f.folder && !folderIds.has(f.folder));
if (orfa.length) add(problemas, `pastas órfãs: ${orfa.map(f => f.name).join(", ")}`);
const gruposAspecto = new Set(folderDocs.filter(f => (f.name ?? "").startsWith("Aspectos")).length ? folderDocs.filter(f => String(f.name).startsWith("Aspectos")).map(f => f.name) : []);
console.log(`\n== PASTAS ==`);
console.log(`total ${folderDocs.length} | Aspectos: ${folderDocs.filter(f => String(f.name).startsWith("Aspectos")).length} | Taxonomias: ${folderDocs.filter(f => String(f.name).startsWith("Taxonomias")).length} | Arquétipos: ${folderDocs.filter(f => String(f.name).startsWith("Arquétipos")).length}`);

// ---- resumo ----
console.log(`\n== RESUMO ==`);
console.log(`problemas: ${problemas.length}`);
problemas.forEach(p => console.log("  ✗ " + p));
console.log(`avisos: ${avisos.length}`);
avisos.slice(0, 10).forEach(a => console.log("  ⚠ " + a));
