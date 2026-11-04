import assert from "node:assert/strict";
import { test } from "node:test";
import { updatePhysicalSpecializations, registerPhysicalSpecializationUpdate, syncImportedPhysicalSpecializations } from "../module/systems/legacy2-physical-specializations.mjs";
import { carregarGrafo, avaliarNo } from "../module/systems/especializacoes-2.mjs";
import { construirMapaCategoria } from "../module/applications/actor/jj/skill-tree-map-2.mjs";

const NS = "jujutsu-system", PACK = "jujutsu-compendium.geral-2-0";
const REACTION_REQUIREMENT = "6 Habilidades de Especialização Totais";
function apply(document, patch) {
  for (const [path, value] of Object.entries(patch)) {
    const keys = path.split('.'), key = keys.pop();
    let target = document;
    for (const part of keys) target = target[part] ??= {};
    target[key] = structuredClone(value);
  }
}
function fixture({ version = "2.0", gm = true } = {}) {
  const writes = [], creates = [], locks = [];
  const names = ["Explosão de Velocidade", "Passo Esguio", "Punho Devastador", "Entrada Impactante", "Energia Atrasada", "Impacto Concussivo"];
  const docs = names.map((name, index) => {
    const item = { _id: `original${index}`, id: `original${index}`, uuid: `Compendium.${PACK}.Item.original${index}`, name, type: "feat",
      img: `${index}-custom-art.webp`, folder: index < 4 ? "corpo-folder" : "punho-folder", sort: 42,
      system: { description: { value: "Texto antigo", chat: "Chat personalizado" }, activities: { custom: { enabled: true } } },
      effects: [{ _id: "custom-effect" }], flags: { unrelated: { keep: true }, [NS]: { especializacao: {
        categoria: "Proezas Físicas", caminho: index < 4 ? "Corpo de Guerreiro" : "Punho Divergente",
        requisitos: name === "Impacto Concussivo" ? ["Ativação Aprimorada"] : []
      } } } };
    item.update = async patch => { writes.push({ item, patch }); apply(item, patch); return item; };
    return item;
  });
  // The existing independent shield migration has already been applied.
  docs.push({ name: "Escudo de Energia", type: "feat", system: { identifier: "escudo-de-energia" }, flags: { [NS]: { energyShieldTreeVersion: 1 } } });
  const pack = { collection: PACK, locked: true, async getDocuments() { return docs; },
    async configure(options) { locks.push(options.locked); this.locked = options.locked; },
    documentClass: { async create(data, options) {
      creates.push({ data, options });
      const item = { ...structuredClone(data), id: data._id, uuid: `Compendium.${PACK}.Item.${data._id}` };
      item.update = async patch => { writes.push({ item, patch }); apply(item, patch); return item; };
      docs.push(item); return item;
    } } };
  const world = { user: { id: "gm", isGM: gm }, users: { activeGM: { id: "gm" } }, actors: [], items: [], scenes: [],
    packs: { get: key => key === PACK ? pack : null }, settings: { get: (scope, key) => key === "rulesetVersion" ? version : key === "especializacoesReq" ? {} : false } };
  globalThis.game = world;
  return { world, pack, docs, writes, creates, locks };
}

test("the requested three entries migrate once without replacing existing identities, artwork or custom mechanics", async () => {
  const f = fixture(), existing = f.docs.slice(0, 6).map(item => ({ id: item.id, img: item.img, folder: item.folder, activities: structuredClone(item.system.activities), effects: structuredClone(item.effects) }));
  await Promise.all([updatePhysicalSpecializations(), updatePhysicalSpecializations()]);
  const reaction = f.docs.find(item => item.name === "Reação Acelerada");
  assert(reaction); assert.equal(f.creates.length, 1); assert.equal(reaction.folder, "corpo-folder");
  assert.deepEqual(reaction.flags[NS].especializacao.requisitos, [REACTION_REQUIREMENT]);
  assert.equal(reaction.flags[NS].especializacao.ordem, 3);
  assert.match(reaction.system.description.value, /Uma vez por rodada/);
  assert.match(reaction.system.description.value, /Reação.*um Ponto de Ação.*a menos.*mínimo de 1/);
  const delayed = f.docs.find(item => item.name === "Energia Atrasada"), impact = f.docs.find(item => item.name === "Impacto Concussivo");
  assert.match(delayed.system.description.value, /até 6 Desvantagens/);
  assert.match(delayed.system.description.value, /metade do seu Atributo Principal/);
  assert.match(delayed.system.description.value, /3 vezes a metade/);
  assert.match(delayed.system.description.value, /mesmo resultado de acerto/);
  assert.match(impact.system.description.value, /inteiro em vez de metade/);
  assert.match(impact.system.description.value, /3 vezes.*sem receber desvantagens/);
  assert.deepEqual(impact.flags[NS].especializacao.requisitos, ["Ativação Aprimorada"]);
  for (let index = 0; index < existing.length; index++) {
    const item = f.docs[index], before = existing[index];
    assert.equal(item.id, before.id); assert.equal(item.img, before.img); assert.equal(item.folder, before.folder);
    assert.deepEqual(item.system.activities, before.activities); assert.deepEqual(item.effects, before.effects);
    assert.equal(item.system.description.chat, "Chat personalizado"); assert.equal(item.flags.unrelated.keep, true);
  }
  const count = f.writes.length;
  delayed.system.description.value = "Edição posterior do autor";
  await updatePhysicalSpecializations(); assert.equal(f.writes.length, count);
  assert.equal(delayed.system.description.value, "Edição posterior do autor"); assert.equal(f.pack.locked, true);
});

test("the actual graph shows Reação Acelerada third and unlocks it only after six learned specializations", async () => {
  fixture(); let ready;
  registerPhysicalSpecializationUpdate({ on() {}, once: (_event, callback) => { ready = callback; } });
  await ready(); const graph = await carregarGrafo();
  const category = graph.categorias.find(row => row.nome === "Proezas Físicas"), path = category.caminhos.find(row => row.nome === "Corpo de Guerreiro");
  assert.deepEqual(path.nos.slice(0, 4).map(node => node.nome), ["Explosão de Velocidade", "Passo Esguio", "Reação Acelerada", "Punho Devastador"]);
  const node = graph.porNome.get("Reação Acelerada"); assert.deepEqual(node.requisitos, [REACTION_REQUIREMENT]);
  const learned = [...graph.porNome.keys()].filter(name => name !== node.nome);
  const actor = count => ({ items: [], system: { details: { level: 1 }, legacy2: {} },
    getFlag: (_scope, key) => key === "especializacoes" ? learned.slice(0, count) : [] });
  for (const count of [0, 5]) assert.equal(avaliarNo(actor(count), node).estado, "bloqueado");
  assert.equal(avaliarNo(actor(6), node).estado, "disponivel");
  const map = construirMapaCategoria(category, graph.porNome);
  assert.equal(map.linhas.some(edge => edge.para === node.nome), false);
});

test("only canonical owned copies are updated, including unlinked tokens; unrelated authored feats stay intact", async () => {
  const f = fixture();
  const copy = { _id: "owned", name: "Energia Atrasada", type: "feat", system: { description: { value: "Antigo" } },
    flags: { [NS]: { especializacao: { categoria: "Proezas Físicas", caminho: "Punho Divergente", requisitos: [] } } } };
  const custom = { _id: "custom", name: copy.name, type: "feat", system: { description: { value: "Texto do usuário" } } };
  const writes = [], actor = { uuid: "Scene.test.Token.unlinked.Actor.npc", items: [copy, custom],
    async updateEmbeddedDocuments(type, patches) { writes.push({ type, patches }); for (const patch of patches) apply(copy, patch); } };
  f.world.actors = [actor]; f.world.scenes = [{ tokens: [{ actorLink: false, actor }] }];
  await updatePhysicalSpecializations();
  assert.equal(writes.length, 1); assert.equal(writes[0].patches.length, 1);
  assert.match(copy.system.description.value, /até 6 Desvantagens/);
  assert.equal(custom.system.description.value, "Texto do usuário");
});

test("the native update restores the original compendium lock after failures and permits a safe retry", async () => {
  const f = fixture(), item = f.docs.find(item => item.name === "Energia Atrasada"), update = item.update;
  item.update = async () => { throw Error("write failed"); };
  await assert.rejects(updatePhysicalSpecializations(), /write failed/); assert.equal(f.pack.locked, true);
  item.update = update; await updatePhysicalSpecializations();
  assert.equal(f.docs.filter(item => item.name === "Reação Acelerada").length, 1); assert.equal(f.pack.locked, true);
  for (const options of [{ version: "1.0" }, { gm: false }]) {
    const skipped = fixture(options); await updatePhysicalSpecializations(); assert.equal(skipped.writes.length, 0); assert.equal(skipped.creates.length, 0);
  }
});

test("registration runs the native update after the world is ready", () => {
  const hooks = []; registerPhysicalSpecializationUpdate({ on() {}, once: (event, callback) => hooks.push({ event, callback }) });
  assert.equal(hooks.length, 1); assert.equal(hooks[0].event, "dnd5e.ready");
});

test("later actor, world item and unlinked-token imports repair only their own physical copies without rereading the catalog", async () => {
  const f = fixture(), events = new Map();
  registerPhysicalSpecializationUpdate({ once() {}, on: (event, callback) => events.set(event, callback) });
  const old = () => ({ _id: "imported", id: "imported", type: "feat", name: "Energia Atrasada", system: { description: { value: "Antigo" } },
    flags: { [NS]: { especializacao: { categoria: "Proezas Físicas", caminho: "Punho Divergente" } } } });
  let reads = 0; f.pack.getDocuments = async () => { reads++; return f.docs; };
  const writes = [], actor = { uuid: "Actor.imported", type: "character", isOwner: true, items: [old()],
    async updateEmbeddedDocuments(_type, updates) { writes.push(updates); for (const patch of updates) apply(this.items.find(item => item.id === patch._id), patch); } };
  assert.equal(typeof events.get("createActor"), "function");
  await events.get("createActor")(actor, {}, "gm");
  assert.match(actor.items[0].system.description.value, /até 6 Desvantagens/);
  const item = old(); item.update = async patch => apply(item, patch);
  await events.get("createItem")(item, {}, "gm");
  assert.match(item.system.description.value, /até 6 Desvantagens/);
  const tokenActor = { ...actor, uuid: "Scene.s.Token.t.Actor.imported", items: [old()] };
  await events.get("createToken")({ actorLink: false, actor: tokenActor }, {}, "gm");
  assert.match(tokenActor.items[0].system.description.value, /até 6 Desvantagens/);
  await events.get("createToken")({ actorLink: true, actor }, {}, "gm");
  assert.equal(writes.length, 2); assert.equal(reads, 0);
});

test("a failed imported-copy repair can retry and does not rewrite unrelated or newer authored copies", async () => {
  const f = fixture(); f.world.user = { id: "owner", isGM: false };
  const copy = { _id: "copy", id: "copy", type: "feat", name: "Energia Atrasada", system: { description: { value: "Antigo" } },
    flags: { [NS]: { especializacao: { categoria: "Proezas Físicas", caminho: "Punho Divergente" } } } };
  const custom = { _id: "custom", type: "feat", name: copy.name, system: { description: { value: "Autoria" } } };
  const current = { ...structuredClone(copy), _id: "current", id: "current", flags: { [NS]: {
    ...structuredClone(copy.flags[NS]), physicalSpecializationsVersion: 999 } } };
  let fail = true;
  const actor = { type: "character", isOwner: true, items: [copy, custom, current], async updateEmbeddedDocuments(_type, updates) {
    if (fail) throw Error("import write failed");
    for (const update of updates) apply(this.items.find(item => item.id === update._id), update);
  } };
  await assert.rejects(syncImportedPhysicalSpecializations(actor), /import write failed/);
  fail = false; await syncImportedPhysicalSpecializations(actor);
  assert.match(copy.system.description.value, /até 6 Desvantagens/);
  assert.equal(custom.system.description.value, "Autoria"); assert.equal(current.system.description.value, "Antigo");
  copy.flags[NS].physicalSpecializationsVersion = 0; copy.system.description.value = "Old ownerless"; actor.isOwner = false;
  await syncImportedPhysicalSpecializations(actor); assert.equal(copy.system.description.value, "Old ownerless");
  actor.isOwner = true; f.world.settings.get = () => "1.0";
  await syncImportedPhysicalSpecializations(actor); assert.equal(copy.system.description.value, "Old ownerless");
});

test("a compendium import during an in-flight repair is included in a subsequent pass", async () => {
  const f = fixture(), events = new Map();
  registerPhysicalSpecializationUpdate({ once() {}, on: (event, callback) => events.set(event, callback) });
  let release, started;
  const reading = new Promise(resolve => { started = resolve; });
  let reads = 0;
  f.pack.getDocuments = async () => {
    const snapshot = [...f.docs]; reads++;
    if (reads === 1) { started(); await new Promise(resolve => { release = resolve; }); }
    return snapshot;
  };
  const running = updatePhysicalSpecializations(); await reading;
  const imported = { id: "later-energy", _id: "later-energy", type: "feat", name: "Energia Atrasada", pack: PACK,
    system: { description: { value: "Antigo" } }, async update(patch) { apply(this, patch); } };
  f.docs.push(imported);
  const importedRepair = events.get("createItem")(imported, {}, "gm");
  release(); await Promise.all([running, importedRepair]);
  assert.match(imported.system.description.value, /até 6 Desvantagens/);
  assert.equal(imported.flags[NS].physicalSpecializationsVersion, 1);
  assert.equal(reads, 2);
});

test("an already authored Reação Acelerada receives the six-specialization requirement without a level gate", async () => {
  const f = fixture();
  const existing = { id: "author-reaction", _id: "author-reaction", name: "Reação Acelerada", type: "feat", img: "author-art.webp",
    system: { description: { value: "Antigo" }, requirements: "4º nível", prerequisites: { level: 4, items: ["old"] } },
    async update(patch) { apply(this, patch); } };
  f.docs.push(existing); await updatePhysicalSpecializations();
  assert.equal(f.creates.length, 0); assert.equal(existing.img, "author-art.webp");
  assert.equal(existing.system.requirements, REACTION_REQUIREMENT); assert.equal(existing.system.prerequisites.level, null);
  assert.deepEqual(existing.system.prerequisites.items, []);
  assert.equal(existing.flags[NS].especializacao.ordem, 3);
  assert.equal(existing.flags[NS].especializacao.caminho, "Corpo de Guerreiro");
});

test("the previous unrestricted entry is upgraded without rewriting already updated Energia or Impacto", async () => {
  const f = fixture();
  for (const item of f.docs) {
    (item.flags ??= {})[NS] ??= {};
    item.flags[NS].physicalSpecializationsVersion = 1;
  }
  const reaction = { _id: "prior-reaction", id: "prior-reaction", name: "Reação Acelerada", type: "feat", img: "same-art.webp",
    system: { description: { value: "Sem requisito" } }, flags: { [NS]: { physicalSpecializationsVersion: 1,
      especializacao: { categoria: "Proezas Físicas", caminho: "Corpo de Guerreiro", requisitos: [], ordem: 3 } } },
    async update(patch) { apply(this, patch); } };
  f.docs.push(reaction);
  await updatePhysicalSpecializations();
  assert.deepEqual(reaction.flags[NS].especializacao.requisitos, [REACTION_REQUIREMENT]);
  assert.equal(reaction.flags[NS].physicalSpecializationsVersion, 2);
  assert.equal(reaction.img, "same-art.webp"); assert.equal(f.creates.length, 0);
  for (const name of ["Energia Atrasada", "Impacto Concussivo"]) {
    assert.equal(f.docs.find(item => item.name === name).system.description.value, "Texto antigo");
  }
});

test("Explosão de Velocidade configures encounter PP on existing copies without resetting spent points", async () => {
  const f = fixture(), base = { id: "owned-speed", _id: "owned-speed", name: "Explosão de Velocidade", type: "feat",
    system: { identifier: "explosao-de-velocidade", uses: { max: "7", spent: 4, recovery: [] }, description: { value: "Antigo" } },
    flags: { [NS]: { physicalSpecializationsVersion: 1, especializacao: { categoria: "Proezas Físicas", caminho: "Corpo de Guerreiro" } } } };
  const actor = { uuid: "Actor.speed", isOwner: true, type: "character", items: [base,
    ...["Passo Esguio", "Punho Devastador", "Reação Acelerada"].map(name => ({ type: "feat", name,
      flags: { [NS]: { especializacao: { categoria: "Proezas Físicas", caminho: "Corpo de Guerreiro" } } } }))],
    async updateEmbeddedDocuments(type, patches) { for (const patch of patches) if (patch._id === base.id) apply(base, patch); } };
  f.world.actors.push(actor); await updatePhysicalSpecializations();
  assert.equal(base.system.uses.max, "7"); assert.equal(base.system.uses.spent, 4);
  assert.deepEqual(base.system.uses.recovery, [{ period: "encounter", type: "recoverAll" }]);
  assert.match(base.system.description.value, /mínimo de 1/); assert.match(base.system.description.value, /a cada 2/);
  base.system.uses.spent = 6; await updatePhysicalSpecializations(); assert.equal(base.system.uses.spent, 6);
});
