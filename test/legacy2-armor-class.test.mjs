import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { npcProfile } from "../module/systems/legacy2-npc-profiles.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { armorTypes: { light: "Leve", medium: "Média", heavy: "Pesada", natural: "Natural", shield: "Escudo" } } };
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const armorRules = await import("../module/systems/legacy2-armor.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
const playerSource = read("module/data/actor/character.mjs"), npcSource = read("module/data/actor/npc.mjs");
function prepare(actor) {
  const body = actor.type === "character"
    ? playerSource.slice(playerSource.indexOf("      const seisCr ="), playerSource.indexOf("      const rankSeis ="))
    : npcSource.slice(npcSource.indexOf("      // CR com o principal"), npcSource.indexOf("      // Resistências dos perfis"));
  return new Function("Ruleset", "actor2", "crSeisOlhos", "npcProfile", "estiloCfg", "prepareLegacy2ArmorClass", body)
    .call(actor.system, Ruleset, actor, () => 0, npcProfile, { atributoPrincipal: "str" }, armorRules.prepareLegacy2ArmorClass);
}
function fixture(type = "character") {
  version = "2.0";
  return { type, items: [], itemTypes: { equipment: [] }, system: {
    abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((key, i) => [key, { value: [12, 8, 4, 7, 9, 5][i], mod: -3 }])),
    attributes: { ac: { bonus: 0, override: null } }, _source: { attributes: { ac: { bonus: 0 } } }, legacy2: {}
  } };
}
function armor(actor, { base = 8, ability = "wis", limit = null, type = "natural", equipped = true, legacy = false } = {}) {
  const item = { id: "armor", name: "Armadura Psíquica", type: "equipment", flags: legacy ? { "jujutsu-system": { armaduraNatural: true, cr: { base, atributo: ability } } } : {},
    system: { type: { value: type }, equipped, armor: { value: legacy ? 0 : base, ability: legacy ? null : ability, dex: limit },
      _source: { armor: { value: legacy ? null : base, ability: legacy ? null : ability, dex: limit } } } };
  actor.items.push(item); actor.itemTypes.equipment.push(item);
  return item;
}

test("equipped armor replaces the default resistance class in the real player and NPC preparation", () => {
  for (const type of ["character", "npc"]) {
    const actor = fixture(type); armor(actor);
    prepare(actor);
    assert.equal(actor.system.attributes.ac.value, 17, "8 + full Wisdom 9, without modifier or unarmored defense");
    assert.equal(actor.system.attributes.ac.armor, 8);
  }
});

test("all six attributes and None can be chosen independently of light, heavy or natural armor type", () => {
  assert.equal(typeof armorRules.prepareLegacy2ArmorClass, "function");
  for (const type of ["character", "npc"]) for (const ability of ["str", "dex", "con", "int", "wis", "cha", ""]) {
    const actor = fixture(type); armor(actor, { base: 10, ability, type: "heavy" });
    prepare(actor);
    assert.equal(actor.system.attributes.ac.value, 10 + (ability ? actor.system.abilities[ability].value : 0));
  }
});

test("unequipping armor restores the default formula even when the armor was worse than it", () => {
  const actor = fixture(); const item = armor(actor, { base: 2, ability: "con" });
  prepare(actor); assert.equal(actor.system.attributes.ac.value, 6);
  item.system.equipped = false;
  prepare(actor); assert.equal(actor.system.attributes.ac.value, Ruleset.resistanceClass(actor));
});

test("the chosen attribute's optional limit applies to its whole value and magical base is counted once", () => {
  for (const type of ["character", "npc"]) {
    const actor = fixture(type), item = armor(actor, { base: 8, ability: "str", limit: 3 });
    item.system.armor.value = 10; // Prepared magical base: +2.
    prepare(actor); assert.equal(actor.system.attributes.ac.value, 13);
    item.system.armor.dex = 0;
    prepare(actor); assert.equal(actor.system.attributes.ac.value, 10);
  }
});

test("existing flagged natural armor obtains its configured base and attribute without editing or reimporting it", () => {
  const actor = fixture("npc"); armor(actor, { legacy: true });
  prepare(actor); assert.equal(actor.system.attributes.ac.value, 17);
});

test("condition bonuses, shields and explicit actor overrides still take effect with armor", () => {
  for (const type of ["character", "npc"]) {
    const actor = fixture(type); armor(actor);
    armor(actor, { base: 2, ability: "", type: "shield" });
    actor.system.attributes.ac.bonus = -2;
    prepare(actor); assert.equal(actor.system.attributes.ac.value, 17);
    actor.system.attributes.ac.override = 0;
    prepare(actor); assert.equal(actor.system.attributes.ac.value, 0);
  }
});

test("legacy natural-armor ADD changes are suppressed only in 2.0 and never suppress unrelated effects", () => {
  const effect = { flags: { "jujutsu-system": { armaduraNaturalCR: { base: 8, atributo: "wis" } } } };
  const change = { key: "system.attributes.ac.bonus", effect };
  for (const type of ["character", "npc"]) assert.equal(armorRules.isLegacyArmorClassChange({ type }, change), true);
  assert.equal(armorRules.isLegacyArmorClassChange({ type: "npc" }, { ...change, key: "system.legacy2.resistances.cold.value" }), false);
  assert.equal(armorRules.isLegacyArmorClassChange({ type: "npc" }, { ...change, effect: { flags: {} } }), false);
  version = "1.0";
  assert.equal(armorRules.isLegacyArmorClassChange({ type: "npc" }, change), false);
  version = "2.0";
});

test("the real equipment schema saves the six attribute choices and None, independently of its type", () => {
  class Field { constructor(options) { Object.assign(this, options); } }
  class Schema extends Field { constructor(fields) { super({ fields }); } }
  class Base { static defineSchema() { return {}; } static mergeSchema(a, b) { return { ...a, ...b }; } }
  const body = read("module/data/item/equipment.mjs").match(/static defineSchema\(\) \{([\s\S]*?)\r?\n  \}/)[1];
  const Model = new Function("Base", "NumberField", "SchemaField", "FormulaField", "SetField", "StringField", "ItemTypeField", "ARMOR_ABILITIES_2",
    `return class extends Base {static defineSchema(){${body}}}`)(Base, Field, Schema, Field, Field, Field, Field, armorRules.ARMOR_ABILITIES_2);
  const field = Model.defineSchema().armor.fields.ability;
  assert.deepEqual(Object.keys(field.choices), ["", "str", "dex", "con", "int", "wis", "cha"]);
  assert.equal(field.nullable, true); assert.equal(field.initial, null);
});

test("equipment editing shows the existing natural armor's Wisdom and base instead of a fixed agility field", async () => {
  const actor = fixture("npc"), item = armor(actor, { legacy: true });
  Object.assign(item.system, { parent: item, isArmor: true, physicalItemSheetFields: [], armor: { ...item.system.armor, value: 8, base: 8 },
    type: { value: "natural", label: "Armadura Natural" } });
  CONFIG.DND5E.miscEquipmentTypes = {}; CONFIG.DND5E.armorTypes = { natural: "Natural" };
  const body = read("module/data/item/equipment.mjs").match(/async getSheetData\(context\) \{([\s\S]*?)\r?\n  \}/)[1];
  globalThis.dnd5e = { utils: { formatModifier: value => String(value) } };
  const context = { properties: { active: [{}] } };
  await new Function("Ruleset", "armor2Configuration", `return async function(context){${body}}`)(Ruleset, armorRules.armor2Configuration).call(item.system, context);
  assert.equal(context.armor2.ability, "wis");
  assert.equal(context.armor2.base, 8);
  assert.equal(context.armor2.formula, "8 + Sabedoria");
  version = "1.0";
  const legacy = { properties: { active: [{}] } };
  await new Function("Ruleset", "armor2Configuration", `return async function(context){${body}}`)(Ruleset, armorRules.armor2Configuration).call(item.system, legacy);
  assert.equal(legacy.armor2, undefined); assert.equal(legacy.hasDexModifier, true);
  version = "2.0";
});

test("the actual legacy effect application skips the obsolete armor bonus and retains 1.0 and other bonuses", () => {
  const body = read("module/documents/active-effect.mjs").match(/static applyChange\(model, change, options=\{\}\) \{([\s\S]*?)\r?\n  \}/)[1];
  class Boundary { static applyChange(_model, change) { return { [change.key]: change.value }; } }
  globalThis.Item = class {}; globalThis.Actor = class {};
  const Effect = new Function("Boundary", "isLegacyArmorClassChange",
    `return class ActiveEffect5e extends Boundary {static FORMULA_FIELDS=new Set();static applyChange(model,change,options={}){${body}}}`)(Boundary, armorRules.isLegacyArmorClassChange);
  const change = { key: "system.attributes.ac.bonus", value: "8 + @abilities.wis.mod",
    effect: { _applyChangeShim: change => change, flags: { "jujutsu-system": { armaduraNaturalCR: { base: 8, atributo: "wis" } } } } };
  assert.deepEqual(Effect.applyChange({ type: "npc" }, change), {});
  version = "1.0";
  assert.deepEqual(Effect.applyChange({ type: "npc" }, change), { "system.attributes.ac.bonus": change.value });
  version = "2.0";
  assert.deepEqual(Effect.applyChange({ type: "npc" }, { ...change, effect: undefined, value: -2 }), { "system.attributes.ac.bonus": -2 });
});

test("real equipment base preparation reads legacy natural armor once and preserves ordinary 1.0 preparation", () => {
  const body = read("module/data/item/equipment.mjs").match(/  prepareBaseData\(\) \{([\s\S]*?)\r?\n  \}/)[1];
  class Boundary { prepareBaseData() {} }
  const Model = new Function("Boundary", "Ruleset", "armor2Configuration",
    `return class extends Boundary {prepareBaseData(){${body}}}`)(Boundary, Ruleset, armorRules.armor2Configuration);
  const actor = fixture(), item = armor(actor, { legacy: true });
  const model = Object.assign(new Model(), item.system, { parent: item }); item.system = model;
  model.prepareBaseData(); assert.equal(model.armor.value, 8);
  model.armor.value += 2;
  prepare(actor); assert.equal(actor.system.attributes.ac.value, 19);
  model.prepareBaseData(); assert.equal(model.armor.value, 8);
  version = "1.0";
  model.prepareBaseData(); assert.equal(model.armor.value, 0);
  version = "2.0";
});
