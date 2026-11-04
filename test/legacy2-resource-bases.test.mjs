import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { resetSizePreparation } from "../module/systems/legacy2-size.mjs";

globalThis.game = { settings: { get: () => "2.0" } };
const resources = await import("../module/systems/legacy2-resources.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
/**
 *
 * @param level
 */
function actor(level=1) {
  const source = { attributes: { hp: { base: null, bonus: 0, max: null } },
    energy: { base: null, bonus: 0, intensiveTraining: { maxEnergy: 0 } },
    legacy2: { pvEspecie: 0, energiaEspecie: 1 } };
  const style = { vidaBase: 5, energiaBase: 15 };
  const a = { type: "character", flags: {}, effects: [], _source: { system: source, flags: {} },
    system: { ...structuredClone(source), _source: source, details: { level }, abilities: { con: { value: 1 } } },
    itemTypes: { class: [{ getFlag: () => style }], race: [{ getFlag: (_scope, key) => key === "pvAdicional" ? 4 : 0 }] } };
  return a;
}
/**
 *
 * @param a
 */
function prepare(a) {
  assert.equal(typeof resources.prepareLegacy2ResourceBases, "function");
  a.system.energy.intensiveTraining = structuredClone(a.system._source.energy.intensiveTraining);
  resources.prepareLegacy2ResourceBases(a.system, a, Ruleset);
}

test("Akashi separates fixed species HP from style and Destino base, at levels one and two", () => {
  for (const [level, expected] of [[1, 18], [2, 25]]) {
    const a=actor(level); prepare(a);
    a.system.attributes.hp.base += 2;
    a.system.energy.base += 5;
    assert.equal(a.system.attributes.hp.base, 7);
    assert.equal(a.system.attributes.hp.bonus, 4);
    assert.equal(Ruleset.maxHitPoints(a), expected);
    assert.equal(Ruleset.maxEnergy(a), 21*level);
  }
});

test("fixed bonuses are added once after level and Constitution multipliers", () => {
  const a=actor(4); prepare(a);
  a.system.attributes.hp.base += 2; a.system.attributes.hp.bonus += 3;
  a.system.energy.base += 5; a.system.energy.bonus += 9;
  assert.equal(Ruleset.maxHitPoints(a), (4+1)*7+4+3);
  assert.equal(Ruleset.maxEnergy(a), 4*21+9);
});

test("repreparing and editing HP never persists or accumulates base and fixed grants", () => {
  const a=actor();
  for (let i=0; i<6; i++) {
    prepare(a); a.system.attributes.hp.base +=2; a.system.energy.base+=5;
    assert.equal(Ruleset.maxHitPoints(a), 18); assert.equal(Ruleset.maxEnergy(a), 21);
    a.system._source.attributes.hp.value=18-i;
  }
  prepare(a);
  assert.equal(Ruleset.maxHitPoints(a), 14);
  assert.equal(a.system._source.attributes.hp.base, null);
  assert.equal(a.system._source.attributes.hp.bonus, 0);
});

test("manual base override, legacy source offsets and plain creation previews stay separate", () => {
  const a=actor(); a.system._source.attributes.hp.base=8; a.system._source.attributes.hp.bonus=2;
  a.system._source.legacy2.pvEspecie=10; prepare(a);
  assert.equal(a.system.attributes.hp.base, 8);
  assert.equal(a.system.attributes.hp.bonus, 6);
  assert.equal(Ruleset.maxHitPoints(a), 22);
  const preview=actor(); delete preview.system.attributes.hp.base; delete preview.system.attributes.hp.bonus;
  preview.system.legacy2.pvEspecie=2;
  assert.equal(Ruleset.maxHitPoints(preview), 18);
});

test("energy previews preserve taxonomy fallback when a combat style has no energy base", () => {
  const a = actor(2);
  a.itemTypes.class[0].getFlag = () => ({ vidaBase: 5 });
  a.items = [{ type: "taxonomy", name: "Custom", system: { energiaBase: 12 } }];
  assert.equal(Ruleset.maxEnergy(a), 26);
  prepare(a);
  assert.equal(Ruleset.maxEnergy(a), 26);
});

test("a null base override resolves automatic bases without repeating fixed origin bonuses", () => {
  const a = actor();
  prepare(a);
  a.system.attributes.hp.base = null;
  a.system.energy.base = null;
  resources.prepareLegacy2ResourceBonuses(a.system, a, Ruleset);
  assert.equal(a.system.attributes.hp.base, 5);
  assert.equal(a.system.energy.base, 16);
  assert.equal(Ruleset.maxHitPoints(a), 14);
  assert.equal(Ruleset.maxEnergy(a), 16);
});

test("Energia Colossal doubles only the style root and respects later base overrides", () => {
  const a=actor(2);
  a.effects=[{active: true, system: {changes: [{key: "flags.jujutsu-system.energiaColossal", type: "override", value: 1, phase: "initial", priority: 50}]}}];
  prepare(a); a.system.energy.base+=5;
  assert.equal(a.system.energy.base, 36);
  a.flags={"jujutsu-system": {energiaColossal: 1}};
  assert.equal(Ruleset.maxEnergy(a), 72);
  a.system.energy.base=20;
  assert.equal(Ruleset.maxEnergy(a), 40, "native base overrides must remain final");
  a.effects[0].active=false; prepare(a);
  assert.equal(a.system.energy.base, 16, "disabled effects cannot reuse last preparation's flag");
});

test("training contributes to the fixed bonus bucket exactly once and explicit zero stays zero", () => {
  const a=actor(3); a.system._source.energy.intensiveTraining.maxEnergy=2;
  prepare(a); a.system.energy.base+=5; a.system.energy.bonus+=3;
  assert.equal(typeof resources.prepareLegacy2ResourceBonuses, "function");
  resources.prepareLegacy2ResourceBonuses(a.system, a, Ruleset);
  assert.equal(a.system.energy.bonus, 45);
  assert.equal(Ruleset.maxEnergy(a), 108);
  resources.prepareLegacy2ResourceBonuses(a.system, a, Ruleset);
  assert.equal(a.system.energy.bonus, 45);
  assert.equal(Ruleset.maxEnergy(a, {intenseMax: 0}), 66);
});

test("legacy base effect keys map without mutating source changes and remain dormant in 1.0/NPC", () => {
  assert.equal(typeof resources.legacy2ResourceChange, "function");
  const a=actor(); const old={key: "system.legacy2.pvEspecie", type: "add", value: 2, phase: "initial", priority: 20};
  const mapped=resources.legacy2ResourceChange(a, old, true);
  assert.equal(mapped.key, "system.attributes.hp.base"); assert.equal(old.key, "system.legacy2.pvEspecie");
  assert.equal(resources.legacy2ResourceChange(a, old, false), old);
  assert.equal(resources.legacy2ResourceChange({...a, type: "npc"}, old, true), old);
});

test("native effect application resolves old and new inputs before maxima without moving final maximum changes", () => {
  const source=readFileSync(new URL("../module/documents/active-effect.mjs", import.meta.url), "utf8");
  const apply=source.match(/static applyChange\(model, change, options=\{\}\) \{([\s\S]*?)\r?\n {2}\}/)[1];
  const phases=[...source.matchAll(/shouldApplyChange\(change, options=\{\}\) \{([\s\S]*?)\r?\n {2}\}/g)];
  assert.equal(phases.length, 1, "the real class cannot override the resource phase handler with a second method");
  const phase=phases[0][1];
  class Boundary {
    static applyChange(_model, change) {return change;}

    shouldApplyChange(change, options) {return change.phase===options.phase;}
  }
  const Effect=new Function("Boundary", "legacy2ResourceChange", "isLegacyArmorClassChange",
    `return class ActiveEffect5e extends Boundary {static FORMULA_FIELDS=new Set();static applyChange(model,change,options={}){${apply}} shouldApplyChange(change,options={}){${phase}}}`)(Boundary, resources.legacy2ResourceChange, () => false);
  const a=actor(); const effect=new Effect(); effect.target=a; effect.system={};
  for (const key of ["system.legacy2.pvEspecie", "system.attributes.hp.base", "system.attributes.hp.bonus", "system.energy.base", "system.energy.bonus"]) {
    const change={key, type: "add", value: 2, phase: "final", priority: 37};
    assert(effect.shouldApplyChange(change, {phase: "initial"}));
    assert(!effect.shouldApplyChange(change, {phase: "final"}));
    const result=Effect.applyChange(a, change);
    assert.equal(result.phase, "initial"); assert.equal(result.priority, 37); assert.equal(change.phase, "final");
  }
  const maximum={key: "system.attributes.hp.max", type: "override", value: 120, phase: "final"};
  assert(effect.shouldApplyChange(maximum, {phase: "final"}));
  assert.equal(Effect.applyChange(a, maximum), maximum);
});

test("Colossal with a false whole-effect condition cannot double the root before native suppression", () => {
  const a=actor();
  a.effects=[{active: true, system: {conditions: {check: () => false}, changes: [
    {key: "flags.jujutsu-system.energiaColossal", type: "override", value: 1, phase: "initial", priority: 50}
  ]}}];
  prepare(a); assert.equal(a.system.energy.base, 16);
});

test("projecting Colossal reads conditions without caching them during embedded preparation", () => {
  const a=actor(); a.effects=[{active: true, system: {
    conditions: {check: () => false}, evaluateCondition() {assert.fail("must not cache conditions before native status collection");},
    changes: [{key: "flags.jujutsu-system.energiaColossal", type: "override", value: 1, phase: "initial"}]
  }}];
  prepare(a); assert.equal(a.system.energy.base, 16);
});

test("native initial phase projects Colossal after collecting statuses from other effects", () => {
  const source=readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const body=source.match(/ {2}applyActiveEffects\(phase\) \{([\s\S]*?)\r?\n {2}\}/)[1];
  let seen;
  class Boundary { applyActiveEffects() {seen=this.system.energy.base;} }
  const Native=new Function("Boundary", "prepareLegacy2ResourceBases", "Ruleset", "resetSizePreparation", `return class extends Boundary {applyActiveEffects(phase){${body}}}`)(Boundary, resources.prepareLegacy2ResourceBases, Ruleset, resetSizePreparation);
  const a=Object.assign(new Native(), actor()); a.statuses=new Set();
  a.effects=[{active: true, statuses: new Set(["jj-envenenado"]), system: {}},
    {active: true, statuses: new Set(), system: {conditions: {check: data => data.statuses.has("jj-envenenado")}, changes: [
      {key: "flags.jujutsu-system.energiaColossal", type: "override", value: 1, phase: "initial"}
    ]}}];
  a.allApplicableEffects=() => a.effects; a.getRollData=() => ({statuses: new Set(a.statuses)});
  a.system.prepareEmbeddedData=() => resources.prepareLegacy2ResourceBases(a.system, a, Ruleset, {projectColossal: false});
  a.applyActiveEffects("initial"); assert.equal(seen, 31);
});

test("legacy non-additive operations retain their offset operand and support dry calculation", () => {
  const source=readFileSync(new URL("../module/documents/active-effect.mjs", import.meta.url), "utf8");
  const body=source.match(/static applyChange\(model, change, options=\{\}\) \{([\s\S]*?)\r?\n {2}\}/)[1];
  class Boundary {
    static applyChange(model, change, options={}) {
      const keys=change.key.split("."); const last=keys.pop(); let parent=model;
      for (const key of keys) parent=parent[key]??={};
      const before=Number(parent[last]??0); const delta=Number(change.value);
      const value=change.type==="override"?delta:change.type==="multiply"?before*delta
        :change.type==="downgrade"?Math.min(before, delta):change.type==="upgrade"?Math.max(before, delta):before+delta;
      if (options.modifyTarget!==false)parent[last]=value;
      return {[change.key]: value};
    }
  }
  const Native=new Function("Boundary", "legacy2ResourceChange", "isLegacyArmorClassChange", `return class ActiveEffect5e extends Boundary {static FORMULA_FIELDS=new Set();static applyChange(model,change,options={}){${body}}}`)(Boundary, resources.legacy2ResourceChange, () => false);
  for (const [type, value, expected] of [["override", 2, 7], ["multiply", 2, 7], ["upgrade", 3, 8], ["downgrade", 0, 5]]) {
    const a=actor(); a.system._source.legacy2.pvEspecie=1; a.system.legacy2.pvEspecie=1; prepare(a);
    Native.applyChange(a, {key: "system.legacy2.pvEspecie", type, value, phase: "initial"});
    assert.equal(a.system.attributes.hp.base, expected, type); assert.equal(a.system._source.legacy2.pvEspecie, 1);
  }
  const a=actor(); a.system._source.legacy2.pvEspecie=1; a.system.legacy2.pvEspecie=1; prepare(a);
  const result=Native.applyChange(a, {key: "system.legacy2.pvEspecie", type: "override", value: 2, phase: "initial"}, {modifyTarget: false});
  assert.equal(result["system.attributes.hp.base"], 7); assert.equal(a.system.attributes.hp.base, 6);
  assert.equal(a.system.legacy2.pvEspecie, 1);
});
