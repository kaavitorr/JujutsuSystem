import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import Ruleset from "../module/systems/ruleset.mjs";
import { activationChoices, activationContext, energyConsumptionPlan } from "../module/applications/activity/legacy2-activation.mjs";
globalThis.game={settings:{get:()=>"2.0"}};
globalThis.CONFIG={DND5E:{abilities:{str:{label:"Força"}}}};
const registered=new Map(),writes=[],formulas=[];let selected="2",beforeAccept=null;
globalThis.CONST={ACTIVE_EFFECT_MODES:{ADD:2,OVERRIDE:5}};
globalThis.Hooks={on:(key,fn)=>registered.set(key,fn),call:()=>true,callAll(){}};
globalThis.ui={notifications:{warn(){},info(){}}};
globalThis.ChatMessage={getSpeaker:()=>({}),create:async()=>{}};
globalThis.KeyboardManager={MODIFIER_CODES:{Alt:[],Control:[],Shift:[]},MODIFIER_KEYS:{}};
globalThis.foundry={data:{fields:{ArrayField:class{}}},dice:{terms:{}},utils:{escapeHTML:String,deepClone:structuredClone},applications:{api:{DialogV2:{async wait(options){
  if(selected===null)return null;beforeAccept?.();return options.buttons[0].callback({}, {}, {element:{querySelector:()=>({value:selected})}});
}}}}};
globalThis.Roll=class{constructor(formula){this.formula=formula;formulas.push(formula);}async evaluate(){this.total=8;return this;}async toMessage(){}};
const {onPhysicalImpulseDefense}=await import("../module/applications/actor/jj/physical-impulse-2.mjs");
const cards=await import("../module/applications/actor/jj/native-cards.mjs");
const {applyDamageToActor}=await import("../module/applications/actor/jj/damage-application.mjs");
function fixture(level=5,pe=7){
 const actor={name:"Restringido",type:"character",itemTypes:{class:[{identifier:"restringido",getFlag:()=>({atributoPrincipal:"str"})}]},items:[],getFlag:()=>null,
 system:{details:{level},abilities:{str:{value:6}},energy:{generated:pe,total:100},legacy2:{actions:{value:6}}}};
 const activity={type:"attack",item:{type:"weapon",actor,system:{}},damage:{parts:[{}]},consumption:{targets:[]},getAttackData:()=>({data:{mod:6,legacyRank:0}})};
 return {actor,activity};
}
test("physical impulse uses ceil(level/2) PE with 2d4 per PE",()=>{
 for(const [level,max]of [[1,1],[2,1],[5,3],[10,5]]){
  const {activity}=fixture(level);const choices=activationChoices(activity,{pa:99});assert.equal(choices.pa,max);
  const ctx=activationContext(activity,{pa:2});assert.equal(ctx.burstFormula,`${2*Math.min(max,2)}d4`);assert.equal(ctx.burstLimit,max);assert.equal(ctx.burstUnit,"PE");assert.equal(ctx.burstTitle,"Impulso Físico");
 }
});
test("the impulse debits PE rather than the reserve or action points",()=>{
 const {actor,activity}=fixture(5,3);const plan=energyConsumptionPlan(activity,{consume:false,legacy2:{pa:2}});
 assert.deepEqual(plan.updates,{"system.energy.generated":1});assert.equal(actor.system.energy.total,100);assert.equal(actor.system.legacy2.actions.value,6);
 actor.system.energy.generated=1;assert.throws(()=>energyConsumptionPlan(activity,{consume:false,legacy2:{pa:2}}),/PE/);
});
test("other combat styles retain one d4 per PA and the ceiling limit",()=>{
 const {actor,activity}=fixture();actor.itemTypes.class[0].identifier="lutador";
 const ctx=activationContext(activity,{pa:3});assert.equal(ctx.burstLimit,3);assert.equal(ctx.burstFormula,"3d4");assert.equal(ctx.burstUnit,"PA");
});
test("paid attack injects twice the d4s, never spends twice, and survives reload",async()=>{
 const {actor,activity}=fixture();actor.id="impulse";activity.id="attack";activity.item.id="weapon";activity.getRollData=()=>({});
 actor.update=async data=>{writes.push(data);actor.system.energy.generated=data["system.energy.generated"];};const before=writes.length;
 assert(await cards.commitLegacy2Attack(activity,{pa:2}));assert.equal(actor.system.energy.generated,5);
 assert(await cards.commitLegacy2Attack(activity,{pa:2},{prepaid:true}));assert.equal(writes.length,before+1);
 const cfg={subject:activity,rolls:[{parts:["1d8"],options:{type:"slashing"}}]};registered.get("dnd5e.preRollDamage")(cfg);
 assert.deepEqual(cfg.rolls[1].parts,["4d4"]);assert.equal(cfg.rolls[1].options.type,"slashing");assert.equal(cfg.rolls[1].options.flavor,"Impulso Físico (PE)");
 cards.popPendingDamage(activity);game.messages=new Map([["paid",{flags:{"jujutsu-system":{activation:{pa:2,physicalImpulse:true}}}}]]);
 assert.deepEqual(cards.legacy2DamageContext(activity,{jj2Origin:"paid"}).rolls[0].parts,["4d"]);
 game.messages.set("old-normal",{flags:{"jujutsu-system":{activation:{pa:2}}}});
 assert.deepEqual(cards.legacy2DamageContext(activity,{jj2Origin:"old-normal"}).rolls[0].parts,["2d"]);
});
test("a migrated reserve cost and scale consume only PE and are validated together",()=>{
 const {actor,activity}=fixture(5,10);activity.jjScale={formula:"1d6",cost:2};activity.consumption.targets=[{target:"energy.total",value:"2"}];
 const ctx=activationContext(activity,{pa:2,scale:2});assert.equal(ctx.scaleConfig.pool,"generated");assert.equal(ctx.scaleConfig.poolLabel,"PE");
 const plan=energyConsumptionPlan(activity,{consume:{resources:[0]},legacy2:{pa:2,scale:2}});
 assert.deepEqual(plan.updates,{"system.energy.generated":2});assert.equal(actor.system.energy.total,100);
 actor.system.energy.generated=7;assert.throws(()=>energyConsumptionPlan(activity,{consume:{resources:[0]},legacy2:{pa:2,scale:2}}),/PE/);
});
test("defense spends selected PE and prepares 2d4 per PE atomically",async()=>{
 const {actor}=fixture();const updates=[];actor.update=async data=>updates.push(data);formulas.length=0;selected="99";
 await onPhysicalImpulseDefense(actor);assert.deepEqual(formulas,["6d4"]);assert.equal(updates.length,1);
 assert.equal(updates[0]["system.energy.generated"],4);assert.deepEqual(updates[0]["flags.jujutsu-system.explosaoDefensivaPendente"],{reducao:8,physicalImpulse:true,peCusto:3});
 assert.equal(updates[0]["system.energy.total"],undefined);assert.equal(updates[0]["system.legacy2.actions.value"],undefined);
});
test("defense cancellation, zero level, zero PE and a changed balance cannot spend stamina",async()=>{
 for(const [level,pe,choice]of[[5,7,null],[0,7,"1"],[5,0,"1"]]){
  const {actor}=fixture(level,pe);actor.update=()=>assert.fail("must not spend");selected=choice;await onPhysicalImpulseDefense(actor);
 }
 const {actor}=fixture();selected="2";actor.update=()=>assert.fail("balance changed while choosing");beforeAccept=()=>{actor.system.energy.generated=1;};
 await onPhysicalImpulseDefense(actor);beforeAccept=null;
});
test("level one can spend one PE for two defensive d4s",async()=>{
 const {actor}=fixture(1,4);const updates=[];actor.update=async data=>updates.push(data);formulas.length=0;selected="99";
 await onPhysicalImpulseDefense(actor);assert.deepEqual(formulas,["2d4"]);assert.equal(updates[0]["system.energy.generated"],3);
});
test("native damage consumes physical defense once before temporary HP, and healing preserves it",async()=>{
 const source=readFileSync(new URL('../module/documents/actor/actor.mjs',import.meta.url),'utf8');
 const body=source.match(/async applyDamage\(damages, options=\{\}\) \{([\s\S]*?)\n  \}/)[1];
 const apply=new Function('Ruleset',`return async function(damages,options={}){${body}}`)(Ruleset);
 Number.isNumeric=value=>typeof value==='number';Math.clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 const hp={value:30,temp:5,damage:0},pending={reducao:8,physicalImpulse:true};
 const actor={system:{attributes:{hp},_source:{attributes:{hp:{tempmax:0}}}},getFlag:()=>actor.pending,pending,
  calculateDamage:damages=>({amount:damages[0].value,temp:0,tempMax:0}),async update(data){
   hp.value=data['system.attributes.hp.value'];hp.temp=data['system.attributes.hp.temp'];if(data['flags.jujutsu-system.-=explosaoDefensivaPendente']===null)actor.pending=null;
  }};
 await apply.call(actor,[{value:10}]);assert.equal(hp.value,30);assert.equal(hp.temp,3);assert.equal(actor.pending,null);
 await apply.call(actor,[{value:10}]);assert.equal(hp.value,23);actor.pending=pending;hp.damage=7;
 await apply.call(actor,[{value:-3}]);assert.equal(hp.value,26);assert.equal(actor.pending,pending);
});
test("custom damage also applies and consumes the same physical protection",async()=>{
 const {actor}=fixture();actor.system.attributes={hp:{value:30,temp:5},prof:2};actor.system.armorPoints={value:0};
 actor.getFlag=()=>({reducao:8,physicalImpulse:true});let update;
 actor.update=async data=>{update=data;};
 await applyDamageToActor(actor,10);
 assert.equal(update['flags.jujutsu-system.-=explosaoDefensivaPendente'],null);
 assert.equal(update['system.attributes.hp.temp'],3);
 assert.equal(update['system.attributes.hp.value'],undefined);
});
