import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

globalThis.CONFIG = { JUJUTSU: {}, DND5E: { movementTypes: { walk: {}, swim: {}, fly: {}, climb: {}, burrow: {} } } };
globalThis.game = { settings: { get: () => "2.0" } };
const rules = await import("../module/systems/legacy2-npc-movement.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
function fixture(nd = 1) {
  const movement = { speeds: { walk: 8, swim: 0, fly: 0, climb: 0, burrow: 0 }, units: "m" };
  return { type: "npc", items: [
    { id: "tax", type: "taxonomy", system: { movimento: { walk: 3, swim: 12, fly: 0 } } },
    { id: "arc", type: "archetype", system: { movimento: { ganho: 1, intervalo: 2, maximo: 25 } } }
  ], system: { legacy2: { nd }, attributes: { movement }, _source: { attributes: { movement: structuredClone(movement) } } } };
}
const prepare = actor => rules.prepareNpcProfileMovement(actor, (n, from, to) => to === "ft" ? n / .3048 : n);
test("taxonomy supplies separate walking and swimming speeds; ND 2 is the first growth milestone", () => {
  const actor = fixture(); prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 3);
  assert.equal(actor.system.attributes.movement.speeds.swim, 12);
  actor.system.legacy2.nd = 2; prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 4);
  assert.equal(actor.system.attributes.movement.speeds.swim, 13);
  actor.system.legacy2.nd = 4; prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 5);
  assert.equal(actor.system.attributes.movement.speeds.fly, 0, "growth never grants a new movement mode");
});
test("one-ND intervals start after ND 1; every-three-ND milestones, caps and repeated preparation remain stable", () => {
  const actor = fixture(1), growth = actor.items[1].system.movimento;
  growth.intervalo = 1; prepare(actor); assert.equal(actor.system.attributes.movement.speeds.walk, 3);
  actor.system.legacy2.nd = 2; prepare(actor); assert.equal(actor.system.attributes.movement.speeds.walk, 4);
  growth.intervalo = 3; actor.system.legacy2.nd = 5; prepare(actor); assert.equal(actor.system.attributes.movement.speeds.walk, 4);
  actor.system.legacy2.nd = 6; prepare(actor); assert.equal(actor.system.attributes.movement.speeds.walk, 5);
  actor.system.legacy2.nd = 100; prepare(actor); prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 25);
  assert.equal(actor.system.attributes.movement.speeds.swim, 25);
  assert.equal(actor.system._source.attributes.movement.speeds.walk, 8);
});
test("empty legacy definitions preserve manual movement and meters convert without changing other speeds", () => {
  const actor = fixture(2); actor.items = []; prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 8);
  actor.items.push({ id: "tax", type: "taxonomy", system: { movimento: { walk: 3 } } });
  actor.system.attributes.movement.units = "ft"; prepare(actor);
  assert.equal(actor.system.attributes.movement.speeds.walk, 3 / .3048);
  assert.equal(actor.system.attributes.movement.speeds.swim, 0);
});
test("native NPC embedded preparation applies profile movement before native condition multipliers", () => {
  const source = readFileSync(new URL("../module/data/actor/npc.mjs", import.meta.url), "utf8");
  const body = source.match(/  prepareEmbeddedData\(\) \{([\s\S]*?)\n  \}/)[1];
  const prepareEmbedded = new Function("prepareNpcProfileMovement", "Ruleset", "AttributesFields", "Item", "defaultUnits", "convertLength", `return class extends class {prepareEmbeddedData(){}} {prepareEmbeddedData(){${body}}}`)
    (rules.prepareNpcProfileMovement, { isV2: () => true }, {}, class {}, () => "m", n => n).prototype.prepareEmbeddedData;
  CONFIG.DND5E.senses = {};
  const actor = fixture(2), system = actor.system; system.parent = actor; system.details = {}; system.attributes.senses = { ranges: {} };
  prepareEmbedded.call(system);
  assert.equal(system.attributes.movement.speeds.walk, 4);
  const attributes = readFileSync(new URL("../module/data/actor/templates/attributes.mjs", import.meta.url), "utf8");
  const nativeBody = attributes.match(/static prepareMovement\(rollData=this\.parent\.getRollData\(\)\) \{([\s\S]*?)\n  \}/)[1];
  const prepareNative = new Function("simplifyBonus", "defaultUnits", "convertLength", "ConditionData", `return function(rollData){${nativeBody}}`)
    (value => Number(value) || 0, () => "m", value => value, { hasLevels: () => false });
  actor.statuses = new Set(); actor.statuses.reduce = (_, initial) => initial;
  actor.flags = {}; actor.hasConditionEffect = type => type === "halfMovement";
  CONFIG.DND5E.defaultUnits = { length: { imperial: "ft" } };
  system.attributes.movement.multiplier = 1;
  prepareNative.call(system, {});
  assert.equal(system.attributes.movement.speeds.walk, 2, "native condition halves the calculated base");
  assert.equal(system.attributes.movement.slowed, true, "native indicators compare against the profile's base");
  prepareEmbedded.call(system); actor.hasConditionEffect = type => type === "noMovement";
  prepareNative.call(system, {});
  assert.equal(system.attributes.movement.speeds.walk, 0);
  assert.equal(system.attributes.movement.speeds.swim, 0);
});
