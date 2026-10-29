import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { collectCreationAdvancements, creationAdvancementFlows, creationPlanFromPreview } from "../module/applications/actor/creation/creation-advancements-2.mjs";
import { commitCreation } from "../module/applications/actor/creation/creation-completion-2.mjs";
import { creationDraft } from "../module/applications/actor/creation/creation-model-2.mjs";
import { performValidatedCustomizationBatch } from "../module/applications/actor/jj/legacy2-customization.mjs";
import Ruleset from "../module/systems/ruleset.mjs";
globalThis.game={settings:{get:(_scope,key)=>key==="rulesetVersion"?"2.0":{}}};

const copy = value => structuredClone(value);
function merge(target, updates) {
  for (const [key, value] of Object.entries(updates)) {
    const parts = key.split("."), last = parts.pop();
    let parent = target;
    for (const part of parts) parent = parent[part] ??= {};
    if (value && typeof value === "object" && !Array.isArray(value)) merge(parent[last] ??= {}, value);
    else parent[last] = copy(value);
  }
}
class NativeApplicationBoundary {
  constructor(options={}) { this.options=options;this.element=null;this.rendered=false; }
  async render() { this.rendered=true;this.element={querySelector:()=>null};return this; }
  async close(options={}) {
    // V14 returns before _onClose when automatic flows never rendered a window.
    if (!this.element) return this;
    this.rendered=false;this.element=null;this._onClose(options);return this;
  }
  _onClose() {}
}
class FlowBoundary extends NativeApplicationBoundary {
  constructor({document,level}) { super();this.advancement=document;this.item=document.item;this.level=level; }
  getAutomaticApplicationValue() { return this.advancement.automaticApplicationValue(this.level); }
  async submit() { await this.advancement.apply(this.level,this.selection??{}); }
  async retainData(data) { this.retainedData=data; }
}
globalThis.Application=class {};
globalThis.dnd5e={applications:{advancement:{AdvancementFlowV2:FlowBoundary}}};
globalThis.Hooks={call:()=>true,callAll(){}};
globalThis.ui={notifications:{error(message){throw new Error(message);}}};
Array.fromRange??=(count,start=0)=>Array.from({length:count},(_,i)=>start+i);
globalThis.foundry={utils:{isEmpty:obj=>!obj||Object.keys(obj).length===0}};
// Run the production manager state machine; only Foundry's document/application boundaries are replaced.
const managerSource=readFileSync(new URL("../module/applications/advancement/advancement-manager.mjs",import.meta.url),"utf8")
  .replace(/^import .*;\r?\n/gm,"").replace("export default class AdvancementManager","class AdvancementManager");
const NativeManager=new Function("Advancement","Application5e","log",`${managerSource}\nreturn AdvancementManager;`)({ERROR:class extends Error{}},NativeApplicationBoundary,()=>{});

class PreviewBoundary {
  constructor(data,definitions=[]) { this.data=copy(data);this.definitions=definitions;this.reset(); }
  clone() { return new PreviewBoundary(this.data,this.definitions); }
  updateSource(updates) {
    const {items,...actor}=updates;merge(this.data,actor);
    if(items) for(const item of items){const index=this.data.items.findIndex(d=>d._id===item._id);if(index<0)this.data.items.push(copy(item));else merge(this.data.items[index],item);}
    this.reset();
  }
  reset() {
    this.system=copy(this.data.system);
    this.system.attributes.hp.max=100;
    this.system.attributes.hp.effectiveMax=100;
    this.system.energy.max=this.data.items.some(d=>d.name==="Energia ampliada")?40:20;
    const list=this.data.items.map(source=>{
      const item={id:source._id,type:source.type,system:source.system??{},hasAdvancement:false,actor:this,advancement:{byLevel:{}}};
      for(const def of this.definitions.filter(d=>d.item===source._id)) {
        item.hasAdvancement=true;
        const advancement={...def,id:def.id,item,configuration:def.configuration??{},constructor:{metadata:{apps:{flow:FlowBoundary}}},
          automaticApplicationValue:async()=>def.automatic??false,
          apply:async(level,data)=>{this.applied??=[];this.applied.push([def.id,level,data]);if(def.apply)await def.apply(this,level,data);},
          restore:async()=>{},reverse:async()=>({})};
        (item.advancement.byLevel[def.level??0]??=[]).push(advancement);advancement.appliesToClass=true;
      }
      return item;
    });
    this.items=list;this.items.get=id=>list.find(d=>d.id===id);
    this.items.delete=id=>{this.data.items=this.data.items.filter(d=>d._id!==id);this.reset();};
  }
  toObject() { return copy(this.data); }
}
const empty=()=>new PreviewBoundary({_id:"actor",name:"Inicial",type:"character",system:{attributes:{hp:{value:0}},energy:{total:0,generated:0},details:{level:1}},items:[]});
const plan=()=>({actor:{name:"Criado","system.energy.generated":10},create:[{_id:"origin",name:"Origem",type:"race",system:{advancement:{}}},{_id:"style",name:"Estilo",type:"class",system:{levels:1,advancement:{}}}]});
const advanceDefinitions=[
  {item:"origin",id:"asi",type:"AbilityScoreImprovement",automatic:{assignments:{str:4}}},
  {item:"style",id:"hp",type:"HitPoints",level:1,automatic:{value:8}},
  {item:"origin",id:"language",type:"Trait",automatic:{chosen:["languages:standard:common"]},apply:preview=>preview.updateSource({"system.traits.languages.value":["common"]})},
  {item:"style",id:"choice",type:"ItemChoice",level:1,apply:(preview,_level,data)=>{
    if (!data.selected) return;
    assert.equal(data.selected,"Item.energy");
    preview.updateSource({items:[{_id:"chosen",name:"Energia ampliada",type:"feat",flags:{JujutsuLegacy:{sourceId:"Item.energy",advancementOrigin:"style.choice",advancementRoot:"style.choice"}}}]});
  }},
  {item:"chosen",id:"nested",type:"ItemGrant",configuration:{items:[{uuid:"Item.nested"}]},automatic:{selected:["Item.nested"]},apply:preview=>preview.updateSource({items:[
    {_id:"nested",name:"Benefício encadeado",type:"feat",flags:{JujutsuLegacy:{sourceId:"Item.nested",advancementOrigin:"chosen.nested",advancementRoot:"chosen.nested"}}}
  ]})},
  {item:"style",id:"future",type:"ItemChoice",level:3}
];
const resolve=async uuid=>({uuid});

test("all-automatic initial benefits complete even when V14 never opens or closes a manager window",async()=>{
  const actor=empty();actor.definitions=advanceDefinitions.filter(def=>def.id==="language");let manager;
  class Manager extends NativeManager {constructor(...args){super(...args);manager=this;}}
  const pending=collectCreationAdvancements(actor,plan(),{Manager,resolve});
  const outcome=await Promise.race([pending.then(value=>({state:"complete",value})),
    new Promise(resolve=>setTimeout(()=>resolve({state:"waiting"}),50))]);
  assert.equal(outcome.state,"complete","the hidden creator must not keep waiting for a window that never rendered");
  assert.equal(manager.rendered,false);assert.equal(manager.element,null);
  assert.equal(outcome.value.actor.system.traits.languages.value[0],"common");
  assert.deepEqual(outcome.value.create.map(item=>item._id),["origin","style"]);
  assert.equal(actor.data.items.length,0,"the preview still waits for the single real character commit");
});

test("Finish persists the origin, style, initial grants, effects and allocations through the real native batch builder",async()=>{
  const actor=empty();actor.id="actor";actor.type="character";actor.isOwner=true;actor.name="Inicial";actor.img="old.webp";
  actor.getFlag=(scope,key)=>actor.data.flags?.[scope]?.[key];
  actor.definitions=[{...advanceDefinitions.find(def=>def.id==="language"),item:"creation1"}];
  const actorSource=readFileSync(new URL("../module/documents/actor/actor.mjs",import.meta.url),"utf8");
  const bulkMethod=actorSource.match(/\n  performBulkUpdate\([\s\S]*?\n  \}/)[0];
  const BulkActor=new Function("Ruleset","performValidatedCustomizationBatch",`return class {${bulkMethod}}`)(Ruleset,performValidatedCustomizationBatch);
  actor.performBulkUpdate=BulkActor.prototype.performBulkUpdate;
  const feature={uuid:"Item.feature",type:"feat",name:"Benefício inicial",system:{activities:{ability:{type:"utility"}}},effects:[{_id:"effect",name:"Efeito inicial",transfer:true}]};
  const flaw={uuid:"Item.flaw",type:"feat",name:"Defeito de teste",system:{},effects:[]};
  const origin={uuid:"Item.origin",type:"race",name:"Origem",flags:{},system:{advancement:{grant:{_id:"grant",type:"ItemGrant",level:0,configuration:{items:[{uuid:feature.uuid}]}}}}};
  const style={uuid:"Item.style",type:"class",name:"Estilo",system:{levels:1,advancement:{}},
    flags:{"jujutsu-system":{legacy2:{vidaBase:7,energiaBase:10,atributoPrincipal:"str",espIniciais:0,proficiencias:{armas:0,salvaguardas:0,pericias:1}}}}};
  const draft=creationDraft(actor);Object.assign(draft,{species:origin.uuid,style:style.uuid,primary:"str",name:"Criado",img:"portrait.webp",tokenImg:"token.webp"});
  draft.abilities={str:6,dex:3,con:4,int:3,wis:2,cha:2};draft.proficiencies.skills.ath=1;draft.customization["jj-flaws"]=[flaw.uuid];
  const catalog={species:[origin],styles:[style],customization:Object.fromEntries(Object.keys(draft.customization).map(key=>[key,key==="jj-flaws"?[flaw]:[]])),graph:{porNome:new Map()}};
  const batches=[],previous=foundry.documents;let id=0;
  foundry.documents={modifyBatch:async operations=>{
    batches.push(operations);
    for(const operation of operations){
      if(operation.documentName==="Actor")actor.updateSource(operation.updates[0]);
      else if(operation.documentName==="Item")actor.updateSource({items:operation.data});
    }
    return [[actor],actor.items];
  }};
  class Manager extends NativeManager {}
  try {
    const pending=commitCreation(actor,draft,catalog,{Manager,idFactory:()=>`creation${++id}`,resolve:async uuid=>[origin,style,feature,flaw].find(doc=>doc.uuid===uuid)});
    const outcome=await Promise.race([pending.then(value=>({state:"complete",value})),new Promise(resolve=>setTimeout(()=>resolve({state:"waiting"}),50))]);
    assert.equal(outcome.state,"complete");assert.equal(batches.length,1);
    assert.equal(actor.getFlag("jujutsu-system","creation2").completed,true);
    assert.equal(actor.data.name,"Criado");assert.equal(actor.data.img,"portrait.webp");
    assert.equal(actor.data.system.abilities.str.value,6);assert.equal(actor.data.system.legacy2.skills.ath,1);
    assert.deepEqual(actor.data.system.traits.languages.value,["common"]);
    assert.deepEqual(actor.data.items.map(item=>item.name),["Origem","Benefício inicial","Estilo","Defeito de teste"]);
    const owned=actor.data.items.find(item=>item.name===feature.name);
    assert.equal(owned.effects[0]._id,"effect");assert.equal(owned.system.activities.ability.type,"utility");
    assert.equal(owned.flags["jujutsu-system"].advancementOrigin,"creation1.grant");
    assert.equal(actor.data.system.details.originalClass,actor.data.items.find(item=>item.type==="class")._id);
    assert.equal(batches[0][1].keepId,true);
    await assert.rejects(commitCreation(actor,draft,catalog,{Manager}),/não está disponível/);
    assert.equal(batches.length,1);
  }finally{foundry.documents=previous;}
});

test("creation applies automatic traits, asks initial choices and commits only the completed preview",async()=>{
  const actor=empty();actor.definitions=advanceDefinitions;let manager;
  class Manager extends NativeManager { constructor(...args){super(...args);manager=this;} }
  const pending=collectCreationAdvancements(actor,plan(),{Manager,resolve});
  // The production manager awaits automatic flows before stopping at the initial item choice.
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(manager.step.flow.advancement.id,"choice");
  assert.deepEqual(manager.clone.applied.map(([id])=>id),["language","choice"]);
  assert.equal(manager.clone.system.traits.languages.value[0],"common");
  assert.equal(actor.data.items.length,0);assert.equal(actor.data.name,"Inicial");
  manager.step.flow.selection={selected:"Item.energy"};
  await Manager.DEFAULT_OPTIONS.actions.complete.call(manager,{}, {disabled:false,dataset:{action:"complete"}});
  const result=await pending;
  assert.equal(result.actor.name,"Criado");assert.equal(result.actor.system.attributes.hp.value,100);
  assert.equal(result.actor.system.energy.total+result.actor.system.energy.generated,40);
  assert.equal(result.actor.system.energy.generated,2);
  const chosen=result.create.find(d=>d._id==="chosen");
  assert.equal(chosen.flags["jujutsu-system"].advancementRoot,"style.choice");
  assert.equal(chosen.flags["jujutsu-system"].creation2Source,"Item.energy");
  const nested=result.create.find(d=>d._id==="nested");
  assert.equal(nested.flags["jujutsu-system"].advancementRoot,"style.choice");
  assert.equal(actor.data.items.length,0);
});

test("closing an initial advancement, including the native back-to-start exit, cancels without writes",async()=>{
  const actor=empty();actor.definitions=[{item:"style",id:"choice",type:"ItemChoice",level:1}];let manager;
  class Manager extends NativeManager { constructor(...args){super(...args);manager=this;} }
  const pending=collectCreationAdvancements(actor,plan(),{Manager,resolve});
  await new Promise(resolve=>setTimeout(resolve,0));
  await manager.close({skipConfirmation:true});
  assert.equal(await pending,null);assert.equal(actor.data.items.length,0);
});

test("only mandatory grants are already handled; optional grants and multiple sizes require flows",async()=>{
  const actor=empty();actor.definitions=[
    {item:"origin",id:"mandatory",type:"ItemGrant",configuration:{items:[{uuid:"Item.fixed"}]}},
    {item:"origin",id:"optional",type:"ItemGrant",configuration:{optional:true,items:[{uuid:"Item.optional"}]}},
    {item:"origin",id:"mixed",type:"ItemGrant",configuration:{items:[{uuid:"Item.fixed"},{uuid:"Item.optional",optional:true}]}},
    {item:"origin",id:"size",type:"Size",configuration:{sizes:new Set(["sm","med"])}}
  ];
  // No serialization of the live data model is involved in choosing flows.
  const manager=new NativeManager(actor);manager.clone.updateSource({items:plan().create});
  const flows=creationAdvancementFlows(manager);
  assert.deepEqual(flows.map(s=>s.flow.advancement.id),["optional","mixed","size"]);
  assert.equal(await flows.at(-1).flow.getAutomaticApplicationValue(),false);
});

test("filled creator choices are skipped while incomplete and replacement choices remain interactive",()=>{
  const actor=empty();actor.definitions=[
    {item:"style",id:"filled",type:"ItemChoice",level:1,configuration:{choices:{1:{count:1,replacement:false}}},value:{added:{1:{chosen:"Item.chosen"}}}},
    {item:"style",id:"incomplete",type:"ItemChoice",level:1,configuration:{choices:{1:{count:2,replacement:false}}},value:{added:{1:{chosen:"Item.chosen"}}}},
    {item:"style",id:"replacement",type:"ItemChoice",level:1,configuration:{choices:{1:{count:1,replacement:true}}},value:{added:{1:{chosen:"Item.chosen"}}}}
  ];
  const manager=new NativeManager(actor);manager.clone.updateSource({items:plan().create});
  assert.deepEqual(creationAdvancementFlows(manager).map(step=>step.flow.advancement.id),["incomplete","replacement"]);
});

test("legacy pool references are redirected before the native picker sees the item",async()=>{
  const actor=empty(),batch=plan(),old="Compendium.legacy.pack.Item.old",current="Compendium.current.pack.Item.old";
  batch.create[0].system.advancement={initial:{type:"ItemChoice",configuration:{choices:{1:{count:1}},pool:[{uuid:old}]}},future:{type:"ItemChoice",configuration:{choices:{3:{count:1}},pool:[{uuid:old}]}}};
  class Manager extends NativeManager {}
  const result=await collectCreationAdvancements(actor,batch,{Manager,resolve:async uuid=>({uuid:uuid===old?current:uuid})});
  const advancements=result.create[0].system.advancement;
  assert.equal(advancements.initial.configuration.pool[0].uuid,current);
  assert.equal(advancements.future.configuration.pool[0].uuid,old);
});

test("preview resource initialization uses the prepared maxima after effects",()=>{
  const actor=empty();actor.updateSource({items:[{_id:"bonus",name:"Energia ampliada"}],"system.energy.generated":10});
  const result=creationPlanFromPreview(actor);
  assert.equal(result.actor.system.attributes.hp.value,100);
  assert.equal(result.actor.system.energy.total+result.actor.system.energy.generated,40);
});

test("new native grants retain the original style root through several nested benefits",()=>{
  const actor=empty();actor.updateSource({items:[
    {_id:"style",type:"class"},
    {_id:"parent",flags:{"jujutsu-system":{advancementOrigin:"old.old",advancementRoot:"old.old",creation2Source:"Item.old"},JujutsuLegacy:{sourceId:"Item.parent",advancementOrigin:"style.choice",advancementRoot:"style.choice"}}},
    {_id:"child",flags:{JujutsuLegacy:{advancementOrigin:"parent.grant",advancementRoot:"parent.grant"}}},
    {_id:"grandchild",flags:{JujutsuLegacy:{advancementOrigin:"child.grant",advancementRoot:"child.grant"}}}
  ]});
  const result=creationPlanFromPreview(actor);
  assert.equal(result.create[1].flags["jujutsu-system"].creation2Source,"Item.parent");
  for(const item of result.create.slice(1))for(const scope of ["jujutsu-system","JujutsuLegacy"])assert.equal(item.flags[scope].advancementRoot,"style.choice");
});

test("ordinary native advancement still awaits its single real actor transaction before closing",async()=>{
  const actor=empty();let release,writes=0,done=false;
  actor.performBulkUpdate=async()=>{writes++;await new Promise(resolve=>{release=resolve;});};
  const manager=new NativeManager(actor,{automaticApplication:true});
  manager.steps=[{type:"forward",automatic:true,level:1}];
  const pending=manager.render({force:true}).then(()=>{done=true;});
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(writes,1);assert.equal(done,false);
  release();await pending;assert.equal(done,true);assert.equal(manager.rendered,false);
});

test("a fixed origin size passes the typed value expected by the actual Size advancement",async()=>{
  const actor=empty();actor.definitions=[{item:"origin",id:"size",type:"Size",configuration:{sizes:new Set(["lg"])}}];
  const manager=new NativeManager(actor);manager.clone.updateSource({items:plan().create});
  const data=await creationAdvancementFlows(manager)[0].flow.getAutomaticApplicationValue();
  assert.deepEqual(data,{size:"lg"});
  const source=readFileSync(new URL("../module/documents/advancement/size.mjs",import.meta.url),"utf8")
    .replace(/^import .*;\r?\n/gm,"").replace("export default class SizeAdvancement","class SizeAdvancement");
  const Size=new Function("Advancement",`${source}\nreturn SizeAdvancement;`)(class {});
  const document=new Size();document.actor=manager.clone;document.configuration={sizes:new Set(["lg"])};
  document.updateSource=({value})=>{assert.equal(typeof value,"object");document.value=value;};
  await document.apply(0,data);
  assert.equal(manager.clone.system.traits.size,"lg");assert.equal(document.value.size,"lg");
});

test("creation refinement comes from the reserve and respects the normal limit and its bonuses",()=>{
  const actor=empty();actor.updateSource({"system.energy.generated":10});
  let result=creationPlanFromPreview(actor);
  assert.equal(result.actor.system.energy.generated,2);
  assert.equal(result.actor.system.energy.total,18);
  actor.flags={"jujutsu-system":{refinamentoBonus:5}};
  result=creationPlanFromPreview(actor);
  assert.equal(result.actor.system.energy.generated,7);
  assert.equal(result.actor.system.energy.total,13);
});

test("Restringido starts with full stamina instead of an empty generated-energy field",()=>{
  const data={system:{attributes:{hp:{value:0}},energy:{total:0,generated:0}}};
  const actor={type:"character",system:{details:{level:1},abilities:{con:{value:4}},attributes:{hp:{max:35}},energy:{max:0}},
    itemTypes:{class:[{system:{identifier:"restringido"}}]},reset(){},toObject:()=>structuredClone({...data,items:[]})};
  const result=creationPlanFromPreview(actor);
  assert.equal(result.actor.system.energy.total,0);
  assert.equal(result.actor.system.energy.generated,8);
});
