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
test("channeling specializations granted at creation include their usable techniques in the same batch", async () => {
  const f = fixture(), origin = structuredClone(species);
  const grant = { uuid: "Compendium.test.Item.channeling", type: "feat", name: "Canalização de Combate", system: {}, flags: {} };
  origin.system.advancement = { a: { type: "ItemGrant", level: 0, configuration: { items: [{ uuid: grant.uuid }] } } };
  const plan = await completion.prepareCreationCompletion(f.actor, f.draft, f.catalog, {
    resolve: async uuid => uuid === species.uuid ? origin : uuid === style.uuid ? style : grant, idFactory: f.idFactory
  });
  assert.deepEqual(plan.create.filter(item => item.type === "spell").map(item => item.name), ["Explosão de Energia", "Defesa Sólida"]);
  assert.equal(new Set(plan.create.map(item => item._id)).size, plan.create.length);
  assert.equal(f.actor.items.length, 0);
});
test("repeat Finish clicks share one native commit and completed creation cannot run again",async()=>{
  assert.equal(typeof completion.commitCreation,"function");
  const f=fixture();let commits=0,completed=false;
  f.actor.getFlag=()=>({completed});
  f.actor.performBulkUpdate=async()=>{commits++;await new Promise(resolve=>setTimeout(resolve,10));completed=true;};
  const options={resolve:f.resolve,idFactory:f.idFactory,advance:async(_actor,plan)=>plan};
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

test("initial grants record native advancement ownership and retain nested grants at the proper level",async()=>{
  const f=fixture(),origin=structuredClone(species),combat=structuredClone(style);
  const benefit={uuid:"Compendium.test.Item.benefit",type:"feat",name:"Benefício",flags:{"jujutsu-system":{advancementOrigin:"oldActor.oldGrant",advancementRoot:"oldActor.oldGrant"}},system:{advancement:{nested:{_id:"nested",type:"ItemGrant",level:0,configuration:{items:[{uuid:"Compendium.test.Item.weapon"}]}}}}};
  const weapon={uuid:"Compendium.test.Item.weapon",type:"weapon",name:"Arma",system:{activities:{attack:{type:"attack"}}},effects:[{name:"Efeito"}]};
  origin.system.advancement={originGrant:{_id:"originGrant",type:"ItemGrant",level:0,configuration:{items:[{uuid:benefit.uuid}]},value:{added:{stale:"Item.old"}}}};
  combat.system.advancement={future:{_id:"future",type:"ItemGrant",level:2,configuration:{items:[{uuid:"Item.future"}]}}};
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{idFactory:f.idFactory,resolve:async uuid=>[origin,combat,benefit,weapon].find(d=>d.uuid===uuid)});
  const race=plan.create.find(d=>d.type==="race"),feat=plan.create.find(d=>d.type==="feat"),gear=plan.create.find(d=>d.type==="weapon"),cls=plan.create.find(d=>d.type==="class");
  assert.deepEqual(race.system.advancement.originGrant.value.added,{[feat._id]:benefit.uuid});
  for(const scope of ["jujutsu-system","JujutsuLegacy"]){
    assert.equal(feat.flags[scope].advancementOrigin,`${race._id}.originGrant`);
    assert.equal(gear.flags[scope].advancementOrigin,`${feat._id}.nested`);
    assert.equal(gear.flags[scope].advancementRoot,`${race._id}.originGrant`);
  }
  assert.equal(plan.actor["system.details.originalClass"],cls._id);
  assert.equal(gear.system.activities.attack.type,"attack");assert.equal(gear.effects.length,1);
  assert.equal(plan.create.length,4);
});

test("a wholly optional grant is left for the advancement choices rather than silently granted",async()=>{
  const f=fixture(),origin=structuredClone(species);
  origin.system.advancement={optional:{_id:"optional",type:"ItemGrant",level:0,configuration:{optional:true,items:[{uuid:"Item.optional",optional:false}]}}};
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:f.resolve,idFactory:f.idFactory});
  // Resolve the changed source, with an unavailable optional reference.
  const changed=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:async uuid=>uuid===origin.uuid?origin:f.resolve(uuid),idFactory:f.idFactory});
  assert.equal(plan.create.length,2);assert.equal(changed.create.length,2);
});

test("advancement cancellation leaves the empty character unchanged and can be retried",async()=>{
  const f=fixture();let commits=0,choices=0;
  f.actor.performBulkUpdate=async()=>{commits++;};
  const options={resolve:f.resolve,idFactory:f.idFactory,advance:async(_actor,plan)=>{choices++;return choices===1?null:plan;}};
  assert.equal(await completion.commitCreation(f.actor,f.draft,f.catalog,options),null);
  assert.equal(commits,0);assert.equal(f.actor.items.length,0);
  assert(await completion.commitCreation(f.actor,f.draft,f.catalog,options));assert.equal(commits,1);
});

test("combat style grants apply at level one, excluding multiclass-only and later benefits",async()=>{
  const f=fixture(),combat=structuredClone(style),feature={uuid:"Item.combat",name:"Estilo inicial",type:"feat",system:{}};
  combat.system.advancement={first:{_id:"first",type:"ItemGrant",level:1,configuration:{items:[{uuid:feature.uuid}]}},secondary:{_id:"secondary",type:"ItemGrant",level:1,classRestriction:"secondary",configuration:{items:[{uuid:"Item.multiclass"}]}},future:{_id:"future",type:"ItemGrant",level:2,configuration:{items:[{uuid:"Item.future"}]}}};
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{idFactory:f.idFactory,resolve:async uuid=>[species,combat,feature].find(d=>d.uuid===uuid)});
  const ownedStyle=plan.create.find(d=>d.type==="class"),feat=plan.create.find(d=>d.type==="feat");
  assert.equal(plan.create.length,3);assert.deepEqual(ownedStyle.system.advancement.first.value.added,{[feat._id]:feature.uuid});
  assert.equal(feat.flags["jujutsu-system"].advancementRoot,`${ownedStyle._id}.first`);
});

test("a broken mandatory reference or grant cycle fails before any actor write",async()=>{
  const f=fixture(),origin=structuredClone(species);
  origin.system.advancement={grant:{_id:"grant",type:"ItemGrant",configuration:{items:[{uuid:"Item.missing"}]}}};
  const options={idFactory:f.idFactory,resolve:async uuid=>uuid===origin.uuid?origin:f.resolve(uuid)};
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,options),/não está mais disponível/);
  origin.system.advancement.grant.configuration.items=[{uuid:origin.uuid}];
  await assert.rejects(completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,options),/circular/);
  assert.equal(f.actor.items.length,0);
});

test("a failed native commit unlocks retry, and concurrent item additions are never overwritten",async()=>{
  const f=fixture();let attempts=0;
  const options={resolve:f.resolve,idFactory:f.idFactory,advance:async(_actor,plan)=>plan};
  f.actor.performBulkUpdate=async()=>{if(++attempts===1)throw new Error("Falha de gravação");};
  await assert.rejects(completion.commitCreation(f.actor,f.draft,f.catalog,options),/Falha de gravação/);
  assert(await completion.commitCreation(f.actor,f.draft,f.catalog,options));assert.equal(attempts,2);
  await assert.rejects(completion.commitCreation(f.actor,f.draft,f.catalog,{...options,advance:async(_actor,plan)=>{f.actor.items.push({});return plan;}}),/alterada durante/);
  assert.equal(attempts,2);
});

test("mandatory spell grants apply the authored native spell configuration",async()=>{
  const f=fixture(),combat=structuredClone(style),spell={uuid:"Item.spell",name:"Feitiço inicial",type:"spell",system:{uses:{max:""}}};
  combat.system.advancement={spells:{_id:"spells",type:"ItemGrant",level:1,configuration:{items:[{uuid:spell.uuid}]}}};
  const spellConfig={ability:new Set(["wis"]),applySpellChanges(data,{ability}){
    data.system.ability=ability;data.system.uses={max:"2",spent:0};
  }};
  const doc={...combat,toObject:()=>combat,advancement:{byId:{spells:{configuration:{spell:spellConfig}}}}};
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{idFactory:f.idFactory,resolve:async uuid=>uuid===combat.uuid?doc:uuid===spell.uuid?spell:f.resolve(uuid)});
  const ownedSpell=plan.create.find(d=>d.type==="spell"),ownedClass=plan.create.find(d=>d.type==="class");
  assert.equal(ownedSpell.system.ability,"wis");assert.equal(ownedSpell.system.uses.max,"2");
  assert.equal(ownedClass.system.advancement.spells.value.ability,"wis");
});

test("the initial plan transfers refinement from the reserve and starts Restringido with stamina",async()=>{
  const f=fixture();
  const plan=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{resolve:f.resolve,idFactory:f.idFactory});
  assert.equal(plan.actor["system.energy.generated"],2);assert.equal(plan.actor["system.energy.total"],8);
  const restricted=structuredClone(style);restricted.name="Restringido";restricted.system.identifier="restringido";
  restricted.flags["jujutsu-system"].legacy2.energiaBase=null;
  const native=await completion.prepareCreationCompletion(f.actor,f.draft,f.catalog,{idFactory:f.idFactory,resolve:async uuid=>uuid===restricted.uuid?restricted:f.resolve(uuid)});
  assert.equal(native.actor["system.energy.generated"],8);assert.equal(native.actor["system.energy.total"],0);
});
