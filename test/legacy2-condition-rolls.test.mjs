import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { applyLegacy2TestRoll, testRollChoices } from "../module/applications/dice/legacy2-test-roll.mjs";

let alternative = false;
globalThis.game = { settings: { get: (_, key) => key === "regraSalvaguarda" ? alternative : "2.0" }, user: { targets: new Set() } };
globalThis.CONFIG = { DND5E: { abilities: { str: {}, dex: {}, con: {}, int: {}, wis: {}, cha: {} } },
  Dice: { D20Roll: { ADV_MODE: { NORMAL: 0, ADVANTAGE: 1, DISADVANTAGE: -1 } } } };
const conditions = await import("../module/systems/legacy2-condition-rolls.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
const actor = (statuses = [], type = "character", uuid = "Actor.subject") => ({ type, uuid,
  statuses: new Set(statuses), effects: [], system: { abilities: { dex: { value: 5 }, wis: { value: 3 } } } });
const processFor = (subject, ability = "dex", kind = "check", skill) => ({ subject, ability, skill,
  hookNames: [kind === "save" ? "SavingThrow" : "abilityCheck", "d20Test"], rolls: [{ options: {} }] });
const attackSource = readFileSync(new URL("../module/data/activity/attack-data.mjs", import.meta.url), "utf8");
const defaultsBody = attackSource.match(/getLegacy2AdvantageDefaults\(\{ ability, attackMode \} = \{\}\) \{([\s\S]*?)\n  \}/)[1];
const nativeModifiers = { combineFields: () => ({}) };
const defaults = new Function("D20RollModificationField", "flanqueamentoDoAtaque", "Ruleset", "conditionRollAdvantages", "MAX_VANTAGENS",
  `return function({ability,attackMode}={}){${defaultsBody}}`)(
  nativeModifiers, () => ({ graus: 0 }), Ruleset, (...args) => conditions.conditionRollAdvantages?.(...args), 6);

test("Depressivo retains all six disadvantages and suppresses advantages from effects and conditions", () => {
  nativeModifiers.combineFields = () => ({ advantage: true, disadvantage: true, advantageCount: 3, disadvantageCount: 6 });
  game.user.targets = new Set([{ actor: actor(["jj-cego"]) }]);
  const subject = actor(["jj-invisivel"]);
  subject.flags = { "jujutsu-system": { flawRules: { attackNoAdvantages: true } } };
  try {
    const activity = { actor: subject, item: { type: "spell" }, getRollData: () => ({ roll: {} }), getActionType: () => "msak" };
    assert.deepEqual(defaults.call(activity), { vantagens: 0, desvantagens: 6 });
    delete subject.flags; assert.equal(defaults.call(activity).vantagens, 5);
  } finally { nativeModifiers.combineFields = () => ({}); game.user.targets = new Set(); }
});

test("attacker conditions automatically stack as individual -1 penalties on player and NPC attacks", () => {
  game.user.targets = new Set();
  for (const type of ["character", "npc"]) {
    const subject = actor(["jj-cego", "blind", "jj-estremecido", "jj-hipotermico", "jj-pesado"], type);
    const activity = { actor: subject, item: { type: "weapon" }, getRollData: () => ({ roll: {} }), getActionType: () => "mwak" };
    assert.deepEqual(defaults.call(activity), { vantagens: 0, desvantagens: 4 });
    assert.equal(Ruleset.advantagePart(defaults.call(activity)), -4);
    activity.getActionType = () => "rsak";
    assert.deepEqual(defaults.call(activity), { vantagens: 0, desvantagens: 3 });
  }
});

test("target conditions supply +1 each and prone changes with melee versus ranged attacks", () => {
  const target = actor(["jj-cego", "blind", "jj-atordoado", "stunned", "jj-caido", "prone"]);
  game.user.targets = new Set([{ actor: target }]);
  const activity = { actor: actor(["jj-invisivel", "invisible"]), item: { type: "spell" }, getRollData: () => ({ roll: {} }), getActionType: () => "msak" };
  assert.deepEqual(defaults.call(activity), { vantagens: 4, desvantagens: 0 });
  activity.getActionType = () => "rsak";
  assert.deepEqual(defaults.call(activity), { vantagens: 3, desvantagens: 1 });
  game.user.targets = new Set();
});

test("dexterity condition penalties reach skills, checks and saves without requiring a manual counter", () => {
  game.user.targets = new Set();
  for (const type of ["character", "npc"]) {
    const subject = actor(["jj-bebado", "jj-concussao", "jj-hipotermico", "jj-sonolento", "jj-sufocado"], type);
    const skill = processFor(subject, "dex", "check", "acr");
    assert.deepEqual(testRollChoices(skill), { vantagens: 0, desvantagens: 3 });
    assert.deepEqual(testRollChoices(processFor(subject, "dex", "save")), { vantagens: 0, desvantagens: 5 });
    assert.deepEqual(testRollChoices(processFor(subject, "wis", "save")), { vantagens: 0, desvantagens: 1 });
    assert.deepEqual(testRollChoices(processFor(subject, "wis", "check", "prc")), { vantagens: 0, desvantagens: 0 });
    const roll = { parts: ["@mod"], data: { mod: 5 }, options: {} };
    applyLegacy2TestRoll(roll, skill); applyLegacy2TestRoll(roll, skill);
    assert.equal(roll.data.legacyAdv, -3);assert.equal(roll.parts.filter(p => p === "@legacyAdv").length, 1);
    assert.equal(roll.options.advantageMode, 0);
    const removed = processFor(actor([], type), "dex", "save");
    assert.deepEqual(testRollChoices(removed), { vantagens: 0, desvantagens: 0 });
  }
});

test("combined saves apply the penalties of their component attributes exactly once", () => {
  alternative = true;
  try {
    const subject = actor(["jj-bebado", "jj-sonolento"]);
    assert.deepEqual(testRollChoices(processFor(subject, "int", "save")), { vantagens: 0, desvantagens: 2 });
    assert.deepEqual(testRollChoices(processFor(subject, "str", "save")), { vantagens: 0, desvantagens: 1 });
    assert.deepEqual(testRollChoices(processFor(subject, "con", "save")), { vantagens: 0, desvantagens: 0 });
  } finally { alternative = false; }
});

test("fear and passion depend on the source; social advantages apply only to interaction with that creature", () => {
  assert.equal(typeof conditions.conditionRollAdvantages, "function");
  const source = actor([], "npc", "Actor.source"), other = actor([], "npc", "Actor.other");
  const subject = actor(["jj-amedrontado", "jj-apaixonado"]);
  subject.effects = [{ statuses: new Set(["jj-amedrontado"]), origin: "Actor.source.Item.fear" },
    { statuses: new Set(["jj-apaixonado"]), origin: "Actor.source.Item.passion" }];
  assert.deepEqual(conditions.conditionRollAdvantages(subject, { kind: "attack", target: source, melee: true }), { vantagens: 0, desvantagens: 4 });
  assert.deepEqual(conditions.conditionRollAdvantages(subject, { kind: "attack", target: other, melee: true }), { vantagens: 0, desvantagens: 0 });
  assert.deepEqual(conditions.conditionRollAdvantages(subject, { kind: "check", skill: "per", target: source }), { vantagens: 0, desvantagens: 3 });
  assert.deepEqual(conditions.conditionRollAdvantages(source, { kind: "check", skill: "per", target: subject }), { vantagens: 6, desvantagens: 0 });
  assert.deepEqual(conditions.conditionRollAdvantages(source, { kind: "check", skill: "prc", target: subject }), { vantagens: 0, desvantagens: 0 });
});

test("the native poison/restrained penalties are not imported from DnD into the 2.0 conditions", () => {
  const body = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8")
    .match(/hasConditionEffect\(key\) \{([\s\S]*?)\n  \}/)[1];
  const hasEffect = new Function("Ruleset", "ConditionData", "replacesNativeConditionRoll", `return function(key){${body}}`)(
    Ruleset, { hasLevels: () => false }, (...args) => conditions.replacesNativeConditionRoll?.(...args));
  CONFIG.DND5E.conditionEffects = { abilityCheckDisadvantage: ["poisoned"], dexteritySaveDisadvantage: ["restrained"], noMovement: ["restrained"] };
  const subject = actor(["jj-envenenado", "poisoned", "jj-impedido", "restrained"]);
  assert.equal(hasEffect.call(subject, "abilityCheckDisadvantage"), false);
  assert.equal(hasEffect.call(subject, "dexteritySaveDisadvantage"), false);
  assert.equal(hasEffect.call(subject, "noMovement"), true);
});
test("usage-card origins identify the source for fear and charm, including synthetic token actors", () => {
  const source = actor([], "npc", "Scene.scene.Token.token.Actor.enemy");
  const subject = actor(["jj-amedrontado", "jj-enfeiticado"]);
  subject.effects = ["jj-amedrontado", "jj-enfeiticado"].map(id => ({ statuses: new Set([id]), origin: "ChatMessage.usage" }));
  globalThis.fromUuidSync = ref => ref === "ChatMessage.usage" ? { getAssociatedActor: () => source } : null;
  try {
    assert.deepEqual(conditions.conditionRollAdvantages(subject, { kind: "attack", target: source }), { vantagens: 0, desvantagens: 1 });
    assert.deepEqual(conditions.conditionRollAdvantages(source, { kind: "check", skill: "per", target: subject }), { vantagens: 1, desvantagens: 0 });
  } finally { delete globalThis.fromUuidSync; }
});
test("automatic counts keep the six-source cap, manual overrides and normal cancellation", () => {
  game.user.targets = new Set([{ actor: actor(["jj-invisivel"]) }]);
  const activity = { actor: actor(["jj-cego", "jj-caido", "jj-estremecido", "jj-impedido", "jj-hipotermico", "jj-pesado"]),
    item: { type: "weapon" }, getRollData: () => ({ roll: {} }), getActionType: () => "mwak" };
  assert.deepEqual(defaults.call(activity), { vantagens: 0, desvantagens: 6 });
  game.user.targets = new Set();
  const process = processFor(actor(["jj-bebado", "jj-concussao"]));
  process.advantage = true;
  const roll = { parts: ["@mod"], data: { mod: 5 }, options: {} };
  applyLegacy2TestRoll(roll, process);assert.equal(roll.data.legacyAdv, -1);
  applyLegacy2TestRoll(roll, process, new Map([["jj2Test.vantagens", "3"], ["jj2Test.desvantagens", "0"]]));
  assert.equal(roll.data.legacyAdv, 3);
});
test("changing the chosen skill attribute refreshes automatic conditions while preserving extra manual counts", () => {
  const process = processFor(actor(["jj-bebado", "jj-hipotermico"]), "wis", "check", "prc");
  const roll = { parts: ["@mod"], data: { mod: 3, abilityId: "wis" }, options: {} };
  applyLegacy2TestRoll(roll, process);assert.equal(roll.data.legacyAdv, 0);
  roll.data.abilityId = "dex";
  applyLegacy2TestRoll(roll, process, new Map([["ability", "dex"], ["jj2Test.vantagens", "0"], ["jj2Test.desvantagens", "0"]]));
  assert.equal(roll.data.legacyAdv, -2);
  // The final native roll factory must retain the attribute chosen in the dialog.
  applyLegacy2TestRoll(roll, process);assert.equal(roll.data.legacyAdv, -2);
  applyLegacy2TestRoll(roll, process, new Map([["ability", "dex"], ["jj2Test.vantagens", "0"], ["jj2Test.desvantagens", "4"]]));
  assert.equal(roll.data.legacyAdv, -4);
  roll.data.abilityId = "wis";
  applyLegacy2TestRoll(roll, process, new Map([["ability", "wis"], ["jj2Test.vantagens", "0"], ["jj2Test.desvantagens", "4"]]));
  assert.equal(roll.data.legacyAdv, -2);
});
