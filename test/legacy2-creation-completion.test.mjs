import assert from "node:assert/strict";
import { test } from "node:test";
import { creationDraft } from "../module/applications/actor/creation/creation-model-2.mjs";
globalThis.game = { settings: { get: () => "2.0" } };
const completion = await import("../module/applications/actor/creation/creation-completion-2.mjs").catch(() => ({}));
const species = { uuid: "Compendium.test.Item.species", type:"race", name:"Origem", img:"origin.webp", system:{description:{value:"<p>Vida Base: 10 Pontos de Vida</p>"},advancement:{}},flags:{} };
const style = { uuid: "Compendium.test.Item.style", type:"class", name:"Estilo", system:{levels:1,advancement:{}},flags:{"jujutsu-system":{legacy2:{vidaBase:7,energiaBase:10,atributoPrincipal:"str",espIniciais:0,proficiencias:{armas:0,salvaguardas:0,pericias:0}}}} };
function fixture() {
  const actor={name:"Nome",type:"character",isOwner:true,items:[],system:{},getFlag(){},img:"old.webp",prototypeToken:{texture:{src:"old-token.webp"}}};
  const draft=creationDraft(actor);Object.assign(draft,{species:species.uuid,style:style.uuid,primary:"str",name:"Feiticeiro",img:"portrait.webp",tokenImg:"token.webp"});
  draft.abilities={str:6,dex:3,con:4,int:3,wis:2,cha:2};
  const catalog={species:[species],styles:[style],customization:Object.fromEntries(Object.keys(draft.customization).map(k=>[k,[]])),graph:{porNome:new Map()}};
  let id=0;return {actor,draft,catalog,idFactory:()=>`creation${++id}`,resolve:async uuid=>[species,style].find(d=>d.uuid===uuid)};
}
test("completion creates a native actor/item batch with saved images, attributes and source identities", async()=>{
  assert.equal(typeof completion.prepareCreationCompletion,"function");
  const f=fixture(),plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:f.resolve,idFactory:f.idFactory});
  assert.equal(plan.create.length,2);assert(plan.create.every(d=>d._id));
  assert.equal(plan.actor.name,"Feiticeiro");assert.equal(plan.actor.img,"portrait.webp");
  assert.equal(plan.actor["prototypeToken.texture.src"],"token.webp");
  assert.equal(plan.actor["system.abilities.str.value"],6);
  assert.equal(plan.actor["system.legacy2.pvEspecie"],10);
  assert.equal(plan.create[0]._stats.compendiumSource,species.uuid);
  assert.equal(plan.actor["flags.jujutsu-system.creation2"].completed,true);
  assert.equal(f.actor.img,"old.webp");assert.equal(f.actor.items.length,0);
});
test("invalid allocations and stale style budgets are rejected before any commit",async()=>{
  assert.equal(typeof completion.prepareCreationCompletion,"function");
  const f=fixture();f.draft.abilities.str=7;
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:f.resolve,idFactory:f.idFactory}));
  f.draft.abilities.str=6;
  const changed=structuredClone(style);changed.flags["jujutsu-system"].legacy2.proficiencias.armas=2;
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:async uuid=>uuid===style.uuid?changed:species,idFactory:f.idFactory}));
});
test("mandatory level-zero species grants are preserved and deduplicated",async()=>{
  assert.equal(typeof completion.prepareCreationCompletion,"function");
  const f=fixture(),origin=structuredClone(species);
  origin.system.advancement={a:{type:"ItemGrant",level:0,configuration:{items:[{uuid:"Compendium.test.Item.grant"},{uuid:"Compendium.test.Item.grant"}]}}};
  const grant={uuid:"Compendium.test.Item.grant",type:"feat",name:"Benefício",system:{},flags:{},effects:[{name:"Benefício",system:{changes:[]}}]};
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:async uuid=>uuid===species.uuid?origin:uuid===style.uuid?style:grant,idFactory:f.idFactory});
  assert.equal(plan.create.length,3);assert.equal(plan.create.filter(d=>d.name==="Benefício").length,1);
  assert.equal(plan.create.find(d=>d.name==="Benefício").effects.length,1);
});
test("repeat Finish clicks share one native commit and completed creation cannot run again",async()=>{
  assert.equal(typeof completion.commitCreation,"function");
  const f=fixture();let commits=0,completed=false;
  f.actor.getFlag=()=>({completed});
  f.actor.performBulkUpdate=async()=>{commits++;await new Promise(resolve=>setTimeout(resolve,10));completed=true;};
  const options={resolve:f.resolve,idFactory:f.idFactory};
  await Promise.all([completion.commitCreation(f.actor,f.draft,f.catalog,options),completion.commitCreation(f.actor,f.draft,f.catalog,options)]);
  assert.equal(commits,1);
  await assert.rejects(completion.commitCreation(f.actor,f.draft,f.catalog,options));
});
test("a chosen customization already granted by the origin retains its section without a second item",async()=>{
  const f=fixture(),origin=structuredClone(species),uuid="Compendium.test.Item.grant";
  origin.system.advancement={a:{type:"ItemGrant",level:0,configuration:{items:[{uuid}]}}};
  const grant={uuid,type:"feat",name:"Defeito",system:{},flags:{}};
  f.catalog.customization["jj-flaws"]=[grant];f.draft.customization["jj-flaws"]=[uuid];
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:async id=>id===species.uuid?origin:id===style.uuid?style:grant,idFactory:f.idFactory});
  assert.equal(plan.create.length,3);assert.equal(plan.create.find(d=>d.name==="Defeito").flags["jujutsu-system"].featureSection,"jj-flaws");
});
test("one source cannot be assigned to two customization sections and a stale non-feat is rejected",async()=>{
  const f=fixture(),uuid="Compendium.test.Item.grant",grant={uuid,type:"feat",name:"Característica",system:{},flags:{}};
  for(const section of ["jj-flaws","jj-peculiarities"]){f.catalog.customization[section]=[grant];f.draft.customization[section]=[uuid];}
  const options={resolve:async id=>f.resolve(id)??grant,idFactory:f.idFactory};
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,options));
  f.draft.customization["jj-peculiarities"]=[];
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{...options,resolve:async id=>id===uuid?{...grant,type:"weapon"}:f.resolve(id)}));
});
test("legacy grant aliases resolving to the same current compendium source do not duplicate it",async()=>{
  const f=fixture(),origin=structuredClone(species),uuid="Compendium.current.Item.grant",old="Compendium.legacy.Item.grant";
  origin.system.advancement={a:{type:"ItemGrant",level:0,configuration:{items:[{uuid:old}]}}};
  const grant={uuid,type:"feat",name:"Benefício",system:{},flags:{}};
  f.catalog.customization["jj-peculiarities"]=[grant];f.draft.customization["jj-peculiarities"]=[uuid];
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:async id=>id===species.uuid?origin:id===style.uuid?style:grant,idFactory:f.idFactory});
  const copy=plan.create.find(d=>d.name==="Benefício");assert.equal(plan.create.length,3);
  assert.equal(copy._stats.compendiumSource,uuid);assert.equal(copy.flags["jujutsu-system"].featureSection,"jj-peculiarities");
});
