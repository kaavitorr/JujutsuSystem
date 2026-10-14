import Ruleset from "./ruleset.mjs";
/**
 * Sistema de Energia Amaldiçoada (PA)
 * 
 * PA Máxima = (nível × 20) + bonuses.maxEnergy + (intensiveTraining.maxEnergy × 5)
 * Limite por turno = nível × baseMultiplier
 * Bônus de treinamento (intensiveTraining.generatedEnergy) é somado UMA VEZ após a geração,
 * Na 1.0, o teto do processTurnEnd também o considera. Na 2.0, refinamento
 * já transferido permanece disponível até ser gasto.
 */
export class EnergySystem {

  static calculateMaxPA(actor) {
    // 2.0: PA Total = energiaBase × (nível + treinos intensos de Energia Máxima)
    if ( Ruleset.isV2() ) return Ruleset.maxEnergy(actor);
    const level = Ruleset.nivel(actor); // 2.0: ND de NPC em vez de details.level
    const bonuses = actor.system.energy.bonuses;
    const intensive = actor.system.energy.intensiveTraining;
    const base = level * 20;
    const bonusMax = bonuses.maxEnergy ?? 0;
    const intensiveBonus = (intensive.maxEnergy ?? 0) * 5;
    return base + bonusMax + intensiveBonus;
  }

  static calculateLimit(level, baseMultiplier = 2) {
    return level * baseMultiplier;
  }

  /** 2.0 refinement has no selectable generation multiplier or 1.0 accumulation. */
  static generationBaseMultiplier(actor) {
    return Ruleset.isV2() ? 2 : actor.system.energy.generation.baseMultiplier ?? 2;
  }

  /**
   * Bônus fixo de geração por turno vindo dos treinos de PA Gerada.
   * = bonuses.generatedEnergy + intensiveTraining.generatedEnergy
   */
  static calculateGenerationBonus(actor) {
    const bonuses = actor.system.energy.bonuses ?? {};
    const intensive = actor.system.energy.intensiveTraining ?? {};
    return (bonuses.generatedEnergy ?? 0) + (intensive.generatedEnergy ?? 0);
  }

  /** 2.0 reserved actions select a ceiling; refinement is transferred from the total reserve. */
  static actionReserveRefinementUpdates(actor, reserves) {
    if (!Ruleset.isV2() || Ruleset.isRestringido(actor) || !actor.system.energy) return {};
    const energy = actor.system.energy;
    const normal = Math.max(0, this.calculateLimit(Ruleset.nivel(actor), 2) + this.calculateGenerationBonus(actor));
    const ceiling = normal * (reserves >= 5 ? 2 : 1);
    const generated = Math.max(0, Number(energy.generated) || 0);
    const total = Math.max(0, Number(energy.total) || 0);
    const transfer = Math.min(Math.max(0, ceiling - generated), total);
    if (!transfer) return {};
    return { "system.energy.total": total - transfer, "system.energy.generated": generated + transfer };
  }

  static calculateCursePointBonus(actor) {
    return actor.system.energy.intensiveTraining.cursePoints ?? 0;
  }

  static async updateMaxPA(actor) {
    const novoMax = this.calculateMaxPA(actor);
    await actor.update({ "system.energy.max": novoMax });
    return novoMax;
  }

  static async processTurnStart(actor) {
    if (Ruleset.isRestringido(actor)) {
      const updates = { "system.energy.generated": Ruleset.staminaMax(actor) };
      await actor.update(updates, { isEnergySystem: true });
      return updates;
    }
    const energy = actor.system.energy;
    const level = Ruleset.nivel(actor); // 2.0: ND de NPC em vez de details.level
    const baseMultiplier = this.generationBaseMultiplier(actor);
    const turnMultiplier = Ruleset.isV2() ? 1 : energy.generation.turnMultiplier ?? 1;
    const bonusFlat = energy.generation.bonusFlat ?? 0;
    const trainingBonus = this.calculateGenerationBonus(actor);
    const limite = this.calculateLimit(level, baseMultiplier);
    const limiteTotal = limite + trainingBonus;

    if (energy.generated >= limiteTotal) return null;

    // Geração base: limitada ao teto base
    const faltandoBase = Math.max(0, limite - energy.generated);
    const base = level * baseMultiplier;
    const geracaoBase = Math.min((base * turnMultiplier) + bonusFlat, faltandoBase);

    // Bônus de treinamento: aplica apenas se ainda não foi atingido o teto total
    const faltandoTotal = limiteTotal - energy.generated;
    const bonusAplicado = Math.min(trainingBonus, faltandoTotal - geracaoBase);
    const geracao = geracaoBase + Math.max(0, bonusAplicado);

    const transferencia = Math.min(geracao, energy.total);
    const novoTotal = energy.total - transferencia;
    const novaGerada = energy.generated + transferencia;

    const updates = {
      "system.energy.total": novoTotal,
      "system.energy.generated": novaGerada,
      "system.energy.generation.turnMultiplier": 1
    };

    await actor.update(updates, { isEnergySystem: true });
    return updates;
  }

  static async consumePA(actor, custo) {
    const gerada = actor.system.energy.generated;
    if (gerada < custo) {
      ui.notifications.warn(
        `${actor.name} não tem ${Ruleset.isRestringido(actor) ? "Estamina" : "PA Gerada"} suficiente! (${gerada} disponível, ${custo} necessário)`
      );
      return false;
    }
    await actor.update({ "system.energy.generated": gerada - custo }, { isEnergySystem: true });
    return true;
  }

  static async processTurnEnd(actor) {
    if (Ruleset.isRestringido(actor)) {
      const maximum = Ruleset.staminaMax(actor);
      if (actor.system.energy.generated > maximum) await actor.update({ "system.energy.generated": maximum }, { isEnergySystem: true });
      return;
    }
    // Refinement already paid for in 2.0 remains available until it is spent.
    if (Ruleset.isV2()) return;
    const energy = actor.system.energy;
    const level = Ruleset.nivel(actor); // 2.0: ND de NPC em vez de details.level
    const trainingBonus = this.calculateGenerationBonus(actor);
    const limite = this.calculateLimit(level, this.generationBaseMultiplier(actor)) + trainingBonus;
    if (energy.generated > limite) {
      await actor.update({ "system.energy.generated": limite }, { isEnergySystem: true });
    }
  }

  /**
   * Sacrifica parte da economia de ações para GERAR energia além do limite do
   * turno. A energia NÃO surge do nada: é transferida da reserva (energy.total)
   * para a energia gerada (energy.generated), como uma geração normal — só que
   * sem respeitar o teto por turno. Limitado ao que existe em `total`.
   * @returns {Promise<number>} quanto foi efetivamente gerado (0 se sem reserva).
   */
  static async sacrificeAction(actor, tipo = "action") {
    const level = Ruleset.nivel(actor); // 2.0: ND de NPC em vez de details.level
    const desejado = tipo === "action" ? level : 2;
    const total = actor.system.energy.total ?? 0;
    const transferencia = Math.min(desejado, total);

    if ( transferencia <= 0 ) {
      ui.notifications.warn(
        `${actor.name} não tem Energia na reserva (Total) para sacrificar uma ação.`
      );
      return 0;
    }

    await actor.update({
      "system.energy.total": total - transferencia,
      "system.energy.generated": actor.system.energy.generated + transferencia
    }, { isEnergySystem: true });

    const acao = tipo === "action" ? "ação" : (tipo === "bonus" ? "ação bônus" : "reação");
    ui.notifications.info(
      `${actor.name} sacrificou uma ${acao} e gerou ${transferencia} de Energia (da reserva, acima do limite).`
    );
    return transferencia;
  }

  static async processTurnStartWithChoices(actor, choices) {
    if (Ruleset.isRestringido(actor)) return this.processTurnStart(actor);
    const energy = actor.system.energy;
    const level = Ruleset.nivel(actor); // 2.0: ND de NPC em vez de details.level
    const abilities = actor.system.energyAbilities;

    const isV2 = Ruleset.isV2();
    let baseMultiplier = isV2 ? 2 : parseInt(choices.baseMultiplier ?? 2);

    if ( !isV2 && choices.useLiberation && abilities.liberation.uses > 0 ) {
      baseMultiplier = 3;
      await actor.update({
        "system.energyAbilities.liberation.uses": abilities.liberation.uses - 1
      }, { isEnergySystem: true });
    }

    const trainingBonus = this.calculateGenerationBonus(actor);
    const limite = this.calculateLimit(level, baseMultiplier);
    const limiteTotal = limite + trainingBonus;
    const faltandoTotal = limiteTotal - energy.generated;

    // Bônus manual (Feitiço/Habilidade): extra livre à geração — NÃO é limitado
    // pelos tetos base/total (estes continuam valendo para a geração base,
    // acúmulo e bônus de treino). A reserva (Total) segue limitando a
    // transferência final.
    const manualBonus = Math.max(0, parseInt(choices.flatBonus) || 0);

    // Nada a gerar: nem pela geração normal, nem pelo bônus manual.
    if ( (faltandoTotal <= 0) && !(manualBonus > 0) ) return;

    // Geração base: limitada ao teto base
    const faltandoBase = Math.max(0, limite - energy.generated);
    const base = level * baseMultiplier;
    let geracaoBase = Math.min(base, faltandoBase);

    if ( !isV2 && choices.useAccumulation && (abilities.accumulation.uses > 0) && (faltandoBase > 0) ) {
      geracaoBase = Math.min(geracaoBase + level, faltandoBase);
      await actor.update({
        "system.energyAbilities.accumulation.uses": abilities.accumulation.uses - 1
      }, { isEnergySystem: true });
    }

    // Bônus de treinamento: aplica apenas o que falta para o teto total
    const bonusAplicado = faltandoTotal > 0
      ? Math.max(0, Math.min(trainingBonus, faltandoTotal - geracaoBase))
      : 0;

    const totalGerar = geracaoBase + bonusAplicado + manualBonus;

    const transferencia = Math.min(totalGerar, energy.total);
    const novoTotal = energy.total - transferencia;
    const novaGerada = energy.generated + transferencia;

    await actor.update({
      "system.energy.total": novoTotal,
      "system.energy.generated": novaGerada,
      "system.energy.generation.turnMultiplier": 1
    }, { isEnergySystem: true });
  }
}
