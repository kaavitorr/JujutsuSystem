import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";

globalThis.Hooks = { on() {} };
let choice = "1", confirm = false, dialogOptions, formulas = [], beforeAccept;
globalThis.game = { user: {}, settings: { get: () => "2.0" } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.ui = { notifications: { info() {}, warn() {} } };
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; formulas.push(formula); this.total = Number(formula.split("d")[0]) * 2; }
  async evaluate() { return this; }
  async toMessage() {}
};
const camposEncontrados = {};
for (const nome of ["ArrayField", "DocumentUUIDField", "FilePathField", "NumberField", "SchemaField", "StringField", "BooleanField", "SetField", "ObjectField"])
  camposEncontrados[nome] = class { constructor(...args) {} initialize() {} };
globalThis.KeyboardManager = class {
  static MODIFIER_CODES = { Alt: ["AltLeft"], Control: ["ControlLeft", "ControlRight"], Meta: ["MetaLeft"], Shift: ["ShiftLeft"] };
  static MODIFIER_KEYS = ["AltLeft", "ControlLeft", "ControlRight", "MetaLeft", "ShiftLeft"];
};
globalThis.foundry = { data: { fields: camposEncontrados }, utils: { escapeHTML: value => String(value) }, applications: { api: { DialogV2: {
  async wait(options) {
    dialogOptions = options;
    if ( choice === null ) return null;
    beforeAccept?.();
    const button = options.buttons[choice === "cancel" ? 1 : 0];
    return (await button.callback({}, {}, { element: { querySelector: () => ({ value: choice }) } })) ?? button.action;
  },
  async confirm() { return confirm; }
} } } };
const { onExplosaoDefensiva2 } = await import("../module/applications/actor/jj/explosao-defensiva.mjs");
// Exercise the NPC's actual entry point without loading the unrelated sheet framework.
const npcSheetSource = readFileSync(new URL("../module/applications/actor/npc-sheet.mjs", import.meta.url), "utf8");
const npcBurstSource = npcSheetSource.slice(npcSheetSource.indexOf("async function _npcExplosaoDefensiva("),
  npcSheetSource.indexOf("async function _npcSyncIntensiveTraining("));
const npcBurst = new Function("Ruleset", "onExplosaoDefensiva2",
  `${npcBurstSource}\nreturn _npcExplosaoDefensiva;`)(Ruleset, onExplosaoDefensiva2);
function actor(pa = 4, nivel = 9, pending = null) {
  formulas = []; dialogOptions = null;
  const flags = { explosaoDefensivaPendente: pending };
  return { name: "Teste", system: { details: { level: nivel }, legacy2: { actions: { value: pa, max: 6 } }, energy: { total: 200, generated: 10 } },
    getFlag: (scope,key) => flags[key], setFlag: async(scope,key,value) => { flags[key] = value; },
    unsetFlag: async(scope,key) => { delete flags[key]; },
    update: async() => {},
    flags
  };
}
function withUpdates(a) {
  a.updates = [];
  a.update = async update => { a.updates.push(update);
    if ("system.energy.generated" in update) a.system.energy.generated = update["system.energy.generated"];
    if ("flags.jujutsu-system.explosaoDefensivaPendente" in update) a.flags.explosaoDefensivaPendente = update["flags.jujutsu-system.explosaoDefensivaPendente"];
  };
  return a;
}
test("defensive burst spends one refined energy per die, atomically, without spending action points", async () => {
  choice = "5";
  const a = withUpdates(actor(4, 9));
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, ["5d4"]);
  assert.equal(a.system.legacy2.actions.value, 4);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 10, paCusto: 5 });
  assert.equal(a.system.energy.generated, 5);
  assert.equal(a.updates.length, 1);
  assert.equal(a.system.energy.total, 200);
});
test("odd levels use the rounded-up half-level cap", async () => {
  choice = "5";
  const a = withUpdates(actor(6, 9));
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, ["5d4"]);
  assert.equal(a.system.legacy2.actions.value, 6);
});
test("fractional choices become whole dice within the cap and queue the rolled reduction", async () => {
  choice = "2.8";
  const a = withUpdates(actor());
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, ["2d4"]);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 4, paCusto: 2 });
});
test("canceling the prompt leaves actor data untouched", async () => {
  choice = null;
  const a = withUpdates(actor());
  await onExplosaoDefensiva2(a);
  assert.deepEqual(a.updates, []);
  assert.deepEqual(formulas, []);
  assert.ok(!a.flags.explosaoDefensivaPendente);
});
test("pending defense is preserved when replacement is declined", async () => {
  choice = "3";
  const a = withUpdates(actor(5, 9, { reducao: 8, paCusto: 4 }));
  await onExplosaoDefensiva2(a);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 8, paCusto: 4 });
  assert.deepEqual(formulas, []);
  assert.deepEqual(a.updates, []);
  assert.equal(a.system.legacy2.actions.value, 5);
});
test("the native cancel fallback never rolls", async () => {
  choice = "cancel";
  const a = withUpdates(actor());
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, []);
  assert.deepEqual(a.updates, []);
});

test("NPC defense opens the player's themed modal and uses ND and refined energy", async () => {
  choice = "99";
  const a = withUpdates(actor(0, 20));
  a.type = "npc";
  a.system.legacy2.nd = "9";
  a.system.energy.generated = 3;
  await npcBurst(a);
  assert.deepEqual(dialogOptions?.classes, ["dnd5e2", "jj2-document", "jj2-defensive-burst"]);
  assert.ok(dialogOptions.actions.jj2StepCounter);
  assert.equal(typeof dialogOptions.render, "function");
  assert.deepEqual(formulas, ["3d4"]);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 6, paCusto: 3 });
  assert.equal(a.system.energy.generated, 0);
  assert.equal(a.system.energy.total, 200);
});

test("canceling NPC defense preserves its pending reduction and resources", async () => {
  choice = "cancel";
  const pending = { reducao: 8, paCusto: 0 };
  const a = withUpdates(actor(3, 9, pending));
  a.type = "npc";
  a.system.legacy2.nd = "9";
  await npcBurst(a);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, pending);
  assert.deepEqual(formulas, []);
  assert.deepEqual(a.updates, []);
});

test("zero energy and an energy balance changed during the dialog cannot create a free defense", async () => {
  choice = "2";
  const a = withUpdates(actor()); a.system.energy.generated = 0;
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, []); assert.deepEqual(a.updates, []);
  const b = withUpdates(actor()); beforeAccept = () => { b.system.energy.generated = 0; };
  try { await onExplosaoDefensiva2(b); } finally { beforeAccept = undefined; }
  assert.deepEqual(b.updates, []); assert.ok(!b.flags.explosaoDefensivaPendente);
});

test("confirmed replacement charges the new dice and preserves action and reserve balances", async () => {
  choice = "3"; confirm = true;
  const a = withUpdates(actor(5, 9, { reducao: 8, paCusto: 4 }));
  try { await onExplosaoDefensiva2(a); } finally { confirm = false; }
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 6, paCusto: 3 });
  assert.equal(a.system.energy.generated, 7); assert.equal(a.system.legacy2.actions.value, 5);
});

test("NPC defense retains the legacy energy requirement in rules 1.0", async () => {
  const getSetting = game.settings.get;
  game.settings.get = () => "1.0";
  try {
    const a = withUpdates(actor());
    a.type = "npc";
    a.system.energy.generated = 0;
    await npcBurst(a);
    assert.equal(dialogOptions, null);
    assert.deepEqual(formulas, []);
    assert.deepEqual(a.updates, []);
  } finally {
    game.settings.get = getSetting;
  }
});
