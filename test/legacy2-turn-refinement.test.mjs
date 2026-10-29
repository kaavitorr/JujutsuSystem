import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { EnergySystem } from "../module/systems/energy.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version } };
globalThis.foundry = { utils: { expandObject: object => object } };
function actorFixture(type = "character") {
  const writes = [];
  const actor = { id: "actor", uuid: type === "npc" ? "Scene.scene.Token.token.Actor.actor" : "Actor.actor",
    type, name: "Criatura", itemTypes: { class: [] }, testUserPermission: () => true,
    system: { details: { level: 10 }, legacy2: { nd: 10 }, energy: { total: 100, generated: 25,
      generation: {}, bonuses: {}, intensiveTraining: { generatedEnergy: 5 } }, energyAbilities: { accumulation: {}, liberation: {} } },
    async update(data) { writes.push(data); for (const [path, value] of Object.entries(data)) {
      const keys = path.split("."), key = keys.pop(); keys.reduce((obj, part) => obj[part], this)[key] = value;
    } } };
  return { actor, writes };
}

const source = readFileSync(new URL("../module/applications/actor/energy-generation-dialog.mjs", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace("export default class", "return class");
let opened;
class DialogBoundary extends EventTarget {
  constructor(options) { super(); this.options = options; this.id = "dialog"; }
  async _prepareContext() { return {}; }
  render() { opened = this; }
  async close() { this.dispatchEvent(new Event("close")); }
}
const Dialog = new Function("Dialog5e", "EnergySystem", "Ruleset", source)(DialogBoundary, EnergySystem, Ruleset);

test("Cancel closes the real refinement dialog without producing choices", async () => {
  const pending = Dialog.configure(actorFixture().actor);
  const cancel = opened.options.buttons.find(button => button.name === "skip" || button.name === "cancel");
  const action = Dialog.DEFAULT_OPTIONS.actions?.[cancel.action];
  assert.equal(typeof action, "function", "the Cancel button must actually close the dialog");
  await action.call(opened);
  assert.equal(await pending, null);
});

test("closing the dialog is cancellation; submitting returns exactly the player's choice", async () => {
  const pending = Dialog.configure(actorFixture().actor); await opened.close();
  assert.equal(await pending, null);
  const confirmed = Dialog.configure(actorFixture().actor);
  await Dialog.DEFAULT_OPTIONS.form.handler.call(opened, {}, {}, { object: { flatBonus: 3 } });
  assert.deepEqual(await confirmed, { flatBonus: 3 });
});

test("the modal shows the actual normal or doubled ceiling, including NPC ND and training", async () => {
  for (const type of ["character", "npc"]) {
    const { actor } = actorFixture(type);
    if (type === "npc") actor.system.details.level = 1;
    for (const [reserves, expected] of [[0, 25], [4, 25], [5, 50]]) {
      const pending = Dialog.configure(actor, { reserves });
      const context = await opened._prepareContext({});
      assert.equal(context.limite, expected);
      await opened.close(); await pending;
    }
  }
});

function socketBoundary(actor, choice, user) {
  const handlers = [], emitted = [], pending = [], dialogs = [];
  const hooks = { on(_name, ready) { ready(); } };
  Object.assign(game, { user, users: { activeGM: { id: "gm", isGM: true, active: true } },
    actors: { get: () => actor }, socket: { on: (_channel, handler) => handlers.push(handler),
      emit: (_channel, data) => emitted.push(data) } });
  const socketSource = readFileSync(new URL("../module/applications/actor/jj/socket.mjs", import.meta.url), "utf8")
    .replace(/^import .*;\r?\n/gm, "");
  new Function("Hooks", "EnergyGenerationDialog", "EnergySystem", "Ruleset", "fromUuid", "setTimeout", socketSource)(
    hooks, { async configure(...args) { dialogs.push(args); return choice; } }, EnergySystem, Ruleset,
    async uuid => uuid === actor.uuid ? actor : null, callback => pending.push(callback()));
  return { emitted, dialogs, async receive(data) { for (const handler of handlers) await handler(data); await Promise.all(pending); } };
}

test("remote owners can cancel without energy writes or a generation result broadcast", async () => {
  const { actor, writes } = actorFixture();
  const socket = socketBoundary(actor, null, { id: "player", isGM: false });
  await socket.receive({ action: "energyGenerationDialog", userId: "player", actorId: actor.id, actorUuid: actor.uuid, context: { reserves: 5 } });
  assert.equal(socket.dialogs.length, 1);
  assert.equal(actor.system.energy.generated, 25); assert.equal(actor.system.energy.total, 100);
  assert.deepEqual(writes, []); assert.deepEqual(socket.emitted, []);
});

test("a remote confirmation refines the correct token NPC once, with the saved double ceiling", async () => {
  const { actor, writes } = actorFixture("npc");
  const socket = socketBoundary(actor, { flatBonus: 0 }, { id: "player", isGM: false });
  // An unlinked token must be resolved by UUID, rather than editing its world actor.
  game.actors.get = () => { throw new Error("World actor lookup would edit the wrong creature"); };
  await socket.receive({ action: "energyGenerationDialog", userId: "player", actorId: actor.id, actorUuid: actor.uuid, context: { reserves: 5 } });
  assert.equal(actor.system.energy.generated, 50); assert.equal(actor.system.energy.total, 75);
  assert.equal(writes.length, 1); assert.deepEqual(socket.emitted, []);
});

test("other clients do not open the modal and stale 2.0 result broadcasts cannot refine twice", async () => {
  const { actor, writes } = actorFixture();
  const socket = socketBoundary(actor, { flatBonus: 7 }, { id: "gm", isGM: true });
  await socket.receive({ action: "energyGenerationDialog", userId: "player", actorId: actor.id });
  await socket.receive({ action: "energyChoicesResult", actorId: actor.id, choices: { flatBonus: 7 } });
  assert.equal(socket.dialogs.length, 0); assert.deepEqual(writes, []);
});

test("1.0 still sends the choice to the GM, who processes it only on the active GM client", async () => {
  version = "1.0";
  try {
    const { actor, writes } = actorFixture(); actor.system.energy.generated = 0;
    const owner = socketBoundary(actor, { baseMultiplier: 2 }, { id: "player", isGM: false });
    await owner.receive({ action: "energyGenerationDialog", userId: "player", actorId: actor.id });
    assert.equal(writes.length, 0); assert.equal(owner.emitted.length, 1);
    const passive = socketBoundary(actor, null, { id: "passive-gm", isGM: true });
    await passive.receive(owner.emitted[0]); assert.equal(writes.length, 0);
    const active = socketBoundary(actor, null, { id: "gm", isGM: true });
    await active.receive(owner.emitted[0]); assert.equal(writes.length, 1);
    assert.equal(actor.system.energy.generated, 25); assert.equal(actor.system.energy.total, 75);
  } finally { version = "2.0"; }
});

test("a null choice never refines energy or recovers stamina", async () => {
  const { actor, writes } = actorFixture();
  await EnergySystem.processTurnStartWithChoices(actor, null, { reserves: 5 });
  assert.deepEqual(writes, []);
});
