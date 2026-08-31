/**
 * jj/manipulation-handlers.mjs
 * Lógica de manipulação de energia e treinamentos — extraída de character-sheet.mjs.
 * Todas as funções recebem `actor` como primeiro parâmetro em vez de usar `this`.
 */

import { prepareManipulationAbilities, prepareTrainings, MANIPULATION_ABILITIES, TRAININGS_DATA, getAvailableTrainingPoints } from "../../../systems/manipulation-data.mjs";
import { showBlackFlashPopup } from "./popup.mjs";

// ── Preparação de contexto ────────────────────────────────────────────────────

export async function prepareManipulationContext(actor, context) {
  context.isRestringido = actor.itemTypes.class.some(c => c.identifier === "restringido");
  if ( !context.isRestringido ) {
    try {
      context.abilities = prepareManipulationAbilities(actor);
    } catch(err) {
      console.error("JujutsuLegacy | Erro Manipulacao:", err);
      context.abilities = { basic: {}, advanced: {}, extreme: {}, barrier: {} };
    }
  }
  return context;
}

export async function prepareTrainingsContext(actor, context) {
  context.availableTrainingPoints = getAvailableTrainingPoints(actor);
  try {
    context.trainings = prepareTrainings(actor);
  } catch(err) {
    console.error("JujutsuLegacy | Erro Treinamentos:", err);
    context.trainings = { general: {}, domain: {} };
  }
  return context;
}

// ── Desbloquear habilidade de manipulação ─────────────────────────────────────

export async function onUnlockManipulationAbility(actor, abilityId, cost) {
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  if ( cursePoints < cost ) {
    ui.notifications.warn(`PM insuficientes! Você tem ${cursePoints} PM, precisa de ${cost}.`);
    return;
  }

  const currentInvested = actor.system.manipulation?.pointsInvested ?? 0;
  const abilityDef = MANIPULATION_ABILITIES[abilityId];
  if ( abilityDef?.techniques?.length ) {
    await grantLinkedTechniques(actor, abilityDef.techniques);
  }

  await actor.update({
    [`system.manipulation.abilities.${abilityId}.unlocked`]: true,
    ...(abilityDef?.repeatable ? {
      [`system.manipulation.abilities.${abilityId}.count`]:
        (actor.system.manipulation?.abilities?.[abilityId]?.count ?? 0) + 1
    } : {}),
    "system.manipulation.pointsInvested": currentInvested + cost,
    "system.curseResources.cursePoints": cursePoints - cost
  });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>${actor.name}</strong> desbloqueou a habilidade de manipulação: <strong>${abilityDef?.label ?? abilityId}</strong>!`
  });
}

// ── Desfazer habilidade de manipulação ────────────────────────────────────────

export async function onUndoManipulationAbility(actor, abilityId) {
  const def = MANIPULATION_ABILITIES[abilityId];
  if ( !def ) return;

  const invested = actor.system.manipulation?.pointsInvested ?? 0;
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  const currentCount = actor.system.manipulation?.abilities?.[abilityId]?.count ?? 0;

  if ( def.repeatable && currentCount > 0 ) {
    const newCount = currentCount - 1;
    await actor.update({
      [`system.manipulation.abilities.${abilityId}.count`]: newCount,
      [`system.manipulation.abilities.${abilityId}.unlocked`]: newCount > 0,
      "system.manipulation.pointsInvested": Math.max(0, invested - def.cost),
      "system.curseResources.cursePoints": cursePoints + def.cost
    });
  } else {
    await actor.update({
      [`system.manipulation.abilities.${abilityId}.unlocked`]: false,
      "system.manipulation.pointsInvested": Math.max(0, invested - def.cost),
      "system.curseResources.cursePoints": cursePoints + def.cost
    });
  }

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `↩️ <strong>${actor.name}</strong> desfez a habilidade: <strong>${def.label}</strong>. +${def.cost} PM devolvidos.`
  });
}

// ── Treinamento Intenso ───────────────────────────────────────────────────────

export async function onIntensiveTraining(actor) {
  const isRestringido = actor.itemTypes.class.some(c => c.identifier === "restringido");
  const it = actor.system.energy?.intensiveTraining ?? {};
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;
  const generatedAtLimit = (it.generatedEnergy ?? 0) >= 20;

  const currentMaxPA = actor.system.energy?.max ?? 0;
  const currentGeneratedBonus = it.generatedEnergy ?? 0;

  const hasEnormousEnergy = actor.items.some(
    i => i.type === "race" && (i.system?.identifier ?? i.name?.slugify()) === "energia-descomunal"
  );
  const trainingPAGain = hasEnormousEnergy ? 10 : 5;

  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "⚔️ Treinamento Intenso — Evolução na Prática" },
    content: `
      <div style="padding:4px 0; font-size:13px; color:#ccc; line-height:1.5;">
        <p style="margin:0 0 10px; font-size:12px; color:#aaa;">
          Escolha o benefício do seu <strong>Treinamento Intenso (10 dias)</strong>:
        </p>
        <div style="display:flex; flex-direction:column; gap:6px;">

          <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                        background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                        cursor:pointer;">
            <input type="radio" name="jj-training-choice" value="maxEnergy" style="flex:0 0 auto;">
            <div>
              <strong style="color:#c0a0ff;">↑ PA Máximo +${trainingPAGain}</strong>
              <div style="font-size:11px; color:#8080a0;">Atual: ${currentMaxPA} → ${currentMaxPA + trainingPAGain} (treino ${(it.maxEnergy ?? 0) + 1})</div>
            </div>
          </label>

          <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                        background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                        cursor:pointer; ${generatedAtLimit ? "opacity:0.4;" : ""}">
            <input type="radio" name="jj-training-choice" value="generatedEnergy"
                   ${generatedAtLimit ? "disabled" : ""} style="flex:0 0 auto;">
            <div>
              <strong style="color:#60c0ff;">⚡ PA Gerada +1/turno</strong>
              <div style="font-size:11px; color:#8080a0;">
                ${generatedAtLimit
                  ? "⛔ Limite atingido (20 treinos)"
                  : `Treinos: ${currentGeneratedBonus}/20 — bônus de +${currentGeneratedBonus} → +${currentGeneratedBonus + 1} por turno`}
              </div>
            </div>
          </label>

          ${!isRestringido ? `
          <label style="display:flex; align-items:center; gap:10px; padding:8px 10px;
                        background:#0e0e1a; border:1px solid #2a2a40; border-radius:6px;
                        cursor:pointer;">
            <input type="radio" name="jj-training-choice" value="cursePoints" style="flex:0 0 auto;">
            <div>
              <strong style="color:#ffa060;">💀 Pontos de Maldição +4</strong>
              <div style="font-size:11px; color:#8080a0;">Atual: ${cursePoints} PM → ${cursePoints + 4} PM</div>
            </div>
          </label>` : ""}

        </div>
        <p style="margin:10px 0 0; font-size:11px; color:#6060a0;">
          ⚠️ Treino de <em>PA Gerada</em> requer 10 dias de espera antes de repetir.
        </p>
      </div>`,
    buttons: [
      {
        label: "Confirmar Treinamento",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const selected = (dialog.element ?? document).querySelector("input[name='jj-training-choice']:checked");
          return selected?.value ?? null;
        }
      },
      {
        label: "Cancelar",
        action: "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !choice ) return;

  const it2 = actor.system.energy?.intensiveTraining ?? {};
  const updates = {};
  let chatMsg = "";

  if ( choice === "maxEnergy" ) {
    const novoContador = (it2.maxEnergy ?? 0) + 1;
    updates["system.energy.intensiveTraining.maxEnergy"] = novoContador;
    chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Máximo +${trainingPAGain}</strong> (${novoContador} treino(s) = +${novoContador * trainingPAGain} PA Máx total de treino).`;
  } else if ( choice === "generatedEnergy" ) {
    if ( generatedAtLimit ) {
      ui.notifications.warn("Limite de treinos de PA Gerada atingido (20 vezes).");
      return;
    }
    const novoContador = (it2.generatedEnergy ?? 0) + 1;
    updates["system.energy.intensiveTraining.generatedEnergy"] = novoContador;
    chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>PA Gerada +1</strong> por turno (treino ${novoContador}/20).`;
  } else if ( choice === "cursePoints" ) {
    const current = actor.system.curseResources?.cursePoints ?? 0;
    updates["system.curseResources.cursePoints"] = current + 4;
    updates["system.energy.intensiveTraining.cursePoints"] = (it2.cursePoints ?? 0) + 4;
    chatMsg = `🏋️ <strong>${actor.name}</strong> completou um Treinamento Intenso! <strong>+4 Pontos de Maldição</strong>.`;
  }

  await actor.update(updates);
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: chatMsg });
  ui.notifications.info("Treinamento Intenso concluído!");
}

export async function onUndoIntensiveTraining(actor, field) {
  const it = actor.system.energy?.intensiveTraining ?? {};

  const FIELD_CONFIG = {
    maxEnergy: {
      label: "PA Máximo",
      amount: 1,
      undo: (it) => ({
        "system.energy.intensiveTraining.maxEnergy": Math.max(0, (it.maxEnergy ?? 0) - 1)
      })
    },
    generatedEnergy: {
      label: "PA Gerada",
      amount: 1,
      undo: (it) => ({
        "system.energy.intensiveTraining.generatedEnergy": Math.max(0, (it.generatedEnergy ?? 0) - 1)
      })
    },
    cursePoints: {
      label: "Pontos de Maldição",
      amount: 4,
      undo: (it) => ({
        "system.curseResources.cursePoints": Math.max(0, (actor.system.curseResources?.cursePoints ?? 0) - 4),
        "system.energy.intensiveTraining.cursePoints": Math.max(0, (it.cursePoints ?? 0) - 4)
      })
    }
  };

  const config = FIELD_CONFIG[field];
  if ( !config ) return;

  const currentCount = it[field] ?? 0;
  if ( currentCount <= 0 ) {
    ui.notifications.warn(`Não há treinos de ${config.label} para desfazer.`);
    return;
  }

  const confirm = await foundry.applications.api.DialogV2.confirm({
    window: { title: "↩️ Desfazer Treinamento" },
    content: `<p>Desfazer o último treino de <strong>${config.label}</strong>?<br>
              <span style="font-size:12px;color:#aaa;">Isso reverterá o bônus de <strong>-${config.amount}</strong>.</span></p>`,
    yes: { label: "Desfazer" },
    no: { label: "Cancelar" }
  });
  if ( !confirm ) return;

  await actor.update(config.undo(it));
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `↩️ <strong>${actor.name}</strong> desfez um Treinamento de <strong>${config.label}</strong> (-${config.amount}).`
  });
  ui.notifications.info(`Treinamento de ${config.label} desfeito.`);
}

// ── Técnicas vinculadas ───────────────────────────────────────────────────────

export async function grantLinkedTechniques(actor, techniqueNames) {
  for ( const name of techniqueNames ) {
    const pack = game.packs.find(p => p.metadata.type === "Item");
    if ( !pack ) continue;
    await pack.getIndex();
    const entry = pack.index.find(i => i.name === name);
    if ( !entry ) continue;
    const item = await pack.getDocument(entry._id);
    if ( item && !actor.items.find(i => i.name === name) ) {
      await actor.createEmbeddedDocuments("Item", [item.toObject()]);
      ui.notifications.info(`Técnica "${name}" adicionada automaticamente.`);
    }
  }
}

// ── Syncronizar Active Effect de treinamento ──────────────────────────────────

const TRAINING_EFFECTS = {
  protecaoEnergia: {
    label: "Proteção de Energia",
    icon: "icons/svg/shield.svg",
    changes: rank => [
      { key: "system.attributes.ac.bonus", mode: 2, value: String(rank), priority: 20 }
    ]
  },
  robusto: {
    label: "Robusto",
    icon: "icons/svg/heart.svg",
    changes: rank => [
      { key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${rank} * @details.level`, priority: 20 }
    ]
  },
  agilidadeAvancada: {
    label: "Agilidade Avançada",
    icon: "icons/svg/wing.svg",
    changes: rank => {
      const bonus = rank === 1 ? 5 : rank === 2 ? 10 : 20;
      return [{ key: "system.attributes.movement.walk", mode: 2, value: String(bonus), priority: 20 }];
    }
  },
  energiaAdaptavel: {
    label: "Energia Adaptável",
    icon: "icons/svg/aura.svg",
    changes: rank => {
      const mult = rank + 2;
      return [{ key: "system.attributes.hp.bonuses.overall", mode: 2, value: `${mult} * @abilities.con.mod`, priority: 20 }];
    }
  },
  golpePenetrante: {
    label: "Golpe Penetrante",
    icon: "icons/svg/sword.svg",
    changes: rank => [
      { key: "system.bonuses.mwak.attack", mode: 2, value: String(rank), priority: 20 },
      { key: "system.bonuses.rwak.attack", mode: 2, value: String(rank), priority: 20 },
      { key: "system.bonuses.msak.attack", mode: 2, value: String(rank), priority: 20 },
      { key: "system.bonuses.rsak.attack", mode: 2, value: String(rank), priority: 20 }
    ]
  }
};

export async function syncTrainingEffect(actor, trainingId, rank) {
  const def = TRAINING_EFFECTS[trainingId];
  if ( !def ) return;

  const existing = actor.effects.find(e => e.getFlag("jujutsu-system", "trainingId") === trainingId);

  if ( rank === 0 ) {
    if ( existing ) await existing.delete();
    return;
  }

  const effectData = {
    name: `${def.label} (${"★".repeat(rank)})`,
    icon: def.icon,
    origin: actor.uuid,
    disabled: false,
    flags: { "jujutsu-system": { trainingId } },
    changes: def.changes(rank)
  };

  if ( existing ) {
    await existing.update(effectData);
  } else {
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}

// ── Treinar habilidade ────────────────────────────────────────────────────────

export async function onTrainAbility(actor, trainingId, instant) {
  const def = TRAININGS_DATA[trainingId];
  if ( !def ) return;

  // Pré-requisito especial: Expansão de Domínio (Maestria 7 + domínio expandido)
  if ( def.requires?.special === "expansaoDominio" ) {
    const masteryLevel = actor.system.masteryLevel ?? 0;
    const dominioExpandido = actor.getFlag?.("jujutsu-system", "dominioExpandido") === true
      || actor.flags?.["jujutsu-system"]?.dominioExpandido === true;
    if ( masteryLevel < 7 || !dominioExpandido ) {
      ui.notifications.warn(`${def.label} requer Maestria 7 e ter expandido o domínio com sucesso.`);
      return;
    }
  }

  const savedTrainings = actor.system.trainings ?? {};
  const saved = savedTrainings[trainingId] ?? { rank: 0, currentDC: def.baseDC };
  const rank = saved.rank ?? 0;
  const currentDC = saved.currentDC ?? def.baseDC;

  const nextPtCost = def.ptCost[rank] ?? def.ptCost[def.ptCost.length - 1];
  const nextPaCost = def.paCost[rank] ?? def.paCost[def.paCost.length - 1];
  const trainingPoints = getAvailableTrainingPoints(actor);
  const energyTotal = actor.system.energy?.total ?? 0;
  const cursePoints = actor.system.curseResources?.cursePoints ?? 0;

  if ( instant ) {
    if ( cursePoints < nextPtCost ) {
      ui.notifications.warn(`PM insuficientes! Precisa de ${nextPtCost} PM.`);
      return;
    }
    const newDC = currentDC + (def.dcIncrement ?? 5);
    await actor.update({
      [`system.trainings.${trainingId}.rank`]: rank + 1,
      [`system.trainings.${trainingId}.currentDC`]: newDC,
      "system.curseResources.cursePoints": cursePoints - nextPtCost,
      "system.masteryPoints": (actor.system.masteryPoints ?? 0) + nextPtCost
    });
    await syncTrainingEffect(actor, trainingId, rank + 1);
    if ( (rank + 1) >= (def.maxRank ?? 3) ) showBlackFlashPopup("systems/jujutsu-system/assets/satoru.gif", 2500);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `⚡ <strong>${actor.name}</strong> usou Avanço Instantâneo em <strong>${def.label}</strong>! (★${"★".repeat(rank + 1)})`
    });
    return;
  }

  if ( trainingPoints < nextPtCost ) {
    ui.notifications.warn(`PT insuficientes! Precisa de ${nextPtCost} PT.`);
    return;
  }
  if ( energyTotal < nextPaCost ) {
    ui.notifications.warn(`PA Total insuficiente! Precisa de ${nextPaCost} PA.`);
    return;
  }

  // Só consome a PA aqui — o PT só é debitado (via spentTrainingPoints/lostTrainingPoints,
  // ver getAvailableTrainingPoints) depois do resultado da rolagem, já que sucesso e falha
  // têm destinos diferentes no extrato.
  await actor.update({
    "system.energy.total": energyTotal - nextPaCost
  }, { isEnergySystem: true });

  const contSkill = actor.system.skills?.Cont;
  const skillTotal = contSkill?.total ?? (
    (actor.system.abilities?.con?.mod ?? 0) +
    Math.floor((actor.system.attributes?.prof ?? 2) * (contSkill?.value ?? 0))
  );
  const roll = await new Roll("1d20 + @bonus", { bonus: skillTotal }).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Controle de Energia (CON)<br><strong>${def.label}</strong> — CD ${currentDC}`
  });

  if ( roll.total >= currentDC ) {
    const newRank = rank + 1;
    const newDC = currentDC + (def.dcIncrement ?? 5);
    const spentPt = actor.system.curseResources?.spentTrainingPoints ?? 0;
    await actor.update({
      [`system.trainings.${trainingId}.rank`]: newRank,
      [`system.trainings.${trainingId}.currentDC`]: newDC,
      "system.masteryPoints": (actor.system.masteryPoints ?? 0) + nextPtCost,
      "system.curseResources.cursePoints": (actor.system.curseResources?.cursePoints ?? 0) + 1,
      "system.curseResources.spentTrainingPoints": spentPt + nextPtCost
    });
    await syncTrainingEffect(actor, trainingId, newRank);
    if ( newRank >= (def.maxRank ?? 3) ) showBlackFlashPopup("systems/jujutsu-system/assets/satoru.gif", 2500);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `✅ <strong>${actor.name}</strong> treinou <strong>${def.label}</strong> com sucesso! (★${"★".repeat(newRank)}) +1 Ponto de Maldição.`
    });
  } else {
    const lostPt = actor.system.curseResources?.lostTrainingPoints ?? 0;
    await actor.update({
      [`system.trainings.${trainingId}.currentDC`]: Math.max(0, currentDC - 1),
      "system.curseResources.lostTrainingPoints": lostPt + nextPtCost
    });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `❌ <strong>${actor.name}</strong> falhou no treino de <strong>${def.label}</strong>. CD reduzida em 1 (nova CD: ${Math.max(0, currentDC - 1)}). <strong>${nextPtCost} PT perdidos</strong>.`
    });
  }
}

// ── Desfazer treinamento ──────────────────────────────────────────────────────

export async function onUndoTraining(actor, trainingId) {
  const def = TRAININGS_DATA[trainingId];
  if ( !def ) return;

  const currentRank = actor.system.trainings?.[trainingId]?.rank ?? 0;
  if ( currentRank === 0 ) return;

  const prevRankIdx = currentRank - 1;
  const ptRefund = def.ptCost[prevRankIdx] ?? def.ptCost[0];
  const currentDC = actor.system.trainings?.[trainingId]?.currentDC ?? def.baseDC;
  const prevDC = Math.max(def.baseDC, currentDC - (def.dcIncrement ?? 5));
  const spentPt = actor.system.curseResources?.spentTrainingPoints ?? 0;

  await actor.update({
    [`system.trainings.${trainingId}.rank`]: currentRank - 1,
    [`system.trainings.${trainingId}.currentDC`]: prevDC,
    "system.masteryPoints": Math.max(0, (actor.system.masteryPoints ?? 0) - ptRefund),
    "system.curseResources.spentTrainingPoints": Math.max(0, spentPt - ptRefund)
  });
  await syncTrainingEffect(actor, trainingId, currentRank - 1);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `↩️ <strong>${actor.name}</strong> desfez um nível de <strong>${def.label}</strong>. Rank voltou para ★${"★".repeat(currentRank - 1) || "0"}.`
  });
}
