import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { SKILL_GROUPS } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import { applyLegacy2TestRoll, testRollBreakdown } from "../module/applications/dice/legacy2-test-roll.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
const read = path => readFileSync(new URL(`../module/${path}`, import.meta.url), "utf8");
const method = (path, signature) => {
  const source = read(path), start = source.indexOf(`  ${signature} {`);
  assert.notEqual(start, -1, `Missing native method: ${signature}`);
  const indent = source.slice(source.lastIndexOf("\n", start) + 1, start) + "  ";
  return source.slice(start + `  ${signature} {`.length, source.indexOf(`\n${indent}}`, start));
};

const getProperty = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const setProperty = (object, path, value) => {
  const keys = path.split("."), last = keys.pop();
  for (const key of keys) object = object[key] ??= {};
  object[last] = value;
};
globalThis.foundry = { utils: { getProperty, setProperty, deepClone: structuredClone } };
globalThis.CONFIG = { DND5E: { abilities: { wis: { label: "Sabedoria" }, int: { label: "Intelecto" } },
  skills: { rel: { label: "Medicina" } }, itemProperties: {} }, Dice: { D20Roll: {
    constructParts: new Function("parts", "data={}", method("dice/basic-roll.mjs", "static constructParts(parts, data={})")),
    mergeOptions: (original, other) => ({ ...original, ...other }), ADV_MODE: { NORMAL: 0 }
  } } };
globalThis.dnd5e = { dataModels: { actor: { CommonTemplate: {
  calculateSkillToolProficiency: () => ({ multiplier: 1, hasProficiency: true, term: 99 })
} } } };
const total = roll => roll.parts.reduce((sum, part) => sum + Number(part.startsWith("@")
  ? getProperty(roll.data, part.slice(1)) : part), 0);

test("NPC skill clicks use the displayed 2.0 attribute exactly once and preserve native fallbacks", () => {
  const body = method("applications/actor/npc-sheet.mjs", "_roll(event, target)");
  class Base { _roll() { this.fallbacks++; return "native"; } }
  const Sheet = new Function("Base", "Ruleset", "SKILL_GROUPS",
    `return class extends Base {_roll(event,target) {${body}}}`)(Base, Ruleset, SKILL_GROUPS);
  const calls = [], sheet = Object.assign(new Sheet(), { fallbacks: 0,
    actor: { system: { skills: { rel: { ability: "int" }, inv: { ability: "wis" } } },
      rollSkill: config => calls.push(config) } });
  const event = {}, target = key => ({ dataset: { type: "skill" }, closest: () => ({ dataset: { key } }) });
  for (const [key, ability] of [["rel", "wis"], ["inv", "wis"], ["ath", "str"]]) {
    assert.equal(sheet._roll(event, target(key)), false);
    assert.deepEqual(calls.at(-1), { skill: key, ability, event });
  }
  sheet.actor.system.skills.inv.ability = "int";
  sheet._roll(event, target("inv"));
  assert.equal(calls.at(-1).ability, "int");
  sheet.actor.system.skills.inv.ability = "str";
  sheet._roll(event, target("inv"));
  assert.equal(calls.at(-1).ability, "int");
  assert.equal(calls.length, 5);
  assert.equal(sheet._roll(event, target("unknown")), "native");
  assert.equal(sheet._roll(event, { dataset: { type: "saving-throw" } }), "native");
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try { assert.equal(sheet._roll(event, target("rel")), "native"); }
  finally { game.settings.get = original; }
  assert.equal(calls.length, 5);
  assert.equal(sheet.fallbacks, 3);
});

test("NPC automatic weapon attribute selects the highest whole 2.0 value even when native modifiers tie", () => {
  const body = method("data/activity/attack-data.mjs", "get ability()");
  const Attack = new Function("Ruleset", `return class {get ability() {${body}}}`)(Ruleset);
  const keys = ["dex", "str"], abilities = { size: keys.length, first: () => keys[0],
    reduce: (...args) => keys.reduce(...args) };
  const attack = Object.assign(new Attack(), { attack: { abilities },
    actor: { type: "npc", system: { abilities: { dex: { value: 6, mod: -2 }, str: { value: 7, mod: -2 } } } } });
  assert.equal(attack.ability, "str");
  attack.attack.ability = "none";
  assert.equal(attack.ability, null);
  delete attack.attack.ability;
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try { assert.equal(attack.ability, "dex"); }
  finally { game.settings.get = original; }
});

test("NPC skill rolls include whole attribute, every proficiency rank, effects, conditions and situational bonus once", () => {
  const body = method("documents/actor/actor.mjs", "_buildSkillToolConfig(type, hostActor, process, config, formData, index)");
  const combineCalls = [];
  const Actor = new Function("Ruleset", "D20RollModificationField",
    `return class {_buildSkillToolConfig(type,hostActor,process,config,formData,index) {${body}}}`)(Ruleset, {
    combineFields(system, fields) { combineCalls.push(fields); return { bonus: 3, minimum: 2 }; }
  });
  const actor = Object.assign(new Actor(), { type: "npc", system: {
    abilities: { wis: { value: 8, mod: -1 }, int: { value: 3, mod: -4 } }, legacy2: { skills: {} } },
    getRollData: () => ({ roll: {} }),
    addConditionRollReduction(parts, data) { parts.push("@exhaustion"); data.exhaustion = -2; } });
  const process = { subject: actor, skill: "rel", ability: "wis", bonus: 4, legacy2: { vantagens: 1 } };
  const situational = new Function("config", "formData", "index",
    method("applications/dice/roll-configuration-dialog.mjs", "_buildConfig(config, formData, index)"));
  const form = new Map([["ability", "wis"], ["roll.0.situational", "5"],
    ["jj2Test.vantagens", "3"], ["jj2Test.desvantagens", "1"]]);
  for (let rank = 0; rank <= 4; rank++) {
    actor.system.legacy2.skills.rel = rank;
    const roll = { parts: [], data: {}, options: {} };
    situational(roll, form, 0);
    actor._buildSkillToolConfig("skill", actor, process, roll, form, 0);
    applyLegacy2TestRoll(roll, process, form);
    applyLegacy2TestRoll(roll, process, form);
    assert.equal(total(roll), 8 + Ruleset.rankBonus(rank) + 3 + 4 - 2 + 5 + 2);
    assert.equal(roll.data.mod, 8);
    assert.equal(roll.data.legacyAdv, 2);
    assert(!roll.parts.includes("@prof"));
    assert.equal(new Set(roll.parts).size, roll.parts.length);
    assert.equal(roll.options.minimum, 2);
    const view = testRollBreakdown(process, roll);
    assert.equal(view.abilityLabel, "Sabedoria");
    assert.equal(view.abilityValue, 8);
    assert.equal(view.rankValue, rank === 1 ? 0 : Ruleset.rankBonus(rank));
    assert.deepEqual(view.extras.map(extra => extra.value), ["+4", "+3", "-2"]);
  }
  form.set("ability", "int");
  const changed = { parts: [], data: {}, options: {} };
  actor._buildSkillToolConfig("skill", actor, process, changed, form, 0);
  assert.equal(changed.data.mod, 3);
  assert.equal(changed.data.abilityId, "int");
  assert.equal(testRollBreakdown(process, changed).abilityLabel, "Intelecto");
  assert.deepEqual(combineCalls.at(-1), ["abilities.int.check.roll", "rolls.ability.check", "rolls.ability.skill", "skills.rel.roll"]);
});

test("NPC native skill rolls apply automatic ND proficiency once and react to removing its suggested priority", () => {
  const body = method("documents/actor/actor.mjs", "_buildSkillToolConfig(type, hostActor, process, config, formData, index)");
  const Actor = new Function("Ruleset", "D20RollModificationField",
    `return class {_buildSkillToolConfig(type,hostActor,process,config,formData,index) {${body}}}`
  )(Ruleset, { combineFields: () => ({ bonus: 0 }) });
  const actor = Object.assign(new Actor(), { type: "npc",
    items: ["taxonomy", "archetype"].map(type => ({ type, id: type, name: type,
      system: { proficiencyOrder: { original: [type === "taxonomy" ? "skills.rel" : "skills.ste"] } } })),
    system: { abilities: { wis: { value: 6 } }, legacy2: { nd: "4", skills: {} } },
    getRollData: () => ({ roll: {} }), addConditionRollReduction() {} });
  const process = { skill: "rel", ability: "wis" };
  for (let i = 0; i < 3; i++) {
    const roll = { parts: [], data: {}, options: {} };
    actor._buildSkillToolConfig("skill", actor, process, roll);
    assert.equal(total(roll), 7); assert.equal(roll.data.legacyRank, 1);
  }
  actor.items.shift();
  const roll = { parts: [], data: {}, options: {} };
  actor._buildSkillToolConfig("skill", actor, process, roll);
  assert.equal(total(roll), 2); assert.equal(roll.data.legacyRank, -4);
});

test("NPC weapon damage includes whole attribute, magic, ammo and effects once, with proficiency confined to attack", () => {
  const appliedRules = {
    collect: () => ({ toArray: () => ["6"] }),
    createIterator: () => ({ filterWith: () => ({ toFormula: () => "6" }) })
  };
  const Base = new Function("Ruleset", "AppliedRules", `return class {
    getRollData(options={}) {${method("data/activity/base-activity.mjs", "getRollData(options={})")}}
    getDamageConfig(config={}, {formulaOptions,rollData}={}) {${method("data/activity/base-activity.mjs", "getDamageConfig(config={}, { formulaOptions, rollData }={})")}}
    _processDamagePart(damage,rollConfig,rollData,index=0,{formulaOptions,rules}={}) {${method("data/activity/base-activity.mjs", "_processDamagePart(damage, rollConfig, rollData, index=0, { formulaOptions, rules }={})")}}
  }`)(Ruleset, appliedRules);
  const Attack = new Function("Base", "Ruleset", "simplifyBonus", `return class extends Base {
    getDamageConfig(config={},options={}) {${method("data/activity/attack-data.mjs", "getDamageConfig(config={}, options={})")}}
    _processDamagePart(damage,rollConfig,rollData,index=0,options={}) {${method("data/activity/attack-data.mjs", "_processDamagePart(damage, rollConfig, rollData, index=0, options={})")}}
  }`)(Base, Ruleset, value => Number(value) || 0);
  globalThis.Roll = class { constructor(formula) { this.isDeterministic = !/\d+d\d+/.test(formula); } };
  const types = new Set(["piercing"]); types.first = () => "piercing";
  const damage = { base: true, types, scaledFormula: () => "1d6" };
  const actor = { type: "npc", system: { abilities: { str: { value: 9, mod: -1 }, dex: { value: 5, mod: -3 } },
    rolls: { damage: { mwak: { bonus: "3" } } }, legacy2: { armas: { natural: 4 } } }, getFlag() {} };
  const item = { type: "weapon", actor, flags: {}, getFlag() {}, getRollData: () => ({ roll: {} }),
    system: { type: { value: "natural" }, magicalBonus: 2, magicAvailable: true,
      damage: { bonus: "4" }, properties: new Set() } };
  const attack = Object.assign(new Attack(), { actor, item, ability: "str", attack: { type: { classification: "weapon" } },
    damage: { parts: [damage, { ...damage, base: false }], critical: {} }, getActionType: () => "mwak",
    _getDamageParts() { return this.damage.parts; } });
  const config = { ability: "str", isCritical: true, ammunition: { system: {
    properties: new Set(), magicalBonus: 1, magicAvailable: true } } };
  const build = new Function("AppliedRules", "Ruleset", `return function(process,config,formData,index) {
    ${method("documents/activity/mixin.mjs", "_buildDamageConfig(process, config, formData, index)")}
  }`)(appliedRules, Ruleset);
  for (let rank = 0; rank <= 4; rank++) {
    actor.system.legacy2.armas.natural = rank;
    const result = attack.getDamageConfig(config), first = result.rolls[0], second = result.rolls[1];
    build.call(attack, result, first, undefined, 0);
    build.call(attack, result, first, undefined, 0);
    assert.equal(first.data.mod, 9);
    assert.equal(first.parts.filter(part => part === "@mod").length, 1);
    assert.equal(first.parts.filter(part => part === "@ruleBonus").length, 1);
    assert(!first.parts.includes("@jj2Rank"));
    assert.equal(total({ ...first, parts: first.parts.slice(1) }), 9 + 3 + 4 + 2 + 1 + 6);
    assert(!second.parts.includes("@mod"));
    assert(!second.parts.includes("@jj2Rank"));
    assert(!second.parts.includes("@magicalBonus"));
    assert.equal(first.options.critical, undefined);
    assert.deepEqual(first.options.types, ["piercing"]);
  }
  const changed = attack.getDamageConfig({ ...config, ability: "dex" });
  assert.equal(changed.rolls[0].data.mod, 5);
  damage.scaledFormula = () => "1d6 + @mod";
  assert.equal(attack.getDamageConfig(config).rolls[0].parts.filter(part => part.includes("@mod")).length, 1);
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try {
    const legacy = attack.getDamageConfig(config).rolls[0];
    assert.equal(legacy.data.mod, -1);
    assert(!legacy.parts.includes("@jj2Rank"));
  } finally { game.settings.get = original; }
});

const actionHooks = new Map();
globalThis.Hooks = { on: (name, callback) => actionHooks.set(name, callback) };
globalThis.ui = { notifications: { warn() {}, info() {} } };
await import("../module/systems/acoes-combate.mjs");
function npcActionFixture({ loaded = true, seals = 0, cost = 1 } = {}) {
  const writes = [], actor = { type: "npc", name: "NPC", itemTypes: {},
    system: { legacy2: { actions: { value: 6 } } },
    flags: { "jujutsu-system": { selos: seals } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) { writes.push(updates); for (const [key, value] of Object.entries(updates)) setProperty(this, key, value); } };
  const item = { type: "weapon", name: "Arma", actor, system: { properties: new Set(["lod"]) },
    loaded, getFlag() { return this.loaded; }, async setFlag(scope, key, value) { this.loaded = value; } };
  return { actor, item, writes, activity: { actor, item, activation: { value: cost } } };
}

test("NPC loaded weapon pays the validated action cost before becoming unloaded", async () => {
  const { actor, item, activity, writes } = npcActionFixture();
  assert.notEqual(actionHooks.get("dnd5e.preUseActivity")(activity, {}), false);
  assert.equal(writes.length, 0);
  await actionHooks.get("dnd5e.postUseActivity")(activity, {});
  assert.equal(item.loaded, false);
  assert.equal(actor.system.legacy2.actions.value, 5);
  assert.equal(writes.length, 1);
  await actionHooks.get("dnd5e.postUseActivity")(activity, {});
  assert.equal(actor.system.legacy2.actions.value, 3);
  actor.system.legacy2.actions.value = 1;
  assert.equal(actionHooks.get("dnd5e.preUseActivity")(activity, {}), false);
});

test("NPC hand seals preserve their validated discount after the seal pool is consumed", async () => {
  const { actor, item, activity } = npcActionFixture({ seals: 2, cost: 3 });
  item.type = "spell"; item.system.properties.clear();
  const usage = { legacy2: { selos: 2 } };
  assert.notEqual(actionHooks.get("dnd5e.preUseActivity")(activity, usage), false);
  await actionHooks.get("dnd5e.postUseActivity")(activity, usage);
  assert.equal(actor.flags["jujutsu-system"].selos, 0);
  assert.equal(actor.system.legacy2.actions.value, 5);
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try { await actionHooks.get("dnd5e.postUseActivity")(activity, usage); }
  finally { game.settings.get = original; }
  assert.equal(actor.system.legacy2.actions.value, 5);
});
