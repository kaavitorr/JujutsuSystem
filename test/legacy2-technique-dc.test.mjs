import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { buildLegacy2Context } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import { buildNpc2Context } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";

let version = "2.0";
globalThis.game = { settings: { get: (_, key) => key === "regraSalvaguarda" ? false : version } };
const keys = ["str", "dex", "con", "int", "wis", "cha"];
const config = { abilities: Object.fromEntries(keys.map(key => [key, { label: key, abbreviation: key }])) };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: config };
const helper = await import("../module/systems/legacy2-technique-dc.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
function fixture(type = "character") {
  const style = { atributoPrincipal: ["int", "wis"], energiaBase: 10, vidaBase: 5 };
  const actor = { type, items: [], itemTypes: { class: [{ name: "Estilo", getFlag: () => style }] },
    getFlag() {}, system: { abilities: Object.fromEntries(keys.map(key => [key, { value: key === "int" ? 7 : 3, mod: -4, dc: 99, attack: { value: 2 } }])),
      legacy2: { principalEscolhido: "int", nd: 5 }, details: { level: 5 }, attributes: {
        hp: { value: 40, max: 40 }, spellcasting: "con", prof: 20, movement: {} }, energy: {} } };
  return actor;
}
test("the player's technique DC follows the current selected principal, using whole attributes", () => {
  const actor = fixture();
  assert.equal(buildLegacy2Context(actor, config, Ruleset).techniqueDC?.value, 17);
  actor.system.legacy2.principalEscolhido = "wis";actor.system.abilities.wis.value = 11;
  const data = buildLegacy2Context(actor, config, Ruleset).techniqueDC;
  assert.equal(data.value, 21);assert.equal(data.ability, "wis");assert.match(data.tooltip, /10.*11.*21/);
});
test("the NPC's technique DC uses its archetype principal and refreshes after profile/attribute changes", () => {
  const actor = fixture("npc");actor.system.abilities.dex.value = 8;
  const archetype = { type: "archetype", id: "arch", name: "Ágil", system: { pesos: { str: 1, dex: 5, con: 2, int: 2, wis: 1, cha: 1 } } };
  actor.items.push(archetype);
  assert.equal(buildNpc2Context(actor, config, Ruleset).techniqueDC?.value, 18);
  archetype.system.pesos = { str: 1, dex: 1, con: 2, int: 1, wis: 2, cha: 5 };actor.system.abilities.cha.value = 9;
  const data = buildNpc2Context(actor, config, Ruleset).techniqueDC;
  assert.equal(data.value, 19);assert.equal(data.ability, "cha");
});

const saveBody = readFileSync(new URL("../module/data/activity/save-data.mjs", import.meta.url), "utf8")
  .match(/prepareFinalData\(rollData\) \{([\s\S]*?)\n  \}/)[1];
class Base { prepareFinalData() {} }
const Save = new Function("Base", "Ruleset", "techniqueDifficulty", "simplifyBonus", "CONFIG", "_loc",
  `return class extends Base {prepareFinalData(rollData){${saveBody}}}`)(Base, Ruleset,
  (...args) => helper.techniqueDifficulty?.(...args), value => Number(value) || 0, CONFIG, (_, data) => String(data.dc));
function save(actor, calculation, formula = "", bonus = "") {
  return Object.assign(new Save(), { actor, ability: "con", labels: {},
    save: { dc: { calculation, formula, bonus } }, getRollData: () => ({}), prepareDamageLabel() {} });
}
test("automatic save activities use the same 10 + principal DC as the metric for players and NPCs", () => {
  for (const type of ["character", "npc"]) {
    const actor = fixture(type);
    if (type === "npc")actor.items.push({ type: "archetype", system: { pesos: { int: 12 } } });
    const automatic = save(actor, "spellcasting", "", "2");automatic.prepareFinalData();
    assert.equal(automatic.save.dc.value, 19);
    const noFormula = save(actor, "");noFormula.prepareFinalData();assert.equal(noFormula.save.dc.value, 17);
  }
});
test("explicit custom DCs and the native 1.0 calculation remain available", () => {
  const custom = save(fixture(), "", "27", "2");custom.prepareFinalData();assert.equal(custom.save.dc.value, 29);
  const vehicle = save(fixture("vehicle"), "spellcasting");vehicle.prepareFinalData();assert.equal(vehicle.save.dc.value, 99);
  version = "1.0";
  try { const native = save(fixture(), "spellcasting");native.prepareFinalData();assert.equal(native.save.dc.value, 99); }
  finally { version = "2.0"; }
});
test("the actor's prepared spell DC agrees with the technique metric", () => {
  const body = readFileSync(new URL("../module/data/actor/templates/attributes.mjs", import.meta.url), "utf8")
    .match(/static prepareSpellcastingAbility\(\) \{([\s\S]*?)\n  \}/)[1];
  const prepare = new Function("Ruleset", "techniqueDifficulty", "CONFIG", `return function(){${body}}`)(
    Ruleset, (...args) => helper.techniqueDifficulty?.(...args), CONFIG);
  const actor = fixture();actor.system.parent = actor;
  prepare.call(actor.system);assert.equal(actor.system.attributes.spell.dc, 17);
});
