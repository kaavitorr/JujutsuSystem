/** The creator already allocates the initial attributes and uses the 2.0 resource formulas. */
export function creationAdvancementFlows(manager) {
  const flows = [];
  for (const item of manager.clone.items) for (const level of [0, 1]) {
    for (const flow of manager.constructor.flowsForLevel(item, level)) {
      const advancement = flow.advancement;
      const type = advancement.type ?? advancement.constructor.typeName;
      if (["race", "class"].includes(item.type) && ["AbilityScoreImprovement", "HitPoints"].includes(type)) continue;
      const choices = advancement.configuration.choices?.[level];
      if (type === "ItemChoice" && choices?.count > 0 && !choices.replacement
        && Object.keys(advancement.value?.added?.[level] ?? {}).length >= choices.count) continue;
      // Mandatory grants have already been resolved, including their own advancements.
      if (type === "ItemGrant" && !advancement.configuration.optional
        && !advancement.configuration.items.some(grant => grant.optional)
        && (advancement.configuration.spell?.ability?.size ?? 0) < 2) continue;
      // Size.apply expects an object; multiple allowed sizes require a choice.
      if (type === "Size") flow.getAutomaticApplicationValue = async () => {
        const sizes = Array.from(advancement.configuration.sizes);
        return sizes.length > 1 ? false : { size: sizes[0] ?? "med" };
      };
      flows.push({ type: "forward", flow, level: 1 });
    }
  }
  return flows;
}

/** Canonicalize legacy compendium links so the native choice UI can resolve them too. */
async function resolveInitialPools(plan, resolve) {
  for (const item of plan.create) for (const advancement of Object.values(item.system?.advancement ?? {})) {
    const config = advancement.configuration ?? {};
    const initial = advancement.type === "ItemChoice"
      ? [0, 1].some(level => Number(config.choices?.[level]?.count ?? 0) > 0)
      : Number(advancement.level ?? 0) <= 1;
    if (!initial || !["ItemGrant", "ItemChoice"].includes(advancement.type)) continue;
    for (const entry of config.items ?? config.pool ?? []) {
      if (!entry.uuid) continue;
      const doc = await resolve(entry.uuid);
      if (doc?.uuid) entry.uuid = doc.uuid;
    }
  }
}

/** Let native grants recognize a non-repeatable feature already chosen in the creator. */
function reconcileInitialGrants(plan) {
  const source = item => item.flags?.JujutsuLegacy?.sourceId ?? item.flags?.["jujutsu-system"]?.sourceId
    ?? item._stats?.compendiumSource ?? item.flags?.["jujutsu-system"]?.creation2Source;
  for (const owner of plan.create) for (const advancement of Object.values(owner.system?.advancement ?? {})) {
    if (advancement.type !== "ItemGrant" || Number(advancement.level ?? 0) > 1) continue;
    const origin = `${owner._id}.${advancement._id}`;
    for (const { uuid } of advancement.configuration?.items ?? []) {
      const existing = plan.create.find(item => item.type === "feat" && !item.system?.prerequisites?.repeatable
        && source(item) === uuid && (!item.flags?.JujutsuLegacy?.advancementOrigin
          || item.flags.JujutsuLegacy.advancementOrigin === origin)
        && (!item.flags?.["jujutsu-system"]?.advancementOrigin
          || item.flags["jujutsu-system"].advancementOrigin === origin));
      if (!existing) continue;
      (advancement.value ??= {}).added ??= {};
      advancement.value.added[existing._id] = uuid;
      existing.flags ??= {};
      for (const scope of ["jujutsu-system", "JujutsuLegacy"]) Object.assign(existing.flags[scope] ??= {}, {
        sourceId: uuid, advancementOrigin: origin,
        advancementRoot: owner.flags?.[scope]?.advancementRoot ?? origin
      });
    }
  }
}

/** ItemChoice applies checkbox changes immediately, but native navigation does not require a full choice. */
function incompleteCreationChoice(step) {
  const advancement = step?.flow?.advancement;
  if ((advancement?.type ?? advancement?.constructor.typeName) !== "ItemChoice") return null;
  const level = step.flow.level, required = Number(advancement.configuration.choices?.[level]?.count ?? 0);
  const counts = advancement.getCounts?.(level) ?? {
    current: Object.keys(advancement.value?.added?.[level] ?? {}).length, max: required
  };
  return counts.current < counts.max ? counts : null;
}

/** Serialize the native preview, after transferred effects and all advancement choices. */
export function creationPlanFromPreview(preview) {
  const originUpdates = creationOriginResourceUpdates(preview.toObject().items);
  if (Object.keys(originUpdates).length) preview.updateSource(originUpdates);
  preview.reset();
  const { items, _id, ...actor } = preview.toObject();
  items.push(...channelingTechniqueGrants(items, Ruleset.nivel(preview)).map(item => ({ ...item, _id: foundry.utils.randomID() })));
  for (const item of items) {
    item.flags ??= {};
    const flags = item.flags["jujutsu-system"] ??= {};
    const legacy = item.flags.JujutsuLegacy ??= {};
    for (const key of ["sourceId", "advancementOrigin", "advancementRoot"]) {
      if (legacy[key] !== undefined) flags[key] = legacy[key];
      if (flags[key] !== undefined) legacy[key] ??= flags[key];
    }
    flags.creation2Source = flags.sourceId ?? item._stats?.compendiumSource ?? flags.creation2Source;
  }
  // Native flows may create new items with nested grants. Follow the immediate
  // owner to recover the same root in both flag namespaces used by the system.
  const byId = new Map(items.map(item => [item._id, item]));
  for (const item of items) {
    const visited = new Set([item._id]);
    let parent = item, root = item.flags["jujutsu-system"].advancementRoot;
    while (parent?.flags?.["jujutsu-system"]?.advancementOrigin) {
      const origin = parent.flags["jujutsu-system"].advancementOrigin;
      const id = origin.split(".")[0];
      if (visited.has(id)) throw new Error("Há um vínculo circular nos benefícios da criação.");
      visited.add(id);root = origin;parent = byId.get(id);
      if (!parent) break;
    }
    if (root) for (const scope of ["jujutsu-system", "JujutsuLegacy"]) item.flags[scope].advancementRoot = root;
  }
  const hp = preview.system.attributes.hp;
  actor.system.attributes.hp.value = Math.max(0, hp.effectiveMax ?? hp.max ?? 0);
  Object.assign(actor.system.energy, initialCreationEnergy(preview));
  return { actor, create: items };
}

/**
 * Run native advancement flows against a clone, never the actual character.
 * Closing the manager discards its preview; the creator can then be resumed.
 */
export async function collectCreationAdvancements(actor, plan, {
  resolve = globalThis.fromUuid, Manager
} = {}) {
  await resolveInitialPools(plan, resolve);
  reconcileInitialGrants(plan);
  Manager ??= (await import("../../advancement/advancement-manager.mjs")).default;
  let finish, reject, settled = false;
  const result = new Promise((resolve, fail) => { finish = resolve;reject = fail; });
  class CreationAdvancementManager extends Manager {
    static DEFAULT_OPTIONS = {
      ...Manager.DEFAULT_OPTIONS,
      actions: Object.fromEntries(Object.entries(Manager.DEFAULT_OPTIONS.actions).map(([action, handler]) => [
        action, async function(event, target) {
          if (["next", "complete"].includes(action)) {
            const counts = incompleteCreationChoice(this.step);
            if (counts) {
              ui.notifications.error(`Selecione os benefícios obrigatórios antes de continuar (${counts.current}/${counts.max}).`);
              return;
            }
          }
          try { return await handler.call(this, event, target); }
          catch (error) { await this._failCreation(error);throw error; }
        }
      ]))
    };

    _settleCreation() {
      if (settled) return;
      settled = true;
      if (this.creationError) reject(this.creationError);
      else finish(this.creationResult ?? null);
    }

    async _failCreation(error) {
      this.creationError ??= error;
      // A failed form or transition must release both windows before the creator resumes.
      await Promise.allSettled(this.steps.map(step => step.flow?.close()));
      try { await this.close({ skipConfirmation: true }); }
      finally { this._settleCreation(); }
    }

    _guardCreationFlow(flow) {
      if (!flow || this.guardedCreationFlows.has(flow)) return;
      this.guardedCreationFlows.add(flow);
      for (const name of ["_handleForm", "_onDrop", "render"]) {
        if (typeof flow[name] !== "function") continue;
        const method = flow[name];
        flow[name] = async (...args) => {
          try { return await method.apply(flow, args); }
          catch (error) {
            const ExpectedError = flow.advancement.constructor.ERROR;
            if (!ExpectedError || !(error instanceof ExpectedError)) await this._failCreation(error);
            throw error;
          }
        };
      }
    }

    guardedCreationFlows = new WeakSet();

    async render(...args) {
      this._guardCreationFlow((this.step ?? this.steps[0])?.flow);
      try {
        const rendered = await super.render(...args);
        if (!settled && rendered === undefined) {
          throw new Error("A abertura dos benefícios da criação foi interrompida. Tente concluir a criação novamente.");
        }
        return rendered;
      } catch (error) {
        await this._failCreation(error);
        return this;
      }
    }

    async _complete() {
      this.creationResult = creationPlanFromPreview(this.clone);
      await this.close({ skipConfirmation: true });
      // V14 skips _onClose when every flow was automatic and no window rendered.
      this._settleCreation();
    }
    async close(options = {}) {
      await super.close(options);
      if (!this.rendered && !this.element) this._settleCreation();
    }
    _onClose(options) {
      super._onClose(options);
      this._settleCreation();
    }
  }
  const manager = new CreationAdvancementManager(actor, { automaticApplication: true });
  manager.clone.updateSource({ ...plan.actor, items: plan.create });
  manager.clone.reset();
  manager.steps = creationAdvancementFlows(manager);
  if (!manager.steps.length) return creationPlanFromPreview(manager.clone);
  await manager.render({ force: true });
  return result;
}
import Ruleset from "../../../systems/ruleset.mjs";
import { EnergySystem } from "../../../systems/energy.mjs";
import { channelingTechniqueGrants } from "../../../systems/legacy2-channeling-techniques.mjs";
import { creationOriginResourceUpdates } from "./creation-origin-resources-2.mjs";

/** Initialize resources using the same reserve transfer and stamina rules as a normal turn. */
export function initialCreationEnergy(actor, maximum = actor.system.energy?.max ?? 0) {
  if (Ruleset.isRestringido(actor)) return { total: 0, generated: Ruleset.staminaMax(actor) };
  const total = Math.max(0, Math.floor(Number(maximum) || 0));
  const preview = { type: actor.type, itemTypes: actor.itemTypes, flags: actor.flags,
    system: { details: actor.system.details, legacy2: actor.system.legacy2,
      energy: { ...actor.system.energy, total, generated: 0 } } };
  const transfer = EnergySystem.actionReserveRefinementUpdates(preview, 0);
  return { total: transfer["system.energy.total"] ?? total, generated: transfer["system.energy.generated"] ?? 0 };
}
