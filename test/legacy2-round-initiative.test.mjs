import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ruleset from "../module/systems/ruleset.mjs";
import { flawInitiativeLast } from "../module/systems/defeitos-active-effects.mjs";

let version = "2.0", enabled = true;
const handlers = new Map(), messages = [];
globalThis.game = { user: { id: "gm", isGM: true }, i18n: { lang: "pt-BR" },
  settings: { get: (scope, key) => key === "rulesetVersion" ? version : enabled } };
globalThis.foundry = { utils: { escapeHTML: value => String(value).replaceAll("<", "&lt;") } };
globalThis.Hooks = { on: (name, handler) => handlers.set(name, handler), callAll() {} };
globalThis.ChatMessage = { create: async message => messages.push(message) };
const initiative = await import("../module/systems/iniciativa-dinamica.mjs");

// Boundary adapter: parent updates merge combatant data atomically; standalone
// Combatant updates preserve the active creature, as Foundry 14 does.
class CoreCombatBoundary {
  constructor({ round = 1, turn = 2, scores = [5, 25, 15], skipDefeated = false } = {}) {
    this.id = "combat"; this.round = round; this.turn = turn;
    this.settings = { skipDefeated }; this.startedActors = []; this.writes = []; this.embeddedWrites = [];
    this.combatants = ["A", "B", "C"].map((name, index) => ({ id: name, name, initiative: 30 - index * 10,
      isDefeated: false, refreshDynamicRing() {},
      actor: { name, statuses: new Set(), system: { legacy2: { reservas: { value: 0 }, actions: { value: 0 } } },
        itemTypes: { weapon: [] }, calls: 0,
        getInitiativeRoll(options = {}) {
          this.calls++;
          return {total: scores[index] + Ruleset.netAdvantageBonus(options.jjInitiativeActions ?? 0, 0), async evaluate() {}};
        } } }));
    this.combatants.get = id => this.combatants.find(c => c.id === id);
    this.setupTurns(); this.previous = { ...this.current };
  }
  get started() { return this.round > 0; }
  get combatant() { return this.turns[this.turn]; }
  _sortCombatants(a, b) { return b.initiative - a.initiative || a.name.localeCompare(b.name); }
  setupTurns() {
    this.turns = [...this.combatants].sort(this._sortCombatants);
    this.current = { round: this.round, turn: this.turn, combatantId: this.combatant?.id ?? null };
    return this.turns;
  }
  clone() {
    const copy = new this.constructor();
    copy.combatants = this.combatants.map(c => ({ ...c }));
    copy.combatants.get = id => copy.combatants.find(c => c.id === id);
    copy.round = this.round; copy.turn = this.turn; copy.settings = { ...this.settings };
    copy.setupTurns(); return copy;
  }
  updateSource(changed) {
    for (const update of changed.combatants ?? []) Object.assign(this.combatants.get(update._id), update);
    if ("round" in changed) this.round = changed.round;
    if ("turn" in changed) this.turn = changed.turn;
    this.setupTurns();
  }
  async _preUpdate() {}
  async update(changed, options = {}) {
    if (await this._preUpdate(changed, options, game.user) === false) return this;
    const prior = { ...this.current };
    const actualChanged = { ...changed };
    if (changed.round === this.round) delete actualChanged.round;
    if (changed.turn === this.turn) delete actualChanged.turn;
    this.writes.push(structuredClone(changed));
    this.lastOptions = structuredClone(options);
    this.updateSource(changed); this.previous = prior;
    if (this.started && options.turnEvents !== false
      && (prior.round !== this.round || prior.combatantId !== this.current.combatantId)) {
      this.startedActors.push(this.combatant?.id);
    }
    await handlers.get("updateCombat")?.(this, actualChanged, options, game.user.id);
    return this;
  }
  async updateEmbeddedDocuments(type, updates, options = {}) {
    assert.equal(type, "Combatant");
    const activeId = this.combatant?.id;
    this.embeddedWrites.push(updates);
    this.updateSource({ combatants: updates });
    this.turn = Math.max(0, this.turns.findIndex(c => c.id === activeId));
    this.setupTurns();
  }
  async nextRound() {
    let turn = this.turn === null ? null : 0;
    if (this.settings.skipDefeated && turn !== null) turn = Math.max(0, this.turns.findIndex(c => !c.isDefeated));
    return this.update({ round: this.round + 1, turn });
  }
  async nextTurn() {
    if (this.turn + 1 >= this.turns.length || this.round === 0) return this.nextRound();
    return this.update({ round: this.round, turn: this.turn + 1 });
  }
  async startCombat() { return this.update({ round: 1, turn: 0 }); }
}

// Execute the actual Combat5e class; only its Foundry/network boundary is replaced.
const source = readFileSync(new URL("../module/documents/combat.mjs", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace("export default class", "return class");
const Combat5e = new Function("Combat", "Ruleset", "prepararIniciativaDaRodada", "flawInitiativeLast", source)
  (CoreCombatBoundary, Ruleset, initiative.prepararIniciativaDaRodada, flawInitiativeLast);
Combat5e.prototype._recoverUses = () => {};

test("Medroso remains last in the tracker and dynamic summary regardless of the rolled score", async () => {
  const combat = new Combat5e({ scores: [100, 25, 15] });
  combat.combatants[0].actor.flags = { "jujutsu-system": { flawRules: { initiativeLast: true } } };
  combat.setupTurns();
  assert.deepEqual(combat.turns.map(c => c.id), ["B", "C", "A"]);
  await combat.nextRound();
  assert.deepEqual(combat.turns.map(c => c.id), ["B", "C", "A"]);
  assert.deepEqual(initiative.ordenarIniciativa(combat.lastOptions.jj2RoundInitiative.linhas).map(l => l.nome), ["B", "C", "A"]);
  assert.equal(combat.combatant.id, "B");
  delete combat.combatants[0].actor.flags;
  combat.setupTurns();
  assert.equal(combat.turns[0].id, "A");
});

test("wrapping the last turn starts only the new initiative leader, even when the former leader falls to second or last", async () => {
  for (const scoreA of [20, 5]) {
    const combat = new Combat5e({ scores: [scoreA, 25, 15] });
    await combat.nextTurn();
    assert.equal(combat.round, 2);
    assert.equal(combat.turn, 0);
    assert.equal(combat.combatant.id, "B");
    assert.deepEqual(combat.startedActors, ["B"]);
    assert.equal(combat.embeddedWrites.length, 0, "no initiative reorder may run after the turn has started");
    assert.deepEqual(combat.combatants.map(c => c.actor.calls), [1, 1, 1]);
  }
});

test("starting combat rolls the first round before choosing its first creature", async () => {
  const combat = new Combat5e({ round: 0, turn: null });
  await combat.startCombat();
  assert.equal(combat.round, 1);
  assert.equal(combat.combatant.id, "B");
  assert.deepEqual(combat.startedActors, ["B"]);
});

test("skip-defeated selects the first eligible creature in the new order", async () => {
  const combat = new Combat5e({ skipDefeated: true });
  combat.combatants.get("B").isDefeated = true;
  await combat.nextTurn();
  assert.equal(combat.combatant.id, "C");
  assert.deepEqual(combat.startedActors, ["C"]);
});

test("normal turn advances and rewinds preserve their initiatives", async () => {
  const combat = new Combat5e({ turn: 0, round: 3 });
  await combat.nextTurn();
  await combat.update({ round: 2, turn: 2 });
  assert.deepEqual(combat.combatants.map(c => c.actor.calls), [0, 0, 0]);
  assert.deepEqual(combat.combatants.map(c => c.initiative), [30, 20, 10]);
});

test("1.0 and disabled dynamic initiative preserve the native transition", async () => {
  for (const setting of ["1.0", "disabled"]) {
    version = setting === "1.0" ? "1.0" : "2.0"; enabled = setting !== "disabled";
    try {
      const combat = new Combat5e(); await combat.nextTurn();
      assert.equal(combat.combatant.id, "A");
      assert.deepEqual(combat.combatants.map(c => c.actor.calls), [0, 0, 0]);
    } finally { version = "2.0"; enabled = true; }
  }
});

test("the initiative summary is published once by the updating GM; other GM clients cannot reroll or duplicate it", async () => {
  const combat = new Combat5e(), before = messages.length;
  await combat.nextTurn();
  assert.equal(messages.length, before + 1);
  assert(messages.at(-1).content.includes("Rodada"));
  const original = game.user;
  game.user = { id: "other-gm", isGM: true };
  try { await handlers.get("updateCombat")?.(combat, combat.writes.at(-1), combat.lastOptions, "gm"); }
  finally { game.user = original; }
  assert.equal(messages.length, before + 1);
  assert.deepEqual(combat.combatants.map(c => c.actor.calls), [1, 1, 1]);
});

test("a failed initiative roll cannot advance the round or start a creature's turn", async () => {
  const combat = new Combat5e();
  combat.combatants.get("B").actor.getInitiativeRoll = () => ({ async evaluate() { throw new Error("Roll failed"); } });
  await assert.rejects(combat.nextTurn(), /Roll failed/);
  assert.equal(combat.round, 1);
  assert.equal(combat.combatant.id, "C");
  assert.deepEqual(combat.startedActors, []);
});

test("the last creature's remaining actions contribute to the new round before its end-turn reserve update", async () => {
  const combat = new Combat5e({ scores: [20, 25, 23] });
  combat.combatants.get("C").actor.system.legacy2.actions.value = 3;
  await combat.nextTurn();
  assert.equal(combat.combatants.get("C").initiative, 26);
  assert.equal(combat.combatant.id, "C");
  assert.deepEqual(combat.startedActors, ["C"]);
});

test("each creature receives +1 per action actually available at the round boundary, ignoring old reserves", async () => {
  const combat = new Combat5e({scores: [10, 10, 10]});
  for (const [id, actions, reserves, max] of [["A", 2, 99, 6], ["B", 0, 6, 6], ["C", 8, 0, 8]]) {
    Object.assign(combat.combatants.get(id).actor.system.legacy2, {actions: {value: actions, max}, reservas: {value: reserves}});
  }
  await combat.nextRound();
  assert.deepEqual(combat.combatants.map(c => c.initiative), [12, 10, 16]);
  assert.equal(combat.combatant.id, "C");
  await combat.nextRound();
  assert.deepEqual(combat.combatants.map(c => c.initiative), [12, 10, 16], "PA bonuses cannot accumulate between rounds");
});

test("the boundary snapshots available actions before any asynchronous initiative evaluation", async () => {
  const combat = new Combat5e({scores: [10, 10, 10]});
  combat.combatants.get("B").actor.system.legacy2.actions = {value: 4, max: 6};
  combat.combatants.get("A").actor.getInitiativeRoll = () => ({total: 10, async evaluate() {
    combat.combatants.get("B").actor.system.legacy2.actions.value = 0;
  }});
  await combat.nextRound();
  assert.equal(combat.combatants.get("B").initiative, 14);
});

test("invalid or overfilled PA never creates an impossible bonus and fixed-status initiative remains exact", async () => {
  for (const [value, expected] of [[9999, 16], [Infinity, 10], [-3, 10], [3.8, 13]]) {
    const combat = new Combat5e({scores: [10, 10, 10]});
    combat.combatants.get("A").actor.system.legacy2.actions = {value, max: 6};
    const result = await initiative.prepararIniciativaDaRodada(combat, {round: 2});
    assert.equal(result.updates[0].initiative, expected);
  }
  for (const [status, expected] of [["dead", 0], ["incapacitated", 0], ["jj-desatento", 1], ["surprised", 1]]) {
    const combat = new Combat5e({scores: [10, 10, 10]}), subject = combat.combatants.get("A").actor;
    subject.statuses.add(status);subject.system.legacy2.actions = {value: 6, max: 6};
    subject.itemTypes.weapon = [{system: {equipped: true, properties: new Set(["des"])}}];
    assert.equal((await initiative.prepararIniciativaDaRodada(combat, {round: 2})).updates[0].initiative, expected);
  }
});

test("the first round ignores action reserves and the standalone roller retains the current creature", async () => {
  const combat = new Combat5e({ round: 0, turn: null });
  combat.combatants.get("A").actor.system.legacy2.reservas.value = 30;
  await combat.startCombat();
  assert.equal(combat.combatants.get("A").initiative, 5);
  assert.equal(combat.combatant.id, "B");
  // A manual initiative reroll remains distinct from beginning a new round.
  const standalone = new Combat5e();
  await initiative.rolarIniciativaDaRodada(standalone);
  assert.equal(standalone.combatant.id, "C");
  assert.equal(standalone.round, 1);
});

test("a single creature begins the next round once and an encounter without a selected turn remains unselected", async () => {
  const single = new Combat5e({ turn: 0 });
  single.combatants.splice(1); single.setupTurns();
  await single.nextTurn();
  assert.equal(single.round, 2);
  assert.equal(single.combatant.id, "A");
  assert.deepEqual(single.startedActors, ["A"]);
  const unselected = new Combat5e({ turn: null });
  await unselected.nextRound();
  assert.equal(unselected.turn, null);
  assert.equal(unselected.combatant, undefined);
});

test("Desatento: iniciativa 1, sem bônus de reserva e sem rolagem", async () => {
  const combat = new Combat5e({ round: 0, turn: null, scores: [30, 20, 10] });
  combat.combatants.get("A").actor.statuses.add("jj-desatento");
  combat.combatants.get("A").actor.system.legacy2.reservas.value = 5;
  await combat.startCombat();
  assert.equal(combat.combatants.get("A").initiative, 1); // desatento: iniciativa fixa em 1
  assert.equal(combat.combatants.get("B").initiative, 20); // os demais rolam normalmente
  // rodada 2: a reserva (9) NÃO levanta a iniciativa do desatento
  combat.combatants.get("A").actor.system.legacy2.reservas.value = 9;
  await combat.nextRound();
  assert.equal(combat.combatants.get("A").initiative, 1);
  assert.equal(combat.combatants.get("B").initiative, 20);
});
