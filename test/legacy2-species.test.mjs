import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as sheetData from "../module/applications/actor/jj/legacy2-sheet.mjs";

test("Origem de Poder resolves the selected owned species rather than a legacy label", () => {
  const oldSpecies = { id: "gojo", uuid: "Actor.a.Item.gojo", type: "race", name: "Linhagem - Gojo" };
  const selected = { id: "newOrigin", uuid: "Actor.a.Item.newOrigin", type: "race", name: "Receptáculo" };
  const actor = { itemTypes: { race: [oldSpecies, selected] }, system: { details: { race: selected } } };
  assert.equal(sheetData.legacy2Species(actor), selected);
  actor.system.details.race = selected.id;
  assert.equal(sheetData.legacy2Species(actor), selected);
  actor.system.details.race = selected.uuid;
  assert.equal(sheetData.legacy2Species(actor), selected);
});

test("owned compendium species still appears with missing or stale native race references", () => {
  const species = { id: "origin", uuid: "Actor.a.Item.origin", type: "race", name: "Corpo Amaldiçoado" };
  const actor = { items: [species], system: { details: { race: "old-deleted-id" } } };
  assert.equal(sheetData.legacy2Species(actor), species);
  actor.system.details.race = { id: "foreign", uuid: "Compendium.origins.Item.foreign", type: "race" };
  assert.equal(sheetData.legacy2Species(actor), species, "must open the owned copy, not a compendium document");
  delete actor.system.details.race;
  assert.equal(sheetData.legacy2Species(actor), species);
  actor.items = [];
  assert.equal(sheetData.legacy2Species(actor), null);
});

test("legacy source references select the matching owned species and empty actors remain valid", () => {
  const first = { id: "first", type: "race", name: "Primeira" };
  const last = { id: "last", type: "race", name: "Segunda" };
  const actor = { itemTypes: { race: [first, last] }, system: { details: {} },
    _source: { system: { details: { race: "first" } } } };
  assert.equal(sheetData.legacy2Species(actor), first);
  actor._source.system.details.race = "missing";
  assert.equal(sheetData.legacy2Species(actor), last);
  assert.equal(sheetData.legacy2Species({ system: {} }), null);
});

test("empty species selection uses the native compendium flow and preserves cancellation and permissions", async () => {
  const source = readFileSync(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
  const body = source.match(/static async #findItem\(event, target\) \{([\s\S]*?)\n  \}/)[1];
  const calls = [];
  const item = { id: "origin", type: "race", name: "Receptáculo" };
  let result = "Compendium.origins.Item.origin";
  const method = new Function("CompendiumBrowser", "fromUuid", "game", `return async function(event,target){${body}}`)(
    { async selectOne(config) { calls.push(config); return result; } }, async () => item,
    { items: { fromCompendium: value => value } }
  );
  const sheet = { isEditable: true, actor: {}, _detachOptions: () => ({}),
    _onDropCreateItems(event, items) { calls.push(items); } };
  await method.call(sheet, {}, { dataset: { itemType: "race" } });
  assert.deepEqual(calls[0].filters.locked.types, new Set(["race"]));
  assert.deepEqual(calls[1], [item]);
  result = null;
  await method.call(sheet, {}, { dataset: { itemType: "race" } });
  assert.equal(calls.length, 3, "cancel never adds an item");
  sheet.isEditable = false;
  await method.call(sheet, {}, { dataset: { itemType: "race" } });
  assert.equal(calls.length, 3, "read-only cannot add species");
});
