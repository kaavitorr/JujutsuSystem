/** Explosão de Velocidade stores its PP in the feat's native limited uses. */
const NS = "jujutsu-system";
export const SPEED_BURST_VERSION = 2;
export const SPEED_BURST_DESCRIPTION = "<p>Você recebe <strong>5 Pontos de Potencial (PP)</strong>, que podem ser utilizados para reduzir o Custo em Pontos de Ação de suas Técnicas, até um mínimo de 1. Esses PP são recuperados no início de cada encontro e não são perdidos caso não sejam utilizados.</p>"
  + "<p>Você recebe <strong>+1 Ponto de Potencial a cada 2 Habilidades de Especialização</strong> que possuir no caminho do Corpo de Guerreiro.</p>";
const pending = new WeakMap();
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const integer = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
export const isSpeedBurst = item => item?.type === "feat"
  && [normalize(item.system?.identifier), normalize(item.name)].includes("explosao-de-velocidade");
export const isBodyPathAbility = item => item?.type === "feat" && (isSpeedBurst(item)
  || ["corpo-de-guerreiro", "corpo-do-guerreiro"].includes(normalize(
    (item.flags?.[NS]?.especializacao ?? item.getFlag?.(NS, "especializacao"))?.caminho)));
export const potentialRecovery = () => [{ period: "encounter", type: "recoverAll" }];

export function potentialPool(actor) {
  const learned = new Set(); let item;
  for (const feat of actor?.items ?? []) {
    if (!isBodyPathAbility(feat)) continue;
    if (isSpeedBurst(feat)) { item ??= feat; learned.add("explosao-de-velocidade"); }
    else learned.add(normalize(feat.system?.identifier || feat.name));
  }
  const max = item ? 5 + Math.floor(learned.size / 2) : 0;
  const spent = integer(item?.system?.uses?.spent);
  return { item, max, spent, current: Math.max(0, max - spent) };
}

export function potentialDiscount(activity, config, actor, actionCost) {
  if (activity?.item?.type !== "spell") return 0;
  return Math.min(integer(config?.legacy2?.potencial), potentialPool(actor).current, Math.max(0, actionCost - 1));
}

/** Learning changes the maximum, never resets spent PP. */
export function potentialConfigUpdates(actor) {
  const { item, max } = potentialPool(actor);
  if (!item) return [];
  const uses = item._source?.system?.uses ?? item.system?.uses ?? {}, patch = { _id: item.id ?? item._id };
  if (String(uses.max ?? "") !== String(max)) patch["system.uses.max"] = String(max);
  if (uses.recovery?.length !== 1 || uses.recovery[0].period !== "encounter" || uses.recovery[0].type !== "recoverAll")
    patch["system.uses.recovery"] = potentialRecovery();
  return Object.keys(patch).length > 1 ? [patch] : [];
}

export async function syncPotentialPoints(actor, world = game) {
  if (world.settings?.get(NS, "rulesetVersion") !== "2.0" || actor?.isOwner !== true
    || !["character", "npc"].includes(actor.type)) return;
  const previous = pending.get(actor) ?? Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const updates = potentialConfigUpdates(actor), { item } = potentialPool(actor);
    if (item && Number(item.flags?.[NS]?.physicalSpecializationsVersion ?? 0) < SPEED_BURST_VERSION) {
      const patch = updates[0] ?? { _id: item.id ?? item._id };
      Object.assign(patch, { "system.description.value": SPEED_BURST_DESCRIPTION,
        [`flags.${NS}.physicalSpecializationsVersion`]: SPEED_BURST_VERSION });
      if (!updates.length) updates.push(patch);
    }
    if (updates.length) await actor.updateEmbeddedDocuments("Item", updates, { potentialPointsSync: true });
  });
  pending.set(actor, task);
  return task.finally(() => { if (pending.get(actor) === task) pending.delete(actor); });
}
