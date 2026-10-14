/**
 * Testes de lógica pura do sistema de Manipulação / Treinamentos.
 * Rodar com:  npm test   (usa o runner nativo `node --test`)
 *
 * Estas funções não dependem de globais do Foundry, então são testáveis
 * diretamente em Node, passando um "ator" simulado (plain object).
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getManipulationStage,
  canUnlockAbility,
  prepareTrainings
} from "../module/systems/manipulation-data.mjs";

/** Constrói um ator simulado com os campos lidos pelas funções puras. */
function makeActor({
  invested = 0, cursePoints = 0, abilities = {}, trainings = {},
  masteryLevel = 0, dominioExpandido = false, trainingPoints = 0, energyTotal = 0
} = {}) {
  return {
    system: {
      manipulation: { pointsInvested: invested, abilities },
      curseResources: { cursePoints, trainingPoints },
      energy: { total: energyTotal },
      trainings,
      masteryLevel
    },
    flags: { "jujutsu-system": { dominioExpandido } }
  };
}

// ── getManipulationStage ────────────────────────────────────────────────────

test("getManipulationStage: limiares de estágio", () => {
  assert.equal(getManipulationStage(0), "beginner");
  assert.equal(getManipulationStage(14), "beginner");
  assert.equal(getManipulationStage(15), "expert");
  assert.equal(getManipulationStage(45), "expert");
  assert.equal(getManipulationStage(46), "master");
  assert.equal(getManipulationStage(999), "master");
});

// ── canUnlockAbility ────────────────────────────────────────────────────────

test("canUnlockAbility: habilidade desconhecida", () => {
  const r = canUnlockAbility("naoExiste", makeActor());
  assert.equal(r.can, false);
  assert.match(r.reason, /desconhecida/i);
});

test("canUnlockAbility: básica liberada com PM suficiente", () => {
  const r = canUnlockAbility("defesaEnergia", makeActor({ cursePoints: 3 }));
  assert.equal(r.can, true);
  assert.equal(r.cost, 3);
});

test("canUnlockAbility: básica bloqueada por falta de PM", () => {
  const r = canUnlockAbility("defesaEnergia", makeActor({ cursePoints: 2 }));
  assert.equal(r.can, false);
  assert.match(r.reason, /Faltam 1 PM/);
});

test("canUnlockAbility: bloqueada por estágio insuficiente", () => {
  // ultimoRecurso exige estágio Perito (15+ PM investidos)
  const r = canUnlockAbility("ultimoRecurso", makeActor({ invested: 0, cursePoints: 99 }));
  assert.equal(r.can, false);
  assert.match(r.reason, /estágio/i);
});

test("canUnlockAbility: bloqueada por pré-requisito de habilidade", () => {
  const r = canUnlockAbility("ultimoRecurso", makeActor({ invested: 15, cursePoints: 99 }));
  assert.equal(r.can, false);
  assert.match(r.reason, /Requer/);
});

test("canUnlockAbility: liberada com estágio + pré-requisito + PM", () => {
  const r = canUnlockAbility("ultimoRecurso", makeActor({
    invested: 15, cursePoints: 6,
    abilities: { explosaoDefensiva: { unlocked: true } }
  }));
  assert.equal(r.can, true);
  assert.equal(r.cost, 6);
});

test("canUnlockAbility: já desbloqueada (não repetível)", () => {
  const r = canUnlockAbility("defesaEnergia", makeActor({
    cursePoints: 99, abilities: { defesaEnergia: { unlocked: true } }
  }));
  assert.equal(r.can, false);
  assert.match(r.reason, /desbloqueada/i);
});

// ── prepareTrainings: gate da Expansão de Domínio (#3) ──────────────────────

test("prepareTrainings: treino de domínio BLOQUEADO sem Maestria 7 + domínio", () => {
  const res = prepareTrainings(makeActor({
    masteryLevel: 7, dominioExpandido: false,
    trainingPoints: 100, energyTotal: 500
  }));
  const t = res.domain.amplificacaoDominio;
  assert.equal(t.canTrain, false);
  assert.match(t.lockReason, /Expansão de Domínio/i);
});

test("prepareTrainings: treino de domínio LIBERADO com Maestria 7 + domínio expandido", () => {
  const res = prepareTrainings(makeActor({
    masteryLevel: 7, dominioExpandido: true,
    trainingPoints: 100, energyTotal: 500
  }));
  const t = res.domain.amplificacaoDominio;
  assert.equal(t.dominioOk, true);
  assert.equal(t.canTrain, true);
  assert.equal(t.lockReason, "");
});

test("prepareTrainings: treino de domínio bloqueado se Maestria < 7 mesmo com flag", () => {
  const res = prepareTrainings(makeActor({
    masteryLevel: 6, dominioExpandido: true,
    trainingPoints: 100, energyTotal: 500
  }));
  assert.equal(res.domain.amplificacaoDominio.canTrain, false);
});

test("prepareTrainings: treino comum não exige domínio", () => {
  const res = prepareTrainings(makeActor({
    trainingPoints: 100, energyTotal: 500
  }));
  const t = res.general.robusto;
  assert.equal(t.requerDominio, false);
  assert.equal(t.canTrain, true);
});
