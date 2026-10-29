import Ruleset from "../../../systems/ruleset.mjs";
import { channelingTechniqueGrants } from "../../../systems/legacy2-channeling-techniques.mjs";
import { alternativeSavesEnabled } from "../../../systems/legacy2-alternative-saves.mjs";
import { collectCreationAdvancements, initialCreationEnergy } from "./creation-advancements-2.mjs";
import { creationOriginResourceUpdates } from "./creation-origin-resources-2.mjs";
import { creationActor, validateCreation, rankSpent, ABILITY_KEYS, styleRules, creationPathOptions, creationSpecializationSlots, creationWeaponBonus,
  PENALIDADE_VITAL_NOME, penalidadeVitalUuid } from "./creation-model-2.mjs";

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
  const caminhoInfo = creationPathOptions(style).find(caminho => caminho.id === draft.caminho) ?? null;

  const create = [], seen = new Map(), resolving = new Set();
  async function addDocument(uuid, tag = {}, depth = 0) {
    if (resolving.has(uuid)) throw new Error("Há um vínculo circular nos benefícios da Origem ou do Estilo de Combate.");
    if (seen.has(uuid)) {
      const data = seen.get(uuid);
      if (Object.keys(tag).length && data.type !== "feat") throw new Error("Uma habilidade escolhida deixou de ser uma característica.");
      Object.assign(data.flags["jujutsu-system"], tag);
      return data;
    }
    if (depth > 8) throw new Error("Não foi possível concluir os benefícios vinculados à Origem.");
    const doc = uuid === draft.species ? species : uuid === draft.style ? style : await resolve(uuid);
    if (!doc) throw new Error("Uma das opções escolhidas não está mais disponível. Confira suas escolhas.");
    if (Object.keys(tag).length && doc.type !== "feat") throw new Error("Uma habilidade escolhida deixou de ser uma característica.");
    const source = doc.uuid ?? uuid;
    if (resolving.has(source)) throw new Error("Há um vínculo circular nos benefícios da Origem ou do Estilo de Combate.");
    if (seen.has(source)) {
      const data = seen.get(source);
      Object.assign(data.flags["jujutsu-system"], tag); seen.set(uuid, data);
      return data;
    }
    const data = raw(doc);
    data._id = idFactory(); data.folder = null;
    data._stats = { ...data._stats, compendiumSource: source.startsWith("Compendium.") ? source : data._stats?.compendiumSource ?? null };
    data.flags ??= {}; data.flags["jujutsu-system"] = { ...data.flags["jujutsu-system"], ...tag,
      creation2Source: source };
    for (const scope of ["jujutsu-system", "JujutsuLegacy"]) {
      const flags = data.flags[scope] ??= {};
      delete flags.advancementOrigin;delete flags.advancementRoot;
      flags.sourceId = source;
    }
    // A penalidade de Vida/Energia traz os dois efeitos; no ator entra só o
    // lado escolhido na criação (a escolha fica registrada na flag).
    if ( doc?.type === "feat" && doc.name === PENALIDADE_VITAL_NOME ) {
      data.flags["jujutsu-system"].penalidadeVital = draft.penalidadeVital;
      const manter = draft.penalidadeVital === "vida" ? "Penalidade: Vida" : "Penalidade: Energia";
      data.effects = (data.effects ?? []).filter(efeito => efeito.name === manter);
    }
    if (data.type === "class") data.system.levels = 1;
    create.push(data);
    seen.set(uuid, data);
    seen.set(source, data);
    resolving.add(source);
    for (const [key, advancement] of Object.entries(data.system?.advancement ?? {})) {
      // Source items can be copies of an owned item. Never retain another actor's grants.
      if (advancement.type === "ItemGrant") advancement.value = {};
      if (advancement.type === "ItemChoice") advancement.value = { added: {}, replaced: {} };
      // The style path was already selected in the creator. Record that choice
      // on its native advancement instead of asking again in a second modal.
      if (advancement.type === "ItemChoice" && source === style.uuid && caminhoInfo
        && advancement.classRestriction !== "secondary"
        && Number(advancement.configuration?.choices?.[1]?.count) === 1) {
        for (const entry of advancement.configuration.pool ?? []) {
          const option = await resolve(entry.uuid);
          if (!option || option.name !== caminhoInfo.label) continue;
          advancement._id ??= key;
          const granted = await addDocument(entry.uuid, {}, depth + 1);
          const uuid = granted.flags["jujutsu-system"].creation2Source;
          entry.uuid = uuid;
          advancement.value.added[1] = { [granted._id]: uuid };
          const origin = `${data._id}.${advancement._id}`;
          for (const scope of ["jujutsu-system", "JujutsuLegacy"]) {
            const flags = granted.flags[scope] ??= {};
            flags.advancementOrigin = origin;
            flags.advancementRoot = origin;
          }
          break;
        }
      }
      if (advancement.type !== "ItemGrant" || Number(advancement.level ?? 0) > 1) continue;
      advancement._id ??= key;
      advancement.value.added = {};
      if (data.type === "class" && advancement.classRestriction === "secondary") continue;
      if (advancement.configuration?.optional) continue;
      for (const grant of advancement.configuration?.items ?? []) {
        if (grant.optional || !grant.uuid) continue;
        const granted = await addDocument(grant.uuid, {}, depth + 1);
        const spellConfig = doc.advancement?.byId?.[advancement._id]?.configuration?.spell;
        if (granted.type === "spell" && spellConfig) {
          const ability = Array.from(spellConfig.ability ?? [])[0];
          spellConfig.applySpellChanges(granted, { ability });
          if (ability) advancement.value.ability = ability;
        }
        grant.uuid = granted.flags["jujutsu-system"].creation2Source;
        advancement.value.added[granted._id] = grant.uuid;
        const origin = `${data._id}.${advancement._id}`;
        const root = data.flags["jujutsu-system"].advancementRoot ?? origin;
        for (const scope of ["jujutsu-system", "JujutsuLegacy"]) {
          const flags = granted.flags[scope] ??= {};
          flags.sourceId ??= grant.uuid;
          flags.advancementOrigin ??= origin;
          flags.advancementRoot ??= root;
        }
        // Nested grants were resolved before the parent's ownership was known.
        for (const child of create) for (const scope of ["jujutsu-system", "JujutsuLegacy"]) {
          const flags = child.flags?.[scope];
          if (flags?.advancementRoot?.startsWith(`${granted._id}.`)) flags.advancementRoot = root;
        }
      }
    }
    resolving.delete(source);
    return data;
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
  create.push(...channelingTechniqueGrants(create, 1).map(item => ({ ...item, _id: idFactory() })));
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
  // Penalidade variante de Vida/Energia: o lado escolhido entra no preview
  // para PV/Energia iniciais já reduzidos (no ator, o efeito transferido do
  // item mantém a redução no valor preparado).
  const penalidadeVital = draft.customization["jj-variant-penalties"]?.includes(penalidadeVitalUuid(catalog))
    ? draft.penalidadeVital : null;
  if ( penalidadeVital === "vida" ) preview.system.legacy2.pvEspecie -= 2;
  if ( penalidadeVital === "energia" ) preview.system.legacy2.energiaEspecie -= 4;
  const hp = Ruleset.maxHitPoints(preview), energy = Ruleset.maxEnergy(preview);
  const initialEnergy = initialCreationEnergy(preview, energy);
  const slotsExtras = Math.max(0, creationSpecializationSlots(style, draft.caminho, species).total - Number(styleRules(style).espIniciais ?? 0));
  const pontosArmasExtras = creationWeaponBonus(style, draft.caminho);
  const updates = { name: draft.name.trim(), img: draft.img || actor.img,
    "system.details.originalClass": seen.get(draft.style)._id,
    "prototypeToken.texture.src": draft.tokenImg || draft.img || actor.prototypeToken?.texture?.src,
    "prototypeToken.name": draft.name.trim(), "system.legacy2.principalEscolhido": draft.primary,
    "system.legacy2.pvEspecie": pvEspecie, "system.legacy2.energiaEspecie": energiaEspecie,
    "system.attributes.hp.value": hp,
    "system.energy.total": initialEnergy.total, "system.energy.generated": initialEnergy.generated,
    "system.legacy2.wounds.value": 0, "system.legacy2.actions.value": 6,
    "system.legacy2.pontos.gastos": Object.values(draft.proficiencies).reduce((sum, ranks) => sum + rankSpent(ranks), 0),
    "flags.jujutsu-system.especializacoes": [...draft.specializations],
    "flags.jujutsu-system.caminhoEstilo": (caminhoInfo || slotsExtras > 0)
      ? { id: caminhoInfo?.id ?? null, label: caminhoInfo?.label ?? null, estilo: style.name, slotsExtras, pontosArmasExtras } : null,
    "flags.jujutsu-system.creation2": { completed: true, completedAt: Date.now(), species: draft.species,
      style: draft.style, primary: draft.primary, caminho: draft.caminho, specializations: [...draft.specializations] } };
  Object.assign(updates, creationOriginResourceUpdates(create));
  for (const key of ABILITY_KEYS) updates[`system.abilities.${key}.value`] = draft.abilities[key];
  for (const [category, ranks] of Object.entries(draft.proficiencies)) {
    const field = category === "saves" && alternativeSavesEnabled() ? "alternativeSaves" : category;
    updates[`system.legacy2.${field}`] = { ...ranks };
  }
  for (const [key, value] of Object.entries(draft.physical)) updates[`system.details.${key}`] = String(value ?? "");
  return { actor: updates, create };
}

/** Keep the guard across resolution and the native batch; failed creation can be retried. */
export function commitCreation(actor, draft, catalog, { advance = collectCreationAdvancements, ...options } = {}) {
  if (pending.has(actor)) return pending.get(actor);
  const run = (async () => {
    let plan = await prepareCreationCompletion(actor, draft, catalog, options);
    plan = await advance(actor, plan, options);
    if (!plan) return null;
    // Choices may keep the preview open for a while; reject concurrent sheet edits.
    if ((actor.items?.size ?? actor.items?.length ?? 0) || actor.getFlag?.("jujutsu-system", "creation2")?.completed)
      throw new Error("A ficha foi alterada durante a criação. Confira as alterações antes de continuar.");
    await actor.performBulkUpdate(plan, { isAdvancement: true });
    return plan;
  })();
  pending.set(actor, run);
  run.finally(() => { if (pending.get(actor) === run) pending.delete(actor); }).catch(() => {});
  return run;
}
