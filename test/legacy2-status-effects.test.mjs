import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {activityConditionsContext, conditionName} from "../module/systems/activity-conditions.mjs";

const handlers = new Map();
globalThis.Hooks = {on() {}, once: (event, callback) => handlers.set(event, callback)};
globalThis.game = {settings: {get: (_, key) => key === "rulesetVersion" ? "2.0" : false},
  i18n: {localize: key => key === "Test.Poisoned" ? "Envenenado" : key}};
globalThis.CONFIG = {DND5E: {abilities: {con: {label: "Constituição"}},
  statusEffects: {dead: {name: "Morto", img: "dead.svg"}},
  conditionTypes: {poisoned: {name: "Test.Poisoned", img: "poison.svg"}},
  encumbrance: {effects: {}}, neverBlockStatuses: new Set()}, statusEffects: {}, specialStatusEffects: {}};
globalThis.foundry = {utils: {deepClone: structuredClone,
  mergeObject: (original, changes) => ({...structuredClone(original), ...structuredClone(changes)})}};
const {JJ2_CONDITIONS, registrarStatusEffectsCondicoes, applyGameCondition} = await import("../module/applications/actor/jj/conditions.mjs");
const source = readFileSync(new URL("../dnd5e.mjs", import.meta.url), "utf8");
const configure = new Function("utils", "DND5E",
  `${source.match(/^function _configureStatusEffects\(\) \{[\s\S]*?^\}/m)[0]};return _configureStatusEffects;`)(
  {staticID: text => createHash("sha256").update(text).digest("hex").slice(0, 16)}, CONFIG.DND5E);

test("the real post-init status configuration retains every Jujutsu condition for attack/save editors and application", async () => {
  CONFIG.statusEffects = {};
  handlers.get("init")();
  const original = structuredClone(CONFIG.statusEffects);
  assert.equal(Object.keys(original).length, JJ2_CONDITIONS.length);
  configure();
  for (const type of ["attack", "save"]) {
    const editor = activityConditionsContext({type, conditions: [{_id: "row", condition: "jj-atordoado", save: "con"}]});
    assert.equal(editor.conditionOptions.length, JJ2_CONDITIONS.length);
    assert.deepEqual(new Set(editor.conditionOptions.map(option => option.value)), new Set(JJ2_CONDITIONS.map(condition => condition.id)));
  }
  for (const condition of JJ2_CONDITIONS) {
    const current = CONFIG.statusEffects[condition.id];
    assert.equal(current.name, condition.label);assert.equal(current.img, original[condition.id].img);
    assert.equal(conditionName(condition.id), condition.label);
  }
  const created = [], actor = {isOwner: true, items: [], effects: [], system: {traits: {ci: {value: new Set()}}},
    async createEmbeddedDocuments(type, data) {created.push(...data);}};
  assert.equal(await applyGameCondition(actor, "jj-atordoado"), true);
  assert(created[0].changes.some(change => change.key === "system.legacy2.actions.max" && change.value === -4));
});

test("native conditions and separately registered module conditions survive repeated configuration with stable identities", () => {
  registrarStatusEffectsCondicoes();
  CONFIG.statusEffects["module-mark"] = {id: "module-mark", _id: "moduleeffect0001", name: "Marca", img: "custom.webp"};
  configure();
  assert.equal(CONFIG.statusEffects.dead.name, "Morto");
  assert.equal(CONFIG.statusEffects.poisoned.name, "Test.Poisoned");
  assert.equal(CONFIG.statusEffects["module-mark"]?._id, "moduleeffect0001");
  const previous = structuredClone(CONFIG.statusEffects);
  configure();assert.deepEqual(CONFIG.statusEffects, previous);
});

test("legacy array entries are normalized by their real condition IDs rather than numeric array positions", () => {
  CONFIG.statusEffects = [{id: "dead", name: "Morto antigo"},
    {id: "jj-cego", name: "Cego", img: "blind.svg", _id: "customblind00001"}];
  configure();
  assert.equal(CONFIG.statusEffects["jj-cego"].name, "Cego");
  assert.equal(CONFIG.statusEffects["jj-cego"]._id, "customblind00001");
  assert.equal(CONFIG.statusEffects[0], undefined);assert.equal(CONFIG.statusEffects[1], undefined);
});
