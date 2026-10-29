import assert from "node:assert/strict";
import { test } from "node:test";
const getProperty = (object, key) => key?.split(".").reduce((v,k)=>v?.[k], object);
const mergeObject = (target, source) => {
  for (const [key,value] of Object.entries(source)) {
    if (value && typeof value === "object") target[key] = mergeObject(target[key] ?? {}, value);
    else target[key] = value;
  }
  return target;
};
// Only the Foundry field base and object utilities are adapted; all effect counting uses the actual field class.
globalThis.foundry = { data: { fields: { NumberField: class {} } }, utils: {
  getProperty, mergeObject, getType: value => value?.constructor === Object ? "Object" : typeof value
} };
const {default:AdvantageModeField} = await import("../module/data/fields/advantage-mode-field.mjs");

test("native Active Effects preserve separate disadvantage sources and respect mode suppression/overrides", () => {
  const source = { skills: { dec: { roll: { mode: 0 } } }, rolls: { ability: { check: { mode: 0 } } } };
  const actor = { _source: { system: structuredClone(source) }, system: { ...structuredClone(source), _source: structuredClone(source) } };
  const field = new AdvantageModeField();
  const apply = (path, value, type="Add") => {
    const roll = getProperty(actor, path.slice(0,path.lastIndexOf(".")));
    roll.mode = field[`_applyChange${type}`](roll.mode, value, actor, {key:path});
  };
  const paths = ["skills.dec.roll.mode", "rolls.ability.check.mode"];
  apply("system.skills.dec.roll.mode", -1);
  apply("system.rolls.ability.check.mode", -1);
  let combined = AdvantageModeField.combineFields(actor.system,paths);
  assert.equal(combined.disadvantageCount,2); assert.equal(combined.advantageCount,0);
  apply("system.skills.dec.roll.mode",1);
  combined = AdvantageModeField.combineFields(actor.system,paths);
  assert.equal(combined.disadvantageCount,2); assert.equal(combined.advantageCount,1);
  assert.equal(combined.mode,0); // Native 1.0 behavior is retained; 2.0 uses the separate counts.
  apply("system.skills.dec.roll.mode",0,"Downgrade");
  combined = AdvantageModeField.combineFields(actor.system,paths); assert.equal(combined.advantageCount,0);
  apply("system.rolls.ability.check.mode",0,"Override");
  combined = AdvantageModeField.combineFields(actor.system,paths);
  assert.equal(combined.disadvantageCount,0); assert.equal(combined.advantageCount,0);
});
