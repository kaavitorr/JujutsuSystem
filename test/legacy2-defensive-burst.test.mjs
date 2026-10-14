import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.Hooks = { on() {} };
let choice = "1", confirm = false, dialogOptions, formulas = [];
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
    const button = options.buttons[choice === "cancel" ? 1 : 0];
    return (await button.callback({}, {}, { element: { querySelector: () => ({ value: choice }) } })) ?? button.action;
  },
  async confirm() { return confirm; }
} } } };
const { onExplosaoDefensiva2 } = await import("../module/applications/actor/jj/explosao-defensiva.mjs");
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
  a.update = async update => { a.updates.push(update); a.system.legacy2.actions.value = update["system.legacy2.actions.value"]; };
  return a;
}
test("defensive burst respects the half-level cap and spends no action points", async () => {
  choice = "5";
  const a = withUpdates(actor(4, 9));
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, ["5d4"]);
  assert.equal(a.system.legacy2.actions.value, 4);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 10, paCusto: 0 });
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
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 4, paCusto: 0 });
});
test("canceling the prompt leaves actor data untouched", async () => {
  choice = null;
  const a = withUpdates(actor());
  await onExplosaoDefensiva2(a);
  assert.deepEqual(a.updates, []);
  assert.deepEqual(formulas, []);
  assert.ok(!a.flags.explosaoDefensivaPendente);
});
test("a new defense overwrites the previous pending reduction without spending action points", async () => {
  choice = "3";
  const a = withUpdates(actor(5, 9, { reducao: 8, paCusto: 4 }));
  await onExplosaoDefensiva2(a);
  assert.deepEqual(a.flags.explosaoDefensivaPendente, { reducao: 6, paCusto: 0 });
  assert.deepEqual(formulas, ["3d4"]);
  assert.equal(a.system.legacy2.actions.value, 5);
});
test("the native cancel fallback never rolls", async () => {
  choice = "cancel";
  const a = withUpdates(actor());
  await onExplosaoDefensiva2(a);
  assert.deepEqual(formulas, []);
  assert.deepEqual(a.updates, []);
});
