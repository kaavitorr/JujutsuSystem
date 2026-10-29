import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { buildLegacy2Context, prepareRankUpdate } from "../module/applications/actor/jj/legacy2-sheet.mjs";
import { creationDraft, allocateCreationRank, creationActor } from "../module/applications/actor/creation/creation-model-2.mjs";
import { testRollBreakdown } from "../module/applications/dice/legacy2-test-roll.mjs";
import { prepareCreationCompletion } from "../module/applications/actor/creation/creation-completion-2.mjs";
import { updateNpc2Rank } from "../module/applications/actor/jj/legacy2-npc-sheet.mjs";

let enabled = true, version = "2.0";
globalThis.game = { settings: { get: (scope, key) => key === "rulesetVersion" ? version : key === "regraSalvaguarda" ? enabled : undefined } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 10 } } };
const keys = ["str", "dex", "con", "int", "wis", "cha"];
const config = { abilities: Object.fromEntries(keys.map(key => [key, { label: key, abbreviation: key }])) };
const style = { name: "Lutador", flags: { "jujutsu-system": { legacy2: { proficiencias: { salvaguardas: 4 } } } } };
function actor(type = "character") {
  return { type, itemTypes: {}, system: { details: { level: 2 },
    attributes: { hp: { value: 20, max: 20 } },
    abilities: Object.fromEntries(keys.map((key, index) => [key, { value: [5, 7, 4, 2, 4, 5][index] }])),
    legacy2: { saves: { str: 4, con: 3 }, alternativeSaves: { fortitude: 2, vontade: 4, reflexo: 0 },
      skills: {}, armas: {}, pontos: { gastos: 7 } } } };
}
test("optional saves round each attribute pair down before adding independent proficiency ranks for players and NPCs", () => {
  enabled = true; version = "2.0";
  assert.equal(typeof Ruleset.alternativeSave, "function");
  const a = actor();
  for (const type of ["character", "npc"]) for (const [key, base, rank, total] of [["fortitude",4,2,5],["vontade",4,4,7],["reflexo",4,0,0]]) {
    const save = Ruleset.alternativeSave(actor(type), key);
    assert.equal(save.base, base);assert.equal(save.rank, rank);assert.equal(save.total, total);
    assert.match(save.tooltip, /arredondado para baixo/);
  }
  assert.equal(Ruleset.saveRank(a,"wis"),2);assert.equal(Ruleset.saveRank(a,"cha"),4);assert.equal(Ruleset.saveRank(a,"int"),0);
  const ctx = buildLegacy2Context(a, config, Ruleset);
  assert.equal(ctx.alternativeSaves,true);
  assert.deepEqual(ctx.saves.map(s=>s.label),["Fortitude","Vontade","Reflexo"]);
  assert.match(ctx.saves[0].tooltip,/5.*4/);
  assert.equal(buildLegacy2Context(actor("npc"),config,Ruleset).saves.length,3);
});
test("changing rule restores the six original saves and charges only the active ranks", () => {
  const a = actor();enabled = true;version = "2.0";
  assert.equal(Ruleset.trainingPointsSpent(a),6);
  assert.equal(Ruleset.trainingPointsAvailable(a),6);
  enabled = false;
  assert.equal(Ruleset.trainingPointsSpent(a),7);
  assert.equal(Ruleset.trainingPointsAvailable(a),5);
  assert.equal(buildLegacy2Context(a,config,Ruleset).saves.length,6);
  assert.equal(Ruleset.saveRank(a,"str"),4);
  enabled = true;version = "1.0";
  assert.equal(Ruleset.alternativeSave(a,"str"),null);
  a.system.legacy2.pontos.gastos=9;
  assert.equal(Ruleset.trainingPointsAvailable(a),3);
  version = "2.0";
});
test("rank editing preserves old saves and rejects inactive or malformed save keys", () => {
  enabled = true;version = "2.0";
  const a = actor(), result = prepareRankUpdate(a,"alternativeSaves","fortitude",3,Ruleset,config.abilities);
  assert.deepEqual(result.update["system.legacy2.alternativeSaves"],{fortitude:3,vontade:4,reflexo:0});
  assert.equal(result.update["system.legacy2.pontos.gastos"],7);
  assert.equal(result.update["system.legacy2.saves"],undefined);
  assert.equal(prepareRankUpdate(a,"alternativeSaves","str",2,Ruleset,config.abilities),null);
  enabled = false;
  assert.equal(prepareRankUpdate(a,"alternativeSaves","fortitude",3,Ruleset,config.abilities),null);
});

test("alternative ranks obey the player budget while NPC edit controls remain freely configurable", async () => {
  enabled=true;version="2.0";
  const a=actor();a.system.legacy2.skills={ath:4,arc:4};
  assert.equal(prepareRankUpdate(a,"alternativeSaves","fortitude",4,Ruleset,config.abilities).insufficient,true);
  a.type="npc";let update;a.update=async data=>{update=data;};
  const target={dataset:{rank:"4"},closest:()=>({dataset:{ctx:"alternativeSaves",key:"fortitude",currentRank:"2"}})};
  await updateNpc2Rank({actor:a,isEditable:true,isEditMode:true},target,Ruleset,config.abilities);
  assert.equal(update["system.legacy2.alternativeSaves"].fortitude,4);
  update=null;
  await updateNpc2Rank({actor:a,isEditable:false,isEditMode:true},target,Ruleset,config.abilities);
  assert.equal(update,null);
});
test("creation allocates the three new proficiencies and previews them in their own fields", () => {
  enabled = true;version = "2.0";
  const draft=creationDraft(actor());
  assert.deepEqual(Object.keys(draft.proficiencies.saves),["fortitude","vontade","reflexo"]);
  assert(allocateCreationRank(draft,style,"saves","fortitude",2));
  assert(!allocateCreationRank(draft,style,"saves","str",2));
  assert.equal(creationActor(draft,style).system.legacy2.alternativeSaves.fortitude,2);
  enabled = false;
  assert.deepEqual(Object.keys(creationDraft(actor()).proficiencies.saves),keys);
});

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("the rule is an optional world checkbox and requires reloading client data", () => {
  let registered;
  const registration = read("module/settings.mjs").match(/  game.settings.register\("jujutsu-system", "regraSalvaguarda", \{[\s\S]*?\r?\n  }\);/)[0];
  new Function("game",registration)({settings:{register:(scope,key,value)=>{registered={scope,key,...value};}}});
  assert.equal(registered.type,Boolean);assert.equal(registered.default,false);assert.equal(registered.scope,"world");
  assert.equal(registered.config,true);assert.equal(registered.requiresReload,true);
});

test("finishing creation persists alternative ranks instead of mixing them into the six attribute saves", async () => {
  enabled=true;version="2.0";
  const a={type:"character",isOwner:true,name:"Novo",items:[],system:{},getFlag(){}};
  const draft=creationDraft(a),origin={uuid:"Item.origin",name:"Origem",type:"race",system:{}};
  const combatStyle={...style,name:"Estilo Teste",uuid:"Item.style",type:"class",system:{},flags:{"jujutsu-system":{legacy2:{
    vidaBase:7,energiaBase:10,atributoPrincipal:"str",espIniciais:0,proficiencias:{salvaguardas:4}}}}};
  Object.assign(draft,{species:origin.uuid,style:combatStyle.uuid,primary:"str",abilities:{str:5,dex:4,con:3,int:3,wis:3,cha:2}});
  draft.proficiencies.saves={fortitude:2,vontade:2,reflexo:0};
  const catalog={species:[origin],styles:[combatStyle],graph:{porNome:new Map()},
    customization:Object.fromEntries(Object.keys(draft.customization).map(key=>[key,[]]))};
  let id=0;
  const plan=await prepareCreationCompletion(a,draft,catalog,{resolve:async uuid=>uuid===origin.uuid?origin:combatStyle,idFactory:()=>`save${++id}`});
  assert.deepEqual(plan.actor["system.legacy2.alternativeSaves"],{fortitude:2,vontade:2,reflexo:0});
  assert.equal(plan.actor["system.legacy2.saves"],undefined);
});

test("native saves requested by attributes or the new names roll the average and correct proficiency once", async () => {
  enabled=true;version="2.0";
  globalThis.foundry={utils:{deepClone:structuredClone,mergeObject:(a,b)=>({...a,...b}),
    setProperty:(obj,key,value)=>{obj[key]=value;}}};
  globalThis.ChatMessage={getSpeaker:()=>({})};globalThis.Hooks={callAll(){}};
  const construct = read("module/dice/basic-roll.mjs").match(/  static constructParts\(parts, data=\{\}\) \{([\s\S]*?)\r?\n  }/)[1];
  CONFIG.DND5E=config;
  CONFIG.Dice={D20Roll:{constructParts:new Function("parts","data={}",construct),mergeConfigs:(a,b)=>({...a,...b}),
    build:async (process,dialog,message)=>[{process,dialog,message,...process.rolls[0]}]}};
  const src=read("module/documents/actor/actor.mjs");
  const methods=src.slice(src.indexOf("  async rollSavingThrow(config={}, dialog={}, message={})"),src.indexOf("  async rollDeathSave("));
  const NativeActor=new Function("Ruleset","D20RollModificationField","_loc",`return class {${methods}}`)(Ruleset,
    {combineFields:()=>({bonus:2})},(key,args)=>args.ability);
  const a=Object.assign(new NativeActor(),actor(),{name:"Teste",getFlag:()=>null,getRollData:()=>({roll:{}}),addConditionRollReduction(){}});
  for(const [ability,total,label]of [["str",7,"Fortitude"],["wis",7,"Fortitude"],["con",9,"Vontade"],["cha",9,"Vontade"],["dex",2,"Reflexo"],["int",2,"Reflexo"],["vontade",9,"Vontade"]]){
    const [roll]=await a.rollSavingThrow({ability});
    assert.equal(roll.data.mod,4);
    assert.equal(roll.parts.reduce((sum,key)=>sum+roll.data[key.slice(1)],0),total);
    assert.equal(roll.dialog.options.window.title,label);
    assert.equal(roll.message.data.flavor,label);
    const breakdown=testRollBreakdown(roll.process,roll);
    assert.equal(breakdown.abilityLabel,label);
  }
  enabled=false;
  const [old]=await a.rollSavingThrow({ability:"str"});
  assert.equal(old.data.mod,5);assert.equal(old.data.legacyRank,3);
});
