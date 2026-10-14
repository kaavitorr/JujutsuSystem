import assert from "node:assert/strict";
import { test } from "node:test";
import { grauFlanqueamento } from "../module/systems/flanking.mjs";
import { buildLegacy2Context } from "../module/applications/actor/jj/legacy2-sheet.mjs";

const engagement = await import("../module/systems/engagement.mjs").catch(() => ({}));
const ruleset = { estilo: () => null, atributoPrincipal: () => "str", rankLabel: () => "", rankBonus: () => 0,
  nivel: () => 1, trainingPointsTotal: () => 0, trainingPointsAvailable: () => 0, atributosAdicionais: () => 0,
  };
const actor = (type = "character", size = "med", value) => ({ type, system: {
  legacy2: { engagement: value }, traits: { size }, attributes: { hp: { max: 10, value: 10 } }, abilities: {}
} });
function encounter(targetActor) {
  const scene = { tokens: [], grid: { size: 100 } };
  const target = { actor: targetActor, disposition: 1, x: 0, y: 0, scene };
  const enemies = [[100, 0], [0, 100], [-100, 0]].map(([x, y]) => ({
    actor: actor(), disposition: -1, x, y, scene
  }));
  scene.tokens = [target, ...enemies];
  return { target, attacker: enemies[0], scene };
}

test("the summary and flanking use character engagement two and the same prepared Active Effect value", () => {
  const pc = actor();
  const { target, attacker } = encounter(pc);
  assert.equal(buildLegacy2Context(pc, { abilities: {} }, ruleset).engagement, 2);
  assert.equal(grauFlanqueamento(attacker, target), 1);
  pc.system.legacy2.engagement = 4;
  pc._source = { system: { legacy2: { engagement: 2 } } };
  const modified = buildLegacy2Context(pc, { abilities: {} }, ruleset);
  assert.equal(modified.engagement, 4);
  assert.equal(modified.engagementBase, 2, "editing keeps the stored base instead of saving the effect bonus");
  assert.equal(grauFlanqueamento(attacker, target), 0);
  pc.system.legacy2.engagement = 0;
  assert.equal(buildLegacy2Context(pc, { abilities: {} }, ruleset).engagement, 0);
  assert.equal(grauFlanqueamento(attacker, target), 3);
});

test("automatic NPC engagement follows size and explicit values survive preparation", () => {
  assert.equal(typeof engagement.prepareEngagement, "function");
  for (const [size, expected] of [["tiny", 1], ["sm", 1], ["med", 1], ["lg", 2], ["huge", 3], ["garg", 4]]) {
    const npc = actor("npc", size, null);
    engagement.prepareEngagement(npc.system, npc.type);
    assert.equal(npc.system.legacy2.engagement, expected);
    npc.system.legacy2.engagement += 2;
    engagement.prepareEngagement(npc.system, npc.type);
    assert.equal(engagement.engagementValue(npc), expected + 2);
  }
  for (const value of [0, 7]) {
    const npc = actor("npc", "garg", value);
    engagement.prepareEngagement(npc.system, npc.type);
    assert.equal(npc.system.legacy2.engagement, value);
  }
});

test("NPC flanking consumes its prepared engagement instead of a fixed size table", () => {
  const npc = actor("npc", "med", 3);
  const { target, attacker } = encounter(npc);
  assert.equal(grauFlanqueamento(attacker, target), 0);
});

test("the real schema exposes a numeric effect key with character and automatic NPC defaults", async () => {
  class DataField { constructor(options = {}) { Object.assign(this, options); } }
  class SchemaField extends DataField { constructor(fields, options) { super(options); this.fields = fields; } }
  class TypedObjectField extends DataField { constructor(element, options) { super(options); this.element = element; } }
  globalThis.foundry = { data: { fields: { DataField, NumberField: DataField, StringField: DataField, BooleanField: DataField, SchemaField, TypedObjectField } } };
  const { default: schema } = await import("../module/data/actor/legacy2-schema.mjs");
  const field = schema().fields.engagement;
  assert.ok(field, "system.legacy2.engagement exists in the actor schema");
  assert.equal(field.initial, 2);
  assert.equal(field.integer, true);
  assert.equal(field.min, 0);
  assert.equal(field.label, "Engajamento");
  assert.equal(schema({ engagementInitial: null }).fields.engagement.initial, null);
});
