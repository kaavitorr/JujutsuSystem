import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as sheetData from "../module/applications/actor/jj/legacy2-sheet.mjs";
const { buildLegacy2Context } = sheetData;

const source = readFileSync(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
const body = source.match(/static async #onActionPip\(event, target\) \{([\s\S]*?)\n  \}/)?.[1];
const ruleset = {
  isV2: () => true, estilo: () => null, atributoPrincipal: () => "str",
  rankLabel: () => "Destreinado", rankBonus: () => 0,
  trainingPointsTotal: () => 0, trainingPointsAvailable: () => 0, atributosAdicionais: () => 0, nivel: () => 1
};

function fixture(value = 4, max = 6) {
  const actor = { system: { attributes: { hp: { max: 10 } }, abilities: {}, legacy2: { actions: { value, max } } },
    async update(data) { this.system.legacy2.actions.value = data["system.legacy2.actions.value"]; } };
  return { actor, isEditable: true, isEditMode: false };
}

function getHandler(methodBody) {
  return new Function("Ruleset", "legacy2ActionMax", "acoesTetoEfetivo", `return async function(event, target) {${methodBody}}`)(
    ruleset, sheetData.legacy2ActionMax, sheetData.acoesTetoEfetivo
  );
}

test("clicking action boxes changes the saved total in play mode, including zero and full", async () => {
  assert.ok(body, "action boxes need a registered handler");
  assert.ok(source.includes("jj2ActionPip: CharacterActorSheet.#onActionPip"));
  const handler = getHandler(body);
  const sheet = fixture();
  for ( const [box, expected] of [[4, 3], [3, 2], [1, 1], [1, 0], [6, 6], [2, 2]] ) {
    const ctx = buildLegacy2Context(sheet.actor, { abilities: {} }, ruleset);
    const pip = ctx.actions.pips[box - 1];
    await handler.call(sheet, {}, { dataset: { value: String(pip.value) } });
    assert.equal(sheet.actor.system.legacy2.actions.value, expected);
    const rendered = buildLegacy2Context(sheet.actor, { abilities: {} }, ruleset);
    assert.equal(rendered.actions.pips.filter(p => p.filled).length, expected);
  }
});

test("invalid action totals and sheets without write permission cannot change the actor", async () => {
  assert.ok(body, "action boxes need a registered handler");
  const handler = getHandler(body);
  const sheet = fixture();
  for ( const value of ["", "-1", "7", "1.5", "invalid"] ) {
    await handler.call(sheet, {}, { dataset: { value } });
    assert.equal(sheet.actor.system.legacy2.actions.value, 4);
  }
  sheet.isEditable = false;
  await handler.call(sheet, {}, { dataset: { value: "0" } });
  assert.equal(sheet.actor.system.legacy2.actions.value, 4);
  sheet.isEditable = true;
  ruleset.isV2 = () => false;
  await handler.call(sheet, {}, { dataset: { value: "0" } });
  assert.equal(sheet.actor.system.legacy2.actions.value, 4);
  ruleset.isV2 = () => true;
});

test("action boxes and restoration follow the effective maximum above six, below six and at zero", async () => {
  const restoreBody = source.match(/static async #onRestoreActions\(\) \{([\s\S]*?)\n  \}/)?.[1];
  const restore = getHandler(restoreBody);
  const click = getHandler(body);
  const sheet = fixture(6, 9);
  let ctx = buildLegacy2Context(sheet.actor, { abilities: {} }, ruleset);
  assert.equal(ctx.actions.max, 9);
  assert.equal(ctx.actions.pips.length, 9);
  await click.call(sheet, {}, { dataset: { value: "9" } });
  assert.equal(sheet.actor.system.legacy2.actions.value, 9);
  sheet.actor.system.legacy2.actions.value = 1;
  await restore.call(sheet);
  assert.equal(sheet.actor.system.legacy2.actions.value, 9);

  sheet.actor.system.legacy2.actions.max = 3;
  ctx = buildLegacy2Context(sheet.actor, { abilities: {} }, ruleset);
  assert.equal(ctx.actions.value, 3);
  assert.equal(ctx.actions.pips.length, 3);
  await click.call(sheet, {}, { dataset: { value: "4" } });
  assert.equal(sheet.actor.system.legacy2.actions.value, 9);
  await restore.call(sheet);
  assert.equal(sheet.actor.system.legacy2.actions.value, 3);

  sheet.actor.system.legacy2.actions.max = 0;
  ctx = buildLegacy2Context(sheet.actor, { abilities: {} }, ruleset);
  assert.equal(ctx.actions.value, 0);
  assert.equal(ctx.actions.pips.length, 0);
  await restore.call(sheet);
  assert.equal(sheet.actor.system.legacy2.actions.value, 0);
});
