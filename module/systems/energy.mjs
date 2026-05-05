/**
 * Sistema de Energia Amaldiçoada (PA)
 * 
 * PA Máxima = (nível × 20) + bonuses.maxEnergy + (intensiveTraining.maxEnergy × 5)
 * Limite por turno = nível × baseMultiplier
 * Bônus de treinamento (intensiveTraining.generatedEnergy) é somado UMA VEZ após a geração,
 * e o teto do processTurnEnd também o considera.
 */
export class EnergySystem {

  static calculateMaxPA(actor) {
    const level = actor.system.details?.level ?? 1;
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

  /**
   * Bônus fixo de geração por turno vindo dos treinos de PA Gerada.
   * = bonuses.generatedEnergy + intensiveTraining.generatedEnergy
   */
  static calculateGenerationBonus(actor) {
    const bonuses = actor.system.energy.bonuses;
    const intensive = actor.system.energy.intensiveTraining;
    return (bonuses.generatedEnergy ?? 0) + (intensive.generatedEnergy ?? 0);
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
    const energy = actor.system.energy;
    const level = actor.system.details?.level ?? 1;
    const baseMultiplier = energy.generation.baseMultiplier ?? 2;
    const turnMultiplier = energy.generation.turnMultiplier ?? 1;
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
        `${actor.name} não tem PA Gerada suficiente! (${gerada} disponível, ${custo} necessário)`
      );
      return false;
    }
    await actor.update({ "system.energy.generated": gerada - custo }, { isEnergySystem: true });
    return true;
  }

  static async processTurnEnd(actor) {
    const energy = actor.system.energy;
    const level = actor.system.details?.level ?? 1;
    const trainingBonus = this.calculateGenerationBonus(actor);
    const limite = this.calculateLimit(level, energy.generation.baseMultiplier) + trainingBonus;
    if (energy.generated > limite) {
      await actor.update({ "system.energy.generated": limite }, { isEnergySystem: true });
    }
  }

  static async sacrificeAction(actor, tipo = "action") {
    const level = actor.system.details?.level ?? 1;
    const ganho = tipo === "action" ? level : 2;
    const novaGerada = actor.system.energy.generated + ganho;
    await actor.update({ "system.energy.generated": novaGerada }, { isEnergySystem: true });
    ui.notifications.info(
      `${actor.name} sacrificou uma ${tipo === "action" ? "ação" : "ação bônus/reação"} e ganhou ${ganho} PA Gerada.`
    );
    return ganho;
  }

  static async processTurnStartWithChoices(actor, choices) {
    const energy = actor.system.energy;
    const level = actor.system.details?.level ?? 1;
    const abilities = actor.system.energyAbilities;

    let baseMultiplier = parseInt(choices.baseMultiplier ?? 2);

    if ( choices.useLiberation && abilities.liberation.uses > 0 ) {
      baseMultiplier = 3;
      await actor.update({
        "system.energyAbilities.liberation.uses": abilities.liberation.uses - 1
      }, { isEnergySystem: true });
    }

    const trainingBonus = this.calculateGenerationBonus(actor);
    const limite = this.calculateLimit(level, baseMultiplier);
    const limiteTotal = limite + trainingBonus;
    const faltandoTotal = limiteTotal - energy.generated;
    if ( faltandoTotal <= 0 ) return;

    // Geração base: limitada ao teto base
    const faltandoBase = Math.max(0, limite - energy.generated);
    const base = level * baseMultiplier;
    let geracaoBase = Math.min(base, faltandoBase);

    if ( choices.useAccumulation && abilities.accumulation.uses > 0 ) {
      geracaoBase = Math.min(geracaoBase + level, faltandoBase);
      await actor.update({
        "system.energyAbilities.accumulation.uses": abilities.accumulation.uses - 1
      }, { isEnergySystem: true });
    }

    const flatBonus = parseInt(choices.flatBonus ?? 0);
    if ( flatBonus > 0 ) geracaoBase = Math.min(geracaoBase + flatBonus, faltandoBase);

    // Bônus de treinamento: aplica apenas o que falta para o teto total
    const bonusAplicado = Math.min(trainingBonus, faltandoTotal - geracaoBase);
    const totalGerar = geracaoBase + Math.max(0, bonusAplicado);

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
