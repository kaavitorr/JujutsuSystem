import Ruleset from "../../systems/ruleset.mjs";
import { flanqueamentoDoAtaque } from "../../systems/flanking.mjs";
import { acertoSeisOlhos } from "../../systems/seis-olhos.mjs";
import simplifyRollFormula from "../../dice/simplify-roll-formula.mjs";
import { convertLength, formatLength, formatNumber, simplifyBonus } from "../../utils.mjs";
import FormulaField from "../fields/formula-field.mjs";
import D20RollModificationField from "../shared/d20-roll-modification-field.mjs";
import DamageField, { DamageData } from "../shared/damage-field.mjs";
import BaseActivityData from "./base-activity.mjs";

const { ArrayField, BooleanField, NumberField, SchemaField, SetField, StringField } = foundry.data.fields;

/**
 * @import { AttackActivityData } from "./_types.mjs";
 */

/**
 * Data model for an attack activity.
 * @extends {BaseActivityData<AttackActivityData>}
 * @mixes AttackActivityData
 */
export default class BaseAttackActivityData extends BaseActivityData {
  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      attack: new SchemaField({
        ability: new StringField(),
        abilities: new SetField(new StringField(), { persisted: false }),
        bonus: new FormulaField(),
        critical: new SchemaField({
          threshold: new NumberField({ integer: true, positive: true })
        }),
        flat: new BooleanField(),
        type: new SchemaField({
          value: new StringField(),
          classification: new StringField()
        })
      }),
      damage: new SchemaField({
        critical: new SchemaField({
          bonus: new FormulaField()
        }),
        includeBase: new BooleanField({ initial: true }),
        parts: new ArrayField(new DamageField())
      })
    };
  }

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /** @override */
  get ability() {
    if ( this.attack.ability === "none" ) return null;

    if ( !this.attack.abilities?.size ) return null;
    if ( this.attack.abilities?.size === 1 ) return this.attack.abilities.first();
    const abilities = this.actor?.system.abilities ?? {};
    const score = Ruleset.isV2() ? "value" : "mod";
    return this.attack.abilities.reduce((largest, ability) =>
      (abilities[ability]?.[score] ?? -Infinity) > (abilities[largest]?.[score] ?? -Infinity) ? ability : largest,
    this.attack.abilities.first());
  }

  /* -------------------------------------------- */

  /** @override */
  get actionType() {
    const type = this.attack.type;
    return `${type.value === "ranged" ? "r" : "m"}${type.classification === "spell" ? "sak" : "wak"}`;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  get activationLabels() {
    const labels = super.activationLabels;
    if ( labels && (this.item.type === "weapon") && !this.range.override ) {
      labels.range = this.item.labels?.range ? this.item.labels.range : null;
      if ( this.item.labels?.reach ) labels.reach = this.item.labels.reach;
    }
    return labels;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getUsageData() {
    const usage = super.getUsageData();
    if ( (this.item.type === "weapon") && !this.range.override ) usage.range = this.item.system.range;
    return usage;
  }

  /* -------------------------------------------- */

  /**
   * Abilities that could potentially be used with this attack. Unless a specific ability is specified then
   * whichever ability has the highest modifier will be selected when making an attack.
   * @type {Set<string>}
   */
  get availableAbilities() {
    // Defer to item if available and matching attack classification
    if ( this.item.system.availableAbilities && (this.item.type === this.attack.type.classification) ) {
      return this.item.system.availableAbilities;
    }

    // Natural weapons also defer to the item if using any classification other than spell.
    if ( this.item.system.availableAbilities && (this.item.system.type?.value === "natural")
      && (this.attack.type.classification !== "spell") ) {
      return this.item.system.availableAbilities;
    }

    // Spell attack not associated with a single class, use highest spellcasting ability on actor
    if ( this.attack.type.classification === "spell" ) return new Set(
      this.actor?.system.attributes?.spellcasting
        ? [this.actor.system.attributes.spellcasting]
        : Object.values(this.actor?.spellcastingClasses ?? {}).map(c => c.spellcasting.ability)
    );

    // Weapon & unarmed attacks uses melee or ranged ability depending on type, or both if actor is an NPC
    const melee = CONFIG.DND5E.defaultAbilities.meleeAttack;
    const ranged = CONFIG.DND5E.defaultAbilities.rangedAttack;
    return new Set([this.attack.type.value === "melee" ? melee : ranged]);
  }

  /* -------------------------------------------- */

  /**
   * Critical threshold for attacks with this activity.
   * @type {number}
   */
  get criticalThreshold() {
    let ammoThreshold;
    // TODO: Fetch threshold from ammo
    const threshold = Math.min(
      this.attack.critical.threshold ?? Infinity,
      this.item.system.criticalThreshold ?? Infinity,
      ammoThreshold ?? Infinity
    );
    return threshold < Infinity ? threshold : 20;
  }

  /* -------------------------------------------- */

  /**
   * Potential attack types when attacking with this activity.
   * @type {Set<string>}
   */
  get validAttackTypes() {
    const sourceType = this._source.attack.type.value;
    if ( sourceType ) return new Set([sourceType]);
    return this.item.system.validAttackTypes ?? new Set();
  }

  /* -------------------------------------------- */
  /*  Data Migration                              */
  /* -------------------------------------------- */

  /** @override */
  static transformTypeData(source, activityData, options) {
    // For weapons and ammunition, separate the first part from the rest to be used as the base damage and keep the rest
    let damageParts = source.system.damage?.parts ?? [];
    const hasBase = (source.type === "weapon")
      || ((source.type === "consumable") && (source.system?.type?.value === "ammo"));
    if ( hasBase && damageParts.length && !source.system.damage?.base ) {
      const [base, ...rest] = damageParts;
      source.system.damage.parts = [base];
      damageParts = rest;
    }

    return foundry.utils.mergeObject(activityData, {
      attack: {
        ability: source.system.ability ?? "",
        bonus: source.system.attack?.bonus ?? "",
        critical: {
          threshold: source.system.critical?.threshold
        },
        flat: source.system.attack?.flat ?? false,
        type: {
          value: source.system.actionType.startsWith("m") ? "melee" : "ranged",
          classification: source.system.actionType.endsWith("wak") ? "weapon" : "spell"
        }
      },
      damage: {
        critical: {
          bonus: source.system.critical?.damage
        },
        includeBase: true,
        parts: damageParts.map(part => this.transformDamagePartData(source, part)) ?? []
      }
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareData() {
    super.prepareData();
    this.attack.type.value ||= this.item.system.attackType ?? "melee";
    this.attack.type.classification ||= this.item.system.attackClassification ?? "weapon";
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareFinalData(rollData) {
    if ( this.attack.ability in CONFIG.DND5E.abilities ) this.attack.abilities.add(this.attack.ability);
    else if ( (this.attack.ability === "spellcasting") && this.spellcastingAbility ) {
      this.attack.abilities.add(this.spellcastingAbility);
    } else if ( !this.attack.ability ) {
      for ( const ability of this.availableAbilities ) this.attack.abilities.add(ability);
    }

    if ( this.damage.includeBase && this.item.system.offersBaseDamage && this.item.system.damage.base.formula ) {
      const basePart = this.item.system.damage.base.clone(this.item.system.damage.base.toObject(false));
      basePart.base = true;
      basePart.locked = true;
      this.damage.parts.unshift(basePart);
    }

    rollData ??= this.getRollData({ deterministic: true });
    super.prepareFinalData(rollData);
    this.prepareDamageLabel(rollData);

    const { data, parts } = this.getAttackData();
    const roll = Roll.create(parts.join("+"), data);
    this.labels.modifier = simplifyRollFormula(roll.formula, { deterministic: true }).replaceAll(" ", "") || "0";
    const formula = simplifyRollFormula(roll.formula).trim() || "0";
    this.labels.toHit = !/^[+-]/.test(formula) ? `+${formula}` : formula;
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * The game term label for this attack.
   * @param {string} [attackMode]  The mode the attack was made with.
   * @returns {string[]}
   */
  getActionLabel(attackMode) {
    let attackModeLabel;
    if ( attackMode ) {
      const key = attackMode.split("-").map(s => s.capitalize()).join("");
      attackModeLabel = _loc(`DND5E.ATTACK.Mode.${key}`);
    }
    const actionType = this.getActionType(attackMode);
    let actionTypeLabel = _loc(`DND5E.Action${actionType.toUpperCase()}`);
    const isLegacy = dnd5e.settings.rulesVersion === "legacy";
    const isUnarmed = this.attack.type.classification === "unarmed";
    if ( isUnarmed ) attackModeLabel = _loc("DND5E.ATTACK.Classification.Unarmed");
    const isSpell = (actionType === "rsak") || (actionType === "msak");
    if ( isLegacy || isSpell ) return [actionTypeLabel, attackModeLabel].filter(_ => _);
    actionTypeLabel = _loc(`DND5E.ATTACK.Attack.${actionType}`);
    if ( isUnarmed ) return [actionTypeLabel, attackModeLabel].filter(_ => _);
    const weaponType = CONFIG.DND5E.weaponTypeMap[this.item.system.type?.value];
    const weaponTypeLabel = weaponType
      ? _loc(`DND5E.ATTACK.Weapon.${weaponType.capitalize()}`)
      : CONFIG.DND5E.weaponTypes[this.item.system.type?.value];
    return [actionTypeLabel, weaponTypeLabel, attackModeLabel].filter(_ => _);
  }

  /* -------------------------------------------- */

  /**
   * Get the roll parts used to create the attack roll.
   * @param {object} [config={}]
   * @param {string} [config.ability]
   * @param {string} [config.ammunition]
   * @param {string} [config.attackMode]
   * @param {string} [config.situational]
   * @returns {{ data: object, parts: string[] }}
   */
  getAttackData({ ability, ammunition, attackMode, situational, legacy2 }={}) {
    const npc = Ruleset.isV2() && this.actor?.type === "npc";
    if (npc && !CONFIG.DND5E.abilities?.[ability]) {
      const configured = this.attack.ability || this.ability;
      ability = CONFIG.DND5E.abilities?.[configured] ? configured : Ruleset.npcPrincipal(this.actor);
    }
    const rollData = this.getRollData({ roll: { ability, attackMode } });
    // Imported NPC fixed bonuses remain an additional bonus in 2.0; they
    // cannot bypass the selected attribute, weapon rank or active effects.
    if ( this.attack.flat && !npc ) return CONFIG.Dice.BasicRoll.constructParts({
      toHit: this.attack.bonus, ...(Ruleset.isV2() ? { legacyAdv: Ruleset.advantagePart(legacy2) } : {})
    }, rollData);

    const weapon = this.item.system;
    const ammo = this.actor?.items.get(ammunition)?.system;
    const { bonus } = this.actor ? D20RollModificationField.combineFields(this.actor.system, [
      `abilities.${rollData.roll.ability}.attack.roll`,
      "rolls.attack", `rolls.attack.${this.getActionType(attackMode)}`
    ], { rules: { category: "attack", actor: this.actor, item: this.item, rollData } }) : {};
    let flanqueamento = { graus: 0, nomeAlvo: null };
    const { parts, data } = Ruleset.isV2()
      ? (() => {
          // 2.0: d20 + atributo inteiro + degrau da arma; as vantagens
          // empilháveis do dialog (condições + flanqueamento) entram como
          // bônus fixo ±2 por grau.
          const advCfg = { ...(legacy2 ?? {}) };
          advCfg.grausFlanqueamento = advCfg.grausFlanqueamento ?? 0;
          // Análise de Fluxo: feitiços da criatura analisada não têm vantagem,
          // mesmo que o dialog tente pré-preencher vantagens.
          const alvoRolagem = Array.from(game.user.targets ?? [])[0]?.actor ?? null;
          const analiseAlvo = alvoRolagem?.getFlag?.("jujutsu-system", "analiseFluxo");
          if ( analiseAlvo && (analiseAlvo.alvoUuid === this.actor?.uuid)
            && [ "spell", "feat" ].includes(this.item?.type) ) {
            advCfg.vantagens = 0;
          }
          const resultado = CONFIG.Dice.BasicRoll.constructParts({
            mod: (rollData.roll.ability && rollData.abilities) ? (rollData.abilities[rollData.roll.ability]?.value ?? 0) : null,
            legacyRank: Ruleset.rankPartArma(this.actor, this.item),
            legacyAdv: Ruleset.advantagePart(advCfg),
            bonus: this.attack.bonus,
            weaponMagic: weapon.magicAvailable ? weapon.magicalBonus : null,
            ammoMagic: ammo?.magicAvailable ? ammo.magicalBonus : null,
            ruleBonus: bonus,
            situational
          }, rollData);
          // Seis Olhos: +2 no acerto (desvendado) / +1 (vendado) — comum e técnica.
          const seisAcerto = acertoSeisOlhos(this.actor);
          if ( seisAcerto ) resultado.parts.push(String(seisAcerto));
          return resultado;
        })()
      : CONFIG.Dice.BasicRoll.constructParts({
        mod: rollData.roll.ability ? rollData.mod : null,
        prof: weapon.prof?.term,
        bonus: this.attack.bonus,
        weaponMagic: weapon.magicAvailable ? weapon.magicalBonus : null,
        ammoMagic: ammo?.magicAvailable ? ammo.magicalBonus : null,
        ruleBonus: bonus,
        situational
      }, rollData);
    if ( flanqueamento.graus > 0 ) data.legacyFlanqueamento = flanqueamento;

    // Add exhaustion reduction
    this.actor?.addConditionRollReduction(parts, data);

    return { data, parts };
  }

  /** Native effect/rule advantage becomes an initial editable counter in 2.0. */
  getLegacy2AdvantageDefaults({ ability, attackMode } = {}) {
    const rollData = this.getRollData({ roll: { ability, attackMode } });
    const { advantage, disadvantage } = this.actor ? D20RollModificationField.combineFields(this.actor.system, [
      `abilities.${rollData.roll.ability}.attack.roll`, "rolls.attack", `rolls.attack.${this.getActionType(attackMode)}`
    ], { rules: { category: "attack", actor: this.actor, item: this.item, rollData } }) : {};
    let vantagens = Number(!!advantage), desvantagens = Number(!!disadvantage);
    // Flanqueamento (excesso de engajamento do ALVO sobre o Valor de
    // Engajamento dele) é vantagem de quem ataca — pré-preenche VANTAGENS.
    if ( this.actor ) vantagens += flanqueamentoDoAtaque(this.actor).graus;

    // Condições de vantagem/desvantagem (8.3) pré-preenchem os contadores do
    // dialog: do ATACANTE (Cego/Estremecido/Impedido/Caído −1; Invisível +1)
    // e do ALVO mirado (Atordoado/Cego/Caído corpo-a-corpo +1; Caído à
    // distância e Invisível −1).
    const alvo = Array.from(game.user.targets ?? [])[0]?.actor ?? null;
    const meuStatus = this.actor?.statuses ?? new Set();
    if ( meuStatus.has("jj-cego") || meuStatus.has("jj-caido") || meuStatus.has("jj-estremecido") || meuStatus.has("jj-impedido") ) desvantagens += 1;
    if ( meuStatus.has("jj-invisivel") ) vantagens += 1;
    const statusAlvo = alvo?.statuses ?? new Set();
    const corpoACorpo = String(this.getActionType(attackMode) ?? "").startsWith("m");
    if ( statusAlvo.has("jj-atordoado") || statusAlvo.has("jj-cego") ) vantagens += 1;
    if ( corpoACorpo && statusAlvo.has("jj-caido") ) vantagens += 1;
    if ( statusAlvo.has("jj-invisivel") || (!corpoACorpo && statusAlvo.has("jj-caido")) ) desvantagens += 1;

    // Análise de Fluxo: feitiços/técnicas da criatura analisada não podem
    // ter vantagem (spell, ou feat — técnicas de NPC).
    const analise = alvo?.getFlag?.("jujutsu-system", "analiseFluxo");
    if ( analise && (analise.alvoUuid === this.actor?.uuid)
      && [ "spell", "feat" ].includes(this.item?.type) ) vantagens = 0;

    return { vantagens: Math.min(vantagens, 5), desvantagens: Math.min(desvantagens, 5) };
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getDamageConfig(config={}, options={}) {
    // Copy properties from selected ammunition
    const ammo = config.ammunition?.system;
    if ( ammo ) {
      const properties = Array.from(ammo.properties).filter(p => CONFIG.DND5E.itemProperties[p]?.isPhysical);
      if ( this.item.system.properties?.has("mgc") && !properties.includes("mgc") ) properties.push("mgc");
      config.properties ??= [];
      for ( const property of properties ) {
        if ( !config.properties.includes(property) ) config.properties.push(property);
      }
    }

    const rollConfig = super.getDamageConfig(config, options);

    // 2.0: a proficiência do grupo de arma soma SOMENTE no acerto
    // (legacyRank em constructParts) — nunca no dano.

    if ( this.damage.critical.bonus && rollConfig.rolls[0] && !rollConfig.rolls[0].options?.critical?.bonusDamage ) {
      foundry.utils.setProperty(rollConfig.rolls[0], "options.critical.bonusDamage", this.damage.critical.bonus);
    }

    return rollConfig;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _getDamageParts(config={}) {
    const ammo = config.ammunition?.system;
    let parts = super._getDamageParts(config);
    // Gestos (2.0): a forma escolhida define o dado de dano da técnica
    // (Flecha/Linha → d8; demais áreas → d6)
    const gesto = config.legacy2?.gesto;
    if ( Ruleset.isV2() && gesto && parts.length ) {
      const dado = (gesto === "flecha" || gesto === "linha") ? 8 : 6;
      parts = parts.map(part => {
        const clone = part.clone?.() ?? foundry.utils.deepClone(part);
        if ( clone.denomination !== undefined ) clone.denomination = dado;
        return clone;
      });
    }
    if ( !ammo?.damage.base.formula ) {
      this._appendDanoAdicional(parts, config);
      return parts;
    }

    const basePartIndex = parts.findIndex(i => i.base);
    const damage = ammo.damage.base.clone(ammo.damage.base);

    // If mode is "replace" and base part is present, replace the base part
    if ( ammo.damage.replace & (basePartIndex !== -1) ) {
      damage.base = true;
      parts.splice(basePartIndex, 1, damage);
    }

    // Otherwise stick the ammo damage after base part (or as first part)
    else {
      damage.ammo = true;
      parts.splice(basePartIndex + 1, 0, damage);
    }

    this._appendDanoAdicional(parts, config);
    return parts;
  }

  /**
   * Dano adicional digitado no dialog (fórmula livre, ex.: "2d6+3"): entra
   * como uma parte extra sem tipo, no fim da lista. Fórmula inválida avisa
   * e é ignorada.
   * @param {DamageData[]} parts   Partes de dano já montadas.
   * @param {object} config        Configuração do rolo (usa legacy2.danoAdicional).
   */
  _appendDanoAdicional(parts, config={}) {
    const extra = String(config.legacy2?.danoAdicional ?? "").trim();
    if ( !Ruleset.isV2() || !extra ) return;
    if ( !Roll.validate(extra) ) {
      ui.notifications.warn(`Dano adicional inválido: "${extra}" — ignorado.`);
      return;
    }
    const parte = parts.length ? parts[0].clone() : new DamageData({ number: 0, denomination: 0,
      bonus: extra, types: [], custom: { enabled: false, formula: "" }, modifiers: [],
      scaling: { mode: "", number: 1, formula: "" } }, { parent: this.damage });
    parte.custom = { enabled: true, formula: extra };
    parte.types = new Set();
    parts.push(parte);
  }

  /* -------------------------------------------- */

  /**
   * Create a label based on this activity's settings and, if contained in a weapon, additional details from the weapon.
   * @returns {string}
   */
  getRangeLabel() {
    if ( this.item.type !== "weapon" ) return this.labels?.range ?? "";

    const parts = [];

    // Add reach for melee weapons, unless the activity is explicitly specified as a ranged attack
    if ( this.validAttackTypes.has("melee") ) {
      let { reach, units } = this.item.system.range;
      if ( !reach ) reach = convertLength(5, "ft", units);
      parts.push(_loc("DND5E.RANGE.Formatted.Reach", {
        reach: formatLength(reach, units, { strict: false })
      }));
    }

    // Add range for ranged or thrown weapons, unless the activity is explicitly specified as melee
    if ( this.validAttackTypes.has("ranged") ) {
      let range;
      if ( this.range.override ) range = `${this.range.value} ${this.range.units ?? ""}`;
      else {
        const { value, long, units } = this.item.system.range;
        range = !long || (long === value) ? formatLength(value, units)
          : `${formatNumber(value)}/${formatLength(long, units)}`;
      }
      if ( range ) parts.push(_loc("DND5E.RANGE.Formatted.Range", { range }));
    }

    return game.i18n.getListFormatter({ type: "disjunction" }).format(parts.filter(_ => _));
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  getRollData(options={}) {
    const rollData = super.getRollData(options);
    if ( options.roll ) {
      const ability = options.roll.ability ?? this.ability;
      rollData.roll ??= {};
      rollData.roll.ability = ability === "none" ? null : ability;
      rollData.roll.attack ??= {};
      rollData.roll.attack.classification = this.attack.type.classification;
      rollData.roll.attack.mode = options.roll.attackMode;
      rollData.roll.attack.type = options.roll.attackMode?.includes("thrown") || (options.roll.attackMode === "ranged")
        ? "ranged" : this.attack.type.value;
      rollData.roll.type = "attack";
    }
    return rollData;
  }

  /* -------------------------------------------- */

  /** @inheritDoc */
  _processDamagePart(damage, rollConfig, rollData, index=0, options={}) {
    if ( !damage.base ) return super._processDamagePart(damage, rollConfig, rollData, index, options);

    // Swap base damage for versatile if two-handed attack is made on versatile weapon
    if ( this.item.system.isVersatile && (rollConfig.attackMode === "twoHanded") ) {
      const versatile = this.item.system.damage.versatile.clone(this.item.system.damage.versatile);
      versatile.base = true;
      versatile.denomination ||= damage.steppedDenomination();
      versatile.number ||= damage.number;
      versatile.types = damage.types;
      damage = versatile;
    }

    const roll = super._processDamagePart(damage, rollConfig, rollData, index, options);
    roll.base = true;

    if ( this.item.type === "weapon" ) {
      // Ensure `@mod` is present in damage unless it is positive and an off-hand attack or damage is a flat value
      const isDeterministic = new Roll(roll.parts[0]).isDeterministic;
      const includeMod = (!rollConfig.attackMode?.endsWith("offhand") || (roll.data.mod < 0)) && !isDeterministic
        && !((this.attack.type.classification === "spell") && (this.item.system.type.value === "natural"));
      if ( includeMod && !roll.parts.some(p => p.includes("@mod")) ) roll.parts.push("@mod");

      // Add magical bonus
      const magicalBonus = simplifyBonus(this.item.system.magicalBonus, rollData);
      if ( magicalBonus && this.item.system.magicAvailable ) {
        roll.parts.push("@magicalBonus");
        roll.data.magicalBonus = magicalBonus;
      }

      // Add ammunition bonus
      const ammo = rollConfig.ammunition?.system;
      const ammoMagicalBonus = simplifyBonus(ammo?.magicalBonus, rollData);
      if ( ammo?.magicAvailable && ammoMagicalBonus ) {
        roll.parts.push("@ammoBonus");
        roll.data.ammoBonus = ammoMagicalBonus;
      }
    }

    const criticalBonusDice = this.actor?.getFlag("jujutsu-system", "meleeCriticalDamageDice") ?? 0;
    if ( (this.getActionType(rollConfig.attackMode) === "mwak") && (parseInt(criticalBonusDice) !== 0) ) {
      foundry.utils.setProperty(roll, "options.critical.bonusDice", criticalBonusDice);
    }

    return roll;
  }
}
