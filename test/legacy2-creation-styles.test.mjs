import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { creationDraft, chooseCreationStyle, creationPathOptions, creationBudgets, creationPodeEscolher,
  validateCreation, creationCombinationError, creationPrimaryOptions } from "../module/applications/actor/creation/creation-model-2.mjs";
import { prepareCreationCompletion, commitCreation } from "../module/applications/actor/creation/creation-completion-2.mjs";
import { carregarGrafo } from "../module/systems/especializacoes-2.mjs";
import { CharacterBoundary, NativeManager } from "./helpers/creation-native-boundary.mjs";

let alternateSaves=false;
globalThis.game = { settings: { get: (_scope, key) => key === "rulesetVersion" ? "2.0" : key === "regraSalvaguarda" ? alternateSaves : {} } };
globalThis.CONFIG = { JUJUTSU: { trainingPoints: { criacao: 4 } }, DND5E: { actorSizes: {
  sm: { label: "Pequeno" }, med: { label: "Médio" }, lg: { label: "Grande" }
} } };
const snapshot = JSON.parse(readFileSync(new URL("./fixtures/creation-combat-styles.json", import.meta.url)));
const document = source => ({ ...structuredClone(source), toObject() {
  const { uuid, toObject, ...data } = this;return structuredClone(data);
} });
const docs = snapshot.docs.map(document);
const styles = docs.filter(doc => doc.type === "class");
const origins = docs.filter(doc => doc.type === "race");
const completedByStyle=new Map(styles.map(style=>[style.name,0]));
game.packs = new Map([["jujutsu-compendium.geral-2-0", { getDocuments: async () => snapshot.graph.map(node => ({
  name: node.nome, uuid: node.uuid, flags: { "jujutsu-system": { especializacao: node } }
})) }]]);
const graph = await carregarGrafo();
const resolve = async uuid => docs.find(doc => doc.uuid === uuid || doc._id === uuid?.split(".").at(-1))
  ?? (() => { const node = snapshot.graph.find(node => node.uuid === uuid);return node && document({
    _id: uuid.split(".").at(-1), uuid, name: node.nome, type: "feat", system: {},
    flags: { "jujutsu-system": { especializacao: node } }
  }); })();
globalThis.fromUuid = resolve;
globalThis.fromUuidSync = uuid => docs.find(doc => doc.uuid === uuid);

function fixture(style, origin, path = null, primary = null) {
  const actor = { type: "character", name: "Teste", isOwner: true, items: [], system: {}, getFlag() {} };
  const draft = creationDraft(actor);
  chooseCreationStyle(draft, style);
  if(primary)draft.primary=primary;
  Object.assign(draft, { species: origin.uuid, caminho: path?.id ?? null,
    abilities: { str: 6, dex: 3, con: 4, int: 3, wis: 2, cha: 2 } });
  let extra = Math.max(0, Number(origin.flags?.["jujutsu-system"]?.atributosAdicionais) || 0);
  for (const key of Object.keys(draft.abilities)) {const add = Math.min(extra, 6 - draft.abilities[key]);draft.abilities[key] += add;extra -= add;}
  const catalog = { styles, species: origins, graph,
    customization: Object.fromEntries(Object.keys(draft.customization).map(key => [key, []])) };
  const budget = creationBudgets(style, draft.caminho, origin);
  for (const key of ["armas", "saves", "skills"]) draft.proficiencies[key][Object.keys(draft.proficiencies[key])[0]] = budget[key];
  // Explore the same tree eligibility rules used by the creator, with restricted
  // groups first so flexible choices do not fill their slots prematurely.
  const candidates = [...graph.porNome.values()].sort((a, b) => {
    const priority = node => node.nome === "Domínio Simples" ? 0 : node.nome === "Energia Reversa" ? 1
      : node.categoria === "Técnicas de Barreira" ? 2 : 3;
    return priority(a) - priority(b);
  });
  function choose() {
    if (draft.specializations.length === budget.specializations) return true;
    for (const node of candidates) {
      if (!creationPodeEscolher(draft, style, node, catalog) || draft.specializations.includes(node.nome)) continue;
      draft.specializations.push(node.nome);
      if (choose()) return true;
      draft.specializations.pop();
    }
    return false;
  }
  assert(choose(), `${style.name} / ${path?.label ?? "padrão"}: deve haver uma seleção inicial válida`);
  assert.deepEqual(validateCreation(draft, catalog), []);
  let id = 0;
  return { actor, draft, catalog, options: { resolve, idFactory: () => `creation${String(++id).padStart(8,"0")}` } };
}

for (const style of styles) for (const path of creationPathOptions(style).length ? creationPathOptions(style) : [null]) {
  test(`${style.name}${path ? ` — ${path.label}` : ""}: transfers the selected path and every initial mandatory grant`, async () => {
    const f = fixture(style, origins.find(origin => origin.name === "Feitiço Inato"), path);
    const plan = await prepareCreationCompletion(f.actor, f.draft, f.catalog, f.options);
    const ownedStyle = plan.create.find(item => item.type === "class");
    assert.equal(ownedStyle.name, style.name);
    assert.equal(plan.actor["flags.jujutsu-system.creation2"].completed, true);
    assert.equal(plan.actor["system.legacy2.actions.value"], 6);
    assert.equal(new Set(plan.create.map(item => item._id)).size, plan.create.length);
    if (path) {
      const granted = plan.create.filter(item => item.name === path.label);
      assert.equal(granted.length, 1, "the path already chosen in the wizard must be granted exactly once");
      const choice = Object.values(ownedStyle.system.advancement).find(a => a.type === "ItemChoice");
      assert.deepEqual(choice.value.added[1], { [granted[0]._id]: granted[0].flags["jujutsu-system"].sourceId });
      assert.equal(granted[0].flags["jujutsu-system"].advancementOrigin, `${ownedStyle._id}.${choice._id}`);
    }
    for (const item of plan.create) for (const advancement of Object.values(item.system?.advancement ?? {})) {
      if (advancement.type !== "ItemGrant" || Number(advancement.level ?? 0) > 1 || advancement.configuration.optional) continue;
      for (const entry of advancement.configuration.items.filter(entry => !entry.optional)) {
        assert(Object.values(advancement.value.added).includes(entry.uuid), `${item.name}: ${entry.uuid}`);
      }
    }
    for (const name of f.draft.specializations) assert(plan.create.some(item => item.name === name));
  });
}

test("canceling a real size modal leaves all styles empty and each can complete on retry", async () => {
  for (const style of styles) {
    const f = fixture(style, origins.find(origin => origin.name === "Maldição"), creationPathOptions(style)[0]);
    const actor = new CharacterBoundary();let manager;
    class Manager extends NativeManager { constructor(...args) { super(...args);manager = this; } }
    const options = { ...f.options, Manager };
    const canceled = commitCreation(actor, f.draft, f.catalog, options);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(manager.step.flow.advancement.type, "Size");
    await manager.close({ skipConfirmation: true });
    assert.equal(await canceled, null);assert.equal(actor.writes, undefined);assert.equal(actor.items.length, 0);
    const retry = commitCreation(actor, f.draft, f.catalog, options);
    await new Promise(resolve => setImmediate(resolve));
    manager.step.flow.formValues = { size: "sm" };
    const target = { disabled: false, dataset: { action: "complete" } };
    await manager.constructor.DEFAULT_OPTIONS.actions.complete.call(manager, {}, target);
    assert(await retry);assert.equal(actor.writes, 1);assert.equal(actor.system.traits.size, "sm");
  }
});

test("optional Gojo benefits can be declined without losing the mandatory origin feature", async () => {
  const style = styles.find(style => style.name === "Especialista");
  const f = fixture(style, origins.find(origin => origin.name === "Linhagem - Gojo"));
  const actor = new CharacterBoundary();let manager;
  class Manager extends NativeManager { constructor(...args) { super(...args);manager = this; } }
  const pending = commitCreation(actor, f.draft, f.catalog, { ...f.options, Manager });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(manager.step.flow.advancement.type, "ItemGrant");
  const target = { disabled: false, dataset: { action: "complete" } };
  await manager.constructor.DEFAULT_OPTIONS.actions.complete.call(manager, {}, target);
  assert(await pending);assert.equal(actor.writes, 1);
  assert(actor.items.some(item => item.name === "Gojo"));
  assert(!actor.items.some(item => ["Seis Olhos", "Poder da Linhagem"].includes(item.name)));
});

test("an additional ItemChoice not handled by the creator keeps its native picker and saves its selection", async () => {
  const original = styles.find(style => style.name === "Restringido"), style = document({ ...original.toObject(), uuid: original.uuid });
  const choice = structuredClone(Object.values(styles.find(style => style.name === "Lutador").system.advancement)[0]);
  style.system.advancement.extra = { ...choice, _id: "extra" };
  const f = fixture(style, origins.find(origin => origin.name === "Feitiço Inato"));
  const actor = new CharacterBoundary();let manager;
  class Manager extends NativeManager { constructor(...args) { super(...args);manager = this; } }
  const pending = commitCreation(actor, f.draft, f.catalog, { ...f.options, Manager,
    resolve: async uuid => uuid === style.uuid ? style : resolve(uuid) });
  await new Promise(resolve => setImmediate(resolve));
  const flow = manager.step.flow;
  assert.equal(flow.advancement.type, "ItemChoice");
  const sections = Array.from(flow.context.sections);
  assert.equal(sections[0].items.length, 2);
  const option = sections[0].items.find(item => item.name === "Punho Ardente");
  await flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: option.uuid } });
  assert.equal(flow.counts.full, true);
  const target = { disabled: false, dataset: { action: "complete" } };
  await manager.constructor.DEFAULT_OPTIONS.actions.complete.call(manager, {}, target);
  assert(await pending);assert.equal(actor.writes, 1);
  assert.equal(actor.items.filter(item => item.name === option.name).length, 1);
});

test("every style and Power Origin combination resolves initial compendium references before opening a modal", async () => {
  let combinations = 0, blocked = 0;
  for (const style of styles) for (const path of creationPathOptions(style).length ? creationPathOptions(style) : [null]) for (const origin of origins) {
    if(creationCombinationError(style,origin)){blocked++;combinations++;continue;}
    const f = fixture(style, origin, path);
    const plan = await prepareCreationCompletion(f.actor, f.draft, f.catalog, f.options);
    assert(plan.create.some(item => item.name === origin.name));
    for (const item of plan.create) for (const a of Object.values(item.system?.advancement ?? {})) {
      if (a.type === "ItemChoice" && !a.configuration.choices?.[0]?.count && !a.configuration.choices?.[1]?.count) continue;
      if (a.type !== "ItemChoice" && Number(a.level ?? 0) > 1) continue;
      for (const entry of a.configuration?.items ?? a.configuration?.pool ?? []) assert(await resolve(entry.uuid), entry.uuid);
    }
    combinations++;
  }
  assert.equal(styles.length, 5);assert.equal(origins.length, 12);
  assert.equal(combinations, 84);assert.equal(blocked, 1);
});

for (const style of styles) for (const path of creationPathOptions(style).length ? creationPathOptions(style) : [null])
for(const primary of creationPrimaryOptions(style))for(const alternate of [false,true]) {
  test(`${style.name}${path ? ` — ${path.label}` : ""} (${primary}; ${alternate?"3":"6"} Salvaguardas): native completion succeeds with all compatible Origins`, async () => {
    alternateSaves=alternate;
    try {
    for (const origin of origins) {
      if(creationCombinationError(style,origin))continue;
      const f = fixture(style, origin, path, primary), actor = new CharacterBoundary();let manager;
      class Manager extends NativeManager { constructor(...args) { super(...args);manager = this; } }
      const pending = commitCreation(actor, f.draft, f.catalog, { ...f.options, Manager });
      // Wait for native automatic steps and the actual manual-flow context.
      await new Promise(resolve => setImmediate(resolve));
      const modals = [];
      while (manager?.rendered) {
        const flow = manager.step.flow, type = flow.advancement.type;
        modals.push(type);
        assert(modals.length <= 2, `${style.name}/${origin.name}: unexpected repeated modal`);
        assert.notEqual(type, "ItemChoice", "a style path chosen in the creator must never be requested again");
        if (type === "Size") {
          assert.equal(flow.context.size.options.length, 3);
          flow.formValues = { size: "lg" };
        } else if (type === "ItemGrant") {
          assert.equal(origin.name, "Linhagem - Gojo");
          assert.equal(flow.context.items.length, 3);
          const option = flow.context.items.find(item => item.name === "Seis Olhos");
          assert(option, "the optional feature must be visible in the actual native picker context");
          await flow._handleForm({ target: { tagName: "DND5E-CHECKBOX", checked: true, name: option.uuid } });
        } else assert.fail(`Unexpected manual flow ${type}`);
        const target = { disabled: false, dataset: { action: "complete" }, type: "button" };
        await manager.constructor.DEFAULT_OPTIONS.actions.complete.call(manager, { target }, target);
      }
      const result = await Promise.race([pending, new Promise((_, reject) => setTimeout(() => reject(new Error(
        `${style.name}/${origin.name}: completion is still pending after the final advancement`
      )), 100))]);
      assert(result);assert.equal(actor.writes, 1);assert.equal(actor.getFlag("jujutsu-system", "creation2").completed, true);
      assert.equal(actor.data.items.filter(item => item.type === "class").length, 1);
      assert.equal(actor.system.abilities[f.draft.primary].value, f.draft.abilities[f.draft.primary]);
      assert.equal(actor.system.legacy2.principalEscolhido,primary);
      assert.deepEqual(actor.system.legacy2[alternate?"alternativeSaves":"saves"],f.draft.proficiencies.saves);
      assert.deepEqual(actor.system.traits.languages.value, ["common"]);
      if (path) assert.equal(actor.data.items.filter(item => item.name === path.label).length, 1);
      if (["Maldição", "Anomalia - Corpo Amaldiçoado"].includes(origin.name)) assert.equal(actor.system.traits.size, "lg");
      if (origin.name === "Linhagem - Gojo") assert(actor.data.items.some(item => item.name === "Seis Olhos"));
      for (const node of f.draft.specializations) assert(actor.data.items.some(item => item.name === node));
      completedByStyle.set(style.name,completedByStyle.get(style.name)+1);
    }
    }finally{alternateSaves=false;}
  });
}

test("all five styles complete every compatible origin, path, primary and save-rule variation",()=>{
  assert.deepEqual(Object.fromEntries(completedByStyle),{
    Restringido:44,Lutador:48,Sentinela:24,Especialista:24,Estrategista:48
  });
  assert.equal([...completedByStyle.values()].reduce((sum,count)=>sum+count,0),188);
});
