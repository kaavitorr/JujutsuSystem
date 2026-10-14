import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { activationChoices, activationContext } from "../module/applications/activity/legacy2-activation.mjs";
import { acertoSeisOlhos } from "../module/systems/seis-olhos.mjs";
globalThis.game={settings:{get:()=>"2.0"},user:{targets:new Set()}};
globalThis.CONFIG={DND5E:{abilities:{str:{label:"Força"},dex:{label:"Agilidade"}}},JUJUTSU:{}};
const attributes=await import("../module/systems/legacy2-npc-attributes.mjs").catch(()=>({}));
const source=readFileSync(new URL("../module/data/activity/attack-data.mjs",import.meta.url),"utf8");
const body=source.match(/getAttackData\(\{ ability, ammunition, attackMode, situational, legacy2 \}=\{\}\) \{([\s\S]*?)\n  \}/)[1];
const Attack=new Function("Ruleset","D20RollModificationField","flanqueamentoDoAtaque","acertoSeisOlhos",`return class {getAttackData({ability,ammunition,attackMode,situational,legacy2}={}) {${body}}}`)(Ruleset,{combineFields:()=>({bonus:3})},()=>({graus:0,nomeAlvo:null}),acertoSeisOlhos);
globalThis.foundry={utils:{setProperty:(data,key,value)=>{data[key]=value;}}};
const nativeParts=readFileSync(new URL("../module/dice/basic-roll.mjs",import.meta.url),"utf8").match(/static constructParts\(parts, data=\{\}\) \{([\s\S]*?)\n  \}/)[1];
CONFIG.Dice={BasicRoll:{constructParts:new Function("parts","data",nativeParts)}};
function fixture(type="npc") {
 const items=[];items.get=()=>undefined;
 const actor={type,items,system:{details:{level:5},legacy2:{nd:"5",armas:{natural:2}},abilities:{str:{value:12,mod:1},dex:{value:6,mod:-2}},energy:{generated:10,total:100}},itemTypes:{class:[]},getFlag(){},addConditionRollReduction(){}};
 const item={type:"weapon",name:"Picada Lethal",actor,system:{type:{value:"natural"},magicalBonus:2,magicAvailable:true}};
 const attack=Object.assign(new Attack(),{type:"attack",actor,item,attack:{flat:true,bonus:7,ability:"str"},damage:{parts:[{}]}});
 attack.getActionType=()=>"mwak";attack.getRollData=({roll})=>({abilities:actor.system.abilities,roll:{ability:roll.ability??"str"},mod:99});
 return {actor,attack};
}
test("2.0 NPC legacy flat attacks include full selected attribute, rank, configured/effect/magic bonuses once",()=>{
 const {attack}=fixture(),data=attack.getAttackData({ability:"str",legacy2:{vantagens:2,desvantagens:1}});
 assert.equal(data.data.mod,12);assert.equal(data.data.legacyRank,1);assert.equal(data.data.bonus,7);assert.equal(data.data.ruleBonus,3);assert.equal(data.data.weaponMagic,2);assert.equal(data.data.legacyAdv,2);
 assert.deepEqual(data.parts,["@mod","@legacyRank","@legacyAdv","@bonus","@weaponMagic","@ruleBonus"]);assert(!data.parts.includes("@prof"));
 const changed=attack.getAttackData({ability:"dex"});assert.equal(changed.data.mod,6);
});
test("NPC activation cards agree with actual attack parts and refresh when the selected attribute changes",()=>{
 const {attack}=fixture(),view=activationContext(attack,{ability:"str",bonus:4,vantagens:2,desvantagens:1});
 assert.equal(view.abilityValue,12);assert.equal(view.skillValue,1);assert.equal(view.bonusLabel,"7 + 2 + 3");assert.equal(view.bonus,4);assert.equal(view.advantageBonus,2);
 assert.equal(activationContext(attack,{ability:"dex"}).abilityValue,6);
});
test("NPC activation starts from the attack's configured attribute",()=>{
 const {attack}=fixture();attack.attack.ability="dex";
 assert.equal(activationContext(attack).abilityValue,6);assert.equal(activationContext(attack).ability,"dex");
});
test("direct NPC attack data uses the configured attribute even when the old flat getter supplies none",()=>{
 const {attack,actor}=fixture();attack.attack.ability="dex";
 attack.getRollData=({roll})=>({abilities:actor.system.abilities,roll:{ability:roll.ability??null},mod:99});
 assert.equal(attack.getAttackData().data.mod,6);
});
test("the native roll builder preserves NPC attack terms and adds situational bonus exactly once",()=>{
 const native=readFileSync(new URL("../module/documents/activity/attack.mjs",import.meta.url),"utf8").match(/_buildAttackConfig\(process, config, formData, index\) \{([\s\S]*?)\n  \}/)[1];
 const Builder=new Function("Ruleset","activationChoices","D20RollModificationField",`return class extends Object {_buildAttackConfig(process,config,formData,index){${native}}}`)(Ruleset,activationChoices,{combineFields:()=>({})});
 CONFIG.Dice.D20Roll={mergeOptions:(a,b)=>({...a,...b}),ADV_MODE:{NORMAL:0}};
 const {attack}=fixture(),doc=Object.assign(new Builder(),attack);doc.getAttackData=attack.getAttackData.bind(attack);
 const roll={options:{advantage:true}},process={ability:"str"};doc._buildAttackConfig(process,roll,new Map([["legacy2.bonus","4"],["legacy2.vantagens","2"],["legacy2.desvantagens","1"]]),0);
 assert.equal(roll.data.mod,12);assert.equal(roll.data.bonus,7);assert.equal(roll.data.jj2ManualBonus,4);assert.equal(roll.parts.filter(p=>p==="@jj2ManualBonus").length,1);
 assert.equal(roll.options.advantage,false);assert.equal(roll.data.legacyAdv,2);
});
test("1.0 NPC and deliberately flat player attacks retain their fixed attack path",()=>{
 const get=game.settings.get;game.settings.get=()=>"1.0";
 try{const {attack}=fixture(),roll=attack.getAttackData();assert.deepEqual(roll.parts,["@toHit"]);assert.equal(roll.data.toHit,7);}finally{game.settings.get=get;}
 const {attack}=fixture("character");assert.deepEqual(attack.getAttackData().parts,["@toHit"]);assert.equal(activationContext(attack).abilityValue,0);
});
test("NPC values clamp before derived rolls and preserve the original source data",()=>{
 assert.equal(typeof attributes.prepareNpc2Abilities,"function");
 const values={str:15,dex:12,con:0,int:Infinity,wis:4.9,cha:18},actor={system:{legacy2:{},abilities:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value,_source:{value}}]))}};
 attributes.prepareNpc2Abilities(actor);
 assert.deepEqual(Object.fromEntries(Object.entries(actor.system.abilities).map(([key,v])=>[key,v.value])),{str:12,dex:12,con:1,int:1,wis:4,cha:12});
 assert.equal(actor.system.abilities.str._source.value,15);
});
test("NPC preparation precedes native roll data/ability calculation and remains dormant in 1.0",()=>{
 const native=readFileSync(new URL("../module/data/actor/npc.mjs",import.meta.url),"utf8");
 const prefix=native.match(/prepareDerivedData\(\) \{([\s\S]*?)\n    this.prepareCurrency\(\);/)[1];
 const run=new Function("Ruleset","prepareNpc2Abilities",prefix);
 const make=()=>{const actor={system:{legacy2:{},abilities:{str:{value:18,_source:{value:18}}}},getRollData(){return {str:this.system.abilities.str.value};},getOriginalStats:()=>({})};
  return {parent:actor,prepareAbilities({rollData}){this.seen=rollData.str;}};};
 const v2=make();run.call(v2,Ruleset,attributes.prepareNpc2Abilities);assert.equal(v2.seen,12);
 const get=game.settings.get;game.settings.get=()=>"1.0";
 try{const v1=make();run.call(v1,Ruleset,attributes.prepareNpc2Abilities);assert.equal(v1.seen,18);}finally{game.settings.get=get;}
});
