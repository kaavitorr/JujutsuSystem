import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { NPC_ABILITIES, validNpcScale, canCreateNpcProfiles, serializeNpcProfileCreation } from "../module/systems/legacy2-npc-profiles.mjs";
import { NUMERIC_DAMAGE_TYPES } from "../module/systems/legacy2-resistances.mjs";
import { SKILL_GROUPS } from "../module/systems/legacy2-skills.mjs";
import { ALTERNATIVE_SAVES } from "../module/systems/legacy2-alternative-saves.mjs";
import { NPC_MOVEMENT_TYPES } from "../module/systems/legacy2-npc-movement.mjs";

// Foundry is the framework boundary; evaluate the actual model/schema definitions.
class Field {constructor(options){Object.assign(this,options);}}
class SchemaField extends Field {constructor(fields){super({fields});}}
class ArrayField extends Field {constructor(element,options){super(options);this.element=element;}}
globalThis.foundry={data:{fields:{NumberField:Field,BooleanField:Field,StringField:Field,ArrayField,SchemaField}},utils:{mergeObject:(a,b)=>({...a,...b})}};
globalThis.ItemDataModel=class {
  static metadata={hasEffects:false};static mixin(){return this;}static defineSchema(){return {};}
  static mergeSchema(a,b){return Object.assign(a,b);}static _validateJoint(){}
  static validateJoint(data){this._validateJoint(data);}
  prepareDerivedData(){}prepareDescriptionData(){this.descriptionPrepared=true;}
};
Object.assign(globalThis,{NPC_ABILITIES,validNpcScale,NUMERIC_DAMAGE_TYPES,SKILL_GROUPS,ALTERNATIVE_SAVES,NPC_MOVEMENT_TYPES});
globalThis.ItemDescriptionTemplate={};
const source=readFileSync(new URL("../module/data/item/npc-profile.mjs",import.meta.url),"utf8").replace(/^import .*;\r?$/gm,"");
const {TaxonomyData,ArchetypeData}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test("registered profile models define six bounded integer fields with a valid default scale",()=>{
  for(const Model of [TaxonomyData,ArchetypeData]){
    const fields=Model.defineSchema().pesos.fields;
    assert.deepEqual(Object.keys(fields),NPC_ABILITIES);
    assert(Object.values(fields).every(field=>field.integer&&field.min===0&&field.max===12&&field.initial===2));
    assert.equal(Model.metadata.singleton,true);assert.equal(Model.metadata.hasEffects,false);
  }
  const taxonomy=TaxonomyData.defineSchema();assert.equal(taxonomy.vidaEnergia.initial,false);assert.equal(taxonomy.energiaBase.initial,10);
  assert.equal(ArchetypeData.defineSchema().energiaBase,undefined);
  const resistencias=TaxonomyData.defineSchema().resistencias.fields;
  assert.deepEqual(Object.keys(resistencias),NUMERIC_DAMAGE_TYPES.map(type=>type.key));
  assert.deepEqual(Object.keys(resistencias.fire.fields),["value","immune"]);
  assert(resistencias.fire.fields.value.integer&&resistencias.fire.fields.value.initial===0);
  assert(resistencias.fire.fields.immune.initial===false);
});
test("joint validation permits partial prevalidation and rejects invalid scales once merged with source",()=>{
  const valid={str:4,dex:2,con:3,int:1,wis:1,cha:1};
  assert.doesNotThrow(()=>TaxonomyData.validateJoint({pesos:valid}));
  assert.doesNotThrow(()=>TaxonomyData.validateJoint({pesos:{str:3}}));
  assert.throws(()=>TaxonomyData.validateJoint({pesos:{...valid,str:3}}),/12/);
  assert.throws(()=>ArchetypeData.validateJoint({pesos:{...valid,dex:2.5}}),/12/);
});
test("taxonomy saves initial movement by type; only archetypes define ND growth, its cap and equipment",()=>{
  const taxonomy=TaxonomyData.defineSchema(), archetype=ArchetypeData.defineSchema();
  assert.deepEqual(Object.keys(taxonomy.movimento.fields),NPC_MOVEMENT_TYPES.map(([key])=>key));
  assert.equal(taxonomy.movimento.fields.walk.min,0);assert.equal(taxonomy.movimento.fields.walk.initial,null);
  assert.equal(archetype.movimento.fields.intervalo.integer,true);assert.equal(archetype.movimento.fields.intervalo.min,1);
  assert.equal(archetype.movimento.fields.maximo.nullable,true);
  assert.equal(taxonomy.equipamentos,undefined);
  assert.deepEqual(Object.keys(archetype.equipamentos.fields),["armadura","armas"]);
});
test("both profile types persist bounded proficiency grants for every skill and each save rule",()=>{
  for(const Model of [TaxonomyData,ArchetypeData]){
    const fields=Model.defineSchema().proficiencias.fields;
    assert.equal(Object.keys(fields.skills.fields).length,15);
    assert(fields.skills.fields.ste);assert(fields.skills.fields.sur);
    assert.deepEqual(Object.keys(fields.saves.fields),["str","dex","con","int","wis","cha"]);
    assert.deepEqual(Object.keys(fields.alternativeSaves.fields),["fortitude","vontade","reflexo"]);
    for(const category of Object.values(fields))for(const field of Object.values(category.fields)){
      assert(field.integer);assert.equal(field.initial,0);assert.equal(field.min,0);assert.equal(field.max,4);
    }
  }
});
test("both profile types persist independent nullable priority orders, including an explicitly empty list",()=>{
  for(const Model of [TaxonomyData,ArchetypeData]){
    const fields=Model.defineSchema().proficiencyOrder?.fields;
    assert.ok(fields);
    assert.deepEqual(Object.keys(fields),["original","alternative"]);
    for(const field of Object.values(fields)){
      assert.equal(field.nullable,true);assert.equal(field.initial,null);
      assert.equal(field.element.blank,false);
    }
  }
});
test("manifest, model exports, default artwork and dedicated sheets cover both native Create Item types",()=>{
  const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
  const manifest=JSON.parse(read("system.json")),models=read("module/data/item/_module.mjs"),runtime=read("dnd5e.mjs"),art=read("module/config.mjs"),language=JSON.parse(read("lang/en.json"));
  for(const type of ["taxonomy","archetype"]){
    assert(manifest.documentTypes.Item[type]);assert(models.includes(`${type}:`));
    assert(art.includes(`${type}: "systems/jujutsu-system/icons/svg/items/${type}.svg"`));
    assert(language["TYPES.Item"][type]);assert(runtime.includes('applications.item.NpcProfileSheet'));
  }
  assert(read("less/jujutsu-hunter-2.css").includes('./jujutsu-npc-profiles-2.css'));
});
test("native creation guard serializes concurrent requests and rejects dry-run duplicates",async()=>{
  const native=readFileSync(new URL("../module/documents/item.mjs",import.meta.url),"utf8").match(/static async createDocuments\(data, context=\{\}\) \{([\s\S]*?)\n  \}/)[1];
  class Boundary {static async createDocuments(data,{parent}){await Promise.resolve();parent.items.push(...data);return data;}}
  globalThis.ui={notifications:{warn(){}}};
  const Item=new Function("Boundary","canCreateNpcProfiles","serializeNpcProfileCreation","Ruleset","customizationCategory",`return class extends Boundary {static async createDocuments(data,context={}){${native}}}`)(Boundary,canCreateNpcProfiles,serializeNpcProfileCreation,{isV2:()=>true},()=>null);
  const actor={type:"npc",items:[]};
  const batches=await Promise.all([Item.createDocuments([{type:"taxonomy"}],{parent:actor}),Item.createDocuments([{type:"taxonomy"}],{parent:actor})]);
  assert.equal(actor.items.length,1);assert.equal(batches.reduce((sum,batch)=>sum+batch.length,0),1);
  await assert.rejects(Item.createDocuments([{type:"taxonomy"}],{parent:actor,dryRun:true}),/uma Taxonomia/);
  await Item.createDocuments([{type:"archetype"}],{parent:actor});assert.equal(actor.items.length,2);
});
