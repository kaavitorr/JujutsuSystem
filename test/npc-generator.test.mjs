import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { readFileSync } from "node:fs";
import { syncNpcProfileEquipment } from "../module/systems/legacy2-npc-equipment.mjs";

globalThis.Hooks = { on() {} };
globalThis.game = { user: { isGM: true }, settings: { get: () => "2.0" }, items: [], packs: [] };
globalThis.ui = { notifications: { warn() {}, error() {}, info() {} } };
globalThis.CONFIG = { JUJUTSU: { taxonomias: { animal: { label: "Animal" } }, arquetipos: { bruto: { label: "Bruto" } } } };
const generator = await import("../module/applications/actor/jj/npc-generator-dialog.mjs");
const { npcGeneratorProfiles } = await import("../module/applications/actor/jj/npc-generator-profiles.mjs");
const profileCatalog = await import("../module/applications/actor/jj/npc-generator-profiles.mjs");
const { activateNpcGeneratorWeapons, npcGeneratorWeaponFolder } = await import("../module/applications/actor/jj/npc-generator-weapons.mjs");
const weights = { str: 3, dex: 2, con: 3, int: 1, wis: 2, cha: 1 };
function profile(type, id, system = {}) {
  return { id, uuid: `Item.${id}`, name: id, type, visible: true, system: { pesos: weights, ...system },
    toObject() { return { _id: id, name: id, type, img: "icons/svg/pawprint.svg", system: structuredClone(this.system), folder: "source", ownership: {} }; } };
}

beforeEach(() => {
  game.user.isGM = true;
  game.items = [];
  game.packs = [];
  game.settings.get = () => "2.0";
});

for (const [world, chosen, expected] of [["2.0", "1.0", "jj-npcgen-tipo"], ["1.0", "2.0", 'name="taxonomia"']]) {
  test(`the ${world} world can explicitly open the ${chosen} generator`, async () => {
    game.settings.get = () => world;
    const dialogs = [];
    globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => {
      dialogs.push(options);
      return dialogs.length === 1
        ? options.buttons.find(button => button.action === "continue")?.callback(null, { form: { elements: { version: { value: chosen } } } })
        : null;
    } } } } };
    await generator.openNpcGenerator();
    assert.equal(dialogs.length, 2);
    assert.match(dialogs[0].content, /1\.0/);
    assert.match(dialogs[0].content, /2\.0/);
    assert.match(dialogs[1].content, new RegExp(expected));
  });
}

test("cancelling version selection does not open a generator or create an actor", async () => {
  let dialogs = 0;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async () => { dialogs++; return null; } } } } };
  globalThis.Actor = { implementation: { create() { assert.fail("Cancelled generation created an actor"); } } };
  await generator.openNpcGenerator();
  assert.equal(dialogs, 1);
});

test("non-GMs cannot open either generator directly", async () => {
  game.user.isGM = false;
  globalThis.foundry = { applications: { api: { DialogV2: { wait() { assert.fail("Non-GM opened a generator"); } } } } };
  await generator.openNpcGenerator();
  await generator.openNpcGenerator1();
  await generator.openNpcGenerator2();
});

test("the 2.0 selector includes world and compendium profiles with escaped names and their thumbnails", async () => {
  game.items = [{ ...profile("taxonomy", "Felinos & <feras>"), img: "icons/felinos.webp" }];
  game.packs = [{ documentName: "Item", visible: true, collection: "test.profiles", metadata: { label: "Perfis" },
    getIndex: async () => [{ _id: "hunter", name: "Caçador", type: "archetype", img: "icons/cacador.webp" }, { _id: "sword", name: "Espada", type: "weapon" }] }];
  const catalog = await npcGeneratorProfiles();
  assert.equal(catalog.taxonomy[0].img, "icons/felinos.webp");
  assert.equal(catalog.archetype[0].img, "icons/cacador.webp");
  let content;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => { content = options.content; return null; } } } } };
  await generator.openNpcGenerator2();
  assert.match(content, /Felinos &amp; &lt;feras&gt;/);
  assert.match(content, /Compendium\.test\.profiles\.Item\.hunter/);
  assert.match(content, /Espada/);
});

test("taxonomy filtering keeps general archetypes and only the selected taxonomy's specific archetypes", async () => {
  game.items = [profile("taxonomy", "Corvídeos", { identifier: "corvideos" }),
    profile("taxonomy", "Felinos", { identifier: "felinos" }), profile("taxonomy", "Quimeras", { identifier: "quimeras" }),
    profile("archetype", "Agourento", { identifier: "agourento" }),
    profile("archetype", "Espreitador Noturno", { identifier: "espreitador-noturno" }),
    profile("archetype", "Íncubo", { identifier: "incubo" }),
    profile("archetype", "Cabeça-de-leão", { identifier: "cabeca-de-leao" }),
    profile("archetype", "Corpo-de-cabra", { identifier: "corpo-de-cabra" }),
    profile("archetype", "Cauda-de-serpente", { identifier: "cauda-de-serpente" }),
    profile("archetype", "Trapaceiro", { identifier: "trapaceiro" }), profile("archetype", "Personalizado")];
  const catalog = await npcGeneratorProfiles();
  const labels = taxonomy => profileCatalog.npcGeneratorArchetypesForTaxonomy(catalog, `Item.${taxonomy}`).map(choice => choice.label);
  assert.deepEqual(labels("Corvídeos"), ["Agourento", "Personalizado", "Trapaceiro"]);
  assert.deepEqual(labels("Felinos"), ["Espreitador Noturno", "Personalizado", "Trapaceiro"]);
  assert.deepEqual(labels("Quimeras"), ["Cabeça-de-leão", "Cauda-de-serpente", "Corpo-de-cabra", "Personalizado", "Trapaceiro"]);
  assert.equal(catalog.archetype.length, 8, "Filtering must not destroy choices needed after changing taxonomy");
});

test("compendium profile identities survive renamed labels and are explicitly requested in the index", async () => {
  const fields = [];
  game.items = [profile("archetype", "Geral", { identifier: "custom-general" })];
  game.packs = [{ documentName: "Item", visible: true, collection: "test.profiles", metadata: { label: "Perfis" },
    getIndex: async options => {
      fields.push(...options.fields);
      const entries = [{ _id: "bird", name: "Corvo renomeado", type: "taxonomy", key: "profile:taxonomy:corvideos" },
        { _id: "omen", name: "Mau presságio", type: "archetype", key: "profile:archetype:agourento" },
        { _id: "dream", name: "Outro presságio", type: "archetype", key: "profile:archetype:incubo" }];
      return entries.map(({ key, ...entry }) => ({ ...entry,
        ...(options.fields.includes("flags.jujutsu-system.encyclopedia.key") ? { flags: { "jujutsu-system": { encyclopedia: { key } } } } : {}) }));
    } }];
  const catalog = await npcGeneratorProfiles();
  assert(fields.includes("system.identifier"));
  assert(fields.includes("flags.jujutsu-system.encyclopedia.key"));
  assert.deepEqual(profileCatalog.npcGeneratorArchetypesForTaxonomy(catalog, "Compendium.test.profiles.Item.bird").map(choice => choice.label),
    ["Geral", "Mau presságio"]);
});

test("humanoid archetypes are available to humanoid taxonomies but do not leak into beasts", async () => {
  game.items = [profile("taxonomy", "Humanos", { identifier: "humanos" }),
    profile("taxonomy", "Homens-fera", { identifier: "homens-fera" }), profile("taxonomy", "Corvídeos", { identifier: "corvideos" }),
    profile("archetype", "Assassino", { identifier: "assassino" }),
    profile("archetype", "Assassino (não Humanoide)", { identifier: "assassino-nao-humanoide" }),
    profile("archetype", "Saqueador Ardiloso", { identifier: "saqueador-ardiloso" })];
  const catalog = await npcGeneratorProfiles();
  const labels = taxonomy => profileCatalog.npcGeneratorArchetypesForTaxonomy(catalog, `Item.${taxonomy}`).map(choice => choice.label);
  assert.deepEqual(labels("Humanos"), ["Assassino"]);
  assert.deepEqual(labels("Homens-fera"), ["Assassino", "Assassino (não Humanoide)", "Saqueador Ardiloso"]);
  assert.deepEqual(labels("Corvídeos"), ["Assassino (não Humanoide)"]);
});

test("human selection shows only humanoid archetypes, even with generic and renamed profiles in the catalog", async () => {
  game.items = [profile("taxonomy", "Humano", { identifier: "humano" }),
    profile("archetype", "Guerreiro", { identifier: "guerreiro" }),
    profile("archetype", "Agarrrador", { identifier: "agarrador" }),
    profile("archetype", "Atirador (cuspidor)", { identifier: "atirador-cuspidor" }),
    profile("archetype", "Personalizado", { identifier: "custom" }),
    { ...profile("archetype", "Assassino renomeado"), flags: { "jujutsu-system": { encyclopedia: { key: "profile:archetype:assassino" } } } }];
  const catalog = await npcGeneratorProfiles();
  assert.deepEqual(profileCatalog.npcGeneratorArchetypesForTaxonomy(catalog, "Item.Humano").map(choice => choice.label),
    ["Assassino renomeado", "Guerreiro"]);
});

test("the generator rejects a stale non-humanoid archetype for humans before creating any actor", async () => {
  const taxonomy = profile("taxonomy", "Humanos", { identifier: "humanos" });
  const archetype = profile("archetype", "Assassino (não Humanoide)", { identifier: "assassino-nao-humanoide" });
  globalThis.fromUuid = async uuid => [taxonomy, archetype].find(item => item.uuid === uuid);
  let creations = 0;
  globalThis.Actor = { implementation: { create() { creations++; return null; } } };
  assert.equal(await generator.createNpc2({ taxonomia: taxonomy.uuid, arquetipo: archetype.uuid, nd: 1 }), null);
  assert.equal(creations, 0);
});

test("human previews and created profile copies use the painted sorcerer while custom art remains untouched", async () => {
  const old = "modules/jujutsu-compendium/assets/perfis-pdn-pintados-v1/taxonomias/humanos.webp";
  const replacement = "systems/jujutsu-system/assets/gerador-pdn-pintado-v1/humano-feiticeiro.webp";
  const human = { ...profile("taxonomy", "Humanos", { identifier: "humanos" }), img: old };
  const custom = { ...profile("taxonomy", "Humano personalizado", { identifier: "humano" }), img: "worlds/mesa/meu-feiticeiro.webp" };
  game.items = [human, custom];
  game.packs = [{ documentName: "Item", visible: true, collection: "test.profiles", metadata: { label: "Perfis" },
    getIndex: async () => [{ _id: "renamed-human", type: "taxonomy", name: "Humano renomeado", img: old,
      flags: { "jujutsu-system": { encyclopedia: { key: "profile:taxonomy:humanos" } } } }] }];
  const catalog = await npcGeneratorProfiles();
  assert.equal(catalog.taxonomy.find(choice => choice.value === human.uuid).img, replacement);
  assert.equal(catalog.taxonomy.find(choice => choice.value === custom.uuid).img, custom.img);
  assert.equal(catalog.taxonomy.find(choice => choice.value.startsWith("Compendium.")).img, replacement);
  globalThis.fromUuid = async uuid => uuid === human.uuid ? human : custom;
  assert.equal((await profileCatalog.npcGeneratorProfile("taxonomy", human.uuid)).data.img, replacement);
  assert.equal((await profileCatalog.npcGeneratorProfile("taxonomy", custom.uuid)).data.img, custom.img);
});

test("a stale incompatible archetype is rejected before NPC creation", async () => {
  const taxonomy = profile("taxonomy", "Corvídeos", { identifier: "corvideos" });
  const archetype = profile("archetype", "Íncubo", { identifier: "incubo" });
  globalThis.fromUuid = async uuid => [taxonomy, archetype].find(item => item.uuid === uuid);
  let creations = 0;
  globalThis.Actor = { implementation: { create() { creations++; return null; } } };
  assert.equal(await generator.createNpc2({ taxonomia: taxonomy.uuid, arquetipo: archetype.uuid, nd: 1 }), null);
  assert.equal(creations, 0);
});

test("2.0 generation copies real profiles, grants only features due at the selected ND and equips their weapons", async () => {
  const tax = profile("taxonomy", "Felinos", { habilidades: [{ uuid: "Item.sense", nd: 1 }, { uuid: "Item.future", nd: 5 }],
    equipamentos: { armas: ["Item.claws"] } });
  const arq = profile("archetype", "Caçador");
  const docs = new Map([[tax.uuid, tax], [arq.uuid, arq], ["Item.sense", profile("feat", "Sentidos")],
    ["Item.claws", { ...profile("weapon", "Garras"), system: {} }]]);
  globalThis.fromUuid = async uuid => docs.get(uuid);
  let data;
  let sequence = 0;
  const actor = { type: "npc", name: "Caçador Felinos", isOwner: true, items: [], system: {},
    createEmbeddedDocuments: async (_, items) => {
      const created = items.map(item => ({ ...item, id: `owned${sequence++}` }));
      actor.items.push(...created); return created;
    },
    deleteEmbeddedDocuments: async (_, ids) => { actor.items = actor.items.filter(item => !ids.includes(item.id)); },
    update: async update => { actor.lastUpdate = update; }, sheet: { render() {} } };
  globalThis.Actor = { implementation: { create: async input => {
    data = input;
    actor.items = input.items.map((item, i) => ({ ...item, id: `initial${i}` }));
    actor.system = { ...input.system, attributes: { hp: { max: 120 } }, energy: { max: 90 } };
    return actor;
  } } };
  const result = await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 3 });
  assert.equal(result, actor);
  assert.deepEqual(data.items.slice(0, 2).map(item => item.type), ["taxonomy", "archetype"]);
  assert.equal(data.items[0].folder, undefined);
  assert.equal(data.items[0]._id, undefined);
  assert.equal(data.items[0].flags["jujutsu-system"].npcProfileSource, "Item.Felinos");
  assert(actor.items.some(item => item.name === "Sentidos"));
  assert(!actor.items.some(item => item.name === "future"));
  assert.equal(actor.items.find(item => item.name === "Garras").system.equipped, true);
  assert.equal(actor.lastUpdate["system.attributes.hp.value"], 120);
  assert.equal(actor.lastUpdate["system.energy.total"], 90);
});

test("invalid or unavailable profiles never create an incomplete 2.0 actor", async () => {
  globalThis.fromUuid = async () => null;
  globalThis.Actor = { implementation: { create() { assert.fail("Invalid profiles created an actor"); } } };
  assert.equal(await generator.createNpc2({ taxonomia: "Item.missing", arquetipo: "Item.missing", nd: 3 }), null);
});

test("choosing model 2.0 in a 1.0 world creates a usable profile-based snapshot with its grants", async () => {
  game.settings.get = () => "1.0";
  const tax = profile("taxonomy", "Felinos", { habilidades: [{ uuid: "Item.sense", nd: 1 }], equipamentos: { armas: ["Item.claws"] } });
  const arq = profile("archetype", "Caçador");
  globalThis.fromUuid = async uuid => ({ [tax.uuid]: tax, [arq.uuid]: arq,
    "Item.sense": profile("feat", "Sentidos"), "Item.claws": profile("weapon", "Garras") })[uuid];
  const actor = { type: "npc", isOwner: true, name: "NPC", items: [], system: {}, sheet: { render() {} },
    update: async update => { actor.lastUpdate = update; },
    createEmbeddedDocuments: async (_, items) => { const created = items.map((item, i) => ({ ...item, id: `grant${i}` })); actor.items.push(...created); return created; },
    deleteEmbeddedDocuments: async () => {} };
  globalThis.Actor = { implementation: { create: async data => {
    actor.items = data.items.map((item, i) => ({ ...item, id: `profile${i}` }));
    // Native 1.0 preparation keeps authored values; it does not derive 2.0 profiles.
    actor.system = { ...data.system, attributes: { ...data.system.attributes,
      hp: { ...data.system.attributes.hp, max: data.system.attributes.hp.max ?? 0 } },
    energy: { ...data.system.energy, max: data.system.energy.max ?? 0 } };
    return actor;
  } } };
  assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1 }), actor);
  // Twenty initial points: For 5, Agi 3, Con 5, Int 2, Sab 3, Pre 2.
  assert.equal(actor.system.abilities?.con?.value, 5);
  assert.equal(actor.lastUpdate["system.attributes.hp.value"], 85);
  assert.equal(actor.lastUpdate["system.energy.total"], 30);
  assert.equal(actor.items.filter(item => item.name === "Sentidos").length, 1);
  assert.equal(actor.items.find(item => item.name === "Garras").system.equipped, true);
  assert.equal(game.settings.get(), "1.0");
});

function weapon(id, { pack = "test.weapons", container = null } = {}) {
  const data = { _id: id, name: id, type: "weapon", folder: "source-folder", ownership: { default: 0 },
    system: { equipped: false, container, activities: { attack: { type: "attack", activation: { type: "action", value: 3 },
      damage: { parts: [{ formula: "@npcDamageDice + @npcPrincipal", types: ["fire"] }] } } } },
    effects: [{ _id: "condition", name: "Queimadura", transfer: false, statuses: ["jj-queimadura"] }],
    flags: { "jujutsu-system": { ataqueNatural: true, condicaoAoAtingir: "Queimadura" } } };
  return { ...data, id, pack, visible: true, uuid: pack ? `Compendium.${pack}.Item.${id}` : `Item.${id}`,
    toObject: () => structuredClone(data) };
}

function actorBoundary() {
  let sequence = 0;
  const actor = { type: "npc", name: "NPC", isOwner: true, items: [], system: {}, sheet: { render() {} },
    createEmbeddedDocuments: async (_, items) => {
      const copies = items.map(item => ({ ...structuredClone(item), id: `grant${sequence++}` }));
      actor.items.push(...copies); return copies;
    },
    deleteEmbeddedDocuments: async (_, ids) => { actor.items = actor.items.filter(item => !ids.includes(item.id)); },
    update: async () => actor };
  globalThis.Actor = { implementation: { create: async data => {
    actor.items = data.items.map((item, index) => ({ ...structuredClone(item), id: `initial${index}` }));
    actor.system = data.system;
    return actor;
  } } };
  return actor;
}

test("every authored NPC weapon, including all elemental limbs and bites, can be selected by source UUID", async () => {
  const source = JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json", import.meta.url), "utf8"));
  const items = Object.values(source).flat().filter(item => item?.type === "weapon");
  assert.equal(items.filter(item => item.type === "weapon").length, 160);
  game.packs = [{ documentName: "Item", visible: true, collection: "jujutsu-compendium.equipamento-pdn",
    metadata: { label: "Equipamentos PdN" }, getIndex: async () => items }];
  let content;
  globalThis.foundry = { applications: { api: { DialogV2: { wait: async options => { content = options.content; return null; } } } } };
  await generator.openNpcGenerator2();
  const values = new Set([...content.matchAll(/name="npcWeapons"[^>]*value="([^"]+)"/g)].map(match => match[1]));
  assert.equal(values.size, 160);
  for (const item of items.filter(item => item.type === "weapon")) {
    assert(values.has(`Compendium.jujutsu-compendium.equipamento-pdn.Item.${item._id}`), item.name);
  }
});

test("the equipment catalogue groups every stock limb and elemental bite without losing native UUIDs", async () => {
  const natural=JSON.parse(readFileSync(new URL("../packs/_source/ataques-naturais.json",import.meta.url),"utf8")).ataquesNaturais;
  const manufactured=JSON.parse(readFileSync(new URL("../packs/_source/armas-pdn.json",import.meta.url),"utf8")).armas;
  const items=[...natural,...manufactured].filter(i=>i.type==="weapon");
  game.packs=[{documentName:"Item",visible:true,collection:"test.gear",metadata:{label:"Equipamentos"},getIndex:async()=>items}];
  const {weapon:choices}=await npcGeneratorProfiles();
  assert.equal(choices.length,188);
  const grouped=choices.reduce((out,i)=>(out[i.folder]=(out[i.folder]??0)+1,out),{});
  assert.deepEqual(grouped,{base:44,acid:16,lightning:16,thunder:16,soul:16,fire:16,cold:16,psychic:16,radiant:16,poison:16});
  assert.equal(new Set(choices.map(i=>i.value)).size,188);
  for(const item of items)assert(choices.some(i=>i.value===`Compendium.test.gear.Item.${item._id}`));
});

test("the 2.0 catalogue excludes old (NPC) attacks from both the world and compendiums", async () => {
  const oldWorld=weapon("Pancada (NPC)",{pack:null});
  const legacy=[
    {_id:"old-hit",name:"Pancada (NPC)",type:"weapon"},
    {_id:"old-pincer",name:"Pancada com Pinça ( npc )",type:"weapon"}
  ];
  const current=[{_id:"claws",name:"Garras",type:"weapon"},{_id:"pistol",name:"Pistola",type:"weapon"}];
  game.items=[oldWorld,{...weapon("Mordida",{pack:null})}];
  game.packs=[{documentName:"Item",visible:true,collection:"test.mixed",metadata:{label:"Acervo"},getIndex:async()=>[...legacy,...current]}];
  const {weapon:choices}=await npcGeneratorProfiles();
  assert.deepEqual(choices.map(choice=>choice.label),["Garras","Mordida","Pistola"]);
  assert.equal(oldWorld.name,"Pancada (NPC)");
  assert.equal(legacy.length,2);
});

test("physical firearms stay in Base even when their source folder is Armas de Fogo",()=>{
  const folders=new Map([["guns",{_id:"guns",name:"Armas de Fogo"}]]);
  assert.equal(npcGeneratorWeaponFolder({name:"Pistola",folder:"guns",
    system:{damage:{base:{types:["piercing"]}}}},folders),"base");
  assert.equal(npcGeneratorWeaponFolder({name:"Arma de Fogo",folder:"guns"},folders),"base");
  assert.equal(npcGeneratorWeaponFolder({name:"Lança de Gelo",system:{damage:{base:{types:["piercing"]}}}}),"base");
});

test("element folders use configured damage including base, activities and legacy parts",()=>{
  const cases=[
    [{name:"Espada",system:{damage:{base:{types:["fire"]}}}},"fire"],
    [{name:"Pistola",system:{activities:{shot:{type:"attack",damage:{parts:[{types:["fire"]}]}}}}},"fire"],
    [{name:"Garras",system:{activities:{hit:{type:"attack",damage:{parts:[{types:new Set(["psychic"])}]}}}}},"psychic"],
    [{name:"Mordida",system:{damage:{parts:[["2d6","acid"]]}}},"acid"],
    [{name:"Flamejante",flags:{"jujutsu-system":{elemento:"fire"}},system:{damage:{base:{types:new Set(["cold"])}}}},"cold"],
    [{name:"Garras",flags:{"jujutsu-system":{elemento:"lightning"}}},"lightning"]
  ];
  for(const [item,expected]of cases)assert.equal(npcGeneratorWeaponFolder(item),expected,item.name);
});

test("the compendium index includes damage data so renamed elemental weapons are classified correctly",async()=>{
  game.items=[{...weapon("Mordida",{pack:null}),system:{damage:{base:{types:["poison"]}}}}];
  const entries=[
    {_id:"pistol",name:"Pistola",type:"weapon",folder:"guns",system:{damage:{base:{types:["piercing"]}}}},
    {_id:"blade",name:"Espada",type:"weapon",img:"icons/blade.webp",system:{damage:{base:{types:["fire"]}}}},
    {_id:"claws",name:"Garras",type:"weapon",system:{activities:{hit:{type:"attack",damage:{parts:[{types:["cold"]}]}}}}}
  ];
  game.packs=[{documentName:"Item",visible:true,collection:"test.gear",metadata:{label:"Acervo"},
    folders:new Map([["guns",{_id:"guns",name:"Armas de Fogo"}]]),
    getIndex:async({fields})=>entries.map(item=>({...item,system:{
      damage:fields.includes("system.damage")?item.system.damage:undefined,
      activities:fields.includes("system.activities")?item.system.activities:undefined
    }})),getDocuments(){assert.fail("Picker loaded full compendium documents");}}];
  const {weapon:choices}=await npcGeneratorProfiles();
  assert.equal(choices.find(i=>i.label==="Pistola").folder,"base");
  assert.equal(choices.find(i=>i.label==="Mordida").folder,"poison");
  assert.equal(choices.find(i=>i.label==="Espada").folder,"fire");
  assert.equal(choices.find(i=>i.label==="Garras").folder,"cold");
  assert.equal(choices.find(i=>i.label==="Espada").img,"icons/blade.webp");
});

test("folder navigation combines search and source filters while retaining selections in hidden folders",()=>{
  const listeners=()=>({handlers:{},addEventListener(event,callback){this.handlers[event]=callback;}});
  const search={...listeners(),value:""},source={...listeners(),value:""},count={},empty={},heading={};
  const buttons=["base","fire","poison","all"].map(folder=>({...listeners(),dataset:{weaponFolder:folder},setAttribute(key,value){this[key]=value;}}));
  const rows=[["Mordida","Livro A","base"],["Garras Flamejantes","Livro A","fire"],["Mordida Venenosa","Livro B","poison"]].map(([name,group,folder])=>{
    const input={checked:false};return {dataset:{weaponName:name,weaponGroup:group,weaponFolder:folder},querySelector:()=>input};
  });
  const selector={"[data-weapon-search]":search,"[data-weapon-source]":source,"[data-weapon-count]":count,"[data-weapon-empty]":empty,"[data-weapon-heading]":heading};
  const picker={...listeners(),querySelector:key=>selector[key],querySelectorAll:key=>key==="[data-weapon-folder-button]"?buttons:rows};
  activateNpcGeneratorWeapons({querySelector:()=>picker});
  assert.deepEqual(rows.map(r=>r.hidden),[false,true,true]);
  rows[0].querySelector().checked=true;picker.handlers.change();
  buttons[1].handlers.click();assert.deepEqual(rows.map(r=>r.hidden),[true,false,true]);
  assert.equal(buttons[1]["aria-pressed"],"true");
  rows[1].querySelector().checked=true;picker.handlers.change();
  buttons[2].handlers.click();assert.deepEqual(rows.map(r=>r.hidden),[true,true,false]);
  assert.equal(rows.filter(r=>r.querySelector().checked).length,2);
  search.value="MÓRDIDA";search.handlers.input();assert.equal(rows[2].hidden,false);
  source.value="Livro A";source.handlers.change();assert.equal(empty.hidden,false);
  buttons[3].handlers.click();assert.deepEqual(rows.map(r=>r.hidden),[false,true,true]);
  assert.match(count.textContent,/2 selecionadas/);
  source.value="";search.value="";search.handlers.input();assert(rows.every(r=>!r.hidden));
});

test("selected weapons become equipped native Items, retain activities/effects and survive profile removal", async () => {
  const selected = weapon("Tentáculos Flamejantes", { container: "other-actor-container" });
  const automatic = weapon("Garras");
  const tax = profile("taxonomy", "Felinos", { equipamentos: { armas: [automatic.uuid] } });
  const arq = profile("archetype", "Lutador");
  const docs = new Map([tax, arq, selected, automatic].map(item => [item.uuid, item]));
  globalThis.fromUuid = async uuid => docs.get(uuid);
  const actor = actorBoundary();
  assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 3,
    armas: [selected.uuid, selected.uuid] }), actor);
  const copies = actor.items.filter(item => item.type === "weapon" && item.name === "Tentáculos Flamejantes");
  assert.equal(copies.length, 1);
  const copy = copies[0];
  assert.equal(copy.system.equipped, true);
  assert.equal(copy.system.container, null);
  assert.equal(copy.system.activities.attack.activation.value, 3);
  assert.equal(copy.system.activities.attack.damage.parts[0].formula, "@npcDamageDice + @npcPrincipal");
  assert.equal(copy.effects[0]._id, "condition");
  assert.equal(copy.effects[0].statuses[0], "jj-queimadura");
  assert.equal(copy.flags["jujutsu-system"].npcArchetypeEquipment, undefined);
  assert.equal(copy._stats.compendiumSource, selected.uuid);
  assert.equal(copy._id, undefined);
  assert.equal(copy.folder, undefined);
  assert.equal(copy.ownership, undefined);
  assert.equal(selected.toObject().system.equipped, false);
  assert(actor.items.some(item => item.name === "Garras"));
  actor.items = actor.items.filter(item => !["taxonomy", "archetype"].includes(item.type));
  actor.system.legacy2.taxonomia = actor.system.legacy2.arquetipo = null;
  await syncNpcProfileEquipment(actor);
  assert.equal(actor.items.filter(item => item.type === "weapon").length, 1);
  assert.equal(actor.items.find(item => item.type === "weapon").name, "Tentáculos Flamejantes");
});

for (const pack of ["test.weapons", null]) {
  test(`a selected ${pack ? "compendium" : "world"} weapon also granted by a profile is copied once`, async () => {
    const selected = weapon("Mordida", { pack });
    const tax = profile("taxonomy", "Felinos", { equipamentos: { armas: [selected.uuid] } });
    const arq = profile("archetype", "Caçador");
    const docs = new Map([tax, arq, selected].map(item => [item.uuid, item]));
    globalThis.fromUuid = async uuid => docs.get(uuid);
    const actor = actorBoundary();
    await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1, armas: [selected.uuid] });
    await syncNpcProfileEquipment(actor);
    const copies = actor.items.filter(item => item.type === "weapon");
    assert.equal(copies.length, 1);
    assert.equal(copies[0].flags["jujutsu-system"].npcArchetypeEquipment, undefined);
    assert.equal(copies[0].flags["jujutsu-system"].npcGeneratorWeaponSource, selected.uuid);
  });
}

test("unavailable, unreadable, non-weapon or legacy selections are rejected before creating the actor", async () => {
  const tax = profile("taxonomy", "Felinos"), arq = profile("archetype", "Lutador");
  const denied = { ...weapon("Privada"), visible: false };
  const wrongType = profile("feat", "Efeito");
  const legacy = weapon("Pancada (NPC)");
  const docs = new Map([tax, arq, denied, wrongType, legacy].map(item => [item.uuid, item]));
  globalThis.fromUuid = async uuid => docs.get(uuid);
  let creations = 0;
  globalThis.Actor = { implementation: { create() { creations++; return null; } } };
  for (const uuid of ["Item.missing", denied.uuid, wrongType.uuid, legacy.uuid]) {
    assert.equal(await generator.createNpc2({ taxonomia: tax.uuid, arquetipo: arq.uuid, nd: 1, armas: [uuid] }), null);
  }
  assert.equal(creations, 0);
});
