import Ruleset from "../../../systems/ruleset.mjs";
import { creationActor, validateCreation, rankSpent, ABILITY_KEYS, styleRules, creationPathOptions, creationSpecializationSlots } from "./creation-model-2.mjs";

const pending = new WeakMap();
const raw = doc => structuredClone(doc.toObject?.() ?? doc);

function speciesHP(species) {
  const rules = species.getFlag?.("jujutsu-system", "legacy2") ?? species.flags?.["jujutsu-system"]?.legacy2 ?? {};
  if (Number.isFinite(Number(rules.pvEspecie ?? rules.vidaBase))) return Number(rules.pvEspecie ?? rules.vidaBase);
  const text = (species.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ");
  const match = /(?:Pontos de Vida Base|Vida Base)\s*:\s*([+-]?\d+)/i.exec(text);
  return Number(match?.[1] ?? 0);
}

function speciesEnergy(species) {
  const rules = species.getFlag?.("jujutsu-system", "legacy2") ?? species.flags?.["jujutsu-system"]?.legacy2 ?? {};
  if (Number.isFinite(Number(rules.energiaEspecie))) return Number(rules.energiaEspecie);
  const text = (species.system?.description?.value ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ");
  const match = /Energia Base\s*:\s*([+-]?\d+)/i.exec(text);
  return Number(match?.[1] ?? 0);
}

/** Resolve and validate every choice before producing a single native actor/item batch. */
export async function prepareCreationCompletion(actor, draft, catalog, {
  resolve = globalThis.fromUuid, idFactory = () => foundry.utils.randomID()
} = {}) {
  if (!actor.isOwner || actor.type !== "character" || actor.getFlag?.("jujutsu-system", "creation2")?.completed)
    throw new Error("A criação deste personagem não está disponível.");
  if (actor.items?.size ?? actor.items?.length ?? 0) throw new Error("A ficha já possui itens. Reabra a ficha para conferir as alterações.");
  const species = await resolve(draft.species), style = await resolve(draft.style);
  if (species?.type !== "race" || style?.type !== "class") throw new Error("Confira a Origem de Poder e o Estilo de Combate.");
  const fresh = { ...catalog, species: [species], styles: [style] };
  const errors = validateCreation(draft, fresh);
  if (errors.length) throw new Error(errors[0].message);

  const create = [], seen = new Map();
  async function addDocument(uuid, tag = {}, depth = 0) {
    if (seen.has(uuid)) {
      const data = seen.get(uuid);
      if (Object.keys(tag).length && data.type !== "feat") throw new Error("Uma habilidade escolhida deixou de ser uma característica.");
      Object.assign(data.flags["jujutsu-system"], tag);
      return;
    }
    if (depth > 8) throw new Error("Não foi possível concluir os benefícios vinculados à Origem.");
    const doc = uuid === draft.species ? species : uuid === draft.style ? style : await resolve(uuid);
    if (!doc) throw new Error("Uma das opções escolhidas não está mais disponível. Confira suas escolhas.");
    if (Object.keys(tag).length && doc.type !== "feat") throw new Error("Uma habilidade escolhida deixou de ser uma característica.");
    const source = doc.uuid ?? uuid;
    if (seen.has(source)) {
      const data = seen.get(source);
      Object.assign(data.flags["jujutsu-system"], tag); seen.set(uuid, data);
      return;
    }
    const data = raw(doc);
    data._id = idFactory(); data.folder = null;
    data._stats = { ...data._stats, compendiumSource: source.startsWith("Compendium.") ? source : data._stats?.compendiumSource ?? null };
    data.flags ??= {}; data.flags["jujutsu-system"] = { ...data.flags["jujutsu-system"], ...tag,
      creation2Source: source };
    if (data.type === "class") data.system.levels = 1;
    create.push(data);
    seen.set(uuid, data);
    seen.set(source, data);
    for (const advancement of Object.values(data.system?.advancement ?? {})) {
      if (advancement.type !== "ItemGrant" || Number(advancement.level ?? 0) > 1) continue;
      for (const grant of advancement.configuration?.items ?? []) {
        if (grant.optional || !grant.uuid) continue;
        await addDocument(grant.uuid, {}, depth + 1);
      }
    }
  }
  await addDocument(draft.species);
  await addDocument(draft.style);
  for (const name of draft.specializations) {
    const node = catalog.graph.porNome.get(name);
    await addDocument(node.uuid, { especializacaoAdquirida: true, featureSection: "jj-combat" });
  }
  for (const [category, uuids] of Object.entries(draft.customization)) {
    for (const uuid of uuids) await addDocument(uuid, { featureSection: category });
  }
  const preview = creationActor(draft, style);
  const pvEspecie = speciesHP(species);
  preview.system.legacy2.pvEspecie = pvEspecie;
  const energiaEspecie = speciesEnergy(species);
  preview.system.legacy2.energiaEspecie = energiaEspecie;
  // Bônus de PV/Energia da Origem entram no cálculo inicial; o valor armazenado
  // segue só com a base (o maxHitPoints/maxEnergy lêem o bônus do item depois).
  const pvAdicional = Number(species.getFlag?.("jujutsu-system", "pvAdicional")
    ?? species.flags?.["jujutsu-system"]?.pvAdicional ?? 0);
  preview.system.legacy2.pvBonusOrigem = pvAdicional;
  const energiaAdicional = Number(species.getFlag?.("jujutsu-system", "energiaAdicional")
    ?? species.flags?.["jujutsu-system"]?.energiaAdicional ?? 0);
  preview.system.legacy2.energiaBonusOrigem = energiaAdicional;
  const hp = Ruleset.maxHitPoints(preview), energy = Ruleset.maxEnergy(preview);
  const caminhoInfo = creationPathOptions(style).find(caminho => caminho.id === draft.caminho) ?? null;
  const slotsExtras = Math.max(0, creationSpecializationSlots(style, draft.caminho).total - Number(styleRules(style).espIniciais ?? 0));
  const updates = { name: draft.name.trim(), img: draft.img || actor.img,
    "prototypeToken.texture.src": draft.tokenImg || draft.img || actor.prototypeToken?.texture?.src,
    "prototypeToken.name": draft.name.trim(), "system.legacy2.principalEscolhido": draft.primary,
    "system.legacy2.pvEspecie": pvEspecie, "system.legacy2.energiaEspecie": energiaEspecie,
    "system.attributes.hp.value": hp,
    "system.energy.total": energy, "system.energy.generated": Math.min(10, energy),
    "system.legacy2.wounds.value": 0, "system.legacy2.actions.value": 6,
    "system.legacy2.pontos.gastos": Object.values(draft.proficiencies).reduce((sum, ranks) => sum + rankSpent(ranks), 0),
    "flags.jujutsu-system.especializacoes": [...draft.specializations],
    "flags.jujutsu-system.caminhoEstilo": (caminhoInfo || slotsExtras > 0)
      ? { id: caminhoInfo?.id ?? null, label: caminhoInfo?.label ?? null, estilo: style.name, slotsExtras } : null,
    "flags.jujutsu-system.creation2": { completed: true, completedAt: Date.now(), species: draft.species,
      style: draft.style, primary: draft.primary, caminho: draft.caminho, specializations: [...draft.specializations] } };
  for (const key of ABILITY_KEYS) updates[`system.abilities.${key}.value`] = draft.abilities[key];
  for (const [category, ranks] of Object.entries(draft.proficiencies)) updates[`system.legacy2.${category}`] = { ...ranks };
  for (const [key, value] of Object.entries(draft.physical)) updates[`system.details.${key}`] = String(value ?? "");
  return { actor: updates, create };
}

/** Keep the guard across resolution and the native batch; failed creation can be retried. */
export function commitCreation(actor, draft, catalog, options) {
  if (pending.has(actor)) return pending.get(actor);
  const run = (async () => {
    const plan = await prepareCreationCompletion(actor, draft, catalog, options);
    await actor.performBulkUpdate(plan);
    return plan;
  })();
  pending.set(actor, run);
  run.finally(() => { if (pending.get(actor) === run) pending.delete(actor); }).catch(() => {});
  return run;
}
