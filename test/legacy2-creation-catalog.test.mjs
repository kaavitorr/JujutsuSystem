import assert from "node:assert/strict";
import { test } from "node:test";
const catalog = await import("../module/applications/actor/creation/creation-catalog-2.mjs").catch(()=>({}));
test("creation classifies real customization feats by saved section or compendium folder",()=>{
  assert.equal(typeof catalog.creationCustomizationCategory,"function");
  assert.equal(catalog.creationCustomizationCategory({type:"feat",flags:{"jujutsu-system":{featureSection:"jj-flaws"}}}),"jj-flaws");
  assert.equal(catalog.creationCustomizationCategory({type:"feat",folder:{name:"Peculiaridades"}}),"jj-peculiarities");
  assert.equal(catalog.creationCustomizationCategory({type:"feat",folder:{name:"Desvantagens"}}),"jj-variant-penalties");
  assert.equal(catalog.creationCustomizationCategory({type:"spell",folder:{name:"Defeitos"}}),null);
  assert.equal(catalog.creationCustomizationCategory({type:"feat",name:"Uma habilidade qualquer"}),null);
});
test("missing creation content produces usable empty catalogs without fake options",async()=>{
  assert.equal(typeof catalog.loadCreationCatalog,"function");
  globalThis.game={packs:new Map(),items:[],settings:{get:()=>({})}};
  const result=await catalog.loadCreationCatalog();
  assert.deepEqual(result.species,[]);assert.deepEqual(result.styles,[]);
  assert.equal(result.graph.porNome.size,0);
  assert.deepEqual(result.customization["jj-legendary-modifiers"],[]);
});

test("legacy creation references recover from missing-pack errors using the current source",async()=>{
  const calls=[],current="Compendium.jujutsu-compendium.geral-2-0.Item.granted",doc={uuid:current,type:"feat"};
  globalThis.fromUuid=async uuid=>{calls.push(uuid);if(uuid===current)return doc;throw new Error("Unknown compendium");};
  assert.equal(await catalog.resolveCreationDocument("Compendium.hunter-legacy-module.hl-geral.Item.granted"),doc);
  assert.equal(calls.length,2);
  await assert.rejects(catalog.resolveCreationDocument("Item.broken"),/Unknown compendium/);
});
