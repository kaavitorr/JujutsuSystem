import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const api = await import("../module/systems/seres-amaldicoados-1.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
let edition = "1.0";
globalThis.game = { settings: { get: () => edition } };
const NS = "jujutsu-system";
const actor = (rules={}, extra={}) => ({ type: "character", system: { details: { level: 10 },
  energy: { bonuses: {}, intensiveTraining: {} }, curseResources: { cursePoints: 4, trainingPoints: 2 } },
  flags: { [NS]: { cursedBenefits1: rules } }, ...extra });
const item = identifier => ({ _id: "benefitItem00001", type: "feat", name: identifier, img: "icons/test.webp",
  system: { identifier }, effects: [], flags: { [NS]: { seresAmaldicoados1: { ruleset: "1.0", kind: "benefit" } } } });
const call = (name, ...args) => { assert.equal(typeof api[name], "function", name); return api[name](...args); };

test("benefits own transferable effects and retain user effects and disabled state on repeated upgrades", () => {
  const source = item("pontos-de-maldicao");
  source.effects.push({ _id: "manualEffect0001", name: "Ajuste do narrador", system: { changes: [] } });
  const plan = call("benefitEffectPlan1", source);
  assert.equal(plan.effects.length, 2);
  assert.deepEqual(plan.effects[0], source.effects[0]);
  const effect = plan.effects[1];
  assert.equal(effect.transfer, true); assert.equal(effect.type, "base");
  assert.deepEqual(effect.system.changes.map(x => [x.key, x.value]), [[`flags.${NS}.cursedBenefits1.cursePoints`, 1]]);
  effect.disabled = true;
  const again = call("benefitEffectPlan1", { ...source, ...plan });
  assert.deepEqual(again, plan);
});

test("ordinary flaws and similarly named custom items do not acquire cursed benefits", () => {
  assert.equal(call("benefitEffectPlan1", { ...item("pontos-de-maldicao"), flags: {} }), null);
  const curse = item("vida-adicional"); curse.flags[NS].seresAmaldicoados1.kind = "curse";
  assert.equal(call("benefitEffectPlan1", curse), null);
});

test("level bonuses cap each repeatable benefit at five and edition 2.0 receives none", () => {
  const a = actor({ cursePoints: 8, trainingPoints: 6, hitPoints: 7 });
  assert.equal(call("cursedBenefitRules1", a).cursePoints, 5);
  assert.equal(call("cursedHitPointBonus1", a), 50);
  edition = "2.0";
  try { assert.equal(call("cursedHitPointBonus1", a), 0); assert.equal(call("cursedBenefitRules1", a).cursePoints, 0); }
  finally { edition = "1.0"; }
});

test("Energia Colossal replaces 20 per level with 30 and improves practice to seven without doubling other bonuses", () => {
  const a = actor({ colossal: 1 });
  a.system.energy.intensiveTraining.maxEnergy = 3;
  assert.equal(call("cursedEnergyFormula1", a, { bonus: 12 }), 333); // 300 + 3×7 + 12
  assert.equal(call("intensiveEnergyGain1", a), 7);
  assert.equal(call("cursedEnergyFormula1", actor(), { bonus: 12 }), 212);
  assert.equal(call("cursedEnergyFormula1", a, { enormous: true, bonus: 12 }), 442); // stronger replacement retained
});

test("Restrição Incompleta uses five energy per level with independent training and flat bonuses", () => {
  const a = actor({ incompleteRestriction: 1 });
  a.system.energy.intensiveTraining.maxEnergy = 2;
  assert.equal(call("cursedEnergyFormula1", a, { bonus: 4 }), 64);
  assert.equal(call("cursedEnergyFormula1", a, { enormous: true }), 70);
});

test("Alma resistance and surprise immunity are native traits and do not leak into 2.0", () => {
  const a = actor({ soulKnowledge: 1, anomalousBody: 1 });
  a.system.traits = { dr: { value: new Set(["fire"]) }, ci: { value: new Set(["poisoned"]) } };
  call("applyCursedBenefitTraits1", a);
  assert.deepEqual([...a.system.traits.dr.value], ["fire", "soul"]);
  assert.ok(a.system.traits.ci.value.has("surprised"));
  const vessel = actor({ destinedVessel: 1 }); vessel.system.traits = { dr: { value: new Set() }, ci: { value: new Set() } };
  call("applyCursedBenefitTraits1", vessel); assert.ok(vessel.system.traits.dr.value.has("soul"));
});

test("Receptáculo Destinado widens the primary Fulgor margin once without rewriting the manually configured base", () => {
  const a = actor({ destinedVessel: 2 });
  a.flags[NS].fulgorPrimaria = 20;
  assert.equal(call("cursedPrimaryMargin1", a, 20), 19);
  assert.equal(call("cursedPrimaryMargin1", a, 17), 16);
  assert.equal(a.flags[NS].fulgorPrimaria, 20);
  edition = "2.0";
  try { assert.equal(call("cursedPrimaryMargin1", a, 20), 20); }
  finally { edition = "1.0"; }
});

function applyResourceUpdate(a, update) {
  for (const [key, value] of Object.entries(update)) {
    const parts=key.split("."); let target=a;
    for (const part of parts.slice(0,-1)) target=target[part]??={};
    target[parts.at(-1)]=structuredClone(value);
  }
}

test("point grants award only the level difference and never reimburse spending when preparing again", () => {
  const a = actor({ cursePoints: 2, trainingPoints: 1 });
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  assert.equal(a.system.curseResources.cursePoints, 24);
  assert.equal(a.system.curseResources.trainingPoints, 12);
  a.system.curseResources.cursePoints -= 15;
  assert.deepEqual(call("cursedBenefitResourceUpdates1", a), {});
  a.system.details.level = 11;
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  assert.equal(a.system.curseResources.cursePoints, 11);
  assert.equal(a.system.curseResources.trainingPoints, 13);
  assert.deepEqual(call("cursedBenefitResourceUpdates1", a), {});
});

test("removing and re-adding a spent grant settles its deficit before awarding any new points", () => {
  const a = actor({ cursePoints: 1 });
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  a.system.curseResources.cursePoints = 1;
  a.flags[NS].cursedBenefits1.cursePoints = 0;
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  assert.equal(a.system.curseResources.cursePoints, 0);
  a.flags[NS].cursedBenefits1.cursePoints = 1;
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  assert.equal(a.system.curseResources.cursePoints, 1);
});

test("switching editions removes only granted points and restores the balance without reissuing spent points", () => {
  const a = actor({ cursePoints: 1, trainingPoints: 1 });
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  a.system.curseResources.cursePoints = 3;
  a.system.curseResources.spentTrainingPoints = 7;
  edition = "2.0";
  try { applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a)); assert.equal(a.system.curseResources.cursePoints, 0); assert.equal(a.system.curseResources.trainingPoints, 2); }
  finally { edition = "1.0"; }
  applyResourceUpdate(a, call("cursedBenefitResourceUpdates1", a));
  assert.equal(a.system.curseResources.cursePoints, 3);
  assert.equal(a.system.curseResources.trainingPoints-a.system.curseResources.spentTrainingPoints, 5);
});

test("narrative benefits do not automatically grant levels, reveal creatures, or fabricate attribute choices", () => {
  for (const key of ["reencarnacao-em-objeto-amaldicoado", "energia-amaldicoada-variante"]) {
    const plan = call("benefitEffectPlan1", item(key));
    assert.deepEqual(plan.effects, []);
    assert.ok(plan.flags[NS].cursedBenefitAutomation1.manual.length);
  }
});

test("the real energy calculator uses the same 1.0 maximum as the sheet", async () => {
  const { EnergySystem } = await import("../module/systems/energy.mjs");
  const a = actor({ colossal: 1 }); a.system.energy.intensiveTraining.maxEnergy=3;
  a.system.energy.bonuses={overall:"9",level:"2",temp:3};
  assert.equal(EnergySystem.calculateMaxPA(a),353); // 300 + 21 + 9 + 20 + 3
});

const runtime = await import("../module/systems/seres-amaldicoados-1-hooks.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
test("existing compendium copies gain managed effects once while edited descriptions and user effects survive", async () => {
  assert.equal(typeof runtime.refreshCursedBenefitEffects1,"function");
  const source=item("vida-adicional"); source.uuid="Compendium.jujutsu-compendium.geral.Item.source000000001";
  source.system.description={value:"Regra oficial"};
  let writes=0;
  const makeCopy=(id,description)=>({ ...structuredClone(source), _id:id, system:{...source.system,description:{value:description}},
    _stats:{compendiumSource:source.uuid},effects:[{_id:"manualEffect0001",name:"Manual",system:{changes:[]}}],
    toObject(){return {_id:this._id,type:this.type,name:this.name,img:this.img,system:this.system,flags:this.flags,effects:this.effects};},
    async update(update){this.effects=structuredClone(update.effects);this.flags[NS].cursedBenefitAutomation1=update[`flags.${NS}.cursedBenefitAutomation1`];writes++;} });
  const copy=makeCopy("copy00000000001","Regra oficial"),edited=makeCopy("edited000000001","Regra do narrador");
  const world={user:{isGM:true,id:"gm"},users:{activeGM:{id:"gm"}},packs:new Map([["jujutsu-compendium.geral",{getDocuments:async()=>[source]}]]),
    items:[],actors:[{items:[copy,edited]}],scenes:new Set()};
  await runtime.refreshCursedBenefitEffects1(world);
  assert.equal(writes,1);assert.equal(copy.effects.length,2);assert.equal(copy.effects[0].name,"Manual");
  copy.effects[1].disabled=true;
  await runtime.refreshCursedBenefitEffects1(world);assert.equal(writes,1);assert.equal(copy.effects[1].disabled,true);
});

test("Perito em Fuga is granted once and an already owned copy is never duplicated or removed", async () => {
  assert.equal(typeof runtime.syncCursedBenefitGrantedItems1,"function");
  const a=actor({incompleteRestriction:1}); a.items=[];
  const source={_id:"sourcePerito0001",name:"Perito em Fuga",type:"feat",system:{identifier:"perito-em-fuga",description:{value:"Regra"}},effects:[]};
  const world={packs:new Map([["jujutsu-compendium.geral",{getDocument:async()=>({toObject:()=>structuredClone(source)})}]])};
  let creates=0,deletes=0;
  a.createEmbeddedDocuments=async(type,docs)=>{creates++;a.items.push(...docs.map(d=>({...d,id:"granted00000001"})));};
  a.deleteEmbeddedDocuments=async(type,ids)=>{deletes++;a.items=a.items.filter(i=>!ids.includes(i.id));};
  await runtime.syncCursedBenefitGrantedItems1(a,world);await runtime.syncCursedBenefitGrantedItems1(a,world);
  assert.equal(creates,1);assert.equal(a.items[0].name,"Perito em Fuga");
  a.flags[NS].cursedBenefits1.incompleteRestriction=0;
  await runtime.syncCursedBenefitGrantedItems1(a,world);assert.equal(deletes,1);assert.equal(a.items.length,0);
  a.items.push({...source,id:"manual000000001"});a.flags[NS].cursedBenefits1.incompleteRestriction=1;
  await runtime.syncCursedBenefitGrantedItems1(a,world);assert.equal(creates,1);
  a.flags[NS].cursedBenefits1.incompleteRestriction=0;
  await runtime.syncCursedBenefitGrantedItems1(a,world);assert.equal(deletes,1);assert.equal(a.items.length,1);
});

test("reduced eyes opening charges exactly one 2d8 damage and repeated time events do not double-charge", async () => {
  assert.equal(typeof runtime.payReducedEyesPenalty1,"function");
  const a=actor({reducedEyesPenalty:1,sixEyes:1});a.flags[NS].seisOlhosMode="full";a.system.attributes={hp:{value:50}};
  const rolled=[];globalThis.Roll=class {constructor(formula){rolled.push(formula);}async evaluate(){this.total=9;return this;}async toMessage(){}};
  globalThis.ChatMessage={getSpeaker:()=>({})};
  a.update=async update=>applyResourceUpdate(a,update);
  await runtime.payReducedEyesPenalty1(a,{start:true,now:10});
  assert.equal(a.system.attributes.hp.value,41);assert.deepEqual(rolled,["2d8"]);
  await runtime.payReducedEyesPenalty1(a,{now:609});assert.equal(a.system.attributes.hp.value,41);
  await Promise.all([runtime.payReducedEyesPenalty1(a,{now:610}),runtime.payReducedEyesPenalty1(a,{now:610})]);
  assert.equal(a.system.attributes.hp.value,32);assert.deepEqual(rolled,["2d8","2d8"]);
});

test("an effective Fulgor margin is excluded from the native autosave form, preventing compounding on unrelated edits", () => {
  for(const file of ["character-sidebar.hbs","tabs/character-effects-2.hbs"]){
    const source=readFileSync(new URL(`../templates/actors/${file}`,import.meta.url),"utf8");
    assert.ok(!/<input\b[^>]*name="flags\.jujutsu-system\.fulgorPrimaria"/.test(source),file);
  }
});

test("reduced eyes never keep damaging an actor after its actual Six Eyes ability is removed", () => {
  const a=actor({reducedEyesPenalty:1});a.flags[NS].seisOlhosMode="full";a.flags[NS].cursedEyesLast1=0;
  assert.equal(call("reducedEyesSchedule1",a,600).charges,0);
});

test("adding the reduction while already in full mode starts its clock and removing Six Eyes clears it", async () => {
  assert.equal(typeof runtime.syncCursedBenefitClock1,"function");
  const a=actor({reducedEyesPenalty:1,sixEyes:1});a.flags[NS].seisOlhosMode="full";
  a.update=async update=>{for(const [key,value]of Object.entries(update)){
    if(key.endsWith(".-=cursedEyesLast1"))delete a.flags[NS].cursedEyesLast1;
    else applyResourceUpdate(a,{[key]:value});
  }};
  await runtime.syncCursedBenefitClock1(a,{time:{worldTime:50}});
  assert.equal(a.flags[NS].cursedEyesLast1,50);
  assert.equal(call("reducedEyesSchedule1",a,650).charges,1);
  a.flags[NS].cursedBenefits1.sixEyes=0;
  await runtime.syncCursedBenefitClock1(a,{time:{worldTime:650}});
  assert.equal(a.flags[NS].cursedEyesLast1,undefined);
});

test("synthetic resource balances receive their own grant before inheriting the base actor ledger", async () => {
  assert.equal(typeof runtime.syncCursedBenefits1,"function");
  const base=actor({cursePoints:1}),synthetic=actor({cursePoints:1});
  base.id="baseActor";base.items=[];synthetic.isToken=true;synthetic.items=[];
  synthetic.system.curseResources.cursePoints=3;
  let ownLedger;
  Object.defineProperty(synthetic.flags[NS],"cursedBenefitGrants1",{get:()=>ownLedger??base.flags[NS].cursedBenefitGrants1,set:value=>{ownLedger=value;},configurable:true});
  for(const a of [base,synthetic])a.update=async update=>applyResourceUpdate(a,update);
  const token={actorLink:false,baseActor:base,actor:synthetic};synthetic.token=token;
  const world={actors:new Set([base]),scenes:new Set([{tokens:new Set([token])}]),time:{worldTime:0}};
  await runtime.syncCursedBenefits1(base,world);
  assert.equal(base.system.curseResources.cursePoints,14);
  assert.equal(synthetic.system.curseResources.cursePoints,13);
  assert.ok(ownLedger);
  await runtime.syncCursedBenefits1(base,world);
  assert.equal(synthetic.system.curseResources.cursePoints,13);
});

test("the production character preparation applies level HP bonuses while respecting a manual maximum", () => {
  Math.clamp??=(value,min,max)=>Math.min(max,Math.max(min,value));
  globalThis.CONFIG={DND5E:{defaultAbilities:{hitPoints:"con"}}};
  const source=readFileSync(new URL("../module/data/actor/character.mjs",import.meta.url),"utf8");
  const body=source.match(/  prepareDerivedData\(\) \{([\s\S]*?)\n  \}/)[1];
  const attributesSource=readFileSync(new URL("../module/data/actor/templates/attributes.mjs",import.meta.url),"utf8");
  const hpBody=attributesSource.match(/static prepareHitPoints\(hp, \{ advancement=\[\], mod=0, bonus=0 \}=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const hitPoints=new Function(`return function(hp,{advancement=[],mod=0,bonus=0}={}){${hpBody}}`)();
  const attributes=new Proxy({prepareHitPoints:hitPoints},{get:(object,key)=>object[key]??(()=>{})});
  const prepare=new Function("AttributesFields","TraitsFields","simplifyBonus","Ruleset","applyCursedBenefitTraits1","cursedHitPointBonus1","cursedEnergyFormula1",`return function(){${body}\n}`)(
    attributes,new Proxy({},{get:()=>()=>{}}),value=>Number(value)||0,{isV2:()=>false},api.applyCursedBenefitTraits1,api.cursedHitPointBonus1,api.cursedEnergyFormula1);
  for(const maximum of [null,120]){
    const a=actor({hitPoints:2,colossal:1});
    a.flags[NS].dominioExpandido=false;a.getFlag=()=>false;a.items=[];a.itemTypes={feat:[]};a.classes={style:{advancement:{byType:{HitPoints:[{getAdjustedTotal:()=>100}]}}}};
    a.getRollData=()=>({});a.getOriginalStats=()=>({});a.hasConditionEffect=()=>false;
    Object.assign(a.system,{parent:a,abilities:{con:{mod:0}},attributes:{hp:{max:maximum,value:5,bonuses:{level:"",overall:""}}},energyDice:{},
      energyAbilities:{accumulation:{}},manipulation:{},masteryPoints:0,trainings:{},armorPoints:{value:0},
      prepareAbilities(){},prepareCurrency(){},prepareSkills(){},prepareTools(){}});
    a.system.energy.generation={};
    prepare.call(a.system);
    assert.equal(a.system.attributes.hp.max,120);
    assert.equal(a.system.attributes.hp.value,5,"gaining a maximum never heals current HP");
    assert.equal(a.system.energy.max,300);
  }
});

test("custom typed damage uses native Alma resistance before consuming defenses and hit points", async () => {
  globalThis.Hooks??={on(){},call:()=>true,callAll(){}};
  globalThis.ChatMessage={getSpeaker:()=>({}),create:async()=>{}};
  globalThis.ui={notifications:{warn(){},info(){}}};
  const {applyDamageToActor}=await import("../module/applications/actor/jj/damage-application.mjs");
  const a=actor({soulKnowledge:1});a.name="Alvo";a.system.attributes={hp:{value:100,temp:0}};a.system.armorPoints={value:0};
  let calculations=0;
  a.getFlag=()=>undefined;a.update=async update=>applyResourceUpdate(a,update);
  a.calculateDamage=parts=>{calculations++;return {amount:parts.reduce((sum,p)=>sum+(p.type==="soul"?Math.floor(p.value/2):p.value),0)};};
  await applyDamageToActor(a,30,{damageTypes:["soul","fire"],damages:[{type:"soul",value:20},{type:"fire",value:10}]});
  assert.equal(calculations,1);assert.equal(a.system.attributes.hp.value,80);
});

test("the real Fulgor listener stores its base once and displays the benefit without a permanent reduction", async () => {
  globalThis.Hooks??={on(){}};
  const {setupFulgorNegro,getFulgorPrimaria}=await import("../module/applications/actor/jj/fulgor-negro.mjs");
  const a=actor({destinedVessel:1});a.isOwner=true;a.flags[NS].fulgorPrimaria=20;
  a.getFlag=(scope,key)=>a.flags[scope][key];a.setFlag=async(scope,key,value)=>{a.flags[scope][key]=value;};
  let listener;
  const input={value:19,addEventListener(event,callback){listener=callback;}};
  const box={querySelector:selector=>selector==="[data-fulgor-primaria]"?input:null};
  setupFulgorNegro({querySelector:()=>box},a);
  for(let i=0;i<3;i++){input.value=19;await listener({stopPropagation(){}});assert.equal(a.flags[NS].fulgorPrimaria,20);assert.equal(getFulgorPrimaria(a),19);}
  a.flags[NS].cursedBenefits1.destinedVessel=0;
  assert.equal(getFulgorPrimaria(a),20);
});

test("the reduced eyes penalty is charged once on opening and once per complete ten minutes, across rounds", () => {
  const a=actor({reducedEyesPenalty:1,sixEyes:1}); a.flags[NS].seisOlhosMode="full";
  let schedule=call("reducedEyesSchedule1",a,100,{start:true});
  assert.deepEqual(schedule,{charges:1,last:100});
  a.flags[NS].cursedEyesLast1=100;
  assert.equal(call("reducedEyesSchedule1",a,699).charges,0);
  assert.deepEqual(call("reducedEyesSchedule1",a,700),{charges:1,last:700});
  assert.deepEqual(call("reducedEyesSchedule1",a,1305),{charges:2,last:1300});
  a.flags[NS].seisOlhosMode="sealed";
  assert.equal(call("reducedEyesSchedule1",a,1400).charges,0);
});

test("resource synchronization serializes repeated requests and writes no update after points were spent", async () => {
  const a=actor({cursePoints:1}); let writes=0;
  a.update=async update=>{await new Promise(resolve=>setTimeout(resolve,2));applyResourceUpdate(a,update);writes++;};
  assert.equal(typeof api.syncCursedBenefitResources1,"function");
  await Promise.all([api.syncCursedBenefitResources1(a),api.syncCursedBenefitResources1(a),api.syncCursedBenefitResources1(a)]);
  assert.equal(writes,1);assert.equal(a.system.curseResources.cursePoints,14);
  a.system.curseResources.cursePoints=0;
  await api.syncCursedBenefitResources1(a);assert.equal(writes,1);
});
