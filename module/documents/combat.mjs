import EnergyGenerationDialog from "../applications/actor/energy-generation-dialog.mjs";
import { EnergySystem } from "../systems/energy.mjs";
import Ruleset from "../systems/ruleset.mjs";
import { resetarUsoReversaNoTurno } from "../applications/actor/jj/energia-reversa.mjs";
import { prepararIniciativaDaRodada } from "../systems/iniciativa-dinamica.mjs";
import { flawInitiativeLast } from "../systems/defeitos-active-effects.mjs";
/**
 * Extended version of Combat to trigger events on combat start & turn changes.
 */
export default class Combat5e extends Combat {

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Expansion state for groups within this combat.
   * @type {Set<string>}
   */
  expandedGroups = new Set();

  /* -------------------------------------------- */
  /*  Methods                                     */
  /* -------------------------------------------- */

  /** @inheritDoc */
  async startCombat() {
    await super.startCombat();
    this._recoverUses({ encounter: true });
    return this;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async endCombat() {
    await super.endCombat();
    if ( this !== game.combat ) this._recoverUses({ turn: true, turnEnd: true, turnStart: true });
    return this;
  }

  /* -------------------------------------------- */

  /** @override */
  async rollAll(options) {
    const ids = new Set();
    for ( let combatant of this.combatants ) {
      if ( combatant.group ) combatant = combatant.group.activeCombatant;
      if ( combatant.isOwner && (combatant.initiative === null) ) ids.add(combatant.id);
    }
    return this.rollInitiative(Array.from(ids), options);
  }

  /* -------------------------------------------- */

  /** @override */
  async rollNPC(options={}) {
    const ids = new Set();
    for ( let combatant of this.combatants ) {
      if ( combatant.group ) combatant = combatant.group.activeCombatant;
      if ( combatant.isOwner && combatant.isNPC && (combatant.initiative === null) ) ids.add(combatant.id);
    }
    return this.rollInitiative(Array.from(ids), options);
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async rollInitiative(ids, options={}) {
    const combatantsInfo = ids.reduce((info, id) => {
      const rollGroupingKey = this.combatants.get(id).getInitiativeGroupingKey() ?? id;
      let deriveFrom = null;
      if ( dnd5e.settings.initiativeGroupRoll && !this.started ) {
        deriveFrom = this.combatants.find(c =>
          (c.getInitiativeGroupingKey() === rollGroupingKey) && (Number.isFinite(c.initiative))
        )?.id ?? null;
      }
      deriveFrom ??= info.toBeRolled[rollGroupingKey];
      if ( deriveFrom ) info.toBeDerived[id] = deriveFrom;
      else info.toBeRolled[rollGroupingKey] = id;
      return info;
    }, { toBeRolled: {}, toBeDerived: {} });

    await super.rollInitiative(Object.values(combatantsInfo.toBeRolled), options);

    const updates = Object.keys(combatantsInfo.toBeDerived).map(id => ({
      _id: id, initiative: this.combatants.get(combatantsInfo.toBeDerived[id]).initiative
    }));

    await this.updateEmbeddedDocuments("Combatant", updates, { turnEvents: false });

    for ( const id of ids ) await this._recoverUses({ initiative: this.combatants.get(id) });
    return this;
  }

  /* -------------------------------------------- */

  /** @override */
  _sortCombatants(a, b) {
    const last = Number(flawInitiativeLast(a.actor)) - Number(flawInitiativeLast(b.actor));
    if ( last ) return last;
    // Initiative takes top priority
    if ( a.initiative !== b.initiative ) return super._sortCombatants(a, b);

    // Separate out combatants with different base actors
    if ( !a.token?.baseActor || !b.token?.baseActor || (a.token?.baseActor !== b.token?.baseActor) ) {
      const name = c => `${c.token?.baseActor?.name ?? ""}.${c.token?.baseActor?.id ?? ""}`;
      return name(a).localeCompare(name(b), game.i18n.lang);
    }

    // Otherwise sort based on combatant name
    return a.name.localeCompare(b.name, game.i18n.lang);
  }

  /* -------------------------------------------- */
  /*  Socket Event Handlers                       */
  /* -------------------------------------------- */

  /** Prepare initiative and the first turn in the same round update. */
  async _preUpdate(changed, options, user) {
    const allowed = await super._preUpdate(changed, options, user);
    if (allowed === false) return false;
    if (!Ruleset.isV2() || !user.isGM || !game.settings.get("jujutsu-system", "iniciativaDinamica")
      || options.turnEvents === false || !(changed.round >= 1) || !(changed.round > this.round)) return;

    const { linhas, updates } = await prepararIniciativaDaRodada(this, { round: changed.round, encerrarTurno: true });
    if (!updates.length) return;
    const combatants = new Map((changed.combatants ?? []).map(update => [update._id, update]));
    for (const update of updates) combatants.set(update._id, { ...combatants.get(update._id), ...update });
    changed.combatants = Array.from(combatants.values());
    const preview = this.clone();
    preview.updateSource({ combatants: changed.combatants });
    const turns = preview.setupTurns();
    if (changed.turn !== null) {
      changed.turn = this.settings.skipDefeated ? Math.max(0, turns.findIndex(c => !c.isDefeated)) : 0;
    }
    // Match the native tie breaker in the summary as well as the tracker.
    const positions = new Map(turns.map((combatant, index) => [combatant.id, index]));
    const ordered = linhas.map((linha, index) => ({ linha, position: positions.get(updates[index]._id) }))
      .sort((a, b) => a.position - b.position).map(entry => entry.linha);
    options.jj2RoundInitiative = { round: changed.round, linhas: ordered };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if ( this.current.combatantId !== this.previous.combatantId ) {
      this.combatants.get(this.previous.combatantId)?.refreshDynamicRing();
      this.combatants.get(this.current.combatantId)?.refreshDynamicRing();
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this.combatants.get(this.current.combatantId)?.refreshDynamicRing();
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onEndTurn(combatant) {
    await super._onEndTurn(combatant);
    this._recoverUses({ turnEnd: combatant });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onStartRound(combatant) {
    await super._onStartRound(combatant);
    this._recoverUses({ round: true });
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
async _onStartTurn(combatant) {
    await resetarUsoReversaNoTurno(combatant.actor, this, combatant);
    await super._onStartTurn(combatant);
    this._recoverUses({ turn: true, turnStart: combatant });

    if (Ruleset.isRestringido(combatant.actor)) return EnergySystem.processTurnStart(combatant.actor);
    // In 2.0 the authoritative turn hook first recovers actions, then requests one cancellable modal.
    if (Ruleset.isV2()) return;

    if ( combatant.actor?.type === "character" && combatant.actor?.system.energy ) {
      // Encontrar dono da ficha (jogador ativo não-GM) ou fallback GM ativo
      const owner = game.users.find(u => !u.isGM && u.active && combatant.actor.testUserPermission(u, "OWNER"))
        ?? game.users.find(u => u.isGM && u.active);

      if ( !owner ) return;

      // Se o usuário atual é o dono, mostra o dialog direto
      if ( owner.id === game.user.id ) {
        const choices = await EnergyGenerationDialog.configure(combatant.actor);
        if ( choices ) await EnergySystem.processTurnStartWithChoices(combatant.actor, choices);
      }
      // Caso contrário, GM emite socket para o dono
      else if ( game.user.isGM ) {
        game.socket.emit("system.jujutsu-system", {
          action: "energyGenerationDialog",
          actorId: combatant.actor.id,
          userId: owner.id
        });
      }
    }
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async _onExit(combatant) {
    await super._onExit(combatant);
    const actor = combatant.actor;
    if ( !actor ) return;
    const batchDelete = [{
      action: "delete",
      documentName: "ActiveEffect",
      ids: [],
      parent: actor
    }];
    const shouldDelete = effect => {
      // Don't delete dependent effects, as these will be deleted via the 5e dependency registry
      if ( effect.getFlag("jujutsu-system", "dependentOn") ) return false;

      // Don't delete item-bound effects which aren't applied enchantments
      if ( !effect.isAppliedEnchantment && (effect.parent instanceof Item) ) return false;

      // If effect is expired, delete
      if ( effect.duration.expired ) return true;

      // Otherwise, if a combat-specific pseudo-expiry, delete only if no start combat or start combat is this combat
      const startCombat = effect.start?.combat;
      return effect.specialDuration && (!startCombat || (combatant.parent === startCombat));
    };
    for ( const effect of actor.effects ) {
      if ( shouldDelete(effect) ) batchDelete[0].ids.push(effect.id);
    }
    for ( const item of actor.items ) {
      const toDelete = [];
      for ( const effect of item.effects ) {
        if ( shouldDelete(effect) ) toDelete.push(effect.id);
      }
      if ( toDelete.length ) batchDelete.push({
        action: "delete",
        documentName: "ActiveEffect",
        ids: toDelete,
        parent: item
      });
    }
    return foundry.documents.modifyBatch(batchDelete);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Determine which group each combatant should be added to, or if a new group should be created.
   * @returns {Map<string, { combatants: Combatant5e[], expanded: boolean }>}
   */
  createGroups() {
    const groups = new Map();
    for ( const combatant of this.combatants ) {
      const key = combatant.getGroupingKey();
      if ( key === null ) continue;
      groups.getOrInsert(key, { combatants: [], expanded: this.expandedGroups.has(key) }).combatants.push(combatant);
    }

    for ( const [key, { combatants }] of groups.entries() ) {
      if ( combatants.length <= 1 ) groups.delete(key);
    }

    return groups;
  }

  /* -------------------------------------------- */

  /**
   * Reset combat specific uses.
   * @param {object} types  Which types of recovery to handle, and whether they should be performed on all combatants
   *                        or only the combatant specified.
   * @protected
   */
  async _recoverUses(types) {
    for ( const combatant of this.combatants ) {
      if ( combatant.isDefeated ) continue;
      const periods = Object.entries(types).filter(([, v]) => (v === true) || (v === combatant)).map(([k]) => k);
      if ( periods.length ) await combatant.recoverCombatUses(periods);
    }
  }
}
