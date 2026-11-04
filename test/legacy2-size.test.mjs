import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareSizeRules, resetSizePreparation, sizeRules, sizeGrappleImmune, sizeTouchRange, sizeContext, sizeMeleeReach } from "../module/systems/legacy2-size.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
function creature(type = "character", size = "med") {
  version = "2.0";
  const system = { traits: { size }, abilities: { str: { value: 4 }, dex: { value: 5 } },
    attributes: { movement: { ignoredDifficultTerrain: new Set(["plants"]) } } };
  return { type, system, _source: { system: { traits: { size }, abilities: { str: { value: 4 }, dex: { value: 5 } } } } };
}

test("the three sizes apply their stated attributes, reach, terrain and push rules to players and NPCs", () => {
  for (const type of ["character", "npc"]) {
    for (const [size, strength, agility, reach, advantages, immune] of [
      ["lg", 4, 5, 2, 2, false], ["huge", 4, 4, 3, 4, false], ["grg", 6, 3, 5, 0, true]
    ]) {
      const actor = creature(type, size), before = structuredClone(actor._source);
      prepareSizeRules(actor);
      assert.equal(actor.system.abilities.str.value, strength);
      assert.equal(actor.system.abilities.dex.value, agility);
      assert.equal(sizeRules(actor).touch, reach);
      assert.equal(sizeRules(actor).pushAdvantages, advantages);
      assert.equal(sizeRules(actor).pushImmune, immune);
      assert.deepEqual([...actor.system.attributes.movement.ignoredDifficultTerrain], ["plants", "all"]);
      assert.deepEqual(actor._source, before);
    }
  }
});

test("repeated preparation and size transitions never accumulate attributes or erase other terrain exemptions", () => {
  const actor = creature("character", "huge");
  for (let n = 0; n < 4; n++) prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 4);
  actor.system.traits.size = "grg"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 3); assert.equal(actor.system.abilities.str.value, 6);
  actor.system.traits.size = "med"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 5); assert.equal(actor.system.abilities.str.value, 4);
  assert.deepEqual([...actor.system.attributes.movement.ignoredDifficultTerrain], ["plants"]);
  // Native preparation resets saved data before applying Active Effects again.
  resetSizePreparation(actor);
  actor.system.abilities.dex.value = 7; actor.system.abilities.str.value = 8;
  actor.system.traits.size = "grg"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 5); assert.equal(actor.system.abilities.str.value, 10);
  actor.system.traits.size = "med"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 7); assert.equal(actor.system.abilities.str.value, 8);
});

test("size penalties may reach zero and bonuses can exceed the normal NPC distribution cap", () => {
  const actor = creature("npc", "grg"); actor.system.abilities.dex.value = 1; actor.system.abilities.str.value = 12;
  prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 0); assert.equal(actor.system.abilities.str.value, 14);
  actor.system.traits.size = "med"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 1); assert.equal(actor.system.abilities.str.value, 12);
});

test("grapple immunity compares the identified grappler size, including the exact upper boundary", () => {
  const target = creature("npc", "huge");
  for (const size of ["tiny", "sm", "med"]) assert.equal(sizeGrappleImmune(target, creature("character", size)), true);
  for (const size of ["lg", "huge", "grg"]) assert.equal(sizeGrappleImmune(target, creature("character", size)), false);
  target.system.traits.size = "grg";
  assert.equal(sizeGrappleImmune(target, creature("character", "lg")), true);
  assert.equal(sizeGrappleImmune(target, creature("character", "huge")), false);
  assert.equal(sizeGrappleImmune(target, null), false);
  assert.equal(sizeGrappleImmune(target, { type: "character", system: {} }), false);
});

test("touch adjustments leave ranged techniques and saved range data unchanged", () => {
  const actor = creature("npc", "huge"), touch = { units: "touch", value: null, override: true };
  assert.deepEqual(sizeTouchRange(actor, touch), { ...touch, units: "m", value: 3 });
  assert.deepEqual(touch, { units: "touch", value: null, override: true });
  const ranged = { units: "m", value: 20 };
  assert.equal(sizeTouchRange(actor, ranged), null);
  actor.system.traits.size = "med"; assert.equal(sizeTouchRange(actor, touch), null);
});

test("1.0 worlds and non-creatures retain their original size behavior", () => {
  const actor = creature("npc", "grg"); version = "1.0"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.dex.value, 5);
  assert.equal(sizeRules(actor).pushImmune, false);
  assert.equal(sizeTouchRange(actor, { units: "touch" }), null);
  version = "2.0"; actor.type = "vehicle"; prepareSizeRules(actor);
  assert.equal(actor.system.abilities.str.value, 4);
});

test("the size selector edits the saved category without persisting a temporary size effect", () => {
  const actor = creature("npc", "med"); actor.system.traits.size = "huge";
  const context = sizeContext(actor);
  assert.equal(context.label, "Enorme"); assert.equal(context.touch, 3);
  assert.equal(context.options.find(option => option.selected).value, "med");
});

test("melee weapons can reach the creature's Touch distance while preserving longer weapon reach", () => {
  for (const [size, reach] of [["lg", 2], ["huge", 3], ["grg", 5]]) {
    const actor = creature("npc", size);
    assert.equal(sizeMeleeReach(actor, 1), reach);
    assert.equal(sizeMeleeReach(actor, sizeMeleeReach(actor, 1)), reach);
    assert.equal(sizeMeleeReach(actor, 6), 6);
  }
  const actor = creature("character", "med"); assert.equal(sizeMeleeReach(actor, 1.5), 1.5);
});
