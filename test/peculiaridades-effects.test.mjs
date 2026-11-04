import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const api = await import("../module/systems/peculiaridades-effects.mjs").catch(error => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {}; throw error;
});
const blueprint = JSON.parse(await fs.readFile(new URL("../packs/_source/personalizacao-2-0.json", import.meta.url), "utf8"));
const changes = effect => effect.system?.changes ?? effect.changes ?? [];
const feat = (name, effects=[]) => ({ _id: "peculiarItem1234", name, type: "feat", img: "icons/test.webp",
  system: { description: { value: "Regra original." } }, flags: { "jujutsu-system": { featureSection: "jj-peculiarities" } }, effects });
const oldEffect = (name, entries, disabled=false) => ({ _id: "oldEffect1234567", name: `Peculiaridade: ${name}`, type: "base", disabled, transfer: true,
  system: { changes: entries.map(([key,value]) => ({ key, value, type: "add", phase: "initial", priority: null })) } });
function plan(item) { assert.equal(typeof api.peculiarityEffectPlan, "function"); return api.peculiarityEffectPlan(item); }

test("fixed grants target real native fields and the Constitution cap is a downgrade", () => {
  for (const [name, expected] of [
    ["Sede De Sangue Imposta", [["system.legacy2.pvEspecie",1],["system.abilities.cha.value",1]]],
    ["Caçador Sombrio", [["system.abilities.int.value",1],["system.legacy2.especiaisExtra",2],["system.legacy2.skills.arc",2]]]
  ]) assert.deepEqual(changes(plan(feat(name)).effects[0]).map(c=>[c.key,c.value]),expected);
  const limited = changes(plan(feat("Físico Limitado")).effects[0]);
  assert.ok(limited.some(c=>c.key==="system.abilities.con.value"&&c.type==="downgrade"&&c.value===10));
  assert.equal(limited.filter(c=>/abilities\.(int|wis)/.test(c.key)).length,0,"the unchosen attribute must not be invented");
  const reminder = changes(plan(feat("Lembrete Sombrio")).effects[0]);
  for (const scope of ["ability.check","ability.save","attack"])
    assert.ok(reminder.some(c=>c.key===`system.rolls.${scope}.bonus`&&c.value===-1));
});

test("legacy corrections retain IDs, disabled effects and separate manual effects without stacking", () => {
  const name="Sede De Sangue Imposta", manual={_id:"manualEffect1234",name:"Ajuste do mestre",system:{changes:[{key:"system.attributes.ac.bonus",type:"add",value:2}]}};
  const original=feat(name,[oldEffect(name,[["system.legacy2.pvEspecie",1],["system.abilities.pre.value",1]],true),manual]);
  const result=plan(original);
  assert.equal(result.effects.length,2);assert.equal(result.effects[0]._id,"oldEffect1234567");assert.equal(result.effects[0].disabled,true);
  assert.deepEqual(result.effects[1],manual);assert.ok(!changes(result.effects[0]).some(c=>c.key.includes(".pre.")));
  assert.deepEqual(plan({...original,...result}),result);
  const edited=structuredClone(original);edited.effects[0].system.changes[0].value=9;
  assert.deepEqual(plan(edited).effects,edited.effects,"edited grants are not overwritten or duplicated");
});

test("native change IDs and initialized metadata are retained on repeated reconciliation",()=>{
  const original=feat("Caçador Sombrio",[oldEffect("Caçador Sombrio",[["system.abilities.int.value",1],["system.legacy2.especiaisExtra",2]])]);
  original.effects[0].system.changes.forEach((change,index)=>Object.assign(change,{_id:`changeId0000000${index}`,conditions:"{}",replacement:""}));
  const result=plan(original);
  assert.equal(changes(result.effects[0])[0]._id,"changeId00000000");
  assert.ok(changes(result.effects[0]).every(c=>c._id?.length===16&&c.conditions==="{}"&&c.replacement===""));
  assert.deepEqual(plan({...original,...result}),result);
});

test("renamed legacy effects are repaired in place and ambiguous duplicate grants are left untouched",()=>{
  const name="Sede De Sangue Imposta",original=feat(name,[oldEffect(name,[["system.legacy2.pvEspecie",1],["system.abilities.pre.value",1]])]);
  original.effects[0].name="Meu ajuste";
  const result=plan(original);assert.equal(result.effects.length,1);assert.equal(result.effects[0]._id,original.effects[0]._id);
  assert.equal(result.effects[0].name,"Meu ajuste");assert.equal(changes(result.effects[0]).filter(c=>c.key==="system.legacy2.pvEspecie").length,1);
  const duplicated=structuredClone(original);duplicated.effects.push({...structuredClone(original.effects[0]),_id:"duplicatedEffect"});
  assert.deepEqual(plan(duplicated).effects,duplicated.effects,"ambiguous duplicates require a manual decision rather than a third grant");
});

test("Lembrete's native global check penalty reaches the actual 2.0 initiative config exactly once",async()=>{
  const source=await fs.readFile(new URL("../module/documents/actor/actor.mjs",import.meta.url),"utf8");
  const body=source.match(/getInitiativeRollConfig\(options=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  const Ruleset=(await import("../module/systems/ruleset.mjs")).default;
  const {applyLegacy2TestRoll}=await import("../module/applications/dice/legacy2-test-roll.mjs");
  globalThis.game={settings:{get:(_,key)=>key==="rulesetVersion"?"2.0":false},user:{targets:new Set()}};
  globalThis.CONFIG={DND5E:{defaultAbilities:{initiative:"dex"}},Dice:{D20Roll:{ADV_MODE:{ADVANTAGE:1,DISADVANTAGE:-1},
    constructParts:(parts,data)=>({parts:Object.keys(parts).filter(k=>parts[k]!==null).map(k=>`@${k}`),data:{...data,...parts}})}}};
  globalThis.foundry={utils:{mergeObject:(a,b)=>({...a,...b})}};globalThis.Hooks={callAll(){}};
  const model={abilities:{dex:{value:4},int:{value:4}},attributes:{init:{prof:{multiplier:0,hasProficiency:false}}},rolls:{ability:{check:{bonus:-1}}}};
  const run=new Function("Ruleset","D20RollModificationField","applyLegacy2TestRoll","_loc",`return function(options={}){${body}}`)(Ruleset,
    {combineFields(system,paths){return {bonus:paths.reduce((sum,path)=>sum+(Number(path.split(".").reduce((o,k)=>o?.[k],system)?.bonus)||0),0)};}},applyLegacy2TestRoll,key=>key);
  const a={type:"character",system:model,flags:{},items:[],getRollData:()=>({roll:{}}),addConditionRollReduction(){}};
  const config=run.call(a);assert.equal(config.data.ruleBonus,-1);assert.equal(config.data.mod,4);
  assert.equal(config.parts.filter(part=>part==="@ruleBonus").length,1);
});

test("2.0 peculiarity effects are suppressed in 1.0 without changing their enabled state", async()=>{
  assert.equal(typeof api.peculiarityEffectSuppressed,"function");
  const effect={item:feat("Sede De Sangue Imposta"),disabled:false};
  assert.equal(api.peculiarityEffectSuppressed(effect,"1.0"),true);
  assert.equal(api.peculiarityEffectSuppressed(effect,"2.0"),false);assert.equal(effect.disabled,false);
  effect.item.flags["jujutsu-system"].featureSection="jj-cursed-benefits";
  assert.equal(api.peculiarityEffectSuppressed(effect,"1.0"),false);
  const source=await fs.readFile(new URL("../module/documents/active-effect.mjs",import.meta.url),"utf8");
  const body=source.match(/get isSuppressed\(\) \{([\s\S]*?)\n  \}/)[1];
  const {sizeGrappleEffectImmune}=await import("../module/systems/legacy2-size.mjs");
  const Boundary=new Function("Base","peculiarityEffectSuppressed","sizeGrappleEffectImmune",`return class extends Base {get isSuppressed(){${body}}}`)(class{get isSuppressed(){return false;}},e=>api.peculiarityEffectSuppressed(e,"1.0"),sizeGrappleEffectImmune);
  const actual=Object.assign(new Boundary(),{item:feat("Sede De Sangue Imposta"),system:{},type:"base"});
  assert.equal(actual.isSuppressed,true);
});

test("standalone Desejo Sombrio penalties also stay dormant in rules 1.0", () => {
  const effect = { disabled: false, flags: { "jujutsu-system": { desejoSombrioPenalidade: true } } };
  assert.equal(api.peculiarityEffectSuppressed(effect, "1.0"), true);
  assert.equal(api.peculiarityEffectSuppressed(effect, "2.0"), false);
  assert.equal(effect.disabled, false);
});

test("world migration changes only proven compendium copies and never writes the source pack", async () => {
  assert.equal(typeof api.refreshPeculiarityEffects,"function");
  const source=feat("Caçador Sombrio",[oldEffect("Caçador Sombrio",[["system.abilities.int.value",1],["system.legacy2.especiaisExtra",2]])]);
  source.uuid="Compendium.jujutsu-compendium.geral-2-0.Item.sourcePeculiar12";
  source.update=()=>assert.fail("must never write the live pack");
  const writes=[];
  const copy=id=>({ ...structuredClone({...source,update:undefined}),_id:id,_stats:{compendiumSource:source.uuid},
    toObject(){const {update,toObject,...data}=this;return structuredClone(data);},async update(data){this.effects=data.effects;this.flags["jujutsu-system"].peculiarityAutomation=data["flags.jujutsu-system.peculiarityAutomation"];this.flags["jujutsu-system"].peculiaridade=data["flags.jujutsu-system.peculiaridade"];writes.push(id);} });
  const actorCopy=copy("actor"),tokenCopy=copy("token"),edited=copy("edited"),manual=copy("manual");
  edited.system.description.value="Regra alterada";delete manual._stats;
  const world={settings:{get:()=>"2.0"},user:{id:"gm",isGM:true},users:{activeGM:{id:"gm"}},
    packs:new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>[source]}]]),items:[edited,manual],
    actors:[{items:[actorCopy]}],scenes:new Map([["scene",{tokens:[{actorLink:false,actor:{items:[tokenCopy]}}]}]])};
  await api.refreshPeculiarityEffects(world);assert.deepEqual(writes,["actor","token"]);
  await api.refreshPeculiarityEffects(world);assert.equal(writes.length,2);
});

test("a player can import corrected grants after ready, and the GM reconciles an import while its source cache loads",async()=>{
  const source=feat("Caçador Sombrio",[oldEffect("Caçador Sombrio",[["system.abilities.int.value",1],["system.legacy2.especiaisExtra",2]])]);
  source.uuid="Compendium.jujutsu-compendium.geral-2-0.Item.playerSource1234";
  const callbacks=new Map(), hooks={once:(name,fn)=>callbacks.set(name,fn),on:(name,fn)=>callbacks.set(name,fn)};
  const world={settings:{get:()=>"2.0"},user:{id:"player",isGM:false},users:{activeGM:{id:"gm"}},
    packs:new Map([["jujutsu-compendium.geral-2-0",{getDocuments:async()=>[source]}]]),items:[],actors:[],scenes:[]};
  globalThis.game=world;api.registerPeculiarityEffectHooks(hooks);
  await callbacks.get("dnd5e.ready")();
  const raw={...structuredClone(source),_stats:{compendiumSource:source.uuid}},copy={toObject:()=>structuredClone(raw),updateSource(data){Object.assign(raw,data);}};
  callbacks.get("preCreateItem")(copy,raw);
  assert.ok(raw.effects.flatMap(changes).some(c=>c.key==="system.legacy2.skills.arc"));
  let release;const loading=new Promise(resolve=>{release=resolve;});
  const gmWorld={...world,user:{id:"gm",isGM:true},packs:new Map([["jujutsu-compendium.geral-2-0",{getDocuments:()=>loading}]])};
  globalThis.game=gmWorld;
  const imported={...structuredClone(source),_stats:{compendiumSource:source.uuid}},writes=[];
  const document={toObject:()=>structuredClone(imported),update:async data=>writes.push(data)};
  assert.equal(typeof callbacks.get("createItem"),"function");
  const pending=callbacks.get("createItem")(document);release([source]);await pending;
  assert.equal(writes.length,1);assert.ok(writes[0].effects.flatMap(changes).some(c=>c.key==="system.legacy2.skills.arc"));
});

test("blueprint and import macro retain corrected effects", async () => {
  const source=blueprint.peculiaridades.find(p=>p.name==="Sede De Sangue Imposta");
  assert.ok(source.effects.flatMap(changes).some(c=>c.key==="system.abilities.cha.value"));
  assert.ok(!source.effects.flatMap(changes).some(c=>c.key==="system.abilities.pre.value"));
  const generator=await fs.readFile(new URL("../utils/gera-personalizacao.cjs",import.meta.url),"utf8");
  assert.match(generator,/effects:\s*dado\.effects/);
  assert.match(generator,/preservarEfeitos/);
});

test("the generator preserves authored and disabled effects in an isolated fixture", async()=>{
  const directory=await fs.mkdtemp(path.join(tmpdir(),"jj-pec-generator-"));
  try {
    await fs.mkdir(path.join(directory,"packs/_source/_geral-1-0"),{recursive:true});
    await fs.symlink(fileURLToPath(new URL("../node_modules",import.meta.url)),path.join(directory,"node_modules"),"junction");
    const effect=oldEffect("Sede De Sangue Imposta",[["system.abilities.cha.value",1]],true);
    await fs.writeFile(path.join(directory,"packs/_source/defeitos-paste.json"),JSON.stringify({defeitos:[],peculiaridades:[{nome:"Sede De Sangue Imposta",texto:"Texto novo."}]}));
    await fs.writeFile(path.join(directory,"packs/_source/personalizacao-2-0.json"),JSON.stringify({defeitos:[],peculiaridades:[feat("Sede De Sangue Imposta",[effect])],modificadores:[],penalidadesVariantes:[]}));
    execFileSync(process.execPath,[fileURLToPath(new URL("../utils/gera-personalizacao.cjs",import.meta.url))],{cwd:directory});
    const generated=JSON.parse(await fs.readFile(path.join(directory,"packs/_source/personalizacao-2-0.json"),"utf8"));
    assert.deepEqual(generated.peculiaridades[0].effects,[effect]);
    const macro=await fs.readFile(path.join(directory,"packs/_source/importar-personalizacao-macro.txt"),"utf8");
    assert.match(macro,/effects:\s*dado\.effects/);assert.match(macro,/system\.abilities\.cha\.value/);
  } finally {
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("jj-pec-generator-"));
    await fs.rm(directory,{recursive:true,force:true});
  }
});
