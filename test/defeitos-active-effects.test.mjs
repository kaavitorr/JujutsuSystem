import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";

const api = await import("../module/systems/defeitos-active-effects.mjs").catch(e => {
  if (e.code === "ERR_MODULE_NOT_FOUND") return {}; throw e;
});
const item = (name, effects=[]) => ({ _id: "originalItem1234", name, type: "feat", img: "icons/test.webp",
  flags: { "jujutsu-system": { featureSection: "jj-flaws", defeitoPontos: 3 } }, effects });
const plan = (name, edition="2.0", effects=[]) => {
  assert.equal(typeof api.flawEffectPlan, "function");
  return api.flawEffectPlan(item(name, effects), edition);
};
const changes = effect => effect.system.changes;
const active = result => result.effects.filter(e => !e.disabled);

test("passive skill penalties transfer with the Item and remain separate from conditional triggers", () => {
  const distracted = plan("Distraído (5 Pontos)");
  assert.deepEqual(changes(active(distracted)[0]).map(c => [c.key, c.value]),
    ["ins", "prc", "his", "inv"].map(k => [`system.skills.${k}.roll.bonus`, -2]));
  const compulsive = plan("Compulsivo (1 Ponto)");
  assert.deepEqual(changes(active(compulsive)[0]).map(c => [c.key, c.value]), [["system.skills.inv.roll.bonus", -2]]);
  assert.ok(distracted.effects.every(e => e.transfer && e.type === "base"));
  assert.deepEqual(plan("Pacifista (5 Pontos)").effects, []);
});

test("edition-specific mechanics are retained rather than copied between editions", () => {
  assert.equal(changes(active(plan("Timidez (1 Ponto)"))[0])[0].key, "system.skills.prf.roll.mode");
  assert.equal(changes(active(plan("Timidez (1 Ponto)", "1.0"))[0])[0].value, -2);
  assert.equal(changes(active(plan("Retrucador (1 Ponto)", "1.0"))[0])[0].key, "system.skills.per.roll.mode");
  assert.equal(active(plan("Obsessivo (1 Ponto)")).length, 0);
  assert.equal(changes(active(plan("Obsessivo (3 Pontos)", "1.0"))[0])[0].key, "system.skills.ins.roll.bonus");
  assert.deepEqual(plan("Demente (3 Pontos)", "1.0").effects, []);
});

test("conditional effects start disabled, explain their trigger, and never change base actions or reserves", () => {
  for (const name of ["Ganancioso", "Dependente", "Visão Ruim", "Fúria Incontrolável", "Trauma Profundo/Fobia", "Dupla Personalidade"]) {
    const result = plan(name);
    assert.ok(result.effects.length, name);
    assert.ok(result.effects.every(e => e.disabled && e.description.length > 25), name);
    assert.ok(result.effects.every(e => changes(e).every(c => !/actions|reservas|energy/.test(c.key))), name);
  }
  assert.equal(plan("Trauma Profundo/Fobia").effects[0].duration.seconds, 60);
  assert.deepEqual(changes(plan("Ruim com Nomes").effects[0]).map(c => c.key), ["system.abilities.cha.check.roll.bonus"]);
});

test("existing equivalent legacy effects are upgraded once and manual effects are preserved", () => {
  const old = { _id: "oldEffect1234567", name: "Mentiroso", transfer: true, disabled: false,
    system: { changes: [{ key: "system.skills.dec.bonuses.check", value: -2, type: "add", phase: "initial", priority: 20 }] } };
  const custom = { _id: "customEffect1234", name: "Bônus do mestre", system: { changes: [{ key: "system.attributes.ac.bonus", value: 2, type: "add" }] } };
  const result = plan("Mentiroso (1 Ponto)", "1.0", [old, custom]);
  assert.equal(result.effects.length, 2);
  assert.equal(result.effects[0]._id, old._id);
  assert.equal(changes(result.effects[0])[0].key, "system.skills.dec.roll.bonus");
  assert.deepEqual(result.effects[1], custom);
  assert.deepEqual(api.flawEffectPlan({ ...item("Mentiroso (1 Ponto)"), ...result }, "1.0"), result);
  const bad = { _id: "wrongEffect12345", name: "Vício", system: { changes: [
    { key: "system.abilities.con.bonuses.save", value: "- 2", type: "custom", priority: 39, phase: "initial" }] } };
  assert.ok(plan("Vicio (3 Pontos)", "1.0", [bad]).effects.every(e => e.disabled));
  assert.ok(plan("Viajante (5 Pontos)", "1.0", [bad]).effects.every(e => !changes(e).some(c => /con/.test(c.key))));
});

test("flaw-specific options distinguish an automatic failure from a critical failure", () => {
  assert.equal(typeof api.configureFlawRoll, "function");
  const actor = { flags: { "jujutsu-system": { flawRules: { failSkills: { per: true }, noCriticals: true } } }, system: { abilities: {} } };
  const roll = { parts: ["@mod"], options: {}, data: {} };
  api.configureFlawRoll(roll, { subject: actor, skill: "per", hookNames: ["skillCheck"] });
  assert.equal(roll.options.jjFlawAutoFailure, true);
  assert.equal(roll.options.jjFlawNoCriticals, true);
  const save = { options: {}, data: {} };
  api.configureFlawRoll(save, { subject: actor, ability: "cha", hookNames: ["savingThrow"] });
  assert.equal(save.options.jjFlawAutoFailure, false);
});

test("two disadvantages against Provocação remain two numeric penalties on 2.0 saves", async () => {
  globalThis.game = { settings: { get: (ns, key) => key === "rulesetVersion" ? "2.0" : false }, user: { targets: new Set() } };
  const { applyLegacy2TestRoll } = await import("../module/applications/dice/legacy2-test-roll.mjs");
  const actor = { flags: { "jujutsu-system": { flawRules: { saveDisadvantages: 2 } } }, system: { abilities: { wis: { value: 4 } } } };
  const process = { subject: actor, ability: "wis", hookNames: ["savingThrow"], rolls: [] };
  const result = applyLegacy2TestRoll({ parts: ["@mod"], data: { mod: 4 }, options: {} }, process);
  assert.equal(result.data.legacyAdv, -2);
  assert.equal(result.options.advantageMode, 0);
  const unaffected = applyLegacy2TestRoll({ parts: [], data: {}, options: {} }, { ...process, skill: "prc", hookNames: ["skillCheck"], legacy2: {} });
  assert.equal(unaffected.data.legacyAdv, 0);
});

test("stacked native Active Effect disadvantages are not collapsed into a single penalty", async () => {
  const { applyLegacy2TestRoll } = await import("../module/applications/dice/legacy2-test-roll.mjs");
  const process = { subject: { system: { abilities: { cha: { value: 4 } } } }, skill: "dec", ability: "cha",
    disadvantage: true, hookNames: ["skillCheck"], rolls: [] };
  const roll = { parts: [], data: {}, options: { advantageCount: 1, disadvantageCount: 2, advantage: true, disadvantage: true } };
  applyLegacy2TestRoll(roll, process);
  assert.equal(roll.data.legacyAdv, -1);
  applyLegacy2TestRoll(roll, process);
  assert.equal(roll.data.legacyAdv, -1);
});

test("native d20 results honor auto-failure and suppress critical benefits without making a fumble", async () => {
  globalThis.FlawBasicRollBoundary = class { get isFailure() { return this.total < this.options.target; } get isSuccess() { return !this.isFailure; } };
  let source = await fs.readFile(new URL("../module/dice/d20-roll.mjs", import.meta.url), "utf8");
  source = source.replace(/import D20RollConfigurationDialog[^;]+;/, "const D20RollConfigurationDialog = class {};")
    .replace(/import \{ areKeysPressed \}[^;]+;/, "const areKeysPressed = () => false;")
    .replace(/import BasicRoll[^;]+;/, "const BasicRoll = globalThis.FlawBasicRollBoundary;")
    .replace(/from "(\.\.[^"]+)"/g, (_, rel) => `from ${JSON.stringify(new URL(rel, new URL("../module/dice/d20-roll.mjs", import.meta.url)).href)}`);
  const { default: D20Roll } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const roll = Object.create(D20Roll.prototype);
  Object.defineProperty(roll, "d20", { value: { isCriticalSuccess: true, isCriticalFailure: false } });
  roll.options = { jjFlawAutoFailure: true, target: 10 }; roll.total = 30; roll._evaluated = true;
  assert.equal(roll.isFailure, true); assert.equal(roll.isSuccess, false); assert.equal(roll.isCritical, false); assert.equal(roll.isFumble, false);
  roll.options = { jjFlawNoCriticals: true, target: 10 };
  assert.equal(roll.isSuccess, true); assert.equal(roll.isCritical, false);
  roll.options = { target: 10 }; assert.equal(roll.isCritical, true);
});

test("the secondary personality only penalizes trained skills and maps automatic save failures to alternative saves", async () => {
  globalThis.game.settings.get = (_, key) => key === "rulesetVersion" ? "2.0" : true;
  const { applyLegacy2TestRoll } = await import("../module/applications/dice/legacy2-test-roll.mjs");
  const actor = { flags: { "jujutsu-system": { flawRules: { trainedSkillDisadvantages: 1, failSaves: { wis: true, int: true } } } },
    system: { abilities: { str: { value: 4 }, wis: { value: 4 } }, legacy2: { skills: { prc: 1, dec: 0 } } } };
  const run = skill => applyLegacy2TestRoll({ parts: [], data: {}, options: {} }, { subject: actor, skill, ability: "wis", hookNames: ["skillCheck"], rolls: [] });
  assert.equal(run("prc").data.legacyAdv, -1); assert.equal(run("dec").data.legacyAdv, 0);
  for (const ability of ["str", "fortitude", "dex", "reflexo"]) {
    const roll = api.configureFlawRoll({ options: {}, data: {} }, { subject: actor, ability, hookNames: ["SavingThrow"] });
    assert.equal(roll.options.jjFlawAutoFailure, true, ability);
  }
  const unaffected = api.configureFlawRoll({ options: {}, data: {} }, { subject: actor, ability: "vontade", hookNames: ["SavingThrow"] });
  assert.equal(unaffected.options.jjFlawAutoFailure, false);
  globalThis.game.settings.get = (_, key) => key === "rulesetVersion" ? "2.0" : false;
});

test("Medíocre prevents critical excess and natural-20 damage triggers in the actual post-attack pipeline", async () => {
  const source = await fs.readFile(new URL("../module/applications/actor/jj/native-cards.mjs", import.meta.url), "utf8");
  const body = source.match(/export async function postJJAttackRoll\(activity, rolls\) \{([\s\S]*?)\n\}/)[1];
  const extras = {}, messages = [], triggers = [];
  const post = new (Object.getPrototypeOf(async function(){}).constructor)("flawPreventsCriticals", "margemExcedente", "_ensureExtras", "ChatMessage",
    "checkFulgorNegro", "_fulgorPendentes", "_stashKey", "registrarGatilhoDano", `return async function(activity,rolls){${body}}`);
  const run = await post(api.flawPreventsCriticals, () => 10, () => extras,
    { create: message => messages.push(message), getSpeaker: () => ({}) }, async () => false, new Set(), () => "attack", (...args) => triggers.push(args));
  game.user.targets = new Set([{ actor: { system: { attributes: { ac: { value: 10 } } } } }]);
  const actor = { flags: { "jujutsu-system": { flawRules: { noCriticals: true } } } }, activity = { item: { actor }, damage: { parts: [] } };
  const rolls = [{ total: 100, isCritical: false, dice: [{ results: [{ result: 20 }] }] }];
  await run(activity, rolls); assert.deepEqual(extras, {}); assert.equal(triggers.length, 0); assert.equal(messages.length, 0);
  delete actor.flags["jujutsu-system"].flawRules;
  await run(activity, rolls); assert.equal(extras.excedenteCritico, true); assert.equal(triggers.length, 1);
  game.user.targets = new Set();
});

test("existing world, player and synthetic NPC copies receive Item-owned effects exactly once; custom effects and disabled state survive", async () => {
  const source = item("Distraído (5 Pontos)"); source.uuid = "Compendium.jujutsu-compendium.geral-2-0.Item.originalItem1234";
  source.system = { description: { value: "Descrição original." } };
  Object.assign(source, api.flawEffectPlan(source, "2.0"));
  const writes = [], makeCopy = id => {
    const data = { ...structuredClone(source), _id: id, _stats: { compendiumSource: source.uuid }, effects: [] };
    const custom = { _id: "customEffect1234", name: "Ajuste manual", system: { changes: [] } }; data.effects.push(custom);
    const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === "object"
      ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,reorder(value[k])])) : value;
    return { ...data, toObject() { const {toObject, update, ...raw} = this; return reorder(structuredClone(raw)); }, async update(update) {
      assert.deepEqual(Object.keys(update).sort(), ["effects", "flags.jujutsu-system.flawAutomation"]);
      this.effects = structuredClone(update.effects); this.flags["jujutsu-system"].flawAutomation = update["flags.jujutsu-system.flawAutomation"]; writes.push(this._id);
    } };
  };
  const worldItem = makeCopy("world"), playerItem = makeCopy("player"), npcItem = makeCopy("npc"), edited = makeCopy("edited");
  edited.system.description.value = "Regra modificada pelo mestre.";
  const npc = { items: [npcItem] };
  const world = { user: { isGM: true, id: "gm" }, users: { activeGM: { id: "gm" } },
    packs: new Map([["jujutsu-compendium.geral-2-0", { getDocuments: async () => [source] }]]),
    items: [worldItem, edited], actors: [{ items: [playerItem] }], scenes: [{ tokens: [{ actorLink: false, actor: npc }, { actorLink: false, actor: npc }] }] };
  await api.refreshFlawEffects(world);
  assert.deepEqual(writes, ["world", "player", "npc"]);
  for (const copy of [worldItem, playerItem, npcItem]) {
    assert.equal(copy.effects.length, 2); assert.equal(copy.effects[1].transfer, true); assert.equal(copy.effects[0].name, "Ajuste manual");
  }
  playerItem.effects[1].disabled = true;
  await api.refreshFlawEffects(world); assert.equal(writes.length, 3); assert.equal(playerItem.effects[1].disabled, true);
  world.user.id = "other"; await api.refreshFlawEffects(world); assert.equal(writes.length, 3);
});

test("a technique with fixed accuracy still receives global Active Effect roll penalties", async () => {
  const source = await fs.readFile(new URL("../module/data/activity/attack-data.mjs", import.meta.url), "utf8");
  const body = source.match(/getAttackData\(\{ ability, ammunition, attackMode, situational, legacy2 \}=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const Ruleset = (await import("../module/systems/ruleset.mjs")).default;
  let readEffects = 0;
  const run = new Function("Ruleset", "D20RollModificationField", `return function(config={}) { const {ability,ammunition,attackMode,situational,legacy2}=config; ${body} }`)(Ruleset,
    { combineFields(model, paths) { assert.ok(paths.includes("rolls.attack")); readEffects++; return { bonus: -5 }; } });
  globalThis.CONFIG = { Dice: { BasicRoll: { constructParts: (parts,data) => ({parts,data}) } } };
  const activity = { actor: { type: "character", system: {}, items: new Map() }, item: { type: "spell", system: {} }, attack: { flat: true, bonus: 7 },
    getRollData: () => ({ roll: { ability: "wis" } }), getActionType: () => "msak" };
  const result = run.call(activity, { ability: "wis", legacy2: { vantagens: 0, desvantagens: 0 } });
  assert.equal(readEffects, 1); assert.equal(result.parts.toHit, 7); assert.equal(result.parts.ruleBonus, -5);
});

test("the actual dialog renders and submits every prepared disadvantage without losing a source", async () => {
  const { applyLegacy2TestRoll, testRollChoices, testRollBreakdown, hasLegacy2Test } = await import("../module/applications/dice/legacy2-test-roll.mjs");
  const Ruleset = (await import("../module/systems/ruleset.mjs")).default;
  const source = await fs.readFile(new URL("../module/applications/dice/d20-configuration-dialog.mjs", import.meta.url), "utf8");
  const body = source.match(/async _prepareFormulasContext\(context, options\) \{([\s\S]*?)\n  \}/)[1];
  const Dialog = new Function("Base","Ruleset","testRollChoices","testRollBreakdown","hasLegacy2Test", `return class extends Base {async _prepareFormulasContext(context,options){${body}}}`)(
    class {async _prepareFormulasContext(context){return context;}}, Ruleset,testRollChoices,testRollBreakdown,hasLegacy2Test);
  const process = { subject: {system:{abilities:{cha:{value:4}}}}, skill:"dec",ability:"cha",disadvantage:true,hookNames:["skillCheck"],rolls:[{options:{}}] };
  const prepared = {parts:["@mod"],data:{mod:4},options:{disadvantageCount:2}};
  applyLegacy2TestRoll(prepared,process); assert.equal(prepared.data.legacyAdv,-2);
  const dialog = Object.assign(new Dialog(),{config:process,rolls:[prepared],id:"test"});
  const context = await dialog._prepareFormulasContext({},{}); assert.equal(context.jj2Test.desvantagens,2);
  const submitted = {parts:["@mod"],data:{mod:4},options:{disadvantageCount:2}};
  applyLegacy2TestRoll(submitted,process,new Map([["jj2Test.vantagens",context.jj2Test.vantagens],["jj2Test.desvantagens",context.jj2Test.desvantagens]]));
  assert.equal(submitted.data.legacyAdv,-2);
});

test("Depressivo supplies six forced disadvantage sources only when its first-attack effect is enabled", () => {
  const effect = plan("Depressivo (1 Ponto)").effects[0];
  assert.ok(effect?.disabled);
  assert.equal(changes(effect).filter(c=>c.key==="system.rolls.attack.mode"&&c.type==="downgrade"&&c.value===-1).length,6);
  assert.ok(changes(effect).some(c=>c.key==="flags.jujutsu-system.flawRules.attackNoAdvantages"));
  assert.equal(changes(plan("Depressivo (1 Ponto)","1.0").effects[0]).filter(c=>c.key==="system.rolls.attack.mode").length,1);
});

test("legacy special flaws expose only their explicitly scoped test modifiers, initially disabled", () => {
  for(const [name,key,value] of [["Lixo da Sociedade","system.rolls.ability.check.bonus",-1],
    ["Instinto Assassino","flags.jujutsu-system.flawRules.failChecks",true],["Ferida Fantasma","system.rolls.ability.save.mode",-1]]){
    const result=plan(name,"1.0"); assert.equal(result.effects.length,1);assert.equal(result.effects[0].disabled,true);
    assert.deepEqual(changes(result.effects[0]).map(c=>[c.key,c.value]),[[key,value]]);
    assert.equal(plan(name,"2.0").effects.length,0);
  }
});

test("changing away from Strength removes Churriado's native penalty and retains manual adjustments and independent sources", async () => {
  const {applyLegacy2TestRoll} = await import("../module/applications/dice/legacy2-test-roll.mjs");
  for(const independent of [0,1]){
    const process={subject:{system:{abilities:{str:{value:4},dex:{value:3}}}},ability:"str",skill:"ath",disadvantage:true,
      jjIndependentRollModes:{desvantagens:independent},hookNames:["skillCheck"],rolls:[{options:{}}]};
    const initial={parts:[],data:{abilityId:"str"},options:{disadvantageCount:1}};
    applyLegacy2TestRoll(initial,process);assert.equal(initial.data.legacyAdv,-1-independent);
    applyLegacy2TestRoll(initial,process,new Map([["jj2Test.vantagens",0],["jj2Test.desvantagens",3+independent]]));
    const changed={parts:[],data:{abilityId:"dex"},options:{disadvantageCount:0}};
    applyLegacy2TestRoll(changed,process,new Map([["ability","dex"],["jj2Test.vantagens",0],["jj2Test.desvantagens",3+independent]]));
    assert.equal(changed.data.legacyAdv,-2-independent);
  }
});
