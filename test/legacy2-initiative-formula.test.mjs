import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import {applyLegacy2TestRoll} from "../module/applications/dice/legacy2-test-roll.mjs";

let version = "2.0", scoreMode = "normal", modifiers = {}, initiativeHook;
globalThis.game = {user: {isGM: true, targets: new Set()}, settings: {get: (_, key) =>
  key === "rulesetVersion" ? version : key === "initiativeScore" ? scoreMode : false}};
globalThis.dnd5e = {settings: {rulesVersion: "legacy"}};
globalThis.Hooks = {callAll: (name, actor, config) => initiativeHook?.(config)};
const merge = (target, source) => Object.assign(target, source);
globalThis.foundry = {utils: {mergeObject: merge}};
class CaptureRoll {
  static ADV_MODE = {NORMAL: 0, ADVANTAGE: 1, DISADVANTAGE: -1};
  static constructParts(parts, data) {
    const configured = {parts: [], data};
    for (const [key, value] of Object.entries(parts)) if (value || value === 0) {
      configured.parts.push(`@${key}`);data[key] = value;
    }
    return configured;
  }
  constructor(formula, data, options) {Object.assign(this, {formula, data, options});}
}
globalThis.CONFIG = {DND5E: {defaultAbilities: {initiative: "dex"}}, Dice: {D20Roll: CaptureRoll, BasicRoll: CaptureRoll}};
const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
const method = name => {
  const start = source.indexOf(`  ${name}(`);
  return source.slice(start, source.indexOf("\n  /* -------------------------------------------- */", start)).trim();
};
const ActorInitiative = new Function("Ruleset", "applyLegacy2TestRoll", "D20RollModificationField", "_loc",
  `return class {${method("getInitiativeRoll")}\n${method("getInitiativeRollConfig")}}`)(
  Ruleset, applyLegacy2TestRoll, {combineFields: () => ({advantage: false, disadvantage: false,
    advantageCount: 0, disadvantageCount: 0, bonus: "", ...modifiers})}, value => value);
function actor(type = "character", dex = 8, int = 5) {
  return Object.assign(new ActorInitiative(), {type, flags: {}, statuses: new Set(), itemTypes: {weapon: []},
    system: {abilities: {dex: {value: dex, mod: -1}, int: {value: int, mod: -3}},
      attributes: {init: {mod: 900, score: 999, prof: {multiplier: 0, hasProficiency: false}}}},
    getRollData: () => ({roll: {}}), addConditionRollReduction() {}});
}

test("PC and NPC initiative uses the rounded-down average of whole AGI and INT, never a stale prepared modifier", () => {
  for (const type of ["character", "npc"]) {
    const result = actor(type).getInitiativeRoll();
    assert.equal(result.formula, "1d20 + @mod");
    assert.equal(result.data.mod, 6);
  }
  assert.equal(Ruleset.iniciativa(actor("npc", "8", "5")), 6);
  assert.equal(Ruleset.iniciativa(actor("npc", 0, 0)), 0);
});
test("automatic tracker rolls and dialog reconfiguration count +1/-1 advantages once, with only one d20", () => {
  modifiers = {advantage: true, disadvantage: true, advantageCount: 3, disadvantageCount: 1};
  try {
    const subject = actor(), result = subject.getInitiativeRoll();
    assert.equal(result.data.legacyAdv, 2);
    assert.equal(result.options.advantageMode, 0);
    assert.equal(result.options.advantage, false);
    const config = subject.getInitiativeRollConfig();
    applyLegacy2TestRoll(config, {subject, hookNames: ["initiativeDialog"]});
    assert.equal(config.data.legacyAdv, 2);
    assert.equal(config.parts.filter(p => p === "@legacyAdv").length, 1);
  } finally {modifiers = {};}
});
test("boolean or mode advantages supplied by the initiative hook survive fresh dialog processes exactly once", () => {
  for (const [options, expected] of [[{advantage: true}, 1], [{disadvantage: true}, -1],
    [{advantageMode: 1}, 1], [{advantageMode: -1}, -1]]) {
    initiativeHook = config => Object.assign(config.options, options);
    try {
      const subject = actor(), config = subject.getInitiativeRollConfig();
      assert.equal(config.data.legacyAdv, expected);
      for (let i = 0; i < 3; i++) {
        applyLegacy2TestRoll(config, {subject, hookNames: ["initiativeDialog"]});
        assert.equal(config.data.legacyAdv, expected);
        assert.equal(config.parts.filter(p => p === "@legacyAdv").length, 1);
      }
    } finally {initiativeHook = undefined;}
  }
});
test("equipping one or several Descomunal weapons imposes two -1 disadvantages, including manual initiative rolls", () => {
  for (const properties of [new Set(["des"]), {des: true}]) {
    const subject = actor();
    subject.itemTypes.weapon = [{system: {equipped: true, properties}}, {system: {equipped: true, properties}}];
    assert.equal(subject.getInitiativeRoll().data.legacyAdv, -2);
    subject.itemTypes.weapon.forEach(w => w.system.equipped = false);
    assert.equal(subject.getInitiativeRoll().data.legacyAdv, 0);
  }
});
test("PA and effect advantages share one cap of six before disadvantages, never an extra bonus on top", () => {
  modifiers = {advantage: true, disadvantage: true, advantageCount: 2, disadvantageCount: 1};
  try {
    for (const [pa, expected] of [[0, 1], [3, 4], [6, 5], [8, 5]]) {
      const subject = actor(), config = subject.getInitiativeRollConfig({jjInitiativeActions: pa});
      assert.equal(config.data.legacyAdv, expected);
      applyLegacy2TestRoll(config, {subject, hookNames: ["initiativeDialog"]});
      assert.equal(config.data.legacyAdv, expected);
      assert.equal(config.parts.filter(p => p === "@legacyAdv").length, 1);
    }
    modifiers = {};
    for (const type of ["character", "npc"]) {
      const result = actor(type).getInitiativeRoll({jjInitiativeActions: 6});
      assert.equal(result.data.mod, 6);assert.equal(result.data.legacyAdv, 6);
      assert.equal(result.formula, "1d20 + @mod + @legacyAdv");
      assert.equal(result.options.advantageMode, 0);
    }
  } finally {modifiers = {};}
});
test("2.0 always rolls a d20 even when the inherited fixed-initiative setting is enabled; 1.0 remains unchanged", () => {
  scoreMode = "all";
  try {
    assert.equal(actor().getInitiativeRoll().formula, "1d20 + @mod");
    version = "1.0";
    assert.equal(actor().getInitiativeRoll().formula, "999");
  } finally {version = "2.0";scoreMode = "normal";}
});
