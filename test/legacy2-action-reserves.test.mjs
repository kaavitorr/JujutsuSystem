import assert from "node:assert/strict";
import { test } from "node:test";
import { EnergySystem } from "../module/systems/energy.mjs";

let version = "2.0";
const hooks = new Map();
globalThis.Hooks = { on(name, callback) { hooks.set(name, callback); } };
const requests = [];
const gm = { id: "gm", isGM: true, active: true }, player = { id: "player", isGM: false, active: true };
const users = [gm, player]; users.get = id => users.find(user => user.id === id); users.activeGM = gm;
globalThis.game = { user: gm, users, settings: { get: () => version },
  socket: { emit: (_channel, data) => requests.push(data) } };
globalThis.foundry = { utils: { isEmpty: data => Object.keys(data).length === 0 } };
globalThis.ui = { notifications: { warn() {}, info() {} } };
await import("../module/systems/acoes-combate.mjs");
let serial = 0;
function fixture({ generated = 25, total = 100, reserves = 5, level = 10, training = 5 } = {}) {
  const writes = [];
  const actor = { id: `actor-${serial + 1}`, uuid: `Actor.actor-${serial + 1}`, name: "Feiticeiro", type: "character",
    testUserPermission: user => user.id === player.id, itemTypes: { class: [] },
    system: { details: { level }, legacy2: { actions: { value: 1, max: 6 }, reservas: { value: reserves } },
      energy: { generated, total, bonuses: { generatedEnergy: 0 }, intensiveTraining: { generatedEnergy: training },
        generation: { baseMultiplier: 2, turnMultiplier: 1, bonusFlat: 0 } },
      energyAbilities: { accumulation: {}, liberation: {} } },
    async update(data, options) {
      writes.push({ data, options });
      for (const [path, value] of Object.entries(data)) {
        const keys = path.split("."), key = keys.pop();
        keys.reduce((obj, part) => obj[part], this)[key] = value;
      }
    } };
  const combatant = { id: "one", actor };
  const combat = { id: `combat-${++serial}`, started: true, round: 2, combatant,
    current: { round: 2, turn: 1, combatantId: "one" }, previous: { round: 2, turn: 0, combatantId: "other" },
    combatants: new Map([["one", combatant]]) };
  return { actor, combat, writes };
}
async function enter(combat, changed = { turn: 1 }, { confirm = true } = {}) {
  const before = requests.length;
  await hooks.get("updateCombat")(combat, changed, {}, game.user.id);
  // The socket/UI boundary returns a choice later; energy is never confirmed by the turn hook itself.
  if (confirm && requests.length > before) {
    const request = requests.at(-1);
    await EnergySystem.processTurnStartWithChoices(combat.combatant.actor, { flatBonus: 0 }, request.context);
  }
}

test("a new turn opens refinement without moving energy until the player confirms, including NPCs", async () => {
  for (const type of ["character", "npc"]) {
    const { actor, combat } = fixture(); actor.type = type;
    const before = requests.length;
    await enter(combat, { turn: 1 }, { confirm: false });
    assert.equal(actor.system.energy.generated, 25);
    assert.equal(actor.system.energy.total, 100);
    assert.equal(actor.system.legacy2.actions.value, 6);
    assert.equal(actor.system.legacy2.reservas.value, 0);
    assert.equal(requests.length, before + 1);
    assert.equal(requests.at(-1).userId, "player");
    assert.equal(requests.at(-1).actorUuid, actor.uuid);
    await enter(combat, { turn: 1 }, { confirm: false });
    assert.equal(requests.length, before + 1);
  }
});

test("first-round confirmation uses the normal ceiling even with five actions saved", async () => {
  const { actor, combat } = fixture({ generated: 0 });
  combat.round = 1; combat.current.round = 1; combat.previous.round = 0;
  const before = requests.length;
  await enter(combat);
  assert.equal(requests.length, before + 1);
  assert.equal(actor.system.energy.generated, 25);
  assert.equal(actor.system.energy.total, 75);
});

test("confirming five reserved actions fills to twice normal refinement and debits only the missing energy", async () => {
  const { actor, combat, writes } = fixture();
  await enter(combat);
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 75);
  assert.equal(actor.system.legacy2.reservas.value, 0);
  assert.equal(actor.system.legacy2.actions.value, 6);
  assert.equal(writes.length, 2);
  assert.equal(writes.at(-1).options?.isEnergySystem, true);
});

test("repeated own turns and a direct round jump stay at 50 without another energy transfer", async () => {
  const { actor, combat } = fixture();
  await enter(combat);
  combat.previous = combat.current;
  combat.current = { round: 3, turn: 0, combatantId: "one" }; combat.round = 3;
  actor.system.legacy2.actions.value = 6;
  await enter(combat, { round: 3, turn: 0 });
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 75);
  combat.previous = combat.current;
  combat.current = { round: 7, turn: 0, combatantId: "one" }; combat.round = 7;
  await enter(combat, { round: 7, turn: 0 });
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 75);
  await EnergySystem.processTurnStart(actor);
  await EnergySystem.processTurnStartWithChoices(actor, { flatBonus: 0 });
  await EnergySystem.processTurnEnd(actor);
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 75);
});

test("after spending refined energy, a later eligible own turn transfers only the missing balance", async () => {
  const { actor, combat } = fixture({ generated: 50, total: 75 });
  await EnergySystem.consumePA(actor, 10);
  await enter(combat);
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 65);
});

test("insufficient or empty total energy cannot create refinement", async () => {
  for (const [total, expected] of [[7, 32], [0, 25]]) {
    const { actor, combat } = fixture({ total });
    await enter(combat);
    assert.equal(actor.system.energy.generated, expected);
    assert.equal(actor.system.energy.total, 0);
  }
});

test("double refinement uses prepared bonuses and training rather than the current balance", async () => {
  const { actor, combat } = fixture({ generated: 8 });
  actor.system.energy.bonuses.generatedEnergy = 3;
  await enter(combat);
  assert.equal(actor.system.energy.generated, 56);
  assert.equal(actor.system.energy.total, 52);
});

test("fewer than five reserves refill only to normal refinement, with no per-action bonus", async () => {
  const { actor, combat } = fixture({ reserves: 3, generated: 10 });
  await enter(combat);
  assert.equal(actor.system.energy.generated, 25);
  assert.equal(actor.system.energy.total, 85);
  combat.previous = combat.current;
  combat.round = 3; combat.current = { round: 3, turn: 0, combatantId: "one" };
  actor.system.legacy2.actions.value = 3;
  await enter(combat, { round: 3, turn: 0 });
  assert.equal(actor.system.energy.generated, 25);
  assert.equal(actor.system.energy.total, 85);
});

test("the boundary is exactly five actions: zero or four refill to 25 and five refill to 50", async () => {
  for (const [reserves, expected] of [[0, 25], [4, 25], [5, 50]]) {
    const { actor, combat } = fixture({ reserves, generated: 0 });
    await enter(combat);
    assert.equal(actor.system.energy.generated, expected);
    assert.equal(actor.system.energy.total, 100 - expected);
  }
});

test("when eligibility drops below five actions, leftover doubled refinement remains until spent but cannot refill above normal", async () => {
  const { actor, combat } = fixture({ generated: 40, reserves: 4 });
  await enter(combat);
  assert.equal(actor.system.energy.generated, 40);
  assert.equal(actor.system.energy.total, 100);
});

test("first round, Restringido and 1.0 never convert reserves into cursed refinement", async () => {
  for (const mode of ["first", "restringido", "1.0"]) {
    const { actor, combat } = fixture();
    if (mode === "first") { combat.round = 1; combat.current.round = 1; combat.previous.round = 0; }
    if (mode === "restringido") actor.itemTypes.class.push({ identifier: "restringido" });
    if (mode === "1.0") version = "1.0";
    try { await enter(combat); }
    finally { version = "2.0"; }
    assert.equal(actor.system.energy.generated, 25);
    assert.equal(actor.system.energy.total, 100);
  }
});

test("duplicate callbacks or initiative reordering cannot refill resources again after the creature spends", async () => {
  const { actor, combat, writes } = fixture();
  await enter(combat);
  actor.system.energy.generated = 40; actor.system.legacy2.actions.value = 5;
  actor.system.legacy2.reservas.value = 5;
  await enter(combat);
  assert.equal(writes.length, 2);
  assert.equal(actor.system.energy.generated, 40);
  assert.equal(actor.system.legacy2.actions.value, 5);
  combat.previous = combat.current;
  combat.current = { ...combat.current, turn: 2 };
  await enter(combat, { turn: 2 });
  assert.equal(writes.length, 2);
});

test("only the updating GM processes the turn resources when two GM sessions are active", async () => {
  const { actor, combat, writes } = fixture();
  const original = { user: game.user, users: game.users };
  const writer = { id: "writer", isGM: true, active: true }, passive = { id: "passive", isGM: true, active: true };
  const users = new Map([[writer.id, writer], [passive.id, passive]]); users.activeGM = passive;
  Object.assign(game, { user: passive, users });
  try {
    await hooks.get("updateCombat")(combat, { turn: 1 }, {}, writer.id);
    assert.equal(writes.length, 0);
    game.user = writer;
    await hooks.get("updateCombat")(combat, { turn: 1 }, {}, writer.id);
    assert.equal(writes.length, 1);
    assert.equal(actor.system.energy.generated, 25);
    assert.equal(actor.system.energy.total, 100);
  } finally { Object.assign(game, original); }
});

test("the remaining actions saved at the real end of a turn select the next own turn's ceiling", async () => {
  const { actor, combat } = fixture({ reserves: 0 });
  const other = fixture({ reserves: 0 }).actor;
  combat.combatants.set("other", { id: "other", actor: other });
  combat.previous.combatantId = null;
  await enter(combat);
  actor.system.legacy2.actions.value = 5;
  combat.previous = combat.current;
  combat.current = { round: 2, turn: 2, combatantId: "other" };
  combat.combatant = combat.combatants.get("other");
  await enter(combat, { turn: 2 });
  assert.equal(actor.system.legacy2.reservas.value, 5);
  assert.equal(actor.system.energy.generated, 25);
  combat.previous = combat.current;
  combat.round = 3; combat.current = { round: 3, turn: 0, combatantId: "one" };
  combat.combatant = combat.combatants.get("one");
  await enter(combat, { round: 3, turn: 0 });
  assert.equal(actor.system.energy.generated, 50);
  assert.equal(actor.system.energy.total, 75);
  assert.equal(actor.system.legacy2.reservas.value, 0);
});

test("simultaneous turn notifications share one resource update and a failed update can retry", async () => {
  const { actor, combat, writes } = fixture(), update = actor.update.bind(actor);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  actor.update = async (data, options) => { await gate; return update(data, options); };
  const first = enter(combat);
  await enter(combat);
  release(); await first;
  assert.equal(writes.length, 2);
  assert.equal(actor.system.energy.total, 75);
  const retry = fixture();
  const retryUpdate = retry.actor.update.bind(retry.actor);
  retry.actor.update = async () => { throw new Error("Write failed"); };
  await assert.rejects(enter(retry.combat), /Write failed/);
  retry.actor.update = retryUpdate;
  await enter(retry.combat);
  assert.equal(retry.actor.system.energy.generated, 50);
  assert.equal(retry.actor.system.energy.total, 75);
});
