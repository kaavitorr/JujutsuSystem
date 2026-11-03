import { PECULIARIDADES } from "./peculiaridades-data.mjs";

const NS = "jujutsu-system";
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
const change = (key, value, type="add", priority=20) => ({ key, value, type, phase: "initial", priority });
const extra = amount => change("system.legacy2.especiaisExtra", amount);
const definitions = {
  "sede-de-sangue-imposta": [change("system.legacy2.pvEspecie", 1), change("system.abilities.cha.value", 1)],
  "cacador-sombrio": [change("system.abilities.int.value", 1), extra(2), change("system.legacy2.skills.arc", 2)],
  "lembrete-sombrio": [change("system.abilities.wis.value", 1), extra(2),
    ...["ability.check", "ability.save", "attack"].map(scope => change(`system.rolls.${scope}.bonus`, -1))],
  "fisico-limitado": [change("system.legacy2.pvEspecie", -1), change("system.legacy2.energiaEspecie", 2),
    change("system.abilities.con.value", 10, "downgrade", 1000)],
  "apetite-canibal": [extra(1)],
  "voto-vinculativo": [extra(3)]
};
const originalChanges = {
  "sede-de-sangue-imposta": [change("system.legacy2.pvEspecie", 1), change("system.abilities.pre.value", 1)],
  "cacador-sombrio": definitions["cacador-sombrio"].slice(0, 2),
  "lembrete-sombrio": definitions["lembrete-sombrio"].slice(0, 2),
  "fisico-limitado": definitions["fisico-limitado"].slice(0, 2),
  "apetite-canibal": definitions["apetite-canibal"],
  "voto-vinculativo": definitions["voto-vinculativo"]
};
const effectChanges = effect => Array.from(effect.system?.changes ?? effect.changes ?? []);
const type = change => change.type ?? ["custom", "multiply", "add", "downgrade", "upgrade", "override"][change.mode];
const equivalent = (actual, expected) => actual.length === expected.length && actual.every((c, i) =>
  c.key === expected[i].key && Number(c.value) === expected[i].value && type(c) === expected[i].type
  && (!c.phase || c.phase === "initial") && (!c.conditions || c.conditions === "{}"));
const itemKey = item => {
  const stable = item.flags?.[NS]?.peculiaridade;
  if (Object.hasOwn(PECULIARIDADES, stable)) return Object.hasOwn(definitions, stable) ? stable : undefined;
  return Object.keys(definitions).find(key => normalize(item.name) === normalize(PECULIARIDADES[key]));
};

/** Edition changes suppress 2.0 effects without persisting a disabled toggle or touching 1.0 traits. */
export function peculiarityEffectSuppressed(effect, edition=globalThis.game?.settings?.get?.(NS, "rulesetVersion")) {
  if (edition === "2.0") return false;
  if (effect.flags?.[NS]?.peculiarityAutomation || effect.flags?.[NS]?.desejoSombrioPenalidade) return true;
  const item = effect.item, flags = item?.flags?.[NS];
  return item?.type === "feat" && (Object.hasOwn(PECULIARIDADES, flags?.peculiaridade)
    || (flags?.featureSection === "jj-peculiarities" && Object.values(PECULIARIDADES).some(name => normalize(name) === normalize(item.name))));
}
function effectId(text) {
  let a = 2166136261, b = 2166136261;
  for (const character of text) { a = Math.imul(a ^ character.charCodeAt(0), 16777619); b = Math.imul(b ^ character.charCodeAt(0), 2246822519); }
  return [a, b].map(n => (n >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Repair only the authored grant; unknown/manual changes and its disabled state survive. */
export function peculiarityEffectPlan(item) {
  const key = itemKey(item), effects = Array.from(item.effects ?? [], effect => structuredClone(effect.toObject?.() ?? effect));
  const flags = structuredClone(item.flags ?? {});
  if (!key || item.type !== "feat") return { effects, flags };
  const name = `Peculiaridade: ${PECULIARIDADES[key]}`;
  const candidates = effects.map((effect, index) => ({effect,index})).filter(({effect}) =>
    effect.flags?.[NS]?.peculiarityAutomation?.key === key || normalize(effect.name) === normalize(name)
    || equivalent(effectChanges(effect), originalChanges[key]) || equivalent(effectChanges(effect), definitions[key]));
  // A renamed original can be identified by its complete grant. Multiple candidates cannot be safely merged.
  if (candidates.length > 1) return { effects, flags };
  const index = candidates[0]?.index ?? -1;
  if (index < 0 && effects.some(effect => effectChanges(effect).some(c =>
    [...originalChanges[key], ...definitions[key]].some(expected => expected.key === c.key)))) return { effects, flags };
  const existing = effects[index];
  // A modified authored effect is also a manual customization; do not duplicate its benefits.
  if (existing && !equivalent(effectChanges(existing), originalChanges[key])
    && !equivalent(effectChanges(existing), definitions[key])) return { effects, flags };
  const id = existing?._id ?? effectId(`${item._id ?? item.id}:${key}`);
  const changes = definitions[key].map(definition => {
    const before = effectChanges(existing ?? {}).find(c => c.key === definition.key
      || (key === "sede-de-sangue-imposta" && definition.key === "system.abilities.cha.value" && c.key === "system.abilities.pre.value"));
    const native = { ...before, ...definition, _id: before?._id ?? effectId(`${id}:${definition.key}`),
      conditions: before?.conditions ?? "{}", replacement: before?.replacement ?? "" };
    delete native.mode;
    return native;
  });
  const effect = { ...existing, _id: id, name: existing?.name ?? name,
    type: "base", img: existing?.img ?? item.img, disabled: existing?.disabled ?? false,
    transfer: existing?.transfer ?? true,
    system: { ...existing?.system, changes },
    flags: { ...existing?.flags, [NS]: { ...existing?.flags?.[NS], peculiarityAutomation: { version: 1, key } } } };
  delete effect.changes;
  if (index < 0) effects.push(effect); else effects[index] = effect;
  flags[NS] = { ...flags[NS], peculiaridade: key, peculiarityAutomation: { version: 1, key } };
  return { effects, flags };
}

/** The same enabled Item effect contributes both the choice budget and its restriction. */
export function peculiaritySpecializationGroups(actor) {
  if (globalThis.game?.settings?.get?.(NS, "rulesetVersion") !== "2.0") return [];
  const groups = [];
  for (const [key, quantidade, rotulo, casa] of [
    ["cacador-sombrio", 2, "Canalização de Energia", no => no.categoria === "Proezas Físicas" && no.caminho === "Canalização de Energia"],
    ["apetite-canibal", 1, "Proezas Físicas", no => no.categoria === "Proezas Físicas"],
    ["voto-vinculativo", 3, "Energia Reversa", no => no.categoria === "Energia Reversa"]
  ]) {
    const enabled = Array.from(actor?.items ?? []).some(item => item.type === "feat" && itemKey(item) === key
      && (item.flags?.[NS]?.peculiaridade === key || item.flags?.[NS]?.featureSection === "jj-peculiarities")
      && Array.from(item.effects ?? []).some(effect => !effect.disabled && effect.active !== false && !effect.isSuppressed && effect.transfer !== false
        && effectChanges(effect).some(c => c.key === "system.legacy2.especiaisExtra" && type(c) === "add" && Number(c.value) === quantidade)));
    if (enabled) groups.push({ id: key, quantidade, rotulo, casa, peculiaridade: true });
  }
  return groups;
}

const sourceCaches = new WeakMap();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function provenPlan(item, source) {
  if (!source || item.type !== "feat" || normalize(item.name) !== normalize(source.name)
    || item.system?.description?.value !== source.system?.description?.value) return null;
  return peculiarityEffectPlan(item);
}
const sourceId = item => item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
const activeGM = world => world.user?.isGM && (!world.users?.activeGM || world.users.activeGM.id === world.user.id);
function loadSources(world) {
  let cache = sourceCaches.get(world);
  if (cache) return cache.loading;
  cache = { sources: new Map() };
  sourceCaches.set(world, cache);
  cache.loading = (async () => {
    const pack = world.packs?.get("jujutsu-compendium.geral-2-0");
    for (const source of await pack?.getDocuments() ?? []) {
      if (itemKey(source) && source.type === "feat" && source.flags?.[NS]?.featureSection === "jj-peculiarities") cache.sources.set(source.uuid, source);
    }
    return cache.sources;
  })().catch(error => { sourceCaches.delete(world); throw error; });
  return cache.loading;
}
async function reconcileCopy(item, sources) {
  if (item.inCompendium || item.pack) return;
  const before = item.toObject(), plan = provenPlan(before, sources.get(sourceId(before)));
  if (!plan || (same(before.effects, plan.effects) && same(before.flags?.[NS]?.peculiarityAutomation, plan.flags[NS]?.peculiarityAutomation)
    && before.flags?.[NS]?.peculiaridade === plan.flags[NS]?.peculiaridade)) return;
  await item.update({ effects: plan.effects, [`flags.${NS}.peculiarityAutomation`]: plan.flags[NS].peculiarityAutomation,
    [`flags.${NS}.peculiaridade`]: plan.flags[NS].peculiaridade });
}

/** Migrate proven copies only, including unlinked token actors; never edit the source pack. */
export async function refreshPeculiarityEffects(world=game) {
  if (world.settings?.get?.(NS, "rulesetVersion") !== "2.0") return;
  // Every importing client needs the proven source cache. Only the active GM reconciles saved copies.
  const sources = await loadSources(world);
  if (!activeGM(world)) return;
  for (const item of world.items ?? []) await reconcileCopy(item, sources);
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) {
    const document = Array.isArray(scene) ? scene[1] : scene;
    for (const token of document.tokens ?? []) if (!token.actorLink && token.actor) actors.add(token.actor);
  }
  for (const actor of actors) for (const item of actor.items ?? []) await reconcileCopy(item, sources);
}

export function registerPeculiarityEffectHooks(hooks=Hooks) {
  hooks.once?.("dnd5e.ready", () => refreshPeculiarityEffects().catch(error => {
    console.error("Jujutsu: não foi possível atualizar efeitos das peculiaridades.", error);
    ui.notifications.error("Não foi possível atualizar os efeitos das peculiaridades das fichas.");
  }));
  hooks.on?.("preCreateItem", (item, data) => {
    if (globalThis.game?.settings?.get?.(NS, "rulesetVersion") !== "2.0" || item.inCompendium || item.pack) return;
    const raw = item.toObject?.() ?? data, plan = provenPlan(raw, sourceCaches.get(game)?.sources.get(sourceId(raw)));
    if (plan) item.updateSource(plan);
  });
  hooks.on?.("createItem", async item => {
    const world = globalThis.game;
    if (!activeGM(world) || world.settings?.get?.(NS, "rulesetVersion") !== "2.0" || item.inCompendium || item.pack) return;
    await reconcileCopy(item, await loadSources(world));
  });
}
