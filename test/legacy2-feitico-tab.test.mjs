import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import Ruleset from "../module/systems/ruleset.mjs";
import { LEGACY2_TABS, LEGACY2_TAB_ICONS } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import { feiticoProgression2 } from "../module/applications/actor/jj/legacy2-feitico.mjs";

let version = "2.0";
globalThis.game = { settings: { get: () => version }, user: { isGM: false } };
globalThis.CONFIG = { DND5E: { spellSchools: {} } };
globalThis.foundry = { applications: { ux: { TextEditor: { implementation: {} } } }, utils: { deepClone: structuredClone } };
globalThis.FeiticoFixture = { Ruleset, LEGACY2_TABS, LEGACY2_TAB_ICONS, feiticoProgression2 };
globalThis.FeiticoActorBoundary = class {
  constructor(actor) { this.actor = actor; }
  _configureRenderParts() { return this.actor.limited ? { biography: { template: "limited" } } : structuredClone(this.constructor.PARTS); }
  _getTabs() { return { native: { id: "native" } }; }
};
let source = await fs.readFile(new URL("../module/applications/actor/character-sheet.mjs", import.meta.url), "utf8");
source = source.replace(/^import\s[\s\S]*?;\r?\n/gm, "");
source = `const BaseActorSheet = globalThis.FeiticoActorBoundary;
const { Ruleset, LEGACY2_TABS, LEGACY2_TAB_ICONS, feiticoProgression2 } = globalThis.FeiticoFixture;\n${source}`;
const { default: CharacterSheet } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const actor = items => ({ limited: false, items, system: { details: { level: 4 }, masteryLevel: 3, attributes: { prof: 2 } }, getFlag: (scope, key) => key === "feiticoName" ? "Ilimitado" : undefined });
const spell = (id, flag, level = 1) => ({ id, name: id, img: "icons/test.webp", type: "spell", system: { level }, getFlag: (scope, key) => key.split(".").slice(1).reduce((v, part) => v?.[part], flag) });

test("2.0 exposes the native Feitiço tab and keeps it selected with its own template", () => {
  version = "2.0";
  const sheet = new CharacterSheet(actor([]));
  sheet.tabGroups.primary = "feitico";
  const tabs = sheet._getTabs(), parts = sheet._configureRenderParts({});
  assert.equal(tabs.feitico?.label, "Feitiço");
  assert.equal(tabs.feitico?.active, true);
  assert.equal(parts.feitico?.template, "systems/jujutsu-system/templates/actors/tabs/character-feitico-2.hbs");
  assert.equal(parts.manipulation, undefined);
  assert.equal(parts.trainings, undefined);
});
test("1.0 and limited sheets keep their original tab/template selection", () => {
  version = "1.0";
  const sheet = new CharacterSheet(actor([]));
  assert.equal(sheet._configureRenderParts({}).feitico.template, "systems/jujutsu-system/templates/actors/tabs/character-feitico.hbs");
  assert.deepEqual(sheet._getTabs(), { native: { id: "native" } });
  version = "2.0"; sheet.actor.limited = true;
  assert.deepEqual(sheet._configureRenderParts({}), { biography: { template: "limited" } });
});
test("restored tab uses saved manifestations, linked techniques and level requirements without writes", async () => {
  version = "2.0";
  const sheet = new CharacterSheet(actor([spell("manifestation", { slot: "m1", requirements: [{ level: 5 }] }), spell("technique", { parent: "m1" }, 2), spell("auxiliary", { parent: "m1" }, 0)]));
  const { feitico } = await sheet._prepareFeiticoContext({}, {});
  assert.equal(feitico.name, "Ilimitado");
  assert.equal(feitico.slots.length, 4);
  const slot = feitico.slots.find(s => s.id === "m1");
  assert.equal(slot.manifestacao.id, "manifestation");
  assert.deepEqual(slot.tecnicasGrau.map(t => t.id), ["technique"]);
  assert.deepEqual(slot.tecnicasAux.map(t => t.id), ["auxiliary"]);
  assert.equal(slot.blocked, true);
  assert.equal(feitico.proficiencia.id, "estendido");
});
test("2.0 context uses character level even when mastery is higher or lower", async () => {
  version = "2.0";
  const a = actor([]); a.system.details.level = 1; a.system.masteryLevel = 7;
  const sheet = new CharacterSheet(a);
  const { feitico } = await sheet._prepareFeiticoContext({}, {});
  assert.equal(feitico.proficiencia.id, "basico");
  assert.equal(feitico.nivel, 1);
  a.system.details.level = 8; a.system.masteryLevel = 0;
  const item = spell("manifestation", { slot: "m1", requirements: [{ level: 7 }] });
  assert.equal(sheet._isFeiticoItemBlocked(item), null);
  version = "1.0";
  assert.match(sheet._isFeiticoItemBlocked(item), /Maestria/);
});
test("2.0 requirement edits accept character levels above seven", async () => {
  version = "2.0";
  const item = spell("manifestation", { slot: "m1", requirements: [{ level: 1 }] });
  let saved; item.setFlag = async (scope, key, value) => { saved = value; };
  const items = [item]; items.get = () => item;
  const sheet = new CharacterSheet(actor(items));
  await sheet._onFeiticoReqChange(item.id, 0, "level", "16");
  assert.equal(saved.requirements[0].level, 16);
  version = "1.0";
  await sheet._onFeiticoReqChange(item.id, 0, "level", "16");
  assert.equal(saved.requirements[0].level, 7);
  version = "2.0";
});
test("Feitiço controls still dispatch through the existing sheet actions", async () => {
  const sheet = new CharacterSheet(actor([]));
  const calls = [];
  sheet._onFeiticoRoll = id => calls.push(["roll", id]);
  sheet._onFeiticoCreateTecnica = slot => calls.push(["create", slot]);
  sheet._onClickAction({}, { dataset: { action: "feitico-roll", itemId: "technique" } });
  sheet._onClickAction({}, { dataset: { action: "feitico-create-tecnica", slot: "m1" } });
  assert.deepEqual(calls, [["roll", "technique"], ["create", "m1"]]);
});
