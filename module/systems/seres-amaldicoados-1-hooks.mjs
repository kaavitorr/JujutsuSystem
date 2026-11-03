import { benefitEffectPlan1, cursedBenefitRules1, cursedSixEyesOwned1, reducedEyesSchedule1, syncCursedBenefitResources1 } from "./seres-amaldicoados-1.mjs";

const NS = "jujutsu-system";
const PACK = "jujutsu-compendium.geral";
const PERITO = "vn7JIDj3L9ewgbQ8";
const same = (a, b) => a === b || (!!a && !!b && typeof a === "object" && typeof b === "object"
  && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b, key) && same(a[key], b[key])));
const allActors = world => new Set([...[...(world.scenes ?? [])].flatMap(scene =>
  Array.from(scene.tokens ?? []).filter(token => !token.actorLink).map(token => token.actor)), ...(world.actors ?? [])].filter(Boolean));
const normalize = name => String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Update only proven, unedited copies. A user's custom effects and disabled state remain theirs. */
export async function refreshCursedBenefitEffects1(world=game) {
  if (!world.user.isGM || world.users.activeGM?.id !== world.user.id) return;
  const pack = world.packs.get(PACK);
  if (!pack) return;
  const sources = (await pack.getDocuments()).filter(item => benefitEffectPlan1(item.toObject?.() ?? item));
  const byUuid = new Map(sources.map(item => [item.uuid, item]));
  const byKey = new Map(sources.map(item => [item.system.identifier, item]));
  const update = async item => {
    const origin = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    const source = byUuid.get(origin) ?? (item.flags?.[NS]?.seresAmaldicoados1 && byKey.get(item.system?.identifier));
    if (!source || item.type !== "feat" || item.system?.description?.value !== source.system?.description?.value) return;
    const before = item.toObject(), plan = benefitEffectPlan1(before);
    if (!plan || same(before.effects, plan.effects) && same(before.flags?.[NS]?.cursedBenefitAutomation1, plan.flags[NS].cursedBenefitAutomation1)) return;
    await item.update({ effects: plan.effects, [`flags.${NS}.cursedBenefitAutomation1`]: plan.flags[NS].cursedBenefitAutomation1 });
  };
  for (const item of world.items ?? []) await update(item);
  for (const actor of allActors(world)) for (const item of actor.items ?? []) await update(item);
}

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
export function syncCursedBenefits1(actor, world=game) {
  const previous = pending.get(actor) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    if (!actor.isToken) for (const scene of world.scenes ?? []) for (const token of scene.tokens ?? []) {
      if (!token.actorLink && token.actor && token.baseActor === actor) await syncCursedBenefits1(token.actor, world);
    }
    await syncCursedBenefitResources1(actor);
    await syncCursedBenefitGrantedItems1(actor, world);
    await syncCursedBenefitClock1(actor, world);
  });
  pending.set(actor, next);
  return next.finally(() => { if (pending.get(actor) === next) pending.delete(actor); });
}

export async function syncCursedBenefitClock1(actor, world=game) {
  const saved = actor.flags?.[NS]?.cursedEyesLast1;
  const active = cursedBenefitRules1(actor).reducedEyesPenalty && cursedSixEyesOwned1(actor)
    && actor.flags?.[NS]?.seisOlhosMode === "full";
  if (active && saved === undefined) await actor.update({ [`flags.${NS}.cursedEyesLast1`]: world.time.worldTime }, { cursedBenefitSync1: true });
  else if (!active && saved !== undefined) await actor.update({ [`flags.${NS}.-=cursedEyesLast1`]: null }, { cursedBenefitSync1: true });
}

export function registerCursedBenefitHooks1(hooks=Hooks) {
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
    if (options?.cursedBenefitSync1 || !canAct(actor)) return;
    const mode = changes[`flags.${NS}.seisOlhosMode`] ?? changes.flags?.[NS]?.seisOlhosMode;
    if (mode !== undefined) {
      if (mode === "full" && actor.flags?.[NS]?.cursedEyesLast1 === undefined) await payReducedEyesPenalty1(actor, { start: true }).catch(fail);
      else if (mode !== "full" && actor.flags?.[NS]?.cursedEyesLast1 !== undefined) await actor.update({ [`flags.${NS}.-=cursedEyesLast1`]: null }, { cursedBenefitSync1: true });
    }
    return sync(actor);
  });
  hooks.on("updateSetting", setting => {
    if (setting.key === `${NS}.rulesetVersion`) return Promise.all([...allActors(game)].map(sync));
  });
  hooks.on("updateWorldTime", async now => {
    for (const actor of allActors(game)) if (canAct(actor)) await payReducedEyesPenalty1(actor, { now }).catch(fail);
  });
  hooks.once("dnd5e.ready", async () => {
    try {
      refreshing = true;
      try { await refreshCursedBenefitEffects1(game); } finally { refreshing = false; }
      for (const actor of allActors(game)) await sync(actor);
    } catch (error) { fail(error); }
  });
}
