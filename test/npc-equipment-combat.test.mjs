import assert from "node:assert/strict";import {test} from "node:test";
const api=await import("../module/systems/npc-equipment-combat.mjs").catch(e=>{if(e.code==="ERR_MODULE_NOT_FOUND")return{};throw e;});
globalThis.game={settings:{get:()=>"2.0"}};
function fixture(){
 const effects=[],damage=[],targets=new Map(),receipts=[];
 const attacker={uuid:"Actor.attacker",isOwner:true,name:"Atacante"};
 const target={uuid:"Actor.target",isOwner:true,name:"Alvo",system:{abilities:{str:{value:8}},legacy2:{resistances:{acid:{value:5}}}},itemTypes:{equipment:[]}};
 targets.set(target.uuid,target);
 const effect={_id:"biteEffect",statuses:new Set(["jj-em-chamas"]),flags:{"jujutsu-system":{condicaoDano:{chave:"fire",save:"con"}}},duration:{value:3,units:"rounds"}};
 const item={type:"weapon",flags:{"jujutsu-system":{ataqueNatural:true,condicaoAoAtingir:"Em Chamas"}},effects:[effect]};
 const message={id:"attack",uuid:"ChatMessage.attack",type:"attack",flags:{},system:{evaluatedTargets:[{actor:target.uuid,isMiss:false}]},getAssociatedActor:()=>attacker,getAssociatedItem:()=>item,getAssociatedActivity:()=>({effects:[{_id:"biteEffect"}]}),
  getFlag(ns,key){return this.flags[ns]?.[key];},async setFlag(ns,key,value){(this.flags[ns]??={})[key]=value;receipts.push(value);}};
 const world={user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},settings:{get:()=>"2.0"}};
 const options={world,resolve:async uuid=>targets.get(uuid),applyCondition:async(...args)=>{effects.push(args);return true;},damage:async(...args)=>{damage.push(args);return true;},announce:()=>{}};
 return{attacker,target,item,effect,message,options,effects,damage,world};
}
test("natural elemental bites apply the configured on-hit condition exactly once without a second save",async()=>{
 assert.equal(typeof api.resolveNpcEquipmentAttack,"function");const f=fixture();
 await Promise.all([api.resolveNpcEquipmentAttack(f.message,f.options),api.resolveNpcEquipmentAttack(f.message,f.options)]);
 assert.equal(f.effects.length,1);assert.equal(f.effects[0][0],f.target);assert.equal(f.effects[0][1],f.effect);
 assert.equal(f.effects[0][2].origin,"ChatMessage.attack");assert.equal(f.damage.length,0);
 await api.resolveNpcEquipmentAttack(f.message,f.options);assert.equal(f.effects.length,1);
});
test("misses, absent targets, unrelated activities and non-authoritative clients never apply conditions or damage",async()=>{
 for(const mode of ["miss","empty","otherClient","notAttack"]){const f=fixture();
  if(mode==="miss")f.message.system.evaluatedTargets[0].isMiss=true;
  if(mode==="empty")f.message.system.evaluatedTargets=[];
  if(mode==="otherClient")f.world.user.id="other";
  if(mode==="notAttack")f.message.type="damage";
  await api.resolveNpcEquipmentAttack(f.message,f.options);assert.equal(f.effects.length,0);assert.equal(f.damage.length,0);
 }
});
test("only the equipped armor returns full-attribute damage, respecting its damage type and normal damage pipeline",async()=>{
 const f=fixture();f.target.itemTypes.equipment=[{id:"armor",type:"equipment",name:"Placas",system:{equipped:true,type:{value:"natural"}},flags:{"jujutsu-system":{thorns:{tipo:"thorns-atributo",atributo:"str",tipoDano:"piercing"}}}}];
 await api.resolveNpcEquipmentAttack(f.message,f.options);assert.equal(f.damage.length,1);assert.equal(f.damage[0][0],f.attacker);assert.equal(f.damage[0][1],8);
 assert.deepEqual(f.damage[0][2],{damageTypes:["piercing"],damages:[{type:"piercing",value:8}]});
 const inactive=fixture();inactive.target.itemTypes.equipment=[{...f.target.itemTypes.equipment[0],system:{equipped:false}}];
 await api.resolveNpcEquipmentAttack(inactive.message,inactive.options);assert.equal(inactive.damage.length,0);
});
test("Membrana Fina returns the effective positive acid resistance, never vulnerability or a modifier",()=>{
 const f=fixture();f.target.itemTypes.equipment=[{id:"armor",type:"equipment",system:{equipped:true,type:{value:"natural"}},flags:{"jujutsu-system":{thorns:{tipo:"thorns-resistencia",tipoDano:"acid"}}}}];
 assert.equal(api.armorRetaliation(f.target).value,5);f.target.system.legacy2.resistances.acid.value=-5;assert.equal(api.armorRetaliation(f.target).value,0);
});
test("disabled conditions and effects belonging to a different activity are not automatically applied",async()=>{
 for(const disabled of [true,false]){const f=fixture();
  if(disabled)f.effect.disabled=true;else f.message.getAssociatedActivity=()=>({effects:[]});
  await api.resolveNpcEquipmentAttack(f.message,f.options);assert.equal(f.effects.length,0);
 }
});
test("a fresh bite restarts a condition's V14 expiry in combat and converts rounds to seconds outside combat",async()=>{
 globalThis.Hooks={on(){},once(){}};
 globalThis.CONST={ACTIVE_EFFECT_MODES:{ADD:2,OVERRIDE:5,MULTIPLY:1}};
 globalThis.CONFIG={statusEffects:{"jj-em-chamas":{id:"jj-em-chamas",name:"Em Chamas"}}};
 globalThis.ui={notifications:{warn(){}}};
 globalThis.game.time={worldTime:100};
 const updates=[],fresh={time:100,combat:"combat",combatant:"turn3",initiative:15,round:3,turn:0};
 const active={statuses:new Set(["jj-em-chamas"]),system:{changes:[]},constructor:{getEffectStart:()=>fresh},async update(data){updates.push(data);}};
 const actor={isOwner:true,name:"Alvo",items:[],effects:[active],system:{traits:{ci:{value:new Set()}},legacy2:{}}};
 const source={statuses:["jj-em-chamas"],duration:{value:3,units:"rounds"},flags:{"jujutsu-system":{condicaoDano:{chave:"fire",save:"con"}}}};
 game.combat={started:true};
 assert.equal(await api.applyNaturalHitCondition(actor,source,{origin:"ChatMessage.new"}),true);
 assert.deepEqual(updates.at(-1).start,fresh);assert.equal(updates.at(-1).duration.value,3);
 game.combat={started:false};
 await api.applyNaturalHitCondition(actor,source,{origin:"ChatMessage.outside"});
 assert.deepEqual(updates.at(-1).duration,{value:18,units:"seconds"});
});
