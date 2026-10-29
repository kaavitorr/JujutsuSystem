import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { extraEscalaDano } from "../module/systems/escala-dano.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { abilities: { str: { label: "Força" }, dex: { label: "Agilidade" } } } };
Math.clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const fonte = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
const itens = fonte.ataquesNaturais;
const porNome = Object.fromEntries(itens.map(item => [item.name, item]));

test("os 16 ataques naturais da tabela existem, com ids válidos e únicos", () => {
  const esperados = ["Galhada", "Bico", "Mordida", "Garras", "Presas", "Punhos", "Cascos", "Chifres",
    "Pseudópode", "Pinças", "Farpas", "Ferrão", "Cauda", "Unhas", "Tentáculos", "Espinhos"];
  // O compendium cresceu com as Mordidas Elementais — as 16 base estão todas presentes.
  const nomes = new Set(itens.map(i => i.name));
  for (const nome of esperados) assert.ok(nomes.has(nome), nome);
  const ids = new Set(itens.map(i => i._id));
  assert.equal(ids.size, 183);
  for (const id of ids) assert.match(id, /^[a-zA-Z0-9]{16}$/, id);
  for (const item of itens) {
    assert.ok(["weapon", "equipment"].includes(item.type), item.name); // armaduras são equipment
    assert.equal(item.system.type.value, "natural");
    // Toda ARMA tem a activity embutida com o mesmo _id do item (armaduras não têm).
    if (item.type === "weapon") {
      const activity = Object.values(item.system.activities)[0];
      assert.equal(activity._id, item._id);
      assert.equal(activity.type, "attack");
    }
  }
});

test("os modificadores de dano mapeiam para os tipos certos", () => {
  const tipoDe = nome => Object.values(porNome[nome].system.activities)[0].damage.parts[0].types[0];
  for (const nome of ["Galhada", "Bico", "Mordida", "Presas", "Chifres", "Farpas", "Ferrão", "Espinhos"])
    assert.equal(tipoDe(nome), "piercing", nome);
  for (const nome of ["Garras", "Pinças", "Unhas"])
    assert.equal(tipoDe(nome), "slashing", nome);
  for (const nome of ["Punhos", "Cascos", "Pseudópode", "Cauda", "Tentáculos"])
    assert.equal(tipoDe(nome), "bludgeoning", nome);
});

test("as três especiais custam 3 PA (2 + 1 adicional); as demais custam 2 PA", () => {
  const activityDe = nome => Object.values(porNome[nome].system.activities)[0];
  for (const nome of ["Mordida", "Chifres", "Ferrão"]) {
    const item = porNome[nome], activity = activityDe(nome);
    assert.equal(item.flags["jujutsu-system"].danoExtraPorNd, true, nome);
    assert.equal(activity.damage.parts[0].custom.formula, "@escala + @mod@escalaExtra", nome);
    assert.equal(activity.activation.value, 3, nome);
    assert.equal(activity.consumption.targets.some(t => t.target === "energy.generated"), false, nome);
    assert.ok(item.system.description.value.includes("1 Ponto de Ação adicional"), nome);
  }
  for (const nome of ["Galhada", "Garras", "Tentáculos", "Espinhos"]) {
    const item = porNome[nome], activity = activityDe(nome);
    assert.equal(item.flags["jujutsu-system"].danoExtraPorNd, false, nome);
    assert.equal(activity.damage.parts[0].custom.formula, "@escala + @mod", nome);
    assert.equal(activity.activation.value, 2, nome);
    assert.equal(activity.consumption.targets.some(t => t.target === "energy.generated"), false, nome);
  }
});

test("o dado extra cresce a cada 4 ND com o tipo da linha da escala", () => {
  assert.equal(extraEscalaDano(1), "");
  assert.equal(extraEscalaDano(3), "");
  assert.equal(extraEscalaDano(4), " + 1d8");   // linha ND 4: 1d8
  assert.equal(extraEscalaDano(7), " + 1d10");  // linha ND 6: 1d10
  assert.equal(extraEscalaDano(9), " + 2d12");  // linha ND 8: 1d12
  assert.equal(extraEscalaDano(12), " + 3d6");  // linha ND 12: 3d6
  assert.equal(extraEscalaDano(30), " + 7d10"); // 30 ÷ 4 = 7
  assert.equal(extraEscalaDano(undefined), "");
});

test("o rolldata do ataque NPC traz escala e o dado extra", () => {
  const fonteAtaque = readFileSync(new URL("../module/documents/activity/attack.mjs", import.meta.url), "utf8");
  const corpo = fonteAtaque.match(/getRollData\(options = \{\}\) \{([\s\S]*?)\r?\n  \}/)[1];
  const Base = class { getRollData() { return {}; } };
  const Classe = new Function("Ruleset", "extraEscalaDano", "Base",
    `return class extends Base { getRollData(options = {}) { ${corpo} } }`)(Ruleset, extraEscalaDano, Base);

  const npc = { type: "npc", system: { legacy2: { nd: "9" } } };
  const ataque = Object.assign(new Classe(), { actor: npc });
  const dados = ataque.getRollData();
  assert.equal(dados.escala, "1d12");
  assert.equal(dados.escalaExtra, " + 2d12");

  const personagem = { type: "character", system: {} };
  assert.equal(Object.assign(new Classe(), { actor: personagem }).getRollData().escalaExtra, undefined);
});

test("o conteúdo mora no pack do usuário (Equipamentos PdN), não no system.json", () => {
  const system = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal(system.packs.some(p => p.name === "ataques-naturais"), false);
  const macro = readFileSync(new URL("../packs/_source/importar-ataques-naturais-macro.txt", import.meta.url), "utf8");
  assert.ok(macro.includes("jujutsu-compendium.equipamento-pdn"));
});
