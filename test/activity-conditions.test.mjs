import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
let alternative = false;
globalThis.game = { settings: { get: (scope, key) => key === "regraSalvaguarda" ? alternative : "2.0" } };
globalThis.CONFIG = { DND5E: { abilities: { str: { label: "Força" }, con: { label: "Constituição" }, dex: { label: "Agilidade" } } },
  statusEffects: { "jj-atordoado": { id: "jj-atordoado", name: "Atordoado" } } };
globalThis.ui = { notifications: { warn() {}, info() {} } };
globalThis.ChatMessage = { getSpeaker: () => ({}) };
const api = await import("../module/systems/activity-conditions.mjs");
const row = { _id: "condition0000001", condition: "jj-atordoado", save: "con" };
const descriptor = { actor: "Actor.alvo", token: "Scene.scene.Token.alvo" };
function activity(type = "attack", damage = true) {
  return { type, conditions: [{ ...row }], item: { actor: { system: { attributes: { spell: { dc: 15 } } } } },
    save: type === "save" ? { dc: { value: 17 }, ability: new Set(["con"]) } : undefined, damage: { parts: damage ? [{}] : [] } };
}
test("conditions snapshot keeps the technique DC and is independent of later edits", () => {
  const a = activity(), snapshot = api.activityConditionsSnapshot(a);
  assert.equal(snapshot.dc, 15);assert.equal(snapshot.type, "attack");assert.deepEqual(snapshot.conditions, [row]);
  a.conditions[0].condition = "changed";assert.equal(snapshot.conditions[0].condition, "jj-atordoado");
  assert.equal(api.activityConditionsSnapshot(activity("save")).dc, 17);
  assert.equal(api.activityConditionsSnapshot({ type: "attack", conditions: [] }), null);
});
test("attack requires a recorded hit on that exact token; miss, unknown AC and an unrelated target never unlock conditions", () => {
  const snapshot = api.activityConditionsSnapshot(activity());
  const roll = isMiss => ({ system: { evaluatedTargets: [{ ...descriptor, isMiss }] } });
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { attacks: [] }).eligible, false);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { attacks: [roll(true)] }).eligible, false);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { attacks: [roll(false)] }).eligible, true);
  assert.equal(api.conditionTargetGate(snapshot, { ...descriptor, token: "Scene.scene.Token.outro" }, { attacks: [roll(false)] }).eligible, false);
});
function saveMessage(total, { condition = false, forceSuccess = false, token = descriptor.token } = {}) {
  return { rolls: [{ total }], flags: { "jujutsu-system": condition ? { conditionResistance: {} } : {} }, system: { forceSuccess },
    getAssociatedToken: () => ({ uuid: token }), getAssociatedActor: () => ({ uuid: descriptor.actor }) };
}
test("damage-save failure unlocks a distinct condition resistance, while success and condition rolls do not", () => {
  const snapshot = api.activityConditionsSnapshot(activity("save"));
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { saves: [] }).eligible, false);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { saves: [saveMessage(16)] }).eligible, true);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { saves: [saveMessage(17)] }).eligible, false);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { saves: [saveMessage(10, { forceSuccess: true })] }).eligible, false);
  assert.equal(api.conditionTargetGate(snapshot, descriptor, { saves: [saveMessage(10, { condition: true })] }).eligible, false);
});
test("a save activity without a damage saving throw goes straight to the condition saving throw", () => {
  const snapshot = api.activityConditionsSnapshot(activity("save", false));
  assert.equal(snapshot.damageSave, false);assert.equal(api.conditionTargetGate(snapshot, descriptor, {}).eligible, true);
});
for (const type of ["character", "npc"]) test(`${type}: only failed condition saves apply; canceling, success and repeated clicks are safe`, async () => {
  let total = null, applied = 0, rolls = 0;const flags = {};
  const actor = { type, uuid: descriptor.actor, isOwner: true, name: "Alvo", getFlag: (scope, key) => flags[key],
    setFlag: async (scope, key, value) => { flags[key] = value; },
    async rollSavingThrow(config, dialog, message) {
      rolls++;assert.equal(config.target, 17);assert.equal(config.ability, "con");
      assert.equal(message.data.system?.origin, undefined, "condition saves must not become damage-save outcomes");
      return total === null ? [] : [{ total }];
    } };
  const snapshot = api.activityConditionsSnapshot(activity("save", false));
  const message = { id: `usage-${type}`, flags: { "jujutsu-system": { activityConditions: snapshot } }, getAssociatedRolls: () => [] };
  const targets = [{ uuid: descriptor.token, actor }];
  const apply = async () => { applied++;return true; };
  await api.resistActivityConditions(message, targets, { apply });assert.equal(applied, 0);
  total = 18;await api.resistActivityConditions(message, targets, { apply });assert.equal(applied, 0);
  const before = rolls;total = 1;await api.resistActivityConditions(message, targets, { apply });assert.equal(rolls, before);
  message.id += "-new-use";
  await Promise.all([api.resistActivityConditions(message, targets, { apply }), api.resistActivityConditions(message, targets, { apply })]);
  assert.equal(applied, 1);
});
test("alternative saves are mapped without changing the shared DC", () => {
  alternative = true;
  try { assert.equal(api.conditionSaveLabel("con"), "Vontade");assert.equal(api.conditionSaveLabel("wis"), "Fortitude"); }
  finally { alternative = false; }
});
test("a viewer without ownership cannot roll or apply conditions to another sheet", async () => {
  const actor = { isOwner: false, uuid: descriptor.actor, rollSavingThrow: () => assert.fail("not owned") };
  const message = { id: "private", flags: { "jujutsu-system": { activityConditions: api.activityConditionsSnapshot(activity("save", false)) } } };
  await api.resistActivityConditions(message, [{ uuid: descriptor.token, actor }], { apply: () => assert.fail("not owned") });
});
test("native usage snapshots the conditions and offers resistance actions in the real card buttons", () => {
  const source = readFileSync(new URL("../module/documents/activity/mixin.mjs", import.meta.url), "utf8");
  const finalizeBody = source.match(/_finalizeMessageConfig\(usageConfig, messageConfig, results\) \{([\s\S]*?)\n    \}/)[1];
  const finalize = new Function("activityConditionsSnapshot", `return function(usageConfig,messageConfig,results){${finalizeBody}}`)(api.activityConditionsSnapshot);
  globalThis.foundry = { utils: { setProperty: (obj, path, value) => { const keys = path.split("."), key = keys.pop();keys.reduce((obj, part) => obj[part] ??= {}, obj)[key] = value; } } };
  const a = activity();a.metadata = { usage: {} };
  const message = { data: {} };finalize.call(a, {}, message, { updates: { rolls: [] } });
  assert.equal(message.data.flags["jujutsu-system"].activityConditions.dc, 15);
  const buttonBody = source.match(/_usageChatButtons\(message\) \{([\s\S]*?)\n    \}/)[1];
  const buttons = new Function("activityConditionsSnapshot", "conditionChatButtons", `return function(message){${buttonBody}}`)(api.activityConditionsSnapshot, api.conditionChatButtons).call(a, message);
  assert.equal(buttons[0].action, "rollConditionSave");assert.equal(buttons[0].dataset.conditionId, row._id);
});
test("native save cards skip the initial saving throw only when there is no damage save", () => {
  const source = readFileSync(new URL("../module/documents/activity/save.mjs", import.meta.url), "utf8");
  const method = source.match(/_usageChatButtons\(message\) \{([\s\S]*?)\n  \}/)[0];
  globalThis._loc = (label, data) => label;
  const Parent = class { _usageChatButtons() { return [{ action: "rollConditionSave" }]; } };
  const Save = new Function("Parent", "activityConditionsSnapshot", "alternativeSavesEnabled", "alternativeSaveDefinition", `return class extends Parent{${method}}`)(Parent, api.activityConditionsSnapshot, () => false, () => null);
  for (const hasDamage of [true, false]) {
    const save = Object.assign(new Save(), activity("save", hasDamage));save.save.ability = new Set(["con"]);
    const buttons = save._usageChatButtons({});
    assert.equal(buttons.some(button => button.action === "rollSave"), hasDamage);
    assert.equal(buttons.some(button => button.action === "rollConditionSave"), true);
  }
});
test("chat requests become available only after a prerequisite hit or damage-save failure", () => {
  const message = { flags: { "jujutsu-system": { activityConditions: api.activityConditionsSnapshot(activity()) } }, getAssociatedRolls: () => [] };
  assert.equal(api.conditionButtonAvailable(message), false);
  message.getAssociatedRolls = type => type === "attack" ? [{ system: { evaluatedTargets: [{ ...descriptor, isMiss: false }] } }] : [];
  assert.equal(api.conditionButtonAvailable(message), true);
  message.flags["jujutsu-system"].activityConditions = api.activityConditionsSnapshot(activity("save", false));
  message.getAssociatedRolls = () => [];assert.equal(api.conditionButtonAvailable(message), true);
});
test("damage without a configured damage saving throw goes straight to the condition save and retains the damage button", () => {
  const a = activity("save");a.save.ability = new Set();
  assert.equal(api.activityConditionsSnapshot(a).damageSave, false);
  const source = readFileSync(new URL("../module/documents/activity/save.mjs", import.meta.url), "utf8");
  const method = source.match(/_usageChatButtons\(message\) \{([\s\S]*?)\n  \}/)[0];
  const Parent = class { _usageChatButtons() { return [{ action: "rollConditionSave" }]; } };
  const Save = new Function("Parent", "activityConditionsSnapshot", "alternativeSavesEnabled", "alternativeSaveDefinition", `return class extends Parent{${method}}`)(Parent, api.activityConditionsSnapshot, () => false, () => null);
  const buttons = Object.assign(new Save(), a)._usageChatButtons({});
  assert.equal(buttons.some(button => button.action === "rollSave"), false);
  assert.equal(buttons.some(button => button.action === "rollDamage"), true);
});
test("native damage saving throws keep the exact targeted token as speaker", async () => {
  const source = readFileSync(new URL("../module/documents/activity/save.mjs", import.meta.url), "utf8");
  const body = source.match(/static async #rollSave\(event, target, message\) \{([\s\S]*?)\n  \}/)[1];
  const save = new Function("getSceneTargets", `return async function(event,target,message){${body}}`)(() => []);
  globalThis.Actor = class {};
  let savedSpeaker;
  const actor = Object.assign(new Actor(), { rollSavingThrow: async (data, dialog, message) => { savedSpeaker = message.data.speaker; } });
  const token = { id: "exact-target", uuid: descriptor.token, actor, documentName: "Token" };
  globalThis.canvas = { scene: {} };
  globalThis.ChatMessage = { getSpeaker: ({ token }) => ({ token: token?.id }) };
  CONFIG.Dice = { BasicRoll: { replaceFormulaData: () => "", constructParts: () => ({ parts: [] }) } };
  await save.call({ save: { dc: { value: 17 } }, getRollData: () => ({}), messageSources: {} }, {}, {}, {
    id: "usage", system: { evaluatedTargets: [token], getButton: () => ({ dataset: { dc: 17, ability: "con" } }) }
  });
  assert.equal(savedSpeaker.token, token.id);
});
test("manual attack rolls from a usage card retain their origin so their hit unlocks condition resistance", () => {
  const source = readFileSync(new URL("../module/documents/activity/attack.mjs", import.meta.url), "utf8");
  const body = source.match(/static #rollAttack\(event, target, message\) \{([\s\S]*?)\n  \}/)[1];
  const click = new Function("event", "target", "message", body);
  let origin;
  click.call({ rollAttack: (config, dialog, message) => { origin = message?.data?.system?.origin; } }, {}, {}, { id: "usage-with-condition" });
  assert.equal(origin, "usage-with-condition");
});
test("a hidden technique DC is still used for resistance without being included in its public flavor", async () => {
  let flavor, target;
  const actor = { name: "Alvo", isOwner: true, uuid: descriptor.actor, getFlag: () => [], setFlag: async () => {},
    async rollSavingThrow(config, dialog, message) { target = config.target;flavor = message.data.flavor;return [{ total: 20 }]; } };
  const message = { id: "hidden", shouldDisplayChallenge: false,
    flags: { "jujutsu-system": { activityConditions: api.activityConditionsSnapshot(activity("save", false)) } } };
  await api.resistActivityConditions(message, [{ uuid: descriptor.token, actor }]);
  assert.equal(target, 17);assert.doesNotMatch(flavor, /17|CD/);
});
