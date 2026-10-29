import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { rollConditionSave, activityConditionsSnapshot } from "../module/systems/activity-conditions.mjs";

let alternative = false;
globalThis.Hooks = { on() {}, once() {}, callAll() {} };
Hooks.onError = (source, error) => { throw error; };
globalThis.CONST = { ACTIVE_EFFECT_MODES: { ADD: 2, OVERRIDE: 5 } };
globalThis.game = { settings: { get: (scope, key) => key === "regraSalvaguarda" ? alternative : "2.0" }, user: {} };
globalThis.ui = { notifications: { warn() {}, info() {} } };
globalThis.CONFIG = { DND5E: { abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { label: key }])) },
  statusEffects: { "jj-atordoado": { id: "jj-atordoado", name: "Atordoado" }, stunned: { id: "stunned" } } };
const merge = (left, right = {}) => {
  for (const [key, value] of Object.entries(right)) {
    if (value && typeof value === "object" && !Array.isArray(value)) left[key] = merge(left[key] ?? {}, value);
    else left[key] = value;
  }
  return left;
};
globalThis.foundry = { utils: { mergeObject: merge, deepClone: structuredClone } };
globalThis.ChatMessage = { getSpeaker: ({ actor, token }) => ({ actor: actor?.id, token: token?.id }) };
globalThis.canvas = { scene: {} };
const actorSource = readFileSync(new URL("../module/documents/actor/actor.mjs", import.meta.url), "utf8");
const actorMethods = actorSource.slice(actorSource.indexOf("  async rollSavingThrow(config={}, dialog={}, message={})"), actorSource.indexOf("  async rollDeathSave("));
const NativeActor = new Function("Ruleset", "D20RollModificationField", "_loc", `return class {${actorMethods}}`)(Ruleset,
  { combineFields: () => ({ bonus: 2 }) }, (key, data) => data.ability);
globalThis.Actor = NativeActor;
const attackSource = readFileSync(new URL("../module/data/chat-message/attack-message-data.mjs", import.meta.url), "utf8");
const attackGetter = attackSource.match(/get evaluatedTargets\(\) \{([\s\S]*?)\n  \}/)[0];
const NativeAttackMessage = new Function(`return class {${attackGetter}}`)();
const saveSource = readFileSync(new URL("../module/documents/activity/save.mjs", import.meta.url), "utf8");
const saveBody = saveSource.match(/static async #rollSave\(event, target, message\) \{([\s\S]*?)\n  \}/)[1];
const nativeDamageSave = new Function("getSceneTargets", `return async function(event,target,message){${saveBody}}`)(() => []);
const mixinSource = readFileSync(new URL("../module/documents/activity/mixin.mjs", import.meta.url), "utf8");
const chatAction = mixinSource.match(/async onChatAction\(event, target, message\) \{([\s\S]*?)\n    \}/)[0];
const NativeChatAction = new Function(`return class {
  ${chatAction}
  #consumeResource() { throw new Error("unexpected resource consumption"); }
  #refundResource() { throw new Error("unexpected resource refund"); }
  #placeTemplate() { throw new Error("unexpected template placement"); }
}`)();
async function clickCondition(fixture) {
  const native = Object.assign(new NativeChatAction(), { id: "activity", metadata: { usage: { actions: { rollConditionSave } } },
    createConsumedFlag: () => null, item: { system: { activities: { get: () => fixture.activity } } } });
  fixture.usage.getAssociatedActor = () => fixture.actor;
  const button = { dataset: { action: "rollConditionSave" }, disabled: false };
  await native.onChatAction({}, button, fixture.usage);
  assert.equal(button.disabled, false);
}

function fixture(type, mode, outcome) {
  const flags = {}, records = [], writes = [], effects = [];
  let die = 1;
  class DiceBoundary {
    constructor(total, target) { this.total = total;this.isCritical = false;this.isFumble = false;this.isSuccess = target === undefined ? false : total >= target;this.isFailure = target === undefined ? false : total < target; }
    static constructParts(entries) {
      const data = Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined && value !== null && value !== ""));
      return { parts: Object.keys(data).map(key => `@${key}`), data };
    }
    static mergeConfigs(config, extra) { return merge(config, extra); }
    static async build(config, dialog, message) {
      if (outcome === "cancel" && message.data.flags?.["jujutsu-system"]?.conditionResistance) return [];
      const roll = new DiceBoundary(die + Object.values(config.rolls[0].data).reduce((sum, value) => sum + Number(value || 0), 0), config.target);
      records.push({ config, dialog, message, roll });return [roll];
    }
  }
  CONFIG.Dice = { D20Roll: DiceBoundary, BasicRoll: { replaceFormulaData: () => "", constructParts: () => ({ parts: [] }) } };
  const actor = Object.assign(new NativeActor(), { type, id: "defender", uuid: "Actor.defender", name: "Defensor", isOwner: true,
    items: [], effects, statuses: new Set(), flags: {},
    system: { abilities: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map(key => [key, { value: 4, mod: 1 }])),
      attributes: { spell: { dc: 15 }, ac: { cover: 0 } }, traits: { ci: { value: new Set() } }, details: { level: 7 },
      legacy2: { nd: "7", actions: { value: 1, max: 6 }, saves: {}, alternativeSaves: {} } },
    getFlag: (scope, key) => flags[key], setFlag: async (scope, key, value) => { flags[key] = value; },
    getRollData: () => ({ roll: {} }), addConditionRollReduction() {},
    async update(data) { writes.push(data);if ("system.legacy2.actions.value" in data) this.system.legacy2.actions.value = data["system.legacy2.actions.value"]; },
    async createEmbeddedDocuments(kind, rows) {
      assert.equal(kind, "ActiveEffect");
      // The document API boundary prepares the returned effects and their action cap.
      for (const row of rows) {
        effects.push({ ...row, statuses: new Set(row.statuses) });
        for (const status of row.statuses) this.statuses.add(status);
        for (const change of row.changes) if (change.key === "system.legacy2.actions.max") this.system.legacy2.actions.max += Number(change.value);
      }
      return effects;
    }
  });
  const token = { id: "defender-token", uuid: "Scene.scene.Token.defender", actor, parent: canvas.scene };
  const activity = { type: mode === "attack" ? "attack" : "save", item: { actor },
    conditions: [{ _id: "condition0000001", condition: "jj-atordoado", save: "con" }],
    damage: { parts: mode === "direct" ? [] : [{}] }, save: { ability: new Set(["con"]), dc: { value: 15 } } };
  const snapshot = activityConditionsSnapshot(activity);
  const usage = { id: "usage", uuid: "ChatMessage.usage", flags: { "jujutsu-system": { activityConditions: snapshot } },
    system: { evaluatedTargets: [token], getButton: () => ({ dataset: { conditionId: "condition0000001" } }) },
    getAssociatedRolls(kind) {
      if (kind === "attack" && mode === "attack") {
        const model = new NativeAttackMessage();model.parent = { rolls: [new DiceBoundary(20)] };
        model.targets = [{ actor: actor.uuid, token: token.uuid, ac: 15 }];return [{ system: model }];
      }
      if (kind !== "save") return [];
      return records.filter(record => record.message.data.system?.origin === usage.id).map(record => ({
        flags: record.message.data.flags ?? {}, rolls: [record.roll], system: {},
        getAssociatedToken: () => token, getAssociatedActor: () => actor
      }));
    }
  };
  return { actor, activity, token, usage, records, writes, effects, chooseDie: value => { die = value; } };
}

for (const type of ["character", "npc"]) for (const mode of ["attack", "damageSave", "direct"]) {
  test(`${type}/${mode}: native save result automatically creates the real condition, without another Apply click`, async () => {
    for (const optional of [false, true]) for (const outcome of ["failure", "success", "cancel"]) {
      alternative = optional;
      const f = fixture(type, mode, outcome);
      if (mode === "damageSave") {
        await nativeDamageSave.call({ ...f.activity, getRollData: () => ({}), messageSources: {} }, {}, {}, {
          ...f.usage, system: { ...f.usage.system, getButton: () => ({ dataset: { ability: "con", dc: 15 } }) }
        });
      }
      f.chooseDie(outcome === "success" ? 20 : 1);
      await clickCondition(f);
      assert.equal(f.effects.length, outcome === "failure" ? 1 : 0, `${type}/${mode}/${optional}/${outcome}`);
      const saved = f.records.find(record => record.message.data.flags?.["jujutsu-system"]?.conditionResistance);
      if (outcome !== "cancel") {
        assert.equal(saved.config.target, 15);assert.equal(saved.message.data.system.origin, undefined);
        assert.equal(saved.dialog.options.window.title, optional ? "Vontade" : "con");
        await clickCondition(f);
        assert.equal(f.records.filter(record => record.message.data.flags?.["jujutsu-system"]?.conditionResistance).length, 1);
      }
      if (outcome === "failure") {
        assert(f.actor.statuses.has("jj-atordoado"));assert(f.actor.statuses.has("stunned"));
        assert(f.effects[0].changes.some(change => change.key === "system.legacy2.actions.max" && change.value === -4));
        assert.equal(f.actor.system.legacy2.actions.value, 1, "a condition must not restore already spent actions");
      }
    }
  });
}
