import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { prepareSizeRules, restoreSizeRules, resetSizePreparation, sizeGrappleEffectImmune, sizeTouchRange, sizeMeleeReach, sizeRules, resistingPush, preventSizePushRoll } from "../module/systems/legacy2-size.mjs";
import { hasLegacy2Test } from "../module/applications/dice/legacy2-test-roll.mjs";
import { prepareNpc2Abilities } from "../module/systems/legacy2-npc-attributes.mjs";
import Ruleset from "../module/systems/ruleset.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { movementUnits: { m: "m", ft: "ft" }, distanceUnits: { touch: "Toque" } } };
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actor = type => ({ type, items: [], itemTypes: {}, system: { traits: { size: "grg" }, legacy2: {},
  abilities: { str: { value: 12 }, dex: { value: 1 } }, attributes: { movement: { ignoredDifficultTerrain: new Set() } } } });

test("native player and NPC preparation applies size before building ability-dependent roll data", () => {
  for (const type of ["character", "npc"]) {
    const source = read(`module/data/actor/${type}.mjs`);
    const body = source.slice(source.indexOf("  prepareDerivedData() {") + "  prepareDerivedData() {".length,
      source.indexOf("    const rollData = this.parent.getRollData", source.indexOf("  prepareDerivedData() {")));
    const prepare = new Function("applyCursedBenefitTraits1", "prepareSizeRules", "restoreSizeRules", "prepareNpc2Abilities", "Ruleset", body);
    const creature = actor(type);
    for (let n = 0; n < 4; n++) prepare.call({ parent: creature }, () => {}, prepareSizeRules, restoreSizeRules, prepareNpc2Abilities, Ruleset);
    assert.equal(creature.system.abilities.str.value, 14);
    assert.equal(creature.system.abilities.dex.value, 0);
    creature.system.traits.size = "med";
    prepare.call({ parent: creature }, () => {}, prepareSizeRules, restoreSizeRules, prepareNpc2Abilities, Ruleset);
    assert.equal(creature.system.abilities.str.value, 12);
    assert.equal(creature.system.abilities.dex.value, 1);
    assert.equal(creature.system.attributes.movement.ignoredDifficultTerrain.has("all"), false);
    resetSizePreparation(creature);
  }
});

test("native range preparation exposes the larger touch reach on the activity and chat labels", () => {
  const source = read("module/data/shared/range-field.mjs");
  const labels = source.match(/static getLabels\(\{ range \}\) \{([\s\S]*?)\r?\n  \}/)[1];
  const prepare = source.match(/static prepareData\(rollData, labels\) \{([\s\S]*?)\r?\n  \}/)[1];
  const RangeField = new Function("sizeTouchRange", "formatLength", "prepareFormulaValue", `return class RangeField {
    static getLabels({range}) {${labels}} static prepareData(rollData, labels) {${prepare}}
  }`)(sizeTouchRange, (value, unit) => `${value} ${unit}`, () => {});
  const creature = actor("npc"), stored = { units: "touch", value: null }, activity = { item: { actor: creature }, range: { ...stored } };
  const chatLabels = {};
  RangeField.prepareData.call(activity, {}, chatLabels);
  assert.equal(activity.range.value, 5); assert.equal(activity.range.units, "m");
  assert.equal(chatLabels.range, "5 m"); assert.equal(stored.units, "touch");
  const ranged = { item: { actor: creature }, range: { units: "m", value: 40 } };
  RangeField.prepareData.call(ranged, {}, {}); assert.equal(ranged.range.value, 40);
});

test("existing native grapple effects are suppressed only while their source is too small", () => {
  const source = read("module/documents/active-effect.mjs");
  const body = source.match(/get isSuppressed\(\) \{([\s\S]*?)\r?\n  \}/)[1];
  class Base { get isSuppressed() { return false; } }
  const Effect = new Function("Base", "sizeGrappleEffectImmune", "peculiarityEffectSuppressed",
    `return class extends Base {get isSuppressed(){${body}}}`)(Base, sizeGrappleEffectImmune, () => false);
  const target = actor("npc"), sourceActor = { type: "character", documentName: "Actor", uuid: "Actor.grappler", system: { traits: { size: "lg" } } };
  globalThis.fromUuidSync = uuid => uuid === sourceActor.uuid ? sourceActor : null;
  try {
    const effect = Object.assign(new Effect(), { actor: target, system: {}, statuses: new Set(["jj-agarrado"]), origin: sourceActor.uuid });
    assert.equal(effect.isSuppressed, true);
    target.system.traits.size = "huge"; assert.equal(effect.isSuppressed, false);
    target.system.traits.size = "grg"; sourceActor.system.traits.size = "huge";
    assert.equal(effect.isSuppressed, false);
    effect.origin = undefined; assert.equal(effect.isSuppressed, false);
  } finally { delete globalThis.fromUuidSync; }
});

test("the native roll dialog confirms push immunity without rolling and still submits unrelated tests", () => {
  const source = read("module/applications/dice/d20-configuration-dialog.mjs");
  const body = source.match(/_finalizeRolls\(action\) \{([\s\S]*?)\r?\n  \}/)[1];
  const calls = [];
  class Base { _finalizeRolls(action) { calls.push(action); return ["native-roll"]; } }
  const Dialog = new Function("Base", "hasLegacy2Test", "preventSizePushRoll", "resistingPush",
    `return class extends Base {_finalizeRolls(action){${body}}}`)(Base, hasLegacy2Test, preventSizePushRoll, resistingPush);
  const original = globalThis.foundry;
  globalThis.foundry = { applications: { ux: { FormDataExtended: class { constructor(form) { return form; } } } } };
  try {
    const dialog = Object.assign(new Dialog(), { config: { subject: actor("npc"), ability: "str" }, form: new Map([["jj2Test.resistPush", true]]) });
    assert.deepEqual(dialog._finalizeRolls("normal"), []); assert.deepEqual(calls, []);
    dialog.form.set("jj2Test.resistPush", false);
    assert.deepEqual(dialog._finalizeRolls("normal"), ["native-roll"]); assert.deepEqual(calls, ["normal"]);
  } finally { globalThis.foundry = original; }
});

test("native weapon preparation extends melee reach before activities inherit it, without changing projectiles", () => {
  const source = read("module/data/item/weapon.mjs");
  const body = source.slice(source.indexOf('    if ( this.attackType === "ranged" ) this.range.reach = null;'),
    source.indexOf('    if ( !this.hasRange ) this.range.value = this.range.long = null;'));
  const prepare = new Function("sizeRules", "sizeMeleeReach", "convertLength", "defaultUnits", body);
  const convert = (value, from, to) => from === to ? value : from === "ft" ? value * 0.3 : value / 0.3;
  for (const [size, expected] of [["lg", 2], ["huge", 3], ["grg", 5]]) {
    const owner = actor("npc"); owner.system.traits.size = size;
    const weapon = { parent: { actor: owner }, attackType: "melee", range: { units: "m", reach: null }, properties: new Set() };
    for (let n = 0; n < 3; n++) prepare.call(weapon, sizeRules, sizeMeleeReach, convert, () => "m");
    assert.equal(weapon.range.reach, expected);
    weapon.attackType = "ranged"; weapon.range.value = 30; weapon.range.long = 60;
    prepare.call(weapon, sizeRules, sizeMeleeReach, convert, () => "m");
    assert.equal(weapon.range.reach, null); assert.equal(weapon.range.value, 30); assert.equal(weapon.range.long, 60);
  }
});
