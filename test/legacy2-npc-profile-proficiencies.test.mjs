import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { npcProfileProficiencyOrder, npcProficiencyMode, npcProficiencyDistribution } from "../module/systems/legacy2-npc-profiles.mjs";
import { proficiencyOrderContext, updateNpcProficiencyOrder } from "../module/applications/actor/jj/npc-proficiency-order.mjs";

let combined = false, version = "2.0";
globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? version : combined } };
function sheetFixture(profile = false) {
  combined = false; version = "2.0";
  const writes = [], document = { type: profile ? "archetype" : "npc", items: [],
    system: profile ? { proficiencyOrder: { original: ["skills.ste", "skills.sur"], alternative: ["alternativeSaves.reflexo"] } }
      : { legacy2: { nd: "5", skills: { ste: 2 }, proficiencyOrder: {
        original: ["skills.ste", "skills.sur"], alternative: ["alternativeSaves.reflexo"] } } },
    async update(changes) {
      writes.push(changes);
      for (const [path, value] of Object.entries(changes)) {
        const keys = path.split("."), last = keys.pop();
        keys.reduce((object, key) => object[key] ??= {}, this)[last] = value;
      }
    } };
  return { sheet: { [profile ? "item" : "actor"]: document, isEditable: true, isEditMode: true }, document, writes };
}
const target = (command, id, value) => ({ dataset: { command, id },
  closest: () => ({ querySelector: () => ({ value }) }) });

test("profile editors load saved ordered choices for each save rule without offering rank grants", async () => {
  const source = readFileSync(new URL("../module/applications/item/npc-profile-sheet.mjs", import.meta.url), "utf8");
  const body = source.match(/async _preparePartContext\(partId, context, options\) \{([\s\S]*?)\r?\n  \}/)[1];
  class Base { async _preparePartContext(_part, context) { return context; } }
  const Sheet = new Function("Base", "npcProficiencyMode", "npcProfileProficiencyOrder", "proficiencyOrderContext",
    `return class extends Base {async _preparePartContext(partId,context,options){${body}}}`
  )(Base, npcProficiencyMode, npcProfileProficiencyOrder, proficiencyOrderContext);
  for (const type of ["archetype", "taxonomy"]) {
    const sheet = Object.assign(new Sheet(), { item: { type } });
    const source = { proficiencyOrder: { original: ["skills.ste", "saves.dex"], alternative: ["alternativeSaves.reflexo", "skills.sur"] } };
    for (const active of [false, true]) {
      combined = active;
      const data = await sheet._preparePartContext("proficiencias", { source }, {});
      const editor = data.profile.proficiency;
      assert.deepEqual(editor.entries.map(entry => entry.id), source.proficiencyOrder[active ? "alternative" : "original"]);
      assert.equal(editor.entries[0].n, 1);
      assert.equal(editor.choices.length, (active ? 18 : 21) - 2);
      assert(editor.choices.every(choice => !editor.entries.some(entry => entry.id === choice.id)));
      assert.equal(editor.profile, true);
      assert.equal(data.profile.rankChoices, undefined);
    }
  }
});

test("reorder, add and remove persist actual actor/profile orders without changing individual points", async () => {
  for (const profile of [false, true]) {
    const { sheet, document, writes } = sheetFixture(profile);
    const field = profile ? document.system : document.system.legacy2;
    const manual = structuredClone(field.skills);
    await updateNpcProficiencyOrder(sheet, target("down", "skills.ste"));
    assert.deepEqual(field.proficiencyOrder.original, ["skills.sur", "skills.ste"]);
    await updateNpcProficiencyOrder(sheet, target("up", "skills.ste"));
    assert.deepEqual(field.proficiencyOrder.original, ["skills.ste", "skills.sur"]);
    await updateNpcProficiencyOrder(sheet, target("remove", "skills.ste"));
    await updateNpcProficiencyOrder(sheet, target("add", null, "saves.dex"));
    assert.deepEqual(field.proficiencyOrder.original, ["skills.sur", "saves.dex"]);
    assert.deepEqual(field.proficiencyOrder.alternative, ["alternativeSaves.reflexo"]);
    assert.deepEqual(field.skills, manual);
    assert.equal(writes.length, 4);
  }
});

test("the first NPC edit copies the suggested sequence and reset returns to current live profile suggestions", async () => {
  const { sheet, document } = sheetFixture();
  document.system.legacy2.proficiencyOrder.original = null;
  const profile = { type: "archetype", id: "arch", name: "Assassino", system: { proficiencyOrder: { original: ["skills.ste", "skills.sur"] } } };
  document.items.push(profile);
  await updateNpcProficiencyOrder(sheet, target("up", "skills.sur"));
  assert.deepEqual(npcProficiencyDistribution(document).order, ["skills.sur", "skills.ste"]);
  profile.system.proficiencyOrder.original = ["saves.dex"];
  assert.deepEqual(npcProficiencyDistribution(document).order, ["skills.sur", "skills.ste"]);
  await updateNpcProficiencyOrder(sheet, target("reset"));
  assert.equal(document.system.legacy2.proficiencyOrder.original, null);
  assert.deepEqual(npcProficiencyDistribution(document).order, ["saves.dex"]);
});

test("clearing a legacy profile order keeps it empty instead of reviving its old direct grants", async () => {
  const { sheet, document } = sheetFixture(true);
  document.system.proficiencias = { skills: { ste: 4 } };
  await updateNpcProficiencyOrder(sheet, target("reset"));
  assert.deepEqual(npcProfileProficiencyOrder(document.system), []);
});

test("invalid choices, duplicates, boundary moves and sheets without edit permission never save", async () => {
  const { sheet, writes } = sheetFixture();
  for (const input of [target("add", null, "skills.ste"), target("add", null, "invalid"),
    target("remove", "skills.ath"), target("up", "skills.ste"), target("down", "skills.sur"),
    target("invalid", "skills.ste"), target("add", null, "alternativeSaves.reflexo")])
    await updateNpcProficiencyOrder(sheet, input);
  await updateNpcProficiencyOrder({ ...sheet, isEditable: false }, target("reset"));
  await updateNpcProficiencyOrder({ ...sheet, isEditMode: false }, target("reset"));
  version = "1.0";
  await updateNpcProficiencyOrder(sheet, target("reset"));
  assert.deepEqual(writes, []);
});

test("editing the alternative rule's order leaves the original order intact", async () => {
  const { sheet, document } = sheetFixture();
  combined = true;
  await updateNpcProficiencyOrder(sheet, target("add", null, "alternativeSaves.vontade"));
  assert.deepEqual(document.system.legacy2.proficiencyOrder.original, ["skills.ste", "skills.sur"]);
  assert.deepEqual(document.system.legacy2.proficiencyOrder.alternative, ["alternativeSaves.reflexo", "alternativeSaves.vontade"]);
});
