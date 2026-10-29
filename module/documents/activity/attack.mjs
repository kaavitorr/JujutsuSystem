import AttackSheet from "../../applications/activity/attack-sheet.mjs";
import AttackRollConfigurationDialog from "../../applications/dice/attack-configuration-dialog.mjs";
import BaseAttackActivityData from "../../data/activity/attack-data.mjs";
import TargetsField from "../../data/chat-message/fields/targets-field.mjs";
import D20RollModificationField from "../../data/shared/d20-roll-modification-field.mjs";
import { prepareJJAttackContext, postJJAttackRoll, commitLegacy2Attack, fulgorAtivoPara, excedenteCriticoPara } from "../../applications/actor/jj/native-cards.mjs";
import { doencaInterrompeAtaque, marcarDoencaUsada } from "../../systems/peculiaridades-automacao.mjs";
import Ruleset from "../../systems/ruleset.mjs";
import { extraEscalaDano } from "../../systems/escala-dano.mjs";
import { activationChoices } from "../../applications/activity/legacy2-activation.mjs";
import ActivityMixin from "./mixin.mjs";

/**
 * @import {
 *   AttackRollDialogConfiguration, AttackRollProcessConfiguration, BasicRollMessageConfiguration, D20RollConfiguration
 * } from "../../dice/_types.mjs";
 * @import { AmmunitionUpdate } from "./_types.mjs";
 */

/**
 * Activity for making attacks and rolling damage.
 */
export default class AttackActivity extends ActivityMixin(BaseAttackActivityData) {
  /* -------------------------------------------- */
  /*  Model Configuration                         */
  /* -------------------------------------------- */

  /** @inheritDoc */
  static LOCALIZATION_PREFIXES = [...super.LOCALIZATION_PREFIXES, "DND5E.ATTACK"];

  /* -------------------------------------------- */

  /** @inheritDoc */
  static metadata = Object.freeze(
    foundry.utils.mergeObject(super.metadata, {
      type: "attack",
      img: "systems/jujutsu-system/icons/svg/activity/attack.svg",
      title: "DND5E.ATTACK.Title.one",
      hint: "DND5E.ATTACK.Hint",
      sheetClass: AttackSheet,
      targetPhase: "post",
      usage: {
        applyEffectsInChat: false,
        actions: {
          rollAttack: AttackActivity.#rollAttack,
          rollDamage: AttackActivity.#rollDamage
        }
      }
    }, { inplace: false })
  );

  /* -------------------------------------------- */
  /*  Activation                                  */
  /* -------------------------------------------- */

  /** @override */
  _usageChatButtons(message) {
    const buttons = [{
      action: "rollAttack",
      icon: "systems/jujutsu-system/icons/svg/trait-weapon-proficiencies.svg",
      label: { value: "DND5E.Attack" }
    }];
    if ( this.damage.parts.length || this.item.system.properties?.has("amm") ) buttons.push({
      action: "rollDamage",
      icon: "fa-solid fa-burst",
      label: { value: "DND5E.Damage" }
    });
    return buttons.concat(super._usageChatButtons(message));
  }

  /* -------------------------------------------- */

  /** @override */
  async _triggerSubsequentActions(config, results) {
    this.rollAttack({ event: config.event, legacy2: config.legacy2 }, Ruleset.isV2() ? { configure: false } : {}, { data: { system: { origin: results.message?.id } } });
  }

  /* -------------------------------------------- */
  /*  Rolling                                     */
  /* -------------------------------------------- */

  /**
   * Perform an attack roll.
   * @param {AttackRollProcessConfiguration} config  Configuration information for the roll.
   * @param {AttackRollDialogConfiguration} dialog   Configuration for the roll dialog.
   * @param {BasicRollMessageConfiguration} message  Configuration for the roll message.
   * @returns {Promise<D20Roll[]|null>}
   */
  async rollAttack(config={}, dialog={}, message={}) {
    if (Ruleset.isV2() && !this._jj2Activation?.prepaid) delete this._jj2OriginMessage;
    if (Ruleset.isV2() && this._jj2Activation) config = { ...config, legacy2: config.legacy2 ?? this._jj2Activation };
    // jujutsu: diálogos customizados de Energia/PA antes da rolagem
    // (assíncronos — não podem viver em hook, que não é awaitado). Cancelar
    // aqui não gasta PA de ativação já consumido: a escolha é que permite
    // desistir sem gastar.
    if ( !(await prepareJJAttackContext(this)) ) return null;

    const rolls = await this.#rollAttackBase(config, dialog, message);
    if (Ruleset.isV2() && rolls?.length) delete this._jj2Activation;

    // jujutsu: Fulgor Negro e Crítico Excedente dependem do resultado do
    // acerto (com awaits internos) — rodados AQUI, aguardados, para estarem
    // no stash antes do dano automático abaixo.
    if ( rolls?.length ) await postJJAttackRoll(this, rolls);

    // jujutsu: rola o DANO junto com o ataque (comportamento da mesa) — sem
    // diálogo, herdando ability/munição/modo e o crítico do ataque. A escolha
    // de Energia/PA já foi feita e é injetada pelo maybePromptJJScale.
    if ( rolls?.length && this.damage?.parts?.length && !config.skipAutoDamage ) {
      const { ability, ammunition, attackMode } = rolls[0].options ?? {};
      // Doença Sobrenatural: crítico próprio é interrompido (Inconsciente,
      // 1×/descanso longo) — o dano automático não rola.
      if ( rolls[0].isCritical && doencaInterrompeAtaque(this.actor) ) {
        await marcarDoencaUsada(this.actor);
        return rolls;
      }
      // Kokusen (Fulgor Negro, 20 natural + dado secundário): o ×2,5 incide
      // sobre o dano BASE — o crítico normal (dobrar os dados) é sobrescrito.
      // Crítico Excedente: acerto acima da CA na margem rola como crítico
      // (dobra os dados), mesmo funcionamento do 20 natural sem Black Flash.
      const kokusen = fulgorAtivoPara(this);
      const criticoEfetivo = rolls[0].isCritical || excedenteCriticoPara(this);
      await this.rollDamage(
        { ability, ammunition, attackMode, isCritical: criticoEfetivo && !kokusen, legacy2: config.legacy2 },
        { configure: false }
      );
    }
    return rolls;
  }

  async #rollAttackBase(config={}, dialog={}, message={}) {
    const targets = TargetsField.getDescriptors();

    if ( (this.item.type === "weapon") && (this.item.system.quantity === 0) ) {
      ui.notifications.warn("DND5E.ATTACK.Warning.NoQuantity", { localize: true });
    }

    const buildConfig = this._buildAttackConfig.bind(this);

    const rollConfig = foundry.utils.mergeObject({
      ability: this.item.getFlag("jujutsu-system", `last.${this.id}.ability`),
      ammunition: this.item.getFlag("jujutsu-system", `last.${this.id}.ammunition`),
      attackMode: this.item.getFlag("jujutsu-system", `last.${this.id}.attackMode`),
      halflingLucky: this.actor?.getFlag("jujutsu-system", "halflingLucky"),
      mastery: this.item.getFlag("jujutsu-system", `last.${this.id}.mastery`),
      target: targets.length === 1 ? targets[0].ac : undefined
    }, config);

    const abilityOptions = this._getAbilityOptions();
    if ( abilityOptions.length && !abilityOptions.find(a => a.value === rollConfig.ability) ) {
      rollConfig.ability = abilityOptions[0]?.value;
    }
    const ammunitionOptions = this.item.system.ammunitionOptions ?? [];
    if ( ammunitionOptions.length ) ammunitionOptions.unshift({ value: "", label: "" });
    if ( rollConfig.ammunition === undefined ) rollConfig.ammunition = ammunitionOptions?.[1]?.value;
    else if ( !ammunitionOptions?.find(m => m.value === rollConfig.ammunition) ) {
      rollConfig.ammunition = ammunitionOptions?.[0]?.value;
    }
    const attackModeOptions = this.item.system.attackModes;
    if ( !attackModeOptions?.find(m => m.value === rollConfig.attackMode) ) {
      rollConfig.attackMode = attackModeOptions?.[0]?.value;
    }
    const masteryOptions = this.item.system.masteryOptions;
    if ( !masteryOptions?.find(m => m.value === rollConfig.mastery) ) {
      rollConfig.mastery = masteryOptions?.[0]?.value;
    }

    const rollData = this.getRollData({ roll: { ability: rollConfig.ability, attackMode: rollConfig.attackMode } });
    const { advantage, disadvantage } = this.actor ? D20RollModificationField.combineFields(this.actor.system, [
      `abilities.${rollConfig.ability}.attack.roll`,
      "rolls.attack", `rolls.attack.${this.getActionType(rollConfig.attackMode)}`
    ], { rules: { category: "attack", actor: this.actor, item: this.item, rollData } }) : {};

    // Condições de visão (2.0):
    //   Invisível: os ataques do ator invisível têm vantagem e ataques contra
    //   um alvo invisível têm desvantagem.
    //   Cego: os ataques do ator cego têm desvantagem e ataques contra um alvo
    //   cego têm vantagem.
    // Vantagem e desvantagem se anulam quando ambas ocorrem.
    const condicoesVisao = a => ({
      invisivel: !!a?.statuses?.has?.("jj-invisivel"),
      cego: !!a?.statuses?.has?.("jj-cego")
    });
    const condAtacante = Ruleset.isV2() ? condicoesVisao(this.actor) : { invisivel: false, cego: false };
    const condAlvos = Ruleset.isV2()
      ? targets.map(d => condicoesVisao(fromUuidSync(d.token, { strict: false })?.actor))
      : [];
    const vantagemCondicional = condAtacante.invisivel || condAlvos.some(c => c.cego);
    const desvantagemCondicional = condAtacante.cego || condAlvos.some(c => c.invisivel);

    rollConfig.hookNames = [...(config.hookNames ?? []), "attack", "d20Test"];
    rollConfig.rolls = [CONFIG.Dice.D20Roll.mergeConfigs({
      options: {
        advantage: (!!advantage || vantagemCondicional) && !(!!disadvantage || desvantagemCondicional),
        disadvantage: (!!disadvantage || desvantagemCondicional) && !(!!advantage || vantagemCondicional),
        ammunition: rollConfig.ammunition,
        attackMode: rollConfig.attackMode,
        criticalSuccess: this.criticalThreshold,
        mastery: rollConfig.mastery
      }
    }, config.rolls?.shift())].concat(config.rolls ?? []);
    rollConfig.subject = this;

    const dialogConfig = foundry.utils.mergeObject({
      applicationClass: AttackRollConfigurationDialog,
      options: {
        abilityOptions,
        ammunitionOptions: rollConfig.ammunition !== false ? ammunitionOptions : [],
        attackModeOptions,
        buildConfig,
        masteryOptions: (masteryOptions?.length > 1) && !config.mastery ? masteryOptions : [],
        position: {
          top: config.event ? config.event.clientY - 80 : null,
          left: window.innerWidth - 710
        },
        window: {
          title: _loc("DND5E.AttackRoll"),
          subtitle: this.item.name,
          icon: this.item.img
        }
      }
    }, dialog);

    const messageConfig = foundry.utils.mergeObject({
      create: true,
      data: {
        flavor: `${this.item.name} - ${_loc("DND5E.AttackRoll")}`,
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        system: { ...this.messageSources, targets },
        type: "attack"
      }
    }, message);

    const rolls = await CONFIG.Dice.D20Roll.buildConfigure(rollConfig, dialogConfig, messageConfig);
    if ( !rolls.length ) return null;
    if (Ruleset.isV2() && !await commitLegacy2Attack(this, rolls[0].options.legacy2 ?? rollConfig.legacy2,
      { prepaid: this._jj2Activation?.prepaid === true })) return null;
    await CONFIG.Dice.D20Roll.buildEvaluate(rolls, rollConfig, messageConfig);
    const { ability, ammunition, mastery, attackMode: mode } = rolls[0].options;
    for ( const [key, value] of Object.entries({ ability, ammunition, mastery, mode }) ) {
      if ( value ) foundry.utils.setProperty(messageConfig.data, `system.${key}`, value);
    }
    await CONFIG.Dice.D20Roll.buildPost(rolls, rollConfig, messageConfig);

    const flags = {};
    let ammoUpdate = null;

    const canUpdate = this.item.isOwner && !this.item.inCompendium;
    if ( rolls[0].options.ability ) flags.ability = rolls[0].options.ability;
    if ( rolls[0].options.ammunition ) {
      const ammo = this.actor?.items.get(rolls[0].options.ammunition);
      if ( ammo ) {
        if ( !ammo.system.properties?.has("ret") ) {
          ammoUpdate = { id: ammo.id, quantity: Math.max(0, ammo.system.quantity - 1) };
          ammoUpdate.destroy = ammo.system.uses.autoDestroy && (ammoUpdate.quantity === 0);
        }
        flags.ammunition = rolls[0].options.ammunition;
      }
    } else if ( rolls[0].options.attackMode?.startsWith("thrown") && !this.item.system.properties?.has("ret") ) {
      ammoUpdate = { id: this.item.id, quantity: Math.max(0, this.item.system.quantity - 1) };
    } else if ( !rolls[0].options.ammunition && dialogConfig.options?.ammunitionOptions?.length ) {
      flags.ammunition = "";
    }
    if ( rolls[0].options.attackMode ) flags.attackMode = rolls[0].options.attackMode;
    else if ( rollConfig.attackMode ) rolls[0].options.attackMode = rollConfig.attackMode;
    if ( rolls[0].options.mastery ) flags.mastery = rolls[0].options.mastery;
    if ( canUpdate && !foundry.utils.isEmpty(flags) && (this.actor && this.actor.items.has(this.item.id)) ) {
      await this.item.setFlag("jujutsu-system", `last.${this.id}`, flags);
    }

    /**
     * A hook event that fires after an attack has been rolled but before any ammunition is consumed.
     * @function dnd5e.rollAttack
     * @memberof hookEvents
     * @param {D20Roll[]} rolls                        The resulting rolls.
     * @param {object} data
     * @param {AttackActivity|null} data.subject       The Activity that performed the attack.
     * @param {AmmunitionUpdate|null} data.ammoUpdate  Any updates related to ammo consumption for this attack.
     */
    Hooks.callAll("dnd5e.rollAttack", rolls, { subject: this, ammoUpdate });
    Hooks.callAll("dnd5e.rollAttackV2", rolls, { subject: this, ammoUpdate });

    // Commit ammunition consumption on attack rolls resource consumption if the attack roll was made
    if ( canUpdate && ammoUpdate?.destroy ) {
      // If ammunition was deleted, store a copy of it in the roll message
      const deleted = [this.actor.items.get(ammoUpdate.id).toObject()];
      const messageId = messageConfig.data?.system?.origin
        ?? rollConfig.event?.target.closest("[data-message-id]")?.dataset.messageId;
      const attackMessage = dnd5e.registry.messages.get(messageId, "attack")?.pop();
      await attackMessage?.update({ "system.deltas": { deleted } });
      await this.actor.deleteEmbeddedDocuments("Item", [ammoUpdate.id]);
    }
    else if ( canUpdate && ammoUpdate ) await this.actor?.updateEmbeddedDocuments("Item", [
      { _id: ammoUpdate.id, "system.quantity": ammoUpdate.quantity }
    ]);

    /**
     * A hook event that fires after an attack has been rolled and ammunition has been consumed.
     * @function dnd5e.postRollAttack
     * @memberof hookEvents
     * @param {D20Roll[]} rolls                   The resulting rolls.
     * @param {object} data
     * @param {AttackActivity|null} data.subject  The activity that performed the attack.
     */
    Hooks.callAll("dnd5e.postRollAttack", rolls, { subject: this });

    return rolls;
  }

  /* -------------------------------------------- */

  /**
   * Configure a roll config for each roll performed as part of the attack process. Will be called once per roll
   * in the process each time an option is changed in the roll configuration interface.
   * @param {AttackRollProcessConfiguration} process       Configuration for the entire rolling process.
   * @param {D20RollConfiguration} config                  Configuration for a specific roll.
   * @param {FormDataExtended} [formData]                  Any data entered into the rolling prompt.
   * @param {number} index                                 Index of the roll within all rolls being prepared.
   */
  _buildAttackConfig(process, config, formData, index) {
    let ability = formData?.get("ability") ?? process.ability;
    let ammunition = formData?.get("ammunition") ?? process.ammunition;
    let attackMode = formData?.get("attackMode") ?? process.attackMode;
    if (Ruleset.isV2()) {
      const choices = { ability, ammunition, attackMode, ...(process.legacy2 ?? {}) };
      for (const key of ["vantagens", "desvantagens", "pa", "bonus", "ability", "ammunition", "attackMode", "scale", "mastery"]) {
        if (formData?.has(`legacy2.${key}`)) choices[key] = formData.get(`legacy2.${key}`);
      }
      process.legacy2 = activationChoices(this, choices);
      ({ ability, ammunition, attackMode } = process.legacy2);
    }
    const mastery = formData?.get("legacy2.mastery") ?? formData?.get("mastery") ?? process.legacy2?.mastery ?? process.mastery;

    let { parts, data } = this.getAttackData({ ability, ammunition, attackMode, legacy2: process.legacy2 });
    const { maximum, minimum } = this.actor ? D20RollModificationField.combineFields(this.actor.system, [
      `abilities.${ability}.attack.roll`,
      "rolls.attack", `rolls.attack.${this.getActionType(attackMode)}`
    ], { rules: { category: "attack", actor: this.actor, item: this.item, rollData: data } }) : {};
    const options = CONFIG.Dice.D20Roll.mergeOptions({
      elvenAccuracy: this.actor?.getFlag("jujutsu-system", "elvenAccuracy")
        && CONFIG.DND5E.characterFlags.elvenAccuracy.abilities.includes(ability),
      maximum,
      minimum
    }, config.options);
    if ( ability !== undefined ) options.ability = ability;
    if ( ammunition !== undefined ) options.ammunition = ammunition;
    if ( attackMode !== undefined ) options.attackMode = attackMode;
    if ( mastery !== undefined ) options.mastery = mastery;
    if (Ruleset.isV2()) {
      options.legacy2 = process.legacy2;
      options.advantage = options.disadvantage = false;
      options.advantageMode = CONFIG.Dice.D20Roll.ADV_MODE.NORMAL;
      if (process.legacy2.bonus) { parts.push("@jj2ManualBonus"); data.jj2ManualBonus = process.legacy2.bonus; }
    }

    config.parts = [...(config.parts ?? []), ...parts];
    config.data = { ...data, ...(config.data ?? {}) };
    config.options = options;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers                */
  /* -------------------------------------------- */

  /**
   * Handle performing an attack roll.
   * @this {AttackActivity}
   * @param {PointerEvent} event     Triggering click event.
   * @param {HTMLElement} target     The capturing HTML element which defined a [data-action].
   * @param {ChatMessage5e} message  Message associated with the activation.
   */
  static #rollAttack(event, target, message) {
    this.rollAttack({ event }, {}, { data: { system: { origin: message.id } } });
  }

  /* -------------------------------------------- */

  /**
   * Handle performing a damage roll.
   * @this {AttackActivity}
   * @param {PointerEvent} event     Triggering click event.
   * @param {HTMLElement} target     The capturing HTML element which defined a [data-action].
   * @param {ChatMessage5e} message  Message associated with the activation.
   */
  static #rollDamage(event, target, message) {
    const lastAttack = message.getAssociatedRolls("attack").pop();
    const { ability, ammunitionItem: ammunition, mode: attackMode } = lastAttack?.system ?? {};
    const isCritical = lastAttack?.rolls[0]?.isCritical;
    const dialogConfig = {};
    if ( isCritical ) dialogConfig.options = { defaultButton: "critical" };

    this.rollDamage({ event, ability, ammunition, attackMode, isCritical }, dialogConfig);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Roll data extra da 2.0: `@escala` resolve os dados da Escala de Dano de
   * NPC pelo ND do ator — armas de NPC configuram o dano como "@escala + @mod"
   * e seguem a tabela sem configuração por arma.
   * @override
   */
  getRollData(options = {}) {
    const rollData = super.getRollData(options);
    if ( Ruleset.isV2() && (this.actor?.type === "npc") ) {
      const nivel = Ruleset.nivel(this.actor);
      rollData.escala = Ruleset.escalaDano(nivel).dados;
      // Modificadores "+1 dado de dano / 4 ND" (Mordida, Chifres, Ferrão):
      // concatena à fórmula, ex. "@escala + @mod@escalaExtra".
      rollData.escalaExtra = extraEscalaDano(nivel);
    }
    return rollData;
  }

  /**
   * Prepare ability options for this attack.
   * @returns {FormSelectOption[]}
   * @protected
   */
  _getAbilityOptions() {
    const actorAbilities = this.actor?.system.abilities ?? {};
    const options = Array.from(this.attack.abilities)
      .filter(ability => ability in CONFIG.DND5E.abilities)
      .sort((a, b) => (actorAbilities[b]?.mod ?? 0) - (actorAbilities[a]?.mod ?? 0))
      .map(value => ({ value, label: CONFIG.DND5E.abilities[value].label }));
    if (Ruleset.isV2() && this.item.type === "weapon" && !this.attack.ability) {
      const principal = this.actor?.type === "npc" ? Ruleset.npcPrincipal(this.actor) : Ruleset.atributoPrincipal(this.actor);
      if (CONFIG.DND5E.abilities[principal]) {
        const index = options.findIndex(option => option.value === principal);
        if (index >= 0) options.splice(index, 1);
        options.unshift({ value: principal, label: CONFIG.DND5E.abilities[principal].label });
      }
    }
    if ( this.attack.ability === "none" ) options.push({ value: "none", label: _loc("DND5E.None") });
    return options;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  async getFavoriteData() {
    return foundry.utils.mergeObject(await super.getFavoriteData(), { modifier: this.labels.modifier });
  }
}
