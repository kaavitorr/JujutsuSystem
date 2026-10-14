import assert from "node:assert/strict";
import { test } from "node:test";
import { modoSeisOlhos, contextoSeisOlhos, acertoSeisOlhos, rankSeisOlhos } from "../module/systems/seis-olhos.mjs";

globalThis.game = { settings: { get: () => "2.0" }, combat: null };
globalThis.Hooks = { on() {} };
globalThis.ui = { notifications: { warn() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { CUSTOM: 0, MULTIPLY: 1, ADD: 2, DOWNGRADE: 3, UPGRADE: 4, OVERRIDE: 5 } };
const interactive = await import("../module/applications/actor/jj/seis-olhos.mjs");
function fixture(mode) {
  const writes = [], actor = { itemTypes: { feat: [{ system: { identifier: "seis-olhos" } }] },
    system: { legacy2: { actions: { value: 6 } } }, mode,
    getFlag() { return this.mode; }, async update(data) { writes.push(data); }, async setFlag() {} };
  return { actor, writes };
}

test("Seis Olhos has only Vendado and Completo; an absent or obsolete state defaults to Vendado", () => {
  for (const mode of [undefined, null, "", "guarded", "sealed"]) {
    const { actor } = fixture(mode), context = contextoSeisOlhos(actor);
    assert.equal(modoSeisOlhos(actor), "sealed");
    assert.equal(context.rotulo, "Vendado");
    assert.equal(context.acerto, 1);
    assert.equal(context.cr, 1);
    assert.equal(context.custo, 1);
    assert.equal(rankSeisOlhos(actor), 2);
  }
  const full = contextoSeisOlhos(fixture("full").actor, { nivel: 8 });
  assert.equal(full.rotulo, "Completo");
  assert.equal(full.acerto, 2);
  assert.equal(full.leitura, true);
  const absent = fixture("full").actor; absent.itemTypes.feat = [];
  assert.equal(contextoSeisOlhos(absent).tem, false);
  assert.equal(acertoSeisOlhos(absent), 0);
});

test("Guardar is rejected without an action debit, and only valid state changes spend an action", async () => {
  const { actor, writes } = fixture("full");
  assert.equal(await interactive.alternarSeisOlhos(actor, ""), false);
  assert.equal(writes.length, 0);
  assert.equal(await interactive.alternarSeisOlhos(actor, "sealed"), true);
  assert.deepEqual(writes, [{ "system.legacy2.actions.value": 5 }, { "flags.jujutsu-system.seisOlhosMode": "sealed" }]);
  const defaults = fixture(undefined);
  assert.equal(await interactive.alternarSeisOlhos(defaults.actor, "sealed"), false);
  assert.equal(defaults.writes.length, 0);
});
