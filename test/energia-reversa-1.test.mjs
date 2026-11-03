import assert from "node:assert/strict";
import { test } from "node:test";

let version = "1.0";
const hooks = new Map(), messages = [];
globalThis.Hooks = { on(name, handler) { const list = hooks.get(name) ?? []; list.push(handler); hooks.set(name, list); } };
globalThis.game = { settings: { get: () => version }, user: { id: "owner", isGM: true, targets: new Set() },
  combat: { id: "combat", started: true, round: 1, combatant: { id: "turn" } } };
globalThis.ui = { notifications: { warn() {}, info() {}, error() {} } };
globalThis.foundry = { utils: { escapeHTML: String }, applications: { api: { DialogV2: { wait: async () => null } } } };
globalThis.ChatMessage = { getSpeaker: () => ({}), create: async data => messages.push(data) };
const er = await import("../module/applications/actor/jj/energia-reversa.mjs");
const get = (object, path) => path.split(".").reduce((v, k) => v?.[k], object);
function fixture({ level = 8, unlocked = true } = {}) {
  version = "1.0"; game.combat.round = 1; game.user.targets.clear();
  const writes = [];
  const actor = { type: "character", name: "Test", isOwner: true, items: [], statuses: new Set(),
    system: { details: { level }, manipulation: { abilities: { energiaReversa: { unlocked } } },
      abilities: { con: { value: 4 } }, attributes: { prof: 3, hp: { value: 10, max: 100 } },
      energy: { total: 100, generated: 20 }, legacy2: { reverseEnergy: { value: 10, max: 30, maxPerRound: 3 } } },
    flags: { "jujutsu-system": {} },
    getFlag(scope, key) { return get(this.flags[scope], key); },
    async update(update) {
      writes.push(update);
      for (const [path, value] of Object.entries(update)) {
        const keys = path.split("."), last = keys.pop(); let target = this;
        for (const key of keys) target = target[key] ??= {};
        target[last] = structuredClone(value);
      }
      return this;
    }
  };
  game.combat.combatant = { id: "turn", actor };
  return { actor, writes };
}

test("1.0 PER heals character level rather than Constitution and costs no actions or energy", async () => {
  const { actor } = fixture();
  assert.equal(await er.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.attributes.hp.value, 18);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 9);
  assert.deepEqual(actor.system.energy, { total: 100, generated: 20 });
});
test("1.0 limb restoration costs 2 PER and refuses unconscious creatures", async () => {
  const { actor, writes } = fixture(); actor.statuses.add("unconscious");
  assert.equal(await er.usarEnergiaReversa(actor, 2), false); assert.equal(writes.length, 0);
  actor.statuses.clear();
  assert.equal(await er.usarEnergiaReversa(actor, 2), true);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 8);
});
test("1.0 awakening is automatic at level 12, while lower-level characters need an existing unlock", async () => {
  const early = fixture({ level: 11, unlocked: false });
  assert.equal(await er.usarEnergiaReversa(early.actor, 1), false);
  const natural = fixture({ level: 12, unlocked: false });
  assert.equal(await er.usarEnergiaReversa(natural.actor, 1), true);
  assert.equal(natural.actor.system.attributes.hp.value, 22);
});
test("1.0 resets its allowance on its turn, never on another creature's turn or a global round change", async () => {
  const { actor } = fixture(); await er.usarEnergiaReversa(actor, 2);
  const other = { id: "other", actor: {} }; game.combat.combatant = other; game.combat.round++;
  assert.equal(er.contextoEnergiaReversa(actor).pontosNaRodada, 2);
  const turn = { id: "turn", actor }; game.combat.combatant = turn;
  await er.resetarUsoReversaNoTurno(actor, game.combat, turn);
  assert.equal(er.contextoEnergiaReversa(actor).pontosNaRodada, 0);
});
test("1.0 conversion requires a rest or Kokusen opportunity and debits only Total Energy", async () => {
  const { actor } = fixture();
  assert.equal(await er.recuperarEnergiaReversa(actor, 1), false);
  actor.flags["jujutsu-system"].reversaRecuperacao = { tipo: "fulgor", combatId: "combat", restante: 10 };
  assert.equal(await er.recuperarEnergiaReversa(actor, 11), false);
  assert.equal(await er.recuperarEnergiaReversa(actor, 6), true);
  assert.equal(actor.system.energy.total, 82);
  assert.equal(actor.system.energy.generated, 20);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 16);
  assert.equal(actor.flags["jujutsu-system"].reversaRecuperacao.restante, 4);
});
test("an old Kokusen cannot be redeemed in another combat, nor a rest opportunity inside combat", async () => {
  const { actor } = fixture();
  for (const credit of [{ tipo: "fulgor", combatId: "old", restante: 10 }, { tipo: "descanso", restante: 30 }]) {
    actor.flags["jujutsu-system"].reversaRecuperacao = credit;
    assert.equal(await er.recuperarEnergiaReversa(actor, 1), false);
  }
});
test("the existing 2.0 formula and unrestricted conversion remain unchanged", async () => {
  const { actor } = fixture(); version = "2.0";
  assert.equal(await er.usarEnergiaReversa(actor, 1), true);
  assert.equal(actor.system.attributes.hp.value, 14);
  assert.equal(await er.recuperarEnergiaReversa(actor, 1), true);
});

const classic = () => import("../module/applications/actor/jj/energia-reversa-1.mjs");
test("Kokusen lowers learning DC once per long rest and offers at most ten conversions after awakening", async () => {
  const mod = await classic(), { actor } = fixture({ unlocked: false });
  actor.flags["jujutsu-system"].fulgorZona = true;
  await mod.registrarFulgorReversa1(actor);
  assert.equal(mod.contextoReversa1(actor).cd, 39);
  await mod.registrarFulgorReversa1(actor);
  assert.equal(mod.contextoReversa1(actor).cd, 39);
  actor.system.manipulation.abilities.energiaReversa.unlocked = true;
  await mod.registrarFulgorReversa1(actor);
  assert.equal(er.contextoEnergiaReversa(actor).recuperavel, 10);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 10, "canceling conversion grants no PER");
});
test("long rest clears the once-per-rest learning reduction marker and opens a paid conversion outside combat", async () => {
  const mod = await classic(), { actor } = fixture();
  actor.flags["jujutsu-system"].reversaZonaDescanso = true;
  const combat = game.combat; game.combat = null;
  try {
    await mod.registrarDescansoReversa1(actor, { longRest: true });
    assert.equal(actor.flags["jujutsu-system"].reversaZonaDescanso, false);
    assert.equal(er.contextoEnergiaReversa(actor).recuperavel, 20);
    assert.equal(actor.system.energy.total, 100);
    assert.equal(await er.recuperarEnergiaReversa(actor, 2), true);
    assert.equal(actor.system.energy.total, 94);
  } finally { game.combat = combat; }
});
test("emergency healing requires an empty PER reserve, the own turn, and 2 generated PA per d4", async () => {
  const mod = await classic(), { actor } = fixture();
  globalThis.Roll = class { constructor(formula) { this.formula = formula; this.total = 5; } async evaluate() { return this; } async toMessage(data) { messages.push(data); } };
  assert.equal(await mod.curarEmergencia1(actor, 2), false);
  actor.system.legacy2.reverseEnergy.value = 0;
  game.combat.combatant = { id: "other", actor: {} };
  assert.equal(await mod.curarEmergencia1(actor, 2), false);
  game.combat.combatant = { id: "turn", actor };
  assert.equal(await mod.curarEmergencia1(actor, 7), false);
  assert.equal(await mod.curarEmergencia1(actor, 2), true);
  assert.equal(actor.system.energy.generated, 16);
  assert.equal(actor.system.energy.total, 100);
  assert.equal(actor.system.attributes.hp.value, 15);
  assert.match(messages.at(-1).flavor, /5 PV recuperados/);
  assert.equal(await mod.curarEmergencia1(actor, 1), false, "the emergency bonus action cannot repeat in the same turn");
});
test("a Kokusen outside combat still offers its paid ten-PER conversion", async () => {
  const mod = await classic(), { actor } = fixture(); const combat = game.combat; game.combat = null;
  try {
    await mod.registrarFulgorReversa1(actor);
    assert.equal(er.contextoEnergiaReversa(actor).recuperavel, 10);
    assert.equal(await er.recuperarEnergiaReversa(actor, 1), true);
    assert.equal(actor.system.energy.total, 97);
  } finally { game.combat = combat; }
});
test("awakening uses native Constitution / Energy Control and does not treat a natural 20 as an automatic success", async () => {
  const mod = await classic(), { actor } = fixture({ unlocked: false });
  actor.rollSkill = async config => { assert.equal(config.skill, "Cont"); assert.equal(config.ability, "con"); return [{ total: 30 }]; };
  assert.equal(await mod.testarDespertarReversa1(actor), false);
  actor.rollSkill = async () => [{ total: 40 }];
  assert.equal(await mod.testarDespertarReversa1(actor), true);
  assert.equal(actor.system.manipulation.abilities.energiaReversa.unlocked, true);
});
test("emergency healing revalidates the turn after its asynchronous roll", async () => {
  const mod = await classic(), { actor } = fixture(); actor.system.legacy2.reverseEnergy.value = 0;
  let release;
  globalThis.Roll = class { constructor() { this.total = 5; } async evaluate() { await new Promise(resolve => release = resolve); return this; } async toMessage() {} };
  const action = mod.curarEmergencia1(actor, 1);
  game.combat.combatant = { id: "other", actor: {} }; release();
  assert.equal(await action, false);
  assert.equal(actor.system.attributes.hp.value, 10);
  assert.equal(actor.system.energy.generated, 20);
});
test("Energy Flexibility retains targeted healing, half the new level-based amount, without charging the target", async () => {
  const mod = await classic(), { actor } = fixture();
  actor.system.manipulation.abilities.energiaFlexivel = { unlocked: true };
  const target = fixture().actor;
  game.user.targets.add({ actor: target });
  await mod.curarEnergiaReversa1(actor);
  assert.equal(actor.system.attributes.hp.value, 10);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 9);
  assert.equal(target.system.attributes.hp.value, 14);
  assert.equal(target.system.legacy2.reverseEnergy.value, 10);
});
test("the sidebar binds each card once and dispatches its real heal handler", async () => {
  const mod = await classic(), { actor } = fixture();
  let clicks = 0, listener;
  const box = { addEventListener(type, handler) { assert.equal(type, "click"); clicks++; listener = handler; } };
  const element = { querySelector: () => box };
  mod.setupReversa1(element, actor); mod.setupReversa1(element, actor);
  assert.equal(clicks, 1);
  listener({ target: { closest: () => ({ dataset: { er1Action: "heal" } }) }, preventDefault() {} });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(actor.system.attributes.hp.value, 18);
  assert.equal(actor.system.legacy2.reverseEnergy.value, 9);
});
test("a Restringido stays ineligible even after being renamed or reaching level twelve", async () => {
  const { actor } = fixture({ level: 12 });
  actor.items.push({ type: "class", name: "Outro nome", system: { identifier: "restringido" } });
  assert.equal(await er.usarEnergiaReversa(actor, 1), false);
  assert.equal((await classic()).contextoReversa1(actor), null);
});
test("the Foundry tracker event resets an awakened 1.0 actor's PER allowance", async () => {
  const { actor } = fixture(); await er.usarEnergiaReversa(actor, 2);
  game.combat.round = 2;
  game.combat.previous = { round: 1, combatantId: "other" };
  game.combat.current = { round: 2, combatantId: "turn" };
  for (const listener of hooks.get("updateCombat")) await listener(game.combat, { turn: 0 }, {}, "owner");
  assert.equal(actor.getFlag("jujutsu-system", "energiaReversaRodada").pontos, 0);
  assert.equal(await er.usarEnergiaReversa(actor, 2), true);
});
test("emergency healing cannot spend a bonus action while unconscious", async () => {
  const mod = await classic(), { actor } = fixture(); actor.system.legacy2.reverseEnergy.value = 0;
  actor.system.attributes.hp.value = 0;
  globalThis.Roll = class { constructor() { this.total = 5; } async evaluate() { return this; } async toMessage() {} };
  assert.equal(await mod.curarEmergencia1(actor, 1), false);
  assert.equal(actor.system.energy.generated, 20);
});
