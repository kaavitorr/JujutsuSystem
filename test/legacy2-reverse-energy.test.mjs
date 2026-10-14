import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";

globalThis.game = { settings: { get: () => "2.0" }, combat: { id: "combat-a", started: true, round: 2 }, user: { isGM: true } };
const hooks = new Map();
globalThis.Hooks = { on(name, handler) { hooks.set(name, handler); } };
globalThis.ui = { notifications: { warn() {} } };
globalThis.foundry = { utils: { escapeHTML: text => String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") } };
const messages = [];
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => messages.push(data) };
const reversa = await import("../module/applications/actor/jj/energia-reversa.mjs");
function fixture() {
  const writes = [], actor = { name: "<Espírito>", isOwner: true, type: "character", itemTypes: { class: [] },
    system: { energy: { generated: 10, total: 100 }, legacy2: { reverseEnergy: { value: 27, max: 30 } },
      abilities: { con: { value: 4 } }, attributes: { hp: { value: 10, max: 30 } } },
    flags: { "jujutsu-system": { energiaReversaRodada: { combatId: "combat-a", rodada: 2, pontos: 3 } } },
    getFlag(scope, key) { return this.flags[scope]?.[key]; },
    async update(updates) {
      writes.push(updates);
      for (const [path, value] of Object.entries(updates)) {
        const keys = path.split("."), last = keys.pop(); let parent = this;
        for (const key of keys) parent = parent[key] ??= {};
        parent[last] = value;
      }
    } };
  return { actor, writes };
}

test("recovering three PER debits nine total PA without spending refinement, actions or round uses", async () => {
  assert.equal(typeof reversa.recuperarEnergiaReversa, "function");
  const { actor, writes } = fixture();
  const before = messages.length;
  assert.equal(await reversa.recuperarEnergiaReversa(actor, 3), true);
  assert.deepEqual(writes, [{ "system.energy.total": 91, "system.legacy2.reverseEnergy.value": 30 }]);
  assert.equal(actor.system.energy.generated, 10);
  assert.deepEqual(actor.flags["jujutsu-system"].energiaReversaRodada, { combatId: "combat-a", rodada: 2, pontos: 3 });
  assert.equal(actor.system.attributes.hp.value, 10);
  assert.equal(messages.length, before + 1);
  assert(messages.at(-1).content.includes("&lt;Espírito&gt;"));
});

test("recovery rejects insufficient PA, overfilling, malformed quantities and unauthorized actors without writes", async () => {
  assert.equal(typeof reversa.recuperarEnergiaReversa, "function");
  for (const quantity of [0, -1, 1.5, "", NaN, Infinity, 4]) {
    const { actor, writes } = fixture();
    assert.equal(await reversa.recuperarEnergiaReversa(actor, quantity), false);
    assert.equal(writes.length, 0);
  }
  for (const change of [actor => { actor.system.energy.total = 2; },
    actor => { actor.system.legacy2.reverseEnergy.value = 30; }, actor => { actor.isOwner = false; }]) {
    const { actor, writes } = fixture(); change(actor);
    assert.equal(await reversa.recuperarEnergiaReversa(actor, 1), false);
    assert.equal(writes.length, 0);
  }
  const { actor, writes } = fixture(), original = game.settings.get;
  game.settings.get = () => "1.0";
  try { assert.equal(await reversa.recuperarEnergiaReversa(actor, 1), false); }
  finally { game.settings.get = original; }
  assert.equal(writes.length, 0);
});

test("card recovery availability respects total PA, effective capacity and the difference between recovery and use", () => {
  const { actor } = fixture();
  const context = reversa.contextoEnergiaReversa(actor);
  assert.equal(context.recuperavel, 3);
  assert.equal(context.custoRecuperacao, 3);
  assert.equal(context.podeRecuperar, true);
  assert.equal(context.restanteRodada, 0);
  actor.system.energy.total = 5;
  assert.equal(reversa.contextoEnergiaReversa(actor).recuperavel, 1);
  actor.system.energy.total = 2;
  assert.equal(reversa.contextoEnergiaReversa(actor).podeRecuperar, false);
  actor.system.energy.total = 120;
  actor.system.legacy2.reverseEnergy.max = 60;
  assert.equal(reversa.contextoEnergiaReversa(actor).recuperavel, 33);
});

test("two concurrent recovery clicks cannot debit the same balance twice", async () => {
  assert.equal(typeof reversa.recuperarEnergiaReversa, "function");
  const { actor, writes } = fixture(), update = actor.update.bind(actor);
  let release;
  actor.update = async changes => { await new Promise(resolve => { release = resolve; }); return update(changes); };
  const first = reversa.recuperarEnergiaReversa(actor, 2);
  assert.equal(await reversa.recuperarEnergiaReversa(actor, 2), false);
  release();
  assert.equal(await first, true);
  assert.equal(writes.length, 1);
  assert.equal(actor.system.energy.total, 94);
  assert.equal(actor.system.energy.generated, 10);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 29);
});

test("recovery cannot convert a Restringido's stamina into cursed energy", async () => {
  const { actor, writes } = fixture();
  actor.itemTypes.class = [{ system: { identifier: "restringido" } }];
  assert.equal(reversa.contextoEnergiaReversa(actor).podeRecuperar, false);
  assert.equal(await reversa.recuperarEnergiaReversa(actor, 1), false);
  assert.equal(writes.length, 0);
});

test("canceling recovery spends nothing and acceptance rechecks changes made while the dialog was open", async () => {
  const { actor, writes } = fixture();
  foundry.applications = { api: { DialogV2: { wait: async () => null } } };
  assert.equal(await reversa.escolherRecuperacaoReversa(actor), false);
  assert.equal(writes.length, 0);
  foundry.applications.api.DialogV2.wait = async () => { actor.system.energy.total = 2; return 3; };
  assert.equal(await reversa.escolherRecuperacaoReversa(actor), false);
  assert.equal(writes.length, 0);
  actor.system.energy.total = 100;
  foundry.applications.api.DialogV2.wait = async () => 3;
  assert.equal(await reversa.escolherRecuperacaoReversa(actor), true);
  assert.deepEqual(writes, [{ "system.energy.total": 91, "system.legacy2.reverseEnergy.value": 30 }]);
});

test("a failed actor update cannot leave recovery locked or post a successful conversion", async () => {
  const { actor } = fixture(), update = actor.update.bind(actor), before = messages.length;
  actor.update = async () => { throw new Error("update failed"); };
  await assert.rejects(reversa.recuperarEnergiaReversa(actor, 1), /update failed/);
  assert.equal(messages.length, before);
  actor.update = update;
  assert.equal(await reversa.recuperarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.energy.total, 97);
  assert.equal(actor.system.energy.generated, 10);
});

test("existing healing keeps its PER limit and effective maximum health", async () => {
  const { actor, writes } = fixture();
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), false);
  assert.equal(writes.length, 0);
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 1;
  actor.system.attributes.hp = { value: 20, max: 30, effectiveMax: 21 };
  assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
  assert.equal(actor.system.attributes.hp.value, 21);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 25);
  assert.equal(actor.flags["jujutsu-system"].energiaReversaRodada.pontos, 3);
});

test("a prior combat's round count cannot block healing in a new combat at the same round", async () => {
  const { actor } = fixture();
  actor.flags["jujutsu-system"].energiaReversaRodada.combatId = "combat-old";
  assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 0);
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.attributes.hp.value, 14);
  assert.deepEqual(actor.flags["jujutsu-system"].energiaReversaRodada, { combatId: "combat-a", rodada: 2, pontos: 1 });
});

test("an unstarted combat or an old flag without combat identity cannot block recovery actions", async () => {
  const original = game.combat;
  try {
    game.combat = { ...original, started: false };
    const { actor } = fixture();
    assert.equal(reversa.contextoEnergiaReversa(actor).emCombate, false);
    assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
    assert.equal(actor.system.legacy2.reverseEnergy.value, 25);
    game.combat = original;
    const legacy = fixture().actor;
    delete legacy.flags["jujutsu-system"].energiaReversaRodada.combatId;
    assert.equal(reversa.contextoEnergiaReversa(legacy).restanteRodada, 3);
    assert.equal(await reversa.usarEnergiaReversa(legacy, 1), true);
  } finally { game.combat = original; }
});

test("repeated healing clicks cannot spend the same remaining round allowance twice", async () => {
  const { actor, writes } = fixture(), update = actor.update.bind(actor);
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 2;
  let release;
  actor.update = async changes => { await new Promise(resolve => { release = resolve; }); return update(changes); };
  const first = reversa.usarEnergiaReversa(actor, 1);
  const second = reversa.usarEnergiaReversa(actor, 1);
  // A concurrent call must finish without queuing another update.
  const outcome = await Promise.race([second, new Promise(resolve => setTimeout(() => resolve("pending"), 10))]);
  assert.equal(outcome, false);
  release();
  assert.equal(await first, true);
  assert.equal(writes.length, 1);
});

test("an actor-specific round limit permits extra PER uses and rejects the first use beyond that limit", async () => {
  const { actor } = fixture();
  actor.system.legacy2.reverseEnergy.maxPerRound = 5;
  const context = reversa.contextoEnergiaReversa(actor);
  assert.equal(context.maximoRodada, 5);
  assert.equal(context.restanteRodada, 2);
  assert.equal(context.rodadaPontos.length, 5);
  assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
  assert.equal(actor.flags["jujutsu-system"].energiaReversaRodada.pontos, 5);
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), false);
});

test("prepared trait limits affect live usage while a zero limit forbids uses only in combat", async () => {
  const { actor } = fixture();
  actor._source = { system: { legacy2: { reverseEnergy: { maxPerRound: 3 } } } };
  actor.system.legacy2.reverseEnergy.maxPerRound = 6;
  assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
  assert.equal(actor._source.system.legacy2.reverseEnergy.maxPerRound, 3);
  actor.system.legacy2.reverseEnergy.maxPerRound = 0;
  assert.equal(reversa.contextoEnergiaReversa(actor).maximoRodada, 0);
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), false);
  const original = game.combat;
  game.combat = null;
  try { assert.equal(await reversa.usarEnergiaReversa(actor, 1), true); }
  finally { game.combat = original; }
});

test("one PER heals constitution in both wounds and normal HP in a single update", async () => {
  const { actor, writes } = fixture();
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 0;
  actor.system.legacy2.wounds = { value: 10 };
  actor.system.attributes.hp = { value: 20, max: 30, effectiveMax: 25 };
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.legacy2.wounds.value, 6);
  assert.equal(actor.system.attributes.hp.value, 24);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 26);
  assert.equal(writes.length, 1);
});

test("reverse healing can refill the life ceiling released by wound healing and reports the actual recovery", async () => {
  const { actor } = fixture();
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 0;
  actor.system.legacy2.wounds = { value: 10 };
  actor.system.attributes.hp = { value: 25, max: 30, effectiveMax: 25 };
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.legacy2.wounds.value, 6);
  assert.equal(actor.system.attributes.hp.value, 27);
  assert.match(messages.at(-1).content, /<strong>2 PV<\/strong>/);
  assert.match(messages.at(-1).content, /<strong>4 ferimentos<\/strong>/);
});

test("member restoration also heals wounds without going below zero or exceeding temporary maximum life", async () => {
  const { actor } = fixture();
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 0;
  actor.system.legacy2.wounds = { value: 3 };
  actor.system.attributes.hp = { value: 27, max: 30, effectiveMax: 32, tempmax: 3 };
  assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
  assert.equal(actor.system.legacy2.wounds.value, 0);
  assert.equal(actor.system.attributes.hp.value, 33);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 25);
});

test("NPC reverse healing ignores legacy wounds and preserves their effective maximum", async () => {
  const { actor, writes } = fixture();
  actor.type = "npc";
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 0;
  actor.system.legacy2.wounds = { value: 10 };
  actor.system.attributes.hp = { value: 31, max: 30, effectiveMax: 33, tempmax: 3 };
  assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.legacy2.wounds.value, 10);
  assert.equal(actor.system.attributes.hp.value, 33);
  assert.equal(Object.hasOwn(writes[0], "system.legacy2.wounds.value"), false);
});

test("conversion works with zero refinement but cannot spend refinement when the total pool is insufficient", async () => {
  const { actor, writes } = fixture();
  actor.system.energy.generated = 0;
  actor.system.energy.total = 3;
  assert.equal(reversa.contextoEnergiaReversa(actor).podeRecuperar, true);
  assert.equal(await reversa.recuperarEnergiaReversa(actor, 1), true);
  assert.deepEqual(writes, [{ "system.energy.total": 0, "system.legacy2.reverseEnergy.value": 28 }]);
  assert.equal(actor.system.energy.generated, 0);
  const insufficient = fixture();
  insufficient.actor.system.energy.generated = 100;
  insufficient.actor.system.energy.total = 2;
  assert.equal(await reversa.recuperarEnergiaReversa(insufficient.actor, 1), false);
  assert.equal(insufficient.writes.length, 0);
});

test("a new global round cannot clear a character's spent PER before their own turn starts", async () => {
  const { actor, writes } = fixture(), original = game.combat;
  game.combat = { ...original, round: 3 };
  try {
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 3);
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), false);
    assert.equal(writes.length, 0);
  } finally { game.combat = original; }
});

test("the native start-turn flow resets only its actor's PER allowance before subsequent turn actions", async () => {
  assert.equal(typeof reversa.resetarUsoReversaNoTurno, "function");
  const source = readFileSync(new URL("../module/documents/combat.mjs", import.meta.url), "utf8");
  const body = source.match(/async _onStartTurn\(combatant\) \{([\s\S]*?)\n  \}/)[1];
  class Base { async _onStartTurn(combatant) { assert.equal(combatant.actor.flags["jujutsu-system"].energiaReversaRodada.pontos, 0); } }
  const Combat = new Function("Base", "Ruleset", "resetarUsoReversaNoTurno", `return class extends Base {
    async _onStartTurn(combatant) {${body}}
    _recoverUses() {}
  }`)(Base, Ruleset, reversa.resetarUsoReversaNoTurno);
  const { actor, writes } = fixture(), other = fixture().actor;
  actor.type = "npc";
  actor.system.legacy2.reverseEnergy.maxPerRound = 5;
  const combat = Object.assign(new Combat(), game.combat);
  await combat._onStartTurn({ actor });
  assert.equal(reversa.contextoEnergiaReversa(actor).restanteRodada, 5);
  assert.equal(reversa.contextoEnergiaReversa(other).pontosNaRodada, 3);
  assert.deepEqual(writes, [{ "flags.jujutsu-system.energiaReversaRodada": {
    combatId: "combat-a", rodada: 2, pontos: 0
  } }]);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 27);
  assert.equal(actor.system.energy.total, 100);
});

test("start-turn PER reset is dormant in 1.0 and unstarted combats", async () => {
  assert.equal(typeof reversa.resetarUsoReversaNoTurno, "function");
  const { actor, writes } = fixture();
  assert.equal(await reversa.resetarUsoReversaNoTurno(actor, { ...game.combat, started: false }), false);
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try { assert.equal(await reversa.resetarUsoReversaNoTurno(actor, game.combat), false); }
  finally { game.settings.get = original; }
  assert.equal(writes.length, 0);
});

test("the actual combat-update event resets the entering actor even when the native start-turn callback never runs", async () => {
  assert.equal(typeof hooks.get("updateCombat"), "function");
  const { actor, writes } = fixture(), other = fixture().actor;
  const one = { id: "one", actor }, two = { id: "two", actor: other };
  const combat = { id: "combat-a", started: true, round: 3, turn: 1, combatant: one,
    current: { round: 3, turn: 1, combatantId: "one" },
    previous: { round: 3, turn: 0, combatantId: "two" }, combatants: new Map([["one", one], ["two", two]]) };
  const original = { combat: game.combat, users: game.users, user: game.user };
  Object.assign(game, { combat, user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } });
  try {
    await hooks.get("updateCombat")(combat, { turn: 1 }, {});
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 0);
    assert.equal(reversa.contextoEnergiaReversa(other).pontosNaRodada, 3);
    assert.equal(writes.length, 1);
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
    await hooks.get("combatTurnChange")(combat, combat.previous, combat.current);
    await reversa.resetarUsoReversaNoTurno(actor, combat, one);
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 1);
    assert.equal(writes.length, 2, "the late native callback must not erase a new use");
  } finally { Object.assign(game, original); }
});

test("round changes reset only the active combatant; reordering or unrelated updates cannot reset again", async () => {
  assert.equal(typeof hooks.get("updateCombat"), "function");
  const { actor, writes } = fixture(), other = fixture().actor;
  const current = { id: "two", actor: other };
  const combat = { id: "combat-a", started: true, round: 3, combatant: current,
    current: { round: 3, turn: 0, combatantId: "two" }, previous: { round: 2, turn: 1, combatantId: "two" } };
  const original = { combat: game.combat, users: game.users, user: game.user };
  Object.assign(game, { combat, user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } });
  try {
    await hooks.get("updateCombat")(combat, { round: 3 }, {});
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 3);
    assert.equal(reversa.contextoEnergiaReversa(other).pontosNaRodada, 0);
    assert.equal(writes.length, 0);
    combat.combatant = { id: "one", actor };
    combat.previous = { round: 3, turn: 1, combatantId: "one" };
    combat.current = { round: 3, turn: 2, combatantId: "one" };
    await hooks.get("combatTurnChange")(combat, combat.previous, combat.current);
    await hooks.get("updateCombat")(combat, { turn: 2 }, {});
    await hooks.get("updateCombat")(combat, { name: "Renamed" }, {});
    assert.equal(writes.length, 0);
  } finally { Object.assign(game, original); }
});

test("an elected owner can reset PER without an active GM; non-authoritative clients cannot write", async () => {
  assert.equal(typeof hooks.get("updateCombat"), "function");
  const { actor, writes } = fixture();
  actor.testUserPermission = user => user.id === "owner";
  const owner = { id: "owner", active: true, isGM: false }, spectator = { id: "spectator", active: true, isGM: false };
  const users = [owner, spectator]; users.activeGM = null;
  const combat = { id: "combat-a", started: true, round: 2, combatant: { id: "one", actor },
    current: { round: 2, combatantId: "one" }, previous: { round: 2, combatantId: "two" } };
  const original = { combat: game.combat, users: game.users, user: game.user };
  Object.assign(game, { combat, users, user: spectator });
  try {
    await hooks.get("updateCombat")(combat, { turn: 1 }, {});
    assert.equal(writes.length, 0);
    game.user = owner;
    await hooks.get("updateCombat")(combat, { turn: 1 }, {});
    assert.equal(writes.length, 1);
    assert.equal(actor.flags["jujutsu-system"].energiaReversaRodada.pontos, 0);
  } finally { Object.assign(game, original); }
});

test("native reset marks even an unused turn and a later tracker event preserves spending until the next own turn", async () => {
  const { actor, writes } = fixture();
  actor.flags["jujutsu-system"].energiaReversaRodada.pontos = 0;
  const combatant = { id: "one", actor };
  const combat = { id: "combat-a", started: true, round: 2, combatant,
    current: { round: 2, combatantId: "one" }, previous: { round: 2, combatantId: "two" } };
  const original = { combat: game.combat, users: game.users, user: game.user };
  Object.assign(game, { combat, user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } } });
  try {
    assert.equal(await reversa.resetarUsoReversaNoTurno(actor, combat, combatant), true);
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
    await hooks.get("updateCombat")(combat, { turn: 1 }, {});
    await hooks.get("combatTurnChange")(combat, combat.previous, combat.current);
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 1);
    assert.equal(writes.length, 2);
    combat.round = 3;
    combat.previous = combat.current;
    combat.current = { round: 3, combatantId: "one" };
    await hooks.get("updateCombat")(combat, { round: 3 }, {});
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 0);
    assert.equal(writes.length, 3);
  } finally { Object.assign(game, original); }
});

test("concurrent start events share one awaited reset and a failed write allows a retry", async () => {
  const { actor, writes } = fixture(), update = actor.update.bind(actor);
  const combat = { ...game.combat }, combatant = { id: "one", actor };
  let release;
  actor.update = async changes => { await new Promise(resolve => { release = resolve; }); return update(changes); };
  const first = reversa.resetarUsoReversaNoTurno(actor, combat, combatant);
  const second = reversa.resetarUsoReversaNoTurno(actor, combat, combatant);
  release();
  assert.deepEqual(await Promise.all([first, second]), [true, false]);
  assert.equal(writes.length, 1);
  combat.round += 1;
  actor.update = async () => { throw new Error("Write failed"); };
  await assert.rejects(reversa.resetarUsoReversaNoTurno(actor, combat, combatant), /Write failed/);
  actor.update = update;
  assert.equal(await reversa.resetarUsoReversaNoTurno(actor, combat, combatant), true);
  assert.equal(writes.length, 2);
});

test("tracker fallback remains dormant in 1.0, stopped combat and updates that suppress turn events", async () => {
  const { actor, writes } = fixture(), combatant = { id: "one", actor };
  const combat = { id: "combat-a", started: false, round: 2, combatant,
    current: { round: 2, combatantId: "one" }, previous: { round: 2, combatantId: "two" } };
  await hooks.get("updateCombat")(combat, { turn: 1 }, {});
  await hooks.get("combatTurnChange")(combat, combat.previous, combat.current);
  combat.started = true;
  await hooks.get("updateCombat")(combat, { turn: 1 }, { turnEvents: false });
  const original = game.settings.get;
  game.settings.get = () => "1.0";
  try {
    await hooks.get("updateCombat")(combat, { turn: 1 }, {});
    await hooks.get("combatTurnChange")(combat, combat.previous, combat.current);
  } finally { game.settings.get = original; }
  assert.equal(writes.length, 0);
});

test("the GM advancing the standard tracker can reset PER even when another session is the active GM", async () => {
  const { actor, writes } = fixture();
  const primary = { id: "gm-primary", isGM: true, active: true };
  const clickingGM = { id: "gm-clicking", isGM: true, active: true };
  const users = new Map([[primary.id, primary], [clickingGM.id, clickingGM]]);
  users.activeGM = primary;
  const combat = { id: "combat-a", started: true, round: 6, combatant: { id: "one", actor },
    current: { round: 6, combatantId: "one" }, previous: { round: 6, combatantId: "two" } };
  const original = { combat: game.combat, users: game.users, user: game.user };
  Object.assign(game, { combat, users, user: clickingGM });
  try {
    game.user = primary;
    await hooks.get("updateCombat")(combat, { turn: 1 }, {}, clickingGM.id);
    assert.equal(writes.length, 0, "a passive GM session does not write the fallback reset");
    game.user = clickingGM;
    await hooks.get("updateCombat")(combat, { turn: 1 }, {}, clickingGM.id);
    assert.equal(writes.length, 1);
    assert.equal(actor.flags["jujutsu-system"].energiaReversaRodada.pontos, 0);
  } finally { Object.assign(game, original); }
});

test("the current own turn releases a stale PER allowance even if every reset event was missed", async () => {
  const { actor, writes } = fixture(), original = game.combat;
  game.combat = { id: "combat-a", started: true, round: 6, combatant: { id: "one", actor } };
  try {
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 0);
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
    assert.deepEqual(actor.flags["jujutsu-system"].energiaReversaRodada,
      { combatId: "combat-a", rodada: 6, pontos: 1, turnKey: "6:one" });
    assert.equal(await reversa.usarEnergiaReversa(actor, 2), true);
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 3);
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), false);
    assert.equal(writes.length, 2);
  } finally { game.combat = original; }
});

test("reconciliation cannot refill usage outside the own turn or refill an unmarked current-round allowance", () => {
  const { actor } = fixture(), other = fixture().actor, original = game.combat;
  actor.uuid = "Actor.one";
  other.uuid = "Scene.scene.Token.token.Actor.one";
  actor.id = other.id = "one";
  game.combat = { id: "combat-a", started: true, round: 6, combatant: { id: "token", actor: other } };
  try {
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 3);
    game.combat.combatant.actor = actor;
    actor.flags["jujutsu-system"].energiaReversaRodada.rodada = 6;
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 3);
    actor.flags["jujutsu-system"].energiaReversaRodada.turnKey = "5:token";
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 0);
  } finally { game.combat = original; }
});

test("first use in the current turn of a new combat survives a late native reset", async () => {
  const { actor } = fixture(), original = game.combat;
  actor.flags["jujutsu-system"].energiaReversaRodada.combatId = "old-combat";
  const combatant = { id: "one", actor };
  game.combat = { id: "combat-a", started: true, round: 1, combatant };
  try {
    assert.equal(await reversa.usarEnergiaReversa(actor, 1), true);
    assert.equal(await reversa.resetarUsoReversaNoTurno(actor, game.combat, combatant), false);
    assert.equal(reversa.contextoEnergiaReversa(actor).pontosNaRodada, 1);
  } finally { game.combat = original; }
});
