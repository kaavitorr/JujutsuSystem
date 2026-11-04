import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import * as graph from "../module/systems/especializacoes-2.mjs";
import * as maps from "../module/applications/actor/jj/skill-tree-map-2.mjs";

const NS = "jujutsu-system", PACK = "jujutsu-compendium.geral-2-0";
function fixture() {
  const events = new Map(), counts = { reads: 0, world: 0, owned: 0, tokens: 0 };
  globalThis.Hooks = { on(event, callback) { const list = events.get(event) ?? []; list.push(callback); events.set(event, list); } };
  const emit = async (event, ...args) => { for (const callback of events.get(event) ?? []) await callback(...args); };
  const feat = (name, requirements = []) => ({ type: "feat", name, uuid: `Compendium.${PACK}.Item.${name}`,
    system: {}, flags: { [NS]: { physicalSpecializationsVersion: 999, especializacao: {
      categoria: "Proezas Físicas", caminho: "Corpo de Guerreiro", requisitos: requirements } } } });
  const docs = [feat("Base"), feat("Avançada", ["Base"]), feat("Reação Acelerada")];
  docs.push({ type: "feat", name: "Escudo de Energia", system: { identifier: "escudo-de-energia" }, flags: { [NS]: { energyShieldTreeVersion: 1 } } });
  const tracked = kind => ({ get type() { counts[kind]++; return "weapon"; } });
  const pack = { collection: PACK, async getDocuments() { counts.reads++; return docs; } };
  const overrides = {};
  const world = { user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } },
    packs: new Map([[PACK, pack]]), settings: { get: (_scope, key) => key === "rulesetVersion" ? "2.0" : key === "especializacoesReq" ? overrides : {} },
    items: [tracked("world")], actors: [{ items: [tracked("owned")] }],
    scenes: [{ tokens: [{ get actorLink() { counts.tokens++; return true; } }] }] };
  globalThis.game = world;
  return { world, pack, docs, counts, overrides, emit };
}

test("repeated and concurrent catalog reads share documents without running world repairs", async () => {
  const f = fixture();
  const graphs = await Promise.all(Array.from({ length: 10 }, () => graph.carregarGrafo()));
  for (let index = 0; index < 10; index++) assert.equal(await graph.carregarGrafo(), graphs[0]);
  assert.deepEqual(f.counts, { reads: 1, world: 0, owned: 0, tokens: 0 });
});

test("requirements and pack events rebuild the graph while unrelated changes retain its cache", async () => {
  const f = fixture(), first = await graph.carregarGrafo();
  await f.emit("updateItem", { parent: { documentName: "Actor" } }, { name: "Renamed weapon" });
  await f.emit("updateCompendium", { collection: "another.pack" });
  await f.emit("updateSetting", { key: `${NS}.especializacoesOcultas` });
  assert.equal(await graph.carregarGrafo(), first);
  f.overrides.Avançada = ["8º nível"];
  await f.emit("updateSetting", { key: `${NS}.especializacoesReq` });
  const changed = await graph.carregarGrafo();
  assert.notEqual(changed, first);
  assert.deepEqual(changed.porNome.get("Avançada").requisitos, ["8º nível"]);
  assert.equal(f.counts.reads, 1, "GM requirements reuse the cached catalog documents");
  f.docs[1].name = "Nova";
  await f.emit("updateItem", { pack: PACK }, { name: "Nova" });
  const renamed = await graph.carregarGrafo();
  assert(renamed.porNome.has("Nova")); assert(!renamed.porNome.has("Avançada"));
  assert.equal(f.counts.reads, 2);
  f.docs.push({ ...f.docs[0], name: "Importada" });
  await f.emit("updateCompendium", f.pack);
  assert((await graph.carregarGrafo()).porNome.has("Importada"));
  assert.equal(f.counts.reads, 3);
});

test("the first saved GM requirement and deleting it invalidate other clients without rereading the pack", async () => {
  const f = fixture(); f.world.user.isGM = false;
  await graph.carregarGrafo();
  f.overrides.Avançada = ["4º nível"];
  await f.emit("createSetting", { key: `${NS}.especializacoesReq` });
  assert.deepEqual((await graph.carregarGrafo()).porNome.get("Avançada").requisitos, ["4º nível"]);
  delete f.overrides.Avançada;
  await f.emit("deleteSetting", { key: `${NS}.especializacoesReq` });
  assert.deepEqual((await graph.carregarGrafo()).porNome.get("Avançada").requisitos, ["Base"]);
  assert.equal(f.counts.reads, 1);
});

test("a failed catalog load can be retried and invalidation during a load cannot publish stale data", async () => {
  const f = fixture(); let fail = true;
  f.pack.getDocuments = async () => { f.counts.reads++; if (fail) throw Error("read failed"); return f.docs; };
  await assert.rejects(graph.carregarGrafo(), /read failed/);
  fail = false; assert((await graph.carregarGrafo()).porNome.has("Base"));
  assert.equal(f.counts.reads, 2);
  let release, started;
  const gate = new Promise(resolve => { started = resolve; });
  f.pack.getDocuments = async () => {
    f.counts.reads++;
    if (f.counts.reads === 3) { started(); return new Promise(resolve => { release = () => resolve([...f.docs]); }); }
    return [...f.docs, { ...f.docs[0], name: "Posterior" }];
  };
  await f.emit("updateCompendium", f.pack);
  const reading = graph.carregarGrafo(); await gate;
  await f.emit("updateCompendium", f.pack); release();
  assert((await reading).porNome.has("Posterior"));
  assert((await graph.carregarGrafo()).porNome.has("Posterior"));
});

test("selecting tree nodes reuses the catalog and evaluates the current actor each time", async () => {
  const f = fixture(), source = readFileSync(new URL("../module/applications/actor/jj/skill-tree-2.mjs", import.meta.url), "utf8");
  const Base = class { async _prepareContext() { return {}; } async render() { this.context = await this._prepareContext({}); } };
  const foundry = { applications: { api: { ApplicationV2: Base }, ux: { TextEditor: { implementation: { enrichHTML: async value => value } } } } };
  const dependencies = { ...graph, ...maps, ApplicationV2Mixin: cls => cls, foundry };
  const App = new Function(...Object.keys(dependencies), source.replace(/^import[\s\S]*?;/gm, "").replace("export default class", "return class"))(...Object.values(dependencies));
  const learned = [], actor = { name: "Ator", isOwner: true, items: [], itemTypes: { class: [] }, system: { details: { level: 1 }, legacy2: {} },
    getFlag: (_scope, key) => key === "especializacoes" ? learned : [], getRollData: () => ({}) };
  const app = new App(actor); await app.render();
  assert.equal(app.context.mapa.nos.find(node => node.nome === "Avançada").estado, "bloqueado");
  for (let index = 0; index < 10; index++) {
    const name = index % 2 ? "Base" : "Avançada";
    await App.DEFAULT_OPTIONS.actions.selecionar.call(app, {}, { closest: () => ({ dataset: { nome: name } }) });
  }
  const learnedItem = { name: "Base", getFlag: () => false }; learned.push("Base"); actor.items.push(learnedItem);
  await app.render();
  assert.equal(app.context.mapa.nos.find(node => node.nome === "Base").estado, "adquirido");
  assert.equal(app.context.mapa.nos.find(node => node.nome === "Avançada").estado, "disponivel");
  assert.deepEqual(f.counts, { reads: 1, world: 0, owned: 0, tokens: 0 });
});
