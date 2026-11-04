import { updateEnergyShieldTree } from "./legacy2-energy-shield-tree.mjs";
import { CORPO_GUERREIRO_ORDER, PHYSICAL_SPECIALIZATIONS, PHYSICAL_CATALOG_VERSION,
  PHYSICAL_CATALOG_MARKER, specializationDescription } from "./legacy2-physical-specialization-data.mjs";
import { isSpeedBurst, potentialConfigUpdates, potentialPool } from "./legacy2-potential-points.mjs";

const PACK = "jujutsu-compendium.geral-2-0", NS = "jujutsu-system";
const pending = new WeakMap();
const pendingCopies = new WeakMap();
const editionTwo = world => world.settings?.get(NS, "rulesetVersion") === "2.0";
const activeGM = world => world.user?.isGM && (!world.users?.activeGM || world.users.activeGM.id === world.user.id);
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const isBodyPath = path => ["corpo-de-guerreiro", "corpo-do-guerreiro"].includes(normalize(path));
const ruleFor = item => item.type === "feat" ? Object.values(PHYSICAL_SPECIALIZATIONS).find(rule =>
  item.system?.identifier === rule.identifier || normalize(item.name) === rule.identifier) : null;
const needsUpdate = item => Number(item.flags?.[NS]?.[PHYSICAL_CATALOG_MARKER] ?? 0)
  < (ruleFor(item)?.version ?? PHYSICAL_CATALOG_VERSION);

function rulePatch(rule) {
  return { "system.description.value": specializationDescription(rule),
    ...(rule.uses ? { "system.uses.max": rule.uses.max, "system.uses.recovery": structuredClone(rule.uses.recovery) } : {}),
    "system.requirements": rule.requirements.join(" e "),
    "flags.jujutsu-system.especializacao.requisitos": [...rule.requirements],
    [`flags.${NS}.${PHYSICAL_CATALOG_MARKER}`]: rule.version ?? PHYSICAL_CATALOG_VERSION };
}

/** Only the requested entries and their explicit path order are changed. */
export function updatePhysicalSpecializations(world = game) {
  if (world.settings?.get(NS, "rulesetVersion") !== "2.0" || !world.user?.isGM
    || (world.users?.activeGM && world.users.activeGM.id !== world.user.id)) return Promise.resolve(null);
  const pack = world.packs?.get(PACK);
  if (!pack) return Promise.resolve(null);
  if (pending.has(pack)) return pending.get(pack);
  const task = updatePack(pack, world).finally(() => pending.delete(pack));
  pending.set(pack, task);
  return task;
}

async function updatePack(pack, world) {
  const documents = await pack.getDocuments();
  const anchor = documents.find(item => isBodyPath(item.flags?.[NS]?.especializacao?.caminho));
  // A partial/foreign catalog is not a target for this migration.
  if (!anchor) return null;
  const path = anchor.flags[NS].especializacao.caminho;
  const updates = [];
  for (const item of documents) {
    if (!needsUpdate(item)) continue;
    const rule = ruleFor(item), specialization = item.flags?.[NS]?.especializacao;
    const order = isBodyPath(specialization?.caminho) ? CORPO_GUERREIRO_ORDER.findIndex(name => normalize(name) === normalize(item.name)) + 1 : 0;
    if (!rule && !order) continue;
    const patch = rule ? rulePatch(rule) : { [`flags.${NS}.${PHYSICAL_CATALOG_MARKER}`]: PHYSICAL_CATALOG_VERSION };
    if (rule === PHYSICAL_SPECIALIZATIONS["Reação Acelerada"]) Object.assign(patch, {
      "system.identifier": rule.identifier,
      "system.requirements": rule.requirements.join(" e "),
      "system.prerequisites.level": null,
      "system.prerequisites.items": [],
      "flags.jujutsu-system.especializacao.categoria": "Proezas Físicas",
      "flags.jujutsu-system.especializacao.caminho": path,
      "flags.jujutsu-system.especializacao.ordem": 3
    });
    if (order) patch["flags.jujutsu-system.especializacao.ordem"] = order;
    updates.push({ item, patch });
  }
  const reactionRule = PHYSICAL_SPECIALIZATIONS["Reação Acelerada"];
  const missing = !documents.some(item => ruleFor(item) === reactionRule);
  if (updates.length || missing) {
    const locked = pack.locked;
    try {
      if (locked) await pack.configure({ locked: false });
      for (const { item, patch } of updates) await item.update(patch);
      if (missing) {
        const template = world.items?.find(item => ruleFor(item) === reactionRule)?.toObject?.() ?? {};
        const data = { ...template, _id: reactionRule.id, name: "Reação Acelerada", type: "feat",
          img: template.img ?? reactionRule.img, folder: anchor.folder?.id ?? anchor.folder ?? null };
        (data.system ??= {}).identifier = reactionRule.identifier;
        (data.system.description ??= {}).value = specializationDescription(reactionRule);
        data.system.requirements = reactionRule.requirements.join(" e ");
        Object.assign(data.system.prerequisites ??= {}, { level: null, items: [] });
        Object.assign((data.flags ??= {})[NS] ??= {}, {
          especializacao: { categoria: "Proezas Físicas", caminho: path, requisitos: [...reactionRule.requirements], ordem: 3 },
          [PHYSICAL_CATALOG_MARKER]: reactionRule.version ?? PHYSICAL_CATALOG_VERSION
        });
        await pack.documentClass.create(data, { pack: pack.collection, keepId: true, renderSheet: false });
      }
    } finally {
      if (locked) await pack.configure({ locked: true });
    }
  }
  await updateOwnedCopies(world);
  return pack;
}

function ownedPatch(item, actor) {
  const rule = ruleFor(item);
  if (!rule) return null;
  const spec = item.flags?.[NS]?.especializacao;
  const canonical = spec?.categoria === "Proezas Físicas"
    && (isBodyPath(rule.path) ? isBodyPath(spec.caminho) : spec.caminho === rule.path)
    || item._stats?.compendiumSource?.startsWith(`Compendium.${PACK}.Item.`);
  if (!canonical) return null;
  const patch = needsUpdate(item) ? { _id: item.id ?? item._id, ...rulePatch(rule) } : null;
  if (patch && actor && isSpeedBurst(item)) patch["system.uses.max"] = String(potentialPool(actor).max);
  const capacity = actor && isSpeedBurst(item) ? potentialConfigUpdates(actor).find(update => update._id === (item.id ?? item._id)) : null;
  return capacity ? { ...patch, ...capacity } : patch;
}

function updateActorCopies(actor) {
  if (!actor || actor.isOwner === false) return Promise.resolve();
  const previous = pendingCopies.get(actor) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const updates = Array.from(actor.items ?? []).map(item => ownedPatch(item, actor)).filter(Boolean);
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  });
  pendingCopies.set(actor, task);
  return task.finally(() => { if (pendingCopies.get(actor) === task) pendingCopies.delete(actor); });
}

/** Native JSON imports suppress hooks; the importing owner repairs only this actor. */
export function syncImportedPhysicalSpecializations(actor, world = game) {
  if (!editionTwo(world) || !actor?.isOwner || !["character", "npc"].includes(actor.type)) return Promise.resolve();
  return updateActorCopies(actor);
}

async function updateOwnedCopies(world) {
  for (const item of world.items ?? []) {
    const patch = ownedPatch(item);
    if (patch) { delete patch._id; await item.update(patch); }
  }
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) for (const token of scene.tokens ?? []) {
    if (!token.actorLink && token.actor) actors.add(token.actor);
  }
  const seen = new Set();
  for (const actor of actors) {
    if (actor.isOwner === false || seen.has(actor.uuid ?? actor)) continue;
    seen.add(actor.uuid ?? actor);
    await updateActorCopies(actor);
  }
}

export function registerPhysicalSpecializationUpdate(hooks = Hooks) {
  const report = error => {
    console.error("Jujutsu: não foi possível atualizar as especializações físicas.", error);
    ui.notifications.warn("Não foi possível atualizar as especializações físicas. Recarregue o mundo para tentar novamente.");
  };
  const repairActor = actor => {
    if (editionTwo(game) && activeGM(game)) return updateActorCopies(actor).catch(report);
  };
  hooks.on("createActor", repairActor);
  hooks.on("createToken", token => { if (!token.actorLink) return repairActor(token.actor); });
  hooks.on("createItem", item => {
    if (!editionTwo(game) || !activeGM(game)) return;
    if (item.parent?.documentName === "Actor") {
      if (ownedPatch(item, item.parent)) return updateActorCopies(item.parent).catch(report);
      return;
    }
    if (item.pack === PACK || item.compendium?.collection === PACK) {
      if (ruleFor(item) && needsUpdate(item)) {
        // A running pass may have captured its documents before this import.
        const previous = pending.get(game.packs?.get(PACK)) ?? Promise.resolve();
        return previous.catch(() => {}).then(() => updatePhysicalSpecializations()).catch(report);
      }
      return;
    }
    const patch = ownedPatch(item);
    if (patch) { delete patch._id; return item.update(patch).catch(report); }
  });
  hooks.once("dnd5e.ready", async () => {
    try {
      await updateEnergyShieldTree();
      await updatePhysicalSpecializations();
    } catch (error) { report(error); }
  });
}
