import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const handlers = new Map();
globalThis.Hooks = { on(name, fn) { const list = handlers.get(name) ?? []; list.push(fn); handlers.set(name, list); }, once() {} };
let version = "2.0", result = 1;
const gm = { id: "gm" }, player = { id: "player" };
globalThis.game = { settings: { get: () => version }, user: player, users: { activeGM: gm }, actors: new Map(),
  combat: { id: "combat", started: true, round: 2, turn: 1 }, time: { worldTime: 20 } };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { ADD: 2, OVERRIDE: 5, CUSTOM: 0 } };
globalThis.CONFIG = { JUJUTSU: {}, DND5E: { abilities: { str: {}, dex: {}, con: {}, int: {}, wis: {}, cha: {} } },
  statusEffects: Object.fromEntries(["jj-incapacitado", "jj-inconsciente", "jj-atordoado", "jj-caido", "jj-em-chamas", "jj-exausto"].map(id => [id, { id, name: id }])) };
const formulas = [];
globalThis.Roll = class {
  constructor(formula) { formulas.push(formula); this.total = result; this.dice = [{ faces: Number(formula.match(/d(\d+)/)?.[1]), results: [{ result }] }]; }
  async evaluate() { return this; }
  async toMessage() {}
};
globalThis.ChatMessage = { create: async () => {}, getSpeaker: ({ actor }) => ({ actor: actor.id }),
  getSpeakerActor: speaker => game.actors.get(speaker.actor) };
globalThis.ui = { notifications: { warn() {}, info() {} } };
const runtime = await import("../module/systems/peculiaridades-automacao.mjs");
const { applyGameCondition } = await import("../module/applications/actor/jj/conditions.mjs");
async function fire(name, ...args) { for (const fn of handlers.get(name) ?? []) await fn(...args); }
function actor(names = []) {
  const flags = {}, effects = [], updates = [];
  const a = { id: "a", uuid: "Actor.a", name: "Ator", isOwner: true, effects, statuses: new Set(), updates,
    items: names.map(name => ({ type: "feat", name, flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } } })),
    system: { legacy2: { actions: { value: 1, max: 6 } }, attributes: { hp: { value: 50 }, exhaustion: 0 }, energy: { total: 30, generated: 10, max: 50 }, abilities: { int: { value: 4 }, con: { value: 5 } } },
    getFlag: (scope, key) => flags[key], setFlag: async (scope, key, value) => { flags[key] = value; }, unsetFlag: async (scope, key) => { delete flags[key]; },
    async update(data) { updates.push(data); for (const [key, value] of Object.entries(data)) { const keys = key.split("."); let target = this; for (const part of keys.slice(0, -1)) target = target[part] ??= {}; target[keys.at(-1)] = value; } },
    async createEmbeddedDocuments(type, rows) { for (const row of rows) { const effect = { ...row, statuses: new Set(row.statuses), getFlag: (scope, key) => row.flags?.[scope]?.[key], update: async data => Object.assign(effect, data), delete: async () => effects.splice(effects.indexOf(effect), 1) }; effects.push(effect); for (const id of row.statuses ?? []) this.statuses.add(id); for (const change of row.changes ?? []) if (change.key === "system.legacy2.actions.max") this.system.legacy2.actions.max += Number(change.value); } return effects; }
  }; game.actors.set(a.id, a); return a;
}

test("recognizes all source peculiarities by stable key and only in 2.0", () => {
  assert.equal(Object.keys(runtime.PECULIARIDADES).length, 27);
  const a = actor(["Renamed"]); a.items[0].flags["jujutsu-system"].peculiaridade = "olhar-do-abismo";
  assert.equal(runtime.temPeculiaridade(a, "olhar-do-abismo"), true);
  version = "1.0"; assert.equal(runtime.temPeculiaridade(a, "olhar-do-abismo"), false); version = "2.0";
});
test("immunities cover Olhar and all damage conditions through common application", async () => {
  assert.equal(runtime.imunidadeCondicao(actor(["Olhar Do Abismo"]), "jj-atordoado"), true);
  const a = actor(["Doença Sobrenatural"]);
  assert.equal(await applyGameCondition(a, "jj-em-chamas"), false);
  assert.equal(a.effects.length, 0);
});
test("Doenca condition carries actual actions/AC changes and next own turn expiry", async () => {
  const a = actor(["Doença Sobrenatural"]); await runtime.marcarDoencaUsada(a);
  assert.ok(a.effects[0].changes.some(c => c.key === "system.attributes.ac.override" && c.value === 0));
  assert.ok(a.effects[0].changes.some(c => c.key === "system.legacy2.actions.value" && c.value === 0));
  assert.equal(a.effects[0].duration.expiry, "turnEnd");
  assert.equal(a.effects[0].duration.units, "rounds");
});
test("player rest resets one-rest flags with GM connected", async () => {
  const a = actor(["Ferida Amaldiçoada", "Doença Sobrenatural"]);
  await a.setFlag("jujutsu-system", "feridaAfetada", true); await a.setFlag("jujutsu-system", "doencaUsada", true);
  await fire("dnd5e.restCompleted", a, { longRest: true });
  assert.equal(a.getFlag("jujutsu-system", "feridaAfetada"), undefined);
  assert.equal(a.getFlag("jujutsu-system", "doencaUsada"), undefined);
});
test("Desejo uses d6 and numeric native bonuses without stacking", async () => {
  const a = actor(["Desejo Sombrio"]); result = 4;
  await runtime.rolarDesejoSombrio(a); assert.equal(formulas.at(-1), "1d6");
  await runtime.alternarPenalidadeDesejo(a, true); await runtime.alternarPenalidadeDesejo(a, true);
  assert.equal(a.effects.length, 1);
  assert.deepEqual(a.effects[0].changes.map(c => c.key), ["system.rolls.ability.check.bonus", "system.rolls.ability.save.bonus", "system.rolls.attack.bonus"]);
  assert.ok(a.effects[0].changes.every(c => c.value === -4 && c.mode === 2)); result = 1;
});
test("player technique pays destructive energy once with GM connected", async () => {
  const a = actor(["Energia Destrutiva"]), activity = { item: { type: "spell", actor: a } }, usage = {};
  await fire("dnd5e.preUseActivity", activity, usage); a.system.energy.generated -= 4;
  await fire("dnd5e.postUseActivity", activity, usage, {}); await fire("dnd5e.postUseActivity", activity, usage, {});
  assert.equal(a.system.attributes.hp.value, 46);
});
test("Corpo Fragil augments native origin damage before absorption", async () => {
  const a = actor(["Corpo Frágil"]), damages = [{ type: "fire", value: 14 }]; result = 7;
  const origin = { item: { type: "spell" }, rolls: [{ options: { type: "fire" }, dice: [{ number: 4, faces: 6 }] }] };
  assert.equal(typeof runtime.preparePeculiarityDamage, "function");
  const expanded = await runtime.preparePeculiarityDamage(a, damages, { origin });
  assert.equal(expanded.reduce((sum, part) => sum + part.value, 0), 21);
  assert.equal(formulas.at(-1), "2d6"); assert.equal(damages[0].value, 14); result = 1;
});
test("nightmares preserve their levels on failure and remove their source on success", async () => {
  const a = actor(["Pesadelos Terríveis"]); a.system.attributes.exhaustion = 3;
  await a.setFlag("jujutsu-system", "pesadelosNivel", 2);
  const rest = { longRest: true, updateData: { "system.attributes.exhaustion": 2 } };
  result = 1; await runtime.preparePeculiarityRest(a, rest, {}); assert.equal(rest.updateData["system.attributes.exhaustion"], 3);
  await a.update(rest.updateData); await a.setFlag("jujutsu-system", "pesadelosNivel", rest.updateData["flags.jujutsu-system.pesadelosNivel"]); await fire("dnd5e.restCompleted", a, rest, {});
  assert.equal(a.getFlag("jujutsu-system", "pesadelosNivel"), 3);
  result = 20; const success = { longRest: true, updateData: { "system.attributes.exhaustion": 2 } };
  await runtime.preparePeculiarityRest(a, success, {}); assert.equal(success.updateData["system.attributes.exhaustion"], 0);
  await a.update(success.updateData); await a.setFlag("jujutsu-system", "pesadelosNivel", success.updateData["flags.jujutsu-system.pesadelosNivel"]); await fire("dnd5e.restCompleted", a, success, {});
  assert.equal(a.getFlag("jujutsu-system", "pesadelosNivel"), 0); result = 1;
});
test("nightmare failures protect only their own exhaustion and preserve recovery from other sources", async () => {
  for (const [before, source, planned, expected] of [[4, 2, 3, 4], [2, 2, 1, 3], [6, 5, 5, 5], [3, 0, 2, 3]]) {
    const a = actor(["Pesadelos Terríveis"]); a.system.attributes.exhaustion = before;
    await a.setFlag("jujutsu-system", "pesadelosNivel", source);
    const rest = { longRest: true, updateData: { "system.attributes.exhaustion": planned } };
    result = 1; await runtime.preparePeculiarityRest(a, rest);
    assert.equal(rest.updateData["system.attributes.exhaustion"], expected, `total ${before}, nightmares ${source}`);
  }
});
test("damage conditions use current saving throw API and respect success/cancel", async () => {
  const { aplicarCondicaoDano } = await import("../module/systems/condicoes-dano.mjs");
  const a = actor();
  a.rollSavingThrow = async config => { assert.equal(config.ability, "con"); return [{ total: 30 }]; };
  assert.equal(await aplicarCondicaoDano(a, "fire", { cd: 10 }), false);
  assert.equal(a.effects.length, 0);
  a.rollSavingThrow = async () => null;
  assert.equal(await aplicarCondicaoDano(a, "fire", { cd: 10 }), false);
  assert.equal(a.effects.length, 0);
});
test("native and JJ damage include Corpo Fragil before a single defense and shield absorption", async () => {
  const { absorbShieldDamage } = await import("../module/systems/legacy2-shield.mjs");
  const { applyDamageToActor } = await import("../module/applications/actor/jj/damage-application.mjs");
  const source = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
  const body = source.slice(source.indexOf("  async applyDamage(damages, options={}) {"), source.indexOf("  /* -------------------------------------------- */", source.indexOf("  async applyDamage(damages, options={}) {")));
  const Native = new Function("preparePeculiarityDamage", "absorbShieldDamage", "Ruleset", `return class { ${body} }`)(runtime.preparePeculiarityDamage, absorbShieldDamage, { isV2: () => true });
  Math.clamp = (n, min, max) => Math.min(max, Math.max(min, n)); Number.isNumeric = Number.isFinite;
  Hooks.call = () => true; Hooks.callAll = () => {};
  for (const native of [true, false]) {
    const a = actor(["Corpo Frágil"]);
    a.system.attributes.hp = { value: 50, temp: 0, tempmax: 0, damage: 0 };
    a.system._source = { attributes: { hp: { tempmax: 0 } } }; a.system.armorPoints = { value: 1 };
    a.calculateDamage = damages => ({ amount: damages.reduce((sum, d) => sum + d.value, 0), temp: 0, tempMax: 0 });
    await a.setFlag("jujutsu-system", "reducaoDano", { valor: 10 });
    const origin = { item: { type: "spell" }, rolls: [{ options: { type: "fire" }, dice: [{ number: 4, faces: 6 }] }] };
    result = 7;
    if (native) await Native.prototype.applyDamage.call(a, [{ type: "fire", value: 14 }], { origin });
    else await applyDamageToActor(a, 14, { damageTypes: ["fire"], damages: [{ type: "fire", value: 14 }], origin });
    assert.equal(a.system.attributes.hp.value, 41); assert.equal(a.system.armorPoints.value, 0);
  }
  result = 1;
});
test("Doenca reaction expires at the affected actor's upcoming turn end", async () => {
  const previous = game.combat;
  game.combat = { id: "c", started: true, round: 2, turn: 0, combatant: { id: "other" }, getCombatantsByActor: () => [{ id: "affected" }] };
  const a = actor(["Doença Sobrenatural"]); await runtime.marcarDoencaUsada(a);
  assert.equal(a.effects[0].start.combatant, "affected");
  assert.equal(a.effects[0].duration.value, 0); assert.equal(a.effects[0].duration.expiry, "turnEnd");
  game.combat = previous;
});
