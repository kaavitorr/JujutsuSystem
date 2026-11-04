import { benefitEffectPlan1, cursedBenefitRules1, cursedSixEyesOwned1, reducedEyesSchedule1, syncCursedBenefitResources1 } from "./seres-amaldicoados-1.mjs";
import { worldActors as allActors, unlinkedActorsFor, registerWorldActorIndex } from "./world-actor-index.mjs";
import { canRunCatalogRepair, catalogRepairDocuments, catalogRepairItems, runCatalogRepair,
  registerCatalogRepair, registerCatalogRepairHooks } from "./catalog-repair-cache.mjs";

const NS = "jujutsu-system";
const PACK = "jujutsu-compendium.geral";
const PERITO = "vn7JIDj3L9ewgbQ8";
const same = (a, b) => a === b || (!!a && !!b && typeof a === "object" && typeof b === "object"
  && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const normalize = name => String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Update only proven, unedited copies. A user's custom effects and disabled state remain theirs. */
export async function refreshCursedBenefitEffects1(world=game, scope={}) {
  if (!canRunCatalogRepair(world, scope)) return;
  return runCatalogRepair(world, "cursed-benefits-1", async () => {
  const targets = catalogRepairItems(world, scope).filter(item => item.type === "feat" && (item.flags?.[NS]?.seresAmaldicoados1
    || (item._stats?.compendiumSource ?? item.flags?.core?.sourceId)?.startsWith(`Compendium.${PACK}.Item.`)));
  if (!targets.length) return;
  const sources = (await catalogRepairDocuments(world, PACK)).filter(item => benefitEffectPlan1(item.toObject?.() ?? item));
  const byUuid = new Map(sources.map(item => [item.uuid, item]));
  const byKey = new Map(sources.map(item => [item.system.identifier, item]));
  const update = async item => {
    const origin = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    const source = byUuid.get(origin) ?? (item.flags?.[NS]?.seresAmaldicoados1 && byKey.get(item.system?.identifier));
    if (!source || item.type !== "feat" || item.system?.description?.value !== source.system?.description?.value) return;
    const before = item.toObject(), plan = benefitEffectPlan1(before);
    if (!plan || same(before.effects, plan.effects) && same(before.flags?.[NS]?.cursedBenefitAutomation1, plan.flags[NS].cursedBenefitAutomation1)) return;
    await item.update({ effects: plan.effects, [`flags.${NS}.cursedBenefitAutomation1`]: plan.flags[NS].cursedBenefitAutomation1 }, { jjCatalogRepair: true });
  };
  for (const item of targets) await update(item);
  }, scope);
}

registerCatalogRepair("cursed-benefits-1", { packs: [PACK], refresh: refreshCursedBenefitEffects1 });

/** Only automatically granted copies are removed; an independently owned basic ability is never duplicated. */
export async function syncCursedBenefitGrantedItems1(actor, world=game) {
  if (!actor?.items) return;
  // An inherited benefit receives the base actor's granted Item; don't create a second copy in the token delta.
  if (actor.isToken && cursedBenefitRules1(actor.token?.baseActor).incompleteRestriction) return;
  const items = Array.from(actor.items), managed = items.filter(item => item.flags?.[NS]?.cursedBenefitGrant1 === "perito-em-fuga");
  if (!cursedBenefitRules1(actor).incompleteRestriction) {
    if (managed.length) await actor.deleteEmbeddedDocuments("Item", managed.map(item => item.id));
    return;
  }
  if (items.some(item => item.type === "feat" && normalize(item.name) === "perito em fuga")) return;
  const source = await world.packs?.get(PACK)?.getDocument(PERITO);
  if (!source) return;
  const data = source.toObject();
  delete data._id; delete data._key; delete data.folder;
  data.flags ??= {}; data.flags[NS] ??= {}; data.flags[NS].cursedBenefitGrant1 = "perito-em-fuga";
  data._stats = { compendiumSource: `Compendium.${PACK}.Item.${PERITO}` };
  for (const effect of data.effects ?? []) {
    delete effect._key; delete effect.origin;
    // This legacy source must establish a floor without lowering a faster creature's existing speed.
    for (const change of effect.system?.changes ?? []) if (change.key === "system.attributes.movement.walk" && change.type === "override") change.type = "upgrade";
  }
  await actor.createEmbeddedDocuments("Item", [data]);
}

const eyesPending = new WeakSet();
/** A direct mental surcharge never consumes shields, temporary HP, or pending defensive reductions. */
export async function payReducedEyesPenalty1(actor, { start=false, now=game.time.worldTime }={}) {
  if (actor?.isOwner === false || eyesPending.has(actor)) return false;
  const schedule = reducedEyesSchedule1(actor, now, { start });
  if (!schedule.charges) return false;
  const hp = actor.system?.attributes?.hp;
  if (!hp) return false;
  eyesPending.add(actor);
  try {
    // Every interval deals at least two damage; rolls after certain incapacitation cannot change the HP result.
    const charges = Math.min(schedule.charges, Math.max(1, Math.ceil(Math.max(0, hp.value ?? 0) / 2)));
    const roll = await new Roll(`${charges * 2}d8`).evaluate();
    if (!cursedBenefitRules1(actor).reducedEyesPenalty || !cursedSixEyesOwned1(actor) || actor.flags?.[NS]?.seisOlhosMode !== "full") return false;
    await actor.update({ "system.attributes.hp.value": Math.max(0, (actor.system.attributes.hp.value ?? 0) - roll.total),
      [`flags.${NS}.cursedEyesLast1`]: schedule.last }, { cursedBenefitSync1: true });
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: "Seis Olhos — penalidade reduzida (2d8 a cada 10 minutos de uso)" });
    return true;
  } finally { eyesPending.delete(actor); }
}

const pending = new WeakMap();
async function anchorSyntheticGrants(actor) {
  const delta = actor.token?.delta;
  if (!delta?.update) return;
  const effective = actor.flags?.[NS]?.cursedBenefitGrants1;
  if (!effective) return;
  const own = delta.getFlag?.(NS, "cursedBenefitGrants1") ?? delta.flags?.[NS]?.cursedBenefitGrants1;
  const finite = value => Number.isFinite(Number(value)) ? Math.max(0, Math.trunc(Number(value))) : 0;
  const ledger = Object.fromEntries(["cursePoints", "trainingPoints"].map(key => [key,
    { granted: finite(effective[key]?.granted), deficit: finite(effective[key]?.deficit) }]));
  if (!same(own, ledger)) await delta.update({ [`flags.${NS}.cursedBenefitGrants1`]: ledger }, { cursedBenefitSync1: true });
}
export function syncCursedBenefits1(actor, world=game, { visited }={}) {
  if (visited?.has(actor)) return Promise.resolve();
  visited?.add(actor);
  const queued = pending.get(actor);
  if (queued) { if (queued.running) queued.again = true; return queued.promise; }
  const state = { running: false, again: false, first: true };
  state.promise = Promise.resolve().then(async () => {
    try {
      do {
        state.again = false; state.running = true;
        const passVisited = state.first ? visited : new Set([actor]); state.first = false;
        // Synthetic grants must settle before the base ledger is changed and inherited.
        if (!actor.isToken) for (const child of unlinkedActorsFor(actor, world)) {
          await syncCursedBenefits1(child, world, { visited: passVisited });
          await anchorSyntheticGrants(child);
        }
        await syncCursedBenefitResources1(actor);
        await syncCursedBenefitGrantedItems1(actor, world);
        await syncCursedBenefitClock1(actor, world);
      } while (state.again);
    } finally {
      // Removal shares the same microtask as the final check: a later caller starts fresh work.
      if (pending.get(actor) === state) pending.delete(actor);
      state.running = false;
    }
  });
  pending.set(actor, state);
  return state.promise;
}

/** Accept flat or nested Foundry patches without inspecting unrelated flags. */
function touches(changes, path) {
  for (const [raw, value] of Object.entries(changes ?? {})) {
    const key = raw.replace(/(^|\.)-=/g, "$1");
    if (key === path || key.startsWith(`${path}.`)) return true;
    if (path.startsWith(`${key}.`) && value && typeof value === "object" && touches(value, path.slice(key.length + 1))) return true;
  }
  return false;
}
const relevantActorChange = changes => ["items", "effects", "system.details.level", "system.curseResources",
  `flags.${NS}.cursedBenefits1`, `flags.${NS}.cursedBenefitGrants1`, `flags.${NS}.seisOlhosMode`].some(path => touches(changes, path));

export async function syncCursedBenefitClock1(actor, world=game) {
  const saved = actor.flags?.[NS]?.cursedEyesLast1;
  const active = cursedBenefitRules1(actor).reducedEyesPenalty && cursedSixEyesOwned1(actor)
    && actor.flags?.[NS]?.seisOlhosMode === "full";
  if (active && saved === undefined) await actor.update({ [`flags.${NS}.cursedEyesLast1`]: world.time.worldTime }, { cursedBenefitSync1: true });
  else if (!active && saved !== undefined) await actor.update({ [`flags.${NS}.-=cursedEyesLast1`]: null }, { cursedBenefitSync1: true });
}

export function registerCursedBenefitHooks1(hooks=Hooks) {
  registerWorldActorIndex(hooks);
  registerCatalogRepairHooks(hooks);
  let refreshing = false;
  const canAct = actor => actor?.type === "character" && actor.isOwner
    && (game.users?.activeGM ? game.users.activeGM.id === game.user.id : true);
  const fail = error => {
    console.error("Jujutsu: falha ao sincronizar benefícios de Seres Amaldiçoados 1.0.", error);
    ui.notifications.error("Não foi possível atualizar os benefícios de Seres Amaldiçoados.");
  };
  const sync = actor => { if (!refreshing && canAct(actor)) return syncCursedBenefits1(actor, game).catch(fail); };
  hooks.on("preCreateItem", item => {
    const plan = benefitEffectPlan1(item.toObject());
    if (plan) item.updateSource({ effects: plan.effects, [`flags.${NS}.cursedBenefitAutomation1`]: plan.flags[NS].cursedBenefitAutomation1 });
  });
  for (const event of ["createItem", "updateItem", "deleteItem"]) hooks.on(event, item => {
    if (item.parent?.documentName === "Actor" && (item.flags?.[NS]?.seresAmaldicoados1 || item.type === "class")) return sync(item.parent);
  });
  for (const event of ["createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) hooks.on(event, effect => {
    const actor = effect.parent?.documentName === "Actor" ? effect.parent : effect.parent?.parent;
    if (effect.flags?.[NS]?.cursedBenefitAutomation1 || effect.parent?.flags?.[NS]?.seresAmaldicoados1) return sync(actor);
  });
  hooks.on("updateActor", async (actor, changes, options) => {
    if (options?.cursedBenefitSync1 || !canAct(actor) || !relevantActorChange(changes)) return;
    const mode = changes[`flags.${NS}.seisOlhosMode`] ?? changes.flags?.[NS]?.seisOlhosMode;
    if (mode !== undefined) {
      if (mode === "full" && actor.flags?.[NS]?.cursedEyesLast1 === undefined) await payReducedEyesPenalty1(actor, { start: true }).catch(fail);
      else if (mode !== "full" && actor.flags?.[NS]?.cursedEyesLast1 !== undefined) await actor.update({ [`flags.${NS}.-=cursedEyesLast1`]: null }, { cursedBenefitSync1: true });
    }
    return sync(actor);
  });
  hooks.on("updateSetting", async setting => {
    if (setting.key === `${NS}.rulesetVersion`) {
      const visited = new Set();
      for (const actor of allActors(game)) if (canAct(actor)) await syncCursedBenefits1(actor, game, { visited }).catch(fail);
    }
  });
  hooks.on("updateWorldTime", async now => {
    if (game.settings?.get(NS, "rulesetVersion") === "2.0") return;
    for (const actor of allActors(game)) if (canAct(actor)) await payReducedEyesPenalty1(actor, { now }).catch(fail);
  });
  hooks.once("dnd5e.ready", async () => {
    try {
      refreshing = true;
      try { await refreshCursedBenefitEffects1(game); } finally { refreshing = false; }
      const visited = new Set();
      for (const actor of allActors(game)) if (canAct(actor)) await syncCursedBenefits1(actor, game, { visited });
    } catch (error) { fail(error); }
  });
}
