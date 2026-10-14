import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import * as resources from "../module/applications/actor/jj/legacy2-extra-resources.mjs";
import { configureExtraResource, deleteExtraResource } from "../module/applications/actor/jj/legacy2-resource-dialog.mjs";

function fixture() {
  const calls = [];
  const actor = { items: [], system: { legacy2: {} }, async update(data) { calls.push(data); } };
  const activity = { id: "heal", uuid: "Actor.a.Item.b.Activity.heal", name: "Curar", canUse: true,
    consumption: { targets: [{ type: "attribute", target: "energy.total", value: "2" }] },
    async use(...args) { calls.push(args); return null; } };
  const item = { actor, name: "Reversa", system: { activities: [activity] },
    async updateActivity(id, data) { calls.push({ id, ...data }); } };
  activity.item = item;
  actor.items.push(item);
  return { actor, activity, calls, sheet: { actor, isEditable: true } };
}

test("PER defaults and custom resources expose real native consumption paths", () => {
  const { actor } = fixture();
  let cards = resources.extraResourceCards(actor);
  assert.equal(cards[0].value, 0);
  assert.equal(cards[0].max, 30);
  assert.equal(cards[0].path, "system.legacy2.reverseEnergy.value");
  actor.system.legacy2.reverseEnergy = { value: 44, max: 60 };
  actor.system.legacy2.extraResources = { focus: { label: "Foco", value: 2, max: 5 } };
  cards = resources.extraResourceCards(actor);
  assert.equal(cards[0].value, 44);
  assert.equal(cards[0].max, 60);
  assert.equal(cards[1].path, "system.legacy2.extraResources.focus.value");
  assert.deepEqual(resources.extraResourceTargets(actor).map(t => t.value), [
    "legacy2.reverseEnergy.value", "legacy2.extraResources.focus.value"
  ]);
  assert.equal(resources.extraResourceById(actor, "../../bad"), null);
});

test("activation invokes the selected owned native activity exactly once and never deducts itself", async () => {
  const f = fixture();
  f.actor.system.legacy2.reverseEnergy = { value: 3, max: 30, activity: f.activity.uuid };
  const event = {};
  await resources.useExtraResource(f.sheet, "reverseEnergy", event);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.calls[0], [{ event }, { options: { sheet: f.sheet } }]);
  assert.equal(f.actor.system.legacy2.reverseEnergy.value, 3, "cancelled native use leaves PER intact");
  f.sheet.isEditable = false;
  await resources.useExtraResource(f.sheet, "reverseEnergy", event);
  f.sheet.isEditable = true;
  f.activity.canUse = false;
  await resources.useExtraResource(f.sheet, "reverseEnergy", event);
  f.activity.canUse = true;
  f.activity.item.actor = {};
  await resources.useExtraResource(f.sheet, "reverseEnergy", event);
  assert.equal(f.calls.length, 1, "read-only, unusable and foreign activity cannot activate");
});

test("resource cost uses one native attribute target and preserves all other costs", () => {
  const f = fixture();
  const card = resources.extraResourceById(f.actor, "reverseEnergy");
  f.activity.consumption.targets.push(
    { type: "attribute", target: "legacy2.reverseEnergy.value", value: "1", scaling: { mode: "amount", formula: "1" } },
    { type: "attribute", target: "legacy2.reverseEnergy.value", value: "3" }
  );
  const targets = resources.resourceConsumptionTargets(f.activity, card, 2);
  assert.deepEqual(targets[0], f.activity.consumption.targets[0]);
  assert.equal(targets.length, 2);
  assert.equal(targets[1].value, "2");
  assert.deepEqual(targets[1].scaling, { mode: "amount", formula: "1" });
  assert.equal(resources.resourceConsumptionTargets(f.activity, card, 0).length, 1);
});

test("invalid configuration never saves and missing activities cannot be bound", async () => {
  const f = fixture();
  for ( const data of [
    { label: "PER", max: -1, value: 0 }, { label: "PER", max: 30, value: 31 },
    { label: "PER", max: 30, value: 1.5 }, { label: "PER", max: 30, value: 1, activity: "Actor.foreign" },
    { label: "PER", max: 30, value: 1, activity: f.activity.uuid, cost: -1 }
  ] ) assert.equal(await resources.saveExtraResource(f.sheet, "reverseEnergy", data), false);
  assert.equal(f.calls.length, 0);
  assert.equal(await resources.saveExtraResource(f.sheet, "reverseEnergy", {
    label: "PER", max: 60, value: 10, activity: f.activity.uuid, cost: 2
  }), true);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0]["consumption.targets"].length, 2);
  assert.equal(f.calls[1]["system.legacy2.reverseEnergy"].max, 60);
});

test("binding an activity does not bake a prepared Active Effect maximum into the base resource", async () => {
  const f = fixture();
  f.actor._source = { system: { legacy2: { reverseEnergy: { value: 10, max: 30 } } } };
  f.actor.system.legacy2.reverseEnergy = { value: 10, max: 60 };
  await resources.saveExtraResource(f.sheet, "reverseEnergy", {
    label: "Energia Reversa", value: 10, max: 60, activity: f.activity.uuid, cost: ""
  });
  assert.equal(Object.hasOwn(f.calls[0]["system.legacy2.reverseEnergy"], "max"), false);
  assert.equal(f.actor._source.system.legacy2.reverseEnergy.max, 30);
});

test("the PER gear saves a new round limit and rejects invalid limits without touching the actor", async () => {
  const f = fixture();
  const data = { label: "Energia Reversa", value: 0, max: 30, activity: "", cost: "", maxPerRound: 5 };
  assert.equal(await resources.saveExtraResource(f.sheet, "reverseEnergy", data), true);
  assert.equal(f.calls[0]["system.legacy2.reverseEnergy"].maxPerRound, 5);
  for (const maxPerRound of [-1, 1.5, Infinity, "bad", ""]) {
    const invalid = fixture();
    assert.equal(await resources.saveExtraResource(invalid.sheet, "reverseEnergy", { ...data, maxPerRound }), false);
    assert.equal(invalid.calls.length, 0);
  }
});

test("saving unchanged PER gear fields never bakes a trait's round-limit bonus into source data", async () => {
  const f = fixture();
  f.actor.system.legacy2.reverseEnergy = { value: 2, max: 30, maxPerRound: 5 };
  f.actor._source = { system: { legacy2: { reverseEnergy: { maxPerRound: 3 } } } };
  await resources.saveExtraResource(f.sheet, "reverseEnergy", {
    label: "Energia Reversa", value: 2, max: 30, maxPerRound: 5, activity: "", cost: ""
  });
  assert.equal(Object.hasOwn(f.calls[0]["system.legacy2.reverseEnergy"], "maxPerRound"), false);
  assert.equal(f.actor._source.system.legacy2.reverseEnergy.maxPerRound, 3);
});

test("native attribute consumption spends PER from actor data and rejects insufficient stock", async () => {
  const source = readFileSync(new URL("../module/data/activity/fields/consumption-targets-field.mjs", import.meta.url), "utf8");
  const body = source.match(/async consumeAttribute\(config, updates\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(body);
  // Exercise the production native consumer rather than an extra-card imitation.
  const getProperty = (object, path) => path.split(".").reduce((o, k) => o?.[k], object);
  const foundry = { utils: { getProperty, hasProperty: (o, p) => getProperty(o, p) !== undefined } };
  const consumer = new Function("foundry", "ConsumptionError", "getHumanReadableAttributeLabel", "_loc", "formatNumber",
    `return async function(config, updates) {${body}}`)(
    foundry, class ConsumptionError extends Error {}, () => "PER", key => key, String
  );
  const { actor } = fixture();
  actor.system.legacy2.reverseEnergy = { value: 3, max: 30 };
  actor._source = { system: actor.system };
  const target = { actor, target: "legacy2.reverseEnergy.value", async resolveCost() { return { total: 2 }; } };
  const updates = { actor: {}, rolls: [] };
  await consumer.call(target, {}, updates);
  assert.equal(updates.actor["system.legacy2.reverseEnergy.value"], 1);
  actor.system.legacy2.reverseEnergy.value = 1;
  await assert.rejects(() => consumer.call(target, {}, { actor: {}, rolls: [] }));
});

test("native consumption dropdown offers PER and custom resources only in 2.0 without duplicate entries", () => {
  const source = readFileSync(new URL("../module/data/activity/fields/consumption-targets-field.mjs", import.meta.url), "utf8");
  const body = source.match(/static validAttributeTargets\(\) \{([\s\S]*?)\n  \}/)[1];
  const Ruleset = { isV2: () => true };
  const method = new Function("TokenDocument", "_loc", "getHumanReadableAttributeLabel", "Ruleset", "extraResourceTargets",
    `return function() {${body}}`)(
    { implementation: { getConsumedAttributes: () => ["energy.total", "legacy2.reverseEnergy.value"] } },
    String, () => "", Ruleset, resources.extraResourceTargets
  );
  const { actor } = fixture();
  actor.system.legacy2.extraResources = { focus: { label: "Foco", value: 2, max: 5 } };
  let result = method.call({ actor });
  assert.equal(result.filter(t => t.value === "legacy2.reverseEnergy.value").length, 1);
  assert.equal(result.find(t => t.value === "legacy2.extraResources.focus.value").label, "Foco");
  Ruleset.isV2 = () => false;
  result = method.call({ actor });
  assert.equal(result.length, 2, "1.0 registry unchanged");
});

test("native activity prompts resolve PER and actor-specific resource names before the label cache", () => {
  const source = readFileSync(new URL("../module/utils.mjs", import.meta.url), "utf8");
  const body = source.match(/export function getHumanReadableAttributeLabel\(attr, \{ actor, item, prefixItemName=true \}=\{\}\) \{([\s\S]*?)\n\}/)[1];
  const method = new Function("ActiveEffect", "Ruleset", "extraResourceLabel", `return function(attr, {actor}={}) {${body}}`)(
    { implementation: { SHIM_FIELDS: {} } }, { isV2: () => true }, resources.extraResourceLabel
  );
  const { actor } = fixture();
  actor.system.legacy2.extraResources = { focus: { label: "Foco", value: 2, max: 5 } };
  assert.equal(method("system.legacy2.reverseEnergy.value", { actor }), "Energia Reversa (PER)");
  assert.equal(method("legacy2.extraResources.focus.value", { actor }), "Foco");
  actor.system.legacy2.extraResources.focus.label = "Concentração";
  assert.equal(method("legacy2.extraResources.focus.value", { actor }), "Concentração");
});

test("configuration cancellation and read-only sheets leave the resource and activity intact", async () => {
  const f = fixture();
  let dialogs = 0;
  globalThis.foundry = { utils: { escapeHTML: String, randomID: () => "newResource" }, applications: { api: {
    DialogV2: { async wait() { dialogs++; return null; } }
  } } };
  await configureExtraResource(f.sheet, "reverseEnergy");
  assert.equal(dialogs, 1);
  assert.equal(f.calls.length, 0);
  f.sheet.isEditable = false;
  await configureExtraResource(f.sheet);
  assert.equal(dialogs, 1);
  delete globalThis.foundry;
});

test("changing the bound activity preserves its existing cost unless a new cost is explicitly entered", async () => {
  const f = fixture();
  f.actor.system.legacy2.reverseEnergy = { value: 3, max: 30, activity: f.activity.uuid };
  f.activity.consumption.targets.push({ type: "attribute", target: "legacy2.reverseEnergy.value", value: "2" });
  const other = { ...f.activity, id: "other", uuid: "Actor.a.Item.b.Activity.other",
    consumption: { targets: [{ type: "attribute", target: "legacy2.reverseEnergy.value", value: "1 + @abilities.con.value" }] } };
  f.activity.item.system.activities.push(other);
  globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: { async wait(config) {
    assert.match(config.content, /name="resource-cost" value=""/, "blank means preserve, regardless of initial activity");
    const fields = { "resource-value": "3", "resource-max": "30", "resource-activity": other.uuid, "resource-cost": "" };
    return config.buttons[0].callback({}, {}, { element: { querySelector(selector) {
      const name = selector.match(/name="(.+?)"/)[1];
      return name in fields ? { value: fields[name] } : null;
    } } });
  } } } } };
  await configureExtraResource(f.sheet, "reverseEnergy");
  assert.equal(f.calls.length, 1, "only saves actor binding; no cost update");
  assert.equal(f.calls[0]["system.legacy2.reverseEnergy"].activity, other.uuid);
  assert.equal(other.consumption.targets[0].value, "1 + @abilities.con.value");
  delete globalThis.foundry;
});

test("removing a custom resource clears only matching native costs and preserves owned activities", async () => {
  const f = fixture();
  f.actor.system.legacy2.extraResources = { focus: { label: "Foco", value: 2, max: 5 } };
  f.activity.consumption.targets.push({ type: "attribute", target: "legacy2.extraResources.focus.value", value: "1" });
  globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: { confirm: async () => true } } } };
  await deleteExtraResource(f.sheet, "focus");
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0]["consumption.targets"], [{ type: "attribute", target: "energy.total", value: "2" }]);
  assert.deepEqual(f.calls[1], { "system.legacy2.extraResources.-=focus": null });
  assert.equal(f.actor.items.length, 1);
  await deleteExtraResource(f.sheet, "reverseEnergy");
  assert.equal(f.calls.length, 2);
  delete globalThis.foundry;
});
