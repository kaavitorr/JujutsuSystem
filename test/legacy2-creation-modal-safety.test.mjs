import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectCreationAdvancements } from "../module/applications/actor/creation/creation-advancements-2.mjs";
import { CharacterBoundary, NativeManager } from "./helpers/creation-native-boundary.mjs";

globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? "2.0" : {} } };
const feature = { _id: "source", uuid: "Item.eyes", type: "feat", name: "Seis Olhos", flags: {},
  system: { prerequisites: { repeatable: false } }, effects: [{ _id: "effect", transfer: true, name: "Percepção" }] };
const documents = new Map([[feature.uuid, feature]]);
const resolve = uuid => documents.get(uuid) ?? [...documents.values()].find(doc => doc._id === uuid?.split(".").at(-1));
globalThis.fromUuid = async uuid => resolve(uuid);
globalThis.fromUuidSync = resolve;
const tick = () => new Promise(resolve => setImmediate(resolve));
const button = action => ({ disabled: false, dataset: { action } });
const optional = () => ({ _id: "grant", type: "ItemGrant", level: 0,
  configuration: { optional: true, items: [{ uuid: feature.uuid, optional: true }] }, value: {} });
const required = (level = 1) => ({ _id: "choice", type: "ItemChoice",
  configuration: { choices: { [level]: { count: 1, replacement: false } }, pool: [{ uuid: feature.uuid }],
    restriction: {}, allowDrops: false }, value: { added: {}, replaced: {} } });
function plan(advancement, extra = []) {
  return { actor: {}, create: [{ _id: "origin", name: "Origem", type: "race", flags: {},
    system: { advancement: { [advancement._id]: advancement } } }, ...extra] };
}
async function start(batch, actor = new CharacterBoundary()) {
  let manager, state = "pending", value, error;
  class Manager extends NativeManager { constructor(...args) { super(...args);manager = this; } }
  const pending = collectCreationAdvancements(actor, batch, { Manager, resolve: fromUuid });
  pending.then(result => { state = "resolved";value = result; }, reason => { state = "rejected";error = reason; });
  await tick();
  return { actor, manager, pending, get state() { return state; }, get value() { return value; }, get error() { return error; },
    action: async action => { const target = button(action);await manager.constructor.DEFAULT_OPTIONS.actions[action].call(manager, {}, target);return target; } };
}

test("a customization feature is checked in its native grant and keeps one item with its native ownership", async () => {
  const existing = structuredClone(feature);delete existing.uuid;existing._id = "custom";
  existing.flags = { "jujutsu-system": { creation2Source: feature.uuid } };
  const run = await start(plan(optional(), [existing]));
  try {
    assert.equal(run.manager.step.flow.context.items[0].checked, true);
    assert.equal(run.manager.clone.items.get("origin").advancement.byId.grant.value.added.custom, feature.uuid);
    await run.manager.step.flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: feature.uuid } });
    await run.action("complete");
    const result = await run.pending, owned = result.create.filter(item => item.name === feature.name);
    assert.equal(owned.length, 1);assert.equal(owned[0]._id, "custom");
    assert.equal(owned[0].effects[0]._id, "effect");
    for (const scope of ["jujutsu-system", "JujutsuLegacy"]) {
      assert.equal(owned[0].flags[scope].advancementOrigin, "origin.grant");
      assert.equal(owned[0].flags[scope].advancementRoot, "origin.grant");
    }
    assert.equal(result.create[0].system.advancement.grant.value.added.custom, feature.uuid);
    assert.equal(run.actor.data.items.length, 0);
  } finally { await run.manager.close({ skipConfirmation: true }); }
});

test("matching names and repeatable features do not consume an independent native grant", async () => {
  const repeatable = structuredClone(feature);repeatable.system.prerequisites.repeatable = true;
  documents.set(feature.uuid, repeatable);
  const owned = structuredClone(repeatable);delete owned.uuid;owned._id = "repeat";
  owned.flags = { "jujutsu-system": { creation2Source: feature.uuid } };
  const other = { ...structuredClone(owned), _id: "different", flags: { "jujutsu-system": { creation2Source: "Item.other" } } };
  const run = await start(plan(optional(), [owned, other]));
  try {
    assert.equal(run.manager.step.flow.context.items[0].checked, false);
    await run.manager.step.flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: feature.uuid } });
    await run.action("complete");
    assert.equal((await run.pending).create.filter(item => item.name === feature.name).length, 3);
  } finally { documents.set(feature.uuid, feature);await run.manager.close({ skipConfirmation: true }); }
});

test("an unrelated non-repeatable feature with the same name keeps its own source and effects", async () => {
  const other = structuredClone(feature);delete other.uuid;other._id = "other";
  other.flags = { "jujutsu-system": { creation2Source: "Item.other" } };
  const run = await start(plan(optional(), [other]));
  try {
    assert.equal(run.manager.step.flow.context.items[0].checked, false);
    await run.manager.step.flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: feature.uuid } });
    await run.action("complete");
    const result = await run.pending;
    assert.equal(result.create.length, 3);
    assert.equal(result.create.find(item => item._id === "other").flags["jujutsu-system"].creation2Source, "Item.other");
    assert.equal(Object.values(result.create[0].system.advancement.grant.value.added)[0], feature.uuid);
  } finally { await run.manager.close({ skipConfirmation: true }); }
});

test("the real Gojo grant reuses Seis Olhos selected through customization", async () => {
  const snapshot = JSON.parse(readFileSync(new URL("./fixtures/creation-combat-styles.json", import.meta.url)));
  for (const doc of snapshot.docs) documents.set(doc.uuid, doc);
  const origin = structuredClone(snapshot.docs.find(doc => doc.name === "Linhagem - Gojo"));
  const eyes = structuredClone(snapshot.docs.find(doc => doc.name === "Seis Olhos"));
  const source = eyes.uuid;delete eyes.uuid;eyes._id = "custom";
  eyes.flags = { ...eyes.flags, "jujutsu-system": { ...eyes.flags?.["jujutsu-system"], creation2Source: source } };
  origin._id = "origin";
  const run = await start({ actor: {}, create: [origin, eyes] });
  try {
    const flow = run.manager.step.flow;
    assert.equal(flow.advancement.type, "ItemGrant");
    assert.equal(flow.context.items.find(item => item.uuid === source).checked, true);
    await flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: source } });
    await run.action("complete");
    const result = await run.pending, owned = result.create.filter(item => item.name === "Seis Olhos");
    assert.equal(owned.length, 1);assert.equal(owned[0]._id, "custom");
    assert.deepEqual(owned[0].effects, eyes.effects);assert.deepEqual(owned[0].system.activities, eyes.system.activities);
    assert.equal(result.create[0].system.advancement[flow.advancement.id].value.added.custom, source);
  } finally {
    for (const doc of snapshot.docs) documents.delete(doc.uuid);
    await run.manager.close({ skipConfirmation: true });
  }
});

for (const level of [0, 1]) test(`a required level ${level} choice stays interactive until its selection is complete`, async () => {
  const notifications = [], original = ui.notifications.error;ui.notifications.error = message => notifications.push(message);
  const run = await start(plan(required(level)));
  try {
    const target = await run.action("complete");await tick();
    assert.equal(run.state, "pending");assert.equal(run.manager.rendered, true);
    assert.equal(run.manager.step.flow.advancement.id, "choice");assert.equal(target.disabled, false);
    assert.match(notifications.at(-1), /1/);
    await run.manager.step.flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: feature.uuid } });
    await run.action("complete");
    const result = await run.pending;assert.equal(result.create.length, 2);
    const choice = result.create[0].system.advancement.choice;
    assert.equal(Object.values(choice.value.added[level])[0], feature.uuid);
  } finally { ui.notifications.error = original;await run.manager.close({ skipConfirmation: true }); }
});

test("Next cannot bypass an incomplete required choice to reach the later origin grant", async () => {
  const notifications = [], original = ui.notifications.error;ui.notifications.error = message => notifications.push(message);
  const batch = plan(required(0));batch.create[0].system.advancement.grant = optional();
  const run = await start(batch);
  try {
    await run.action("next");
    assert.equal(run.manager.step.flow.advancement.id, "choice");assert.equal(run.state, "pending");
    assert.equal(notifications.length, 1);
  } finally { ui.notifications.error = original;await run.manager.close({ skipConfirmation: true }); }
});

test("a pending replacement still requires its replacement item when the level grants no new choices", async () => {
  const advancement=required();
  advancement.configuration.choices={0:{count:1,replacement:false},1:{count:0,replacement:true}};
  advancement.value={added:{0:{previous:feature.uuid},1:{}},replaced:{1:{original:"previous",level:0}}};
  const previous={...structuredClone(feature),_id:"previous"};
  const notices=[],original=ui.notifications.error;ui.notifications.error=message=>notices.push(message);
  const run=await start(plan(advancement,[previous]));
  try {
    assert.equal(run.manager.step.flow.counts.max,1);
    await run.action("complete");await tick();
    assert.equal(run.state,"pending");assert.equal(notices.length,1);
    assert.equal(run.manager.rendered,true);
  }finally{ui.notifications.error=original;await run.manager.close({skipConfirmation:true});}
});

test("an optional native origin grant may be declined", async () => {
  const run = await start(plan(optional()));
  await run.action("complete");
  assert.equal((await run.pending).create.length, 1);assert.equal(run.actor.data.items.length, 0);
});

test("a render hook interruption rejects creation collection instead of leaving the hidden creator waiting", async () => {
  const original = Hooks.call;Hooks.call = () => false;
  const run = await start(plan(required()));
  try {
    await tick();assert.equal(run.state, "rejected");
    assert.match(run.error.message, /interrompid|cancelad/i);
    assert.equal(run.manager.rendered, false);assert.equal(run.actor.data.items.length, 0);
  } finally { Hooks.call = original;await run.manager.close({ skipConfirmation: true }); }
});

test("an unexpected manual advancement error rejects the collection and closes the discarded preview", async () => {
  const run = await start(plan(optional()));
  const flow = run.manager.step.flow;flow.submit = async () => { throw new Error("Falha no avanço"); };
  const target = button("complete");
  try {
    await assert.rejects(run.manager.constructor.DEFAULT_OPTIONS.actions.complete.call(run.manager, {}, target), /Falha no avanço/);
    await tick();assert.equal(run.state, "rejected");assert.equal(run.error.message, "Falha no avanço");
    assert.equal(run.manager.rendered, false);assert.equal(flow.rendered, false);assert.equal(target.disabled, false);
    assert.equal(run.actor.data.items.length, 0);
  } finally { await run.manager.close({ skipConfirmation: true }); }
});

test("an error from a native checkbox form rejects collection and permits a clean retry", async () => {
  const run = await start(plan(optional())), flow = run.manager.step.flow;
  flow.advancement.apply = async () => { throw new Error("Falha ao selecionar benefício"); };
  try {
    await assert.rejects(flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: feature.uuid } }), /Falha ao selecionar/);
    await tick();assert.equal(run.state, "rejected");assert.equal(run.manager.rendered, false);assert.equal(flow.rendered, false);
    const retry = await start(plan(optional()), run.actor);
    await retry.action("complete");assert.equal((await retry.pending).create.length, 1);
  } finally { await run.manager.close({ skipConfirmation: true }); }
});
