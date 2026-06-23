import DamageField from "../shared/damage-field.mjs";
import FormulaField from "../fields/formula-field.mjs";
import BaseActivityData from "./base-activity.mjs";
import { simplifyBonus } from "../../utils.mjs";

const { SchemaField, NumberField, StringField, BooleanField } = foundry.data.fields;

/**
 * @import { HealActivityData } from "./_types.mjs";
 */

/**
 * Data model for an heal activity.
 * @extends {BaseActivityData<HealActivityData>}
 * @mixes HealActivityData
 */
export default class BaseHealActivityData extends BaseActivityData {
  /** @inheritDoc */
  static defineSchema() {
    return {
      ...super.defineSchema(),
      healing: new DamageField(),
      // Limite TOTAL de cura desta atividade (mecânica JJK). A cura é capada ao
      // saldo restante e o consumo é registrado em `spent`. Reseta conforme `reset`.
      healLimit: new SchemaField({
        enabled: new BooleanField(),   // checkbox de exibição (UI)
        autoHeal: new BooleanField(),  // cura automaticamente no início de cada turno
        formula: new FormulaField({ deterministic: true, label: "JUJUTSU.HealLimit.Formula" }),
        spent: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        reset: new StringField({ initial: "" }),        // "" | shortRest | longRest | technique
        longRests: new NumberField({ required: true, nullable: false, integer: true, min: 1, initial: 1 }),
        restCount: new NumberField({ required: true, nullable: false, integer: true, min: 0, initial: 0 }),
        technique: new StringField()                    // id do item-técnica que reseta ao ser usado
      }, { label: "JUJUTSU.HealLimit.Label" })
    };
  }

  /* -------------------------------------------- */

  /**
   * Resolve o limite total de cura da atividade.
   * @param {object} [rollData]
   * @returns {{enabled:boolean, max:number, spent:number, remaining:number}}
   */
  getHealLimit(rollData) {
    const formula = this.healLimit?.formula?.trim();
    if ( !formula ) return { enabled: false, max: Infinity, spent: 0, remaining: Infinity };
    rollData ??= this.getRollData({ deterministic: true });
    const max = Math.round(simplifyBonus(formula, rollData));
    if ( !Number.isFinite(max) || max < 0 ) return { enabled: false, max: Infinity, spent: 0, remaining: Infinity };
    const spent = Math.max(0, this.healLimit.spent ?? 0);
    return { enabled: true, max, spent, remaining: Math.max(0, max - spent) };
  }

  /* -------------------------------------------- */
  /*  Data Migration                              */
  /* -------------------------------------------- */

  /** @override */
  static transformTypeData(source, activityData, options) {
    return foundry.utils.mergeObject(activityData, {
      healing: this.transformDamagePartData(source, source.system.damage?.parts?.[0] ?? ["", ""])
    });
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @inheritDoc */
  prepareFinalData(rollData) {
    rollData ??= this.getRollData({ deterministic: true });
    super.prepareFinalData(rollData);
    this.prepareDamageLabel(rollData);
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /** @override */
  getDamageConfig(config={}) {
    if ( !this.healing.formula ) return foundry.utils.mergeObject({ rolls: [] }, config);

    const rollConfig = foundry.utils.mergeObject({ critical: { allow: false } }, config);
    const rollData = this.getRollData();
    rollConfig.rolls = [this._processDamagePart(this.healing, rollConfig, rollData)].concat(config.rolls ?? []);

    // Limite total: capa FISICAMENTE a cura ao saldo restante via min(saldo, fórmula).
    // Só no momento da ROLAGEM (jjApplyHealCap) — NÃO na geração de rótulos, senão
    // o rótulo da cura mostraria "min(...)".
    if ( config.jjApplyHealCap ) {
      const lim = this.getHealLimit(rollData);
      if ( lim.enabled && rollConfig.rolls[0] ) {
        const part = rollConfig.rolls[0];
        const inner = (part.parts ?? []).filter(Boolean).join(" + ") || "0";
        part.parts = [`min(@jjHealRem, (${inner}))`];
        part.data = { ...(part.data ?? {}), jjHealRem: lim.remaining };
      }
    }

    return rollConfig;
  }
}
