/**
 * systems/condicoes-dano.mjs
 * Automação das Condições de Dano (Capítulo 8.3):
 *  - Crítico de 20 natural (ou ativar o Fulgor Negro) com um tipo de dano
 *    dispara uma Salvaguarda no alvo (Constituição; Sabedoria para Entropia
 *    e Confuso) contra CD 10 + atributo principal do atacante.
 *  - Falhando, o alvo recebe a condição associada como efeito com duração em
 *    rodadas (aplicar de novo apenas reseta a duração — não acumula).
 *  - A ação "Remover" (2 ⬢⬢ + Teste de Sabedoria/Medicina) remove antes do
 *    tempo contra a mesma CD da salvaguarda.
 */
import Ruleset from "./ruleset.mjs";
import { temPeculiaridade } from "./peculiaridades-automacao.mjs";
import { statusesParaCondicao } from "../applications/actor/jj/conditions.mjs";

/** CD base da salvaguarda: 10 + atributo principal do atacante. */
const CD_BASE = 10;

/** Tipo de dano (chaves do dnd5e) → condição de dano do Capítulo 8.3. */
export const CONDICOES_DANO = Object.freeze({
  poison:    { status: "jj-envenenado",  label: "Envenenado",  save: "con", rodadas: 3, extra: [] },
  lightning: { status: "jj-chocado",     label: "Chocado",     save: "con", rodadas: 3, extra: [] },
  cold:      { status: "jj-congelando",  label: "Congelando",  save: "con", rodadas: 1, extra: ["jj-lento"] },
  psychic:   { status: "jj-confuso",     label: "Confuso",     save: "wis", rodadas: 2, extra: ["jj-desorientado"] },
  acid:      { status: "jj-corroendo",   label: "Corroendo",   save: "con", rodadas: 3, extra: [] },
  fire:      { status: "jj-em-chamas",   label: "Em Chamas",   save: "con", rodadas: 3, extra: [] },
  necrotic:  { status: "jj-entropia",    label: "Entropia",    save: "wis", rodadas: 2, extra: ["jj-amedrontado"] },
  // Alma (2.0): dano de alma compartilha a Entropia do necrótico — membros
  // elementais Sombrios causam dano de tipo "soul" e disparam a mesma condição
  // em crítico de 20 natural.
  soul:      { status: "jj-entropia",    label: "Entropia",    save: "wis", rodadas: 2, extra: ["jj-amedrontado"] },
  radiant:   { status: "jj-irradiado",   label: "Irradiado",   save: "con", rodadas: 3, extra: [] },
  slashing:  { status: "jj-sangramento", label: "Sangramento", save: "con", rodadas: 3, extra: [] },
  piercing:  { status: "jj-sangramento", label: "Sangramento", save: "con", rodadas: 3, extra: [] },
  // Trovejante: o Estremecido dura até o FIM do turno da própria criatura
  // (duração em turnos com expiração no turnEnd — fora de combate, permanece
  // até ser removida manualmente, pois não há turnos para contar).
  thunder:   { status: "jj-estremecido", label: "Estremecido", save: "con", rodadas: null, turnos: 1, expiry: "turnEnd", extra: [] }
});

/** Changes de movimento por condição — usados no efeito criado pelo toggle
 *  da ficha e pela aplicação por dano crítico. */
export const MODIFICADORES_MOVIMENTO = Object.freeze({
  "jj-acelerado":   [{ key: "system.attributes.movement.walk", mode: 2, value: 10 }],
  "jj-atordoado":   [{ key: "system.attributes.movement.walk", mode: 5, value: 3 }],
  "jj-agarrado":    [{ key: "system.attributes.movement.walk", mode: 4, value: 0 }],
  "jj-caido":       [{ key: "system.attributes.movement.walk", mode: 3, value: 0.25 }],
  "jj-desidratado": [{ key: "system.attributes.movement.walk", mode: 3, value: 0.5 }],
  "jj-estremecido": [{ key: "system.attributes.movement.walk", mode: 3, value: 0.5 }],
  "jj-exausto":     [{ key: "system.attributes.movement.walk", mode: 2, value: -1.5 }],
  "jj-impedido":    [{ key: "system.attributes.movement.walk", mode: 4, value: 0 }],
  "jj-letargico":   [{ key: "system.attributes.movement.walk", mode: 3, value: 0.5 }],
  "jj-lento":       [{ key: "system.attributes.movement.walk", mode: 2, value: -10 }],
  "jj-pesado":      [{ key: "system.attributes.movement.walk", mode: 3, value: 0.5 }]
});

/** Condições de dano ativas num ator (effects criados por este módulo). */
export function condicoesDanoAtivas(actor) {
  return (actor?.effects ?? [])
    .filter(e => e.getFlag?.("jujutsu-system", "condicaoDano"))
    .map(e => ({ effect: e, status: [...e.statuses ?? []][0], label: e.name,
      cd: e.getFlag?.("jujutsu-system", "condicaoDano")?.cd ?? null }));
}

/** Gatilhos em memória: alvoId → { tipos, cd, atacante, fulgor, expira }. */
const _gatilhos = new Map();
const TTL = 10 * 60 * 1000;

/**
 * Registra que o atacante acertou um crítico de 20 natural (ou ativou o
 * Fulgor Negro) no alvo com os tipos de dano dados — o próximo dano
 * aplicado dispara a salvaguarda.
 */
export function registrarGatilhoDano(alvo, { tipos = [], atacante = null, fulgor = false } = {}) {
  const id = alvo?.id ?? alvo?.uuid;
  if ( !id ) return;
  const chave = Ruleset.atributoPrincipal?.(atacante) ?? "str";
  const valor = Number(atacante?.system?.abilities?.[chave]?.value ?? 0);
  _gatilhos.set(id, {
    tipos: tipos.map(t => String(t).toLowerCase()),
    cd: CD_BASE + valor,
    atacante: atacante?.name ?? "?", atacanteUuid: atacante?.uuid ?? null, fulgor: !!fulgor,
    expira: Date.now() + TTL
  });
}

/** Condição disparada pelo gatilho do alvo, considerando os tipos aplicados. */
function condicaoDoGatilho(alvo, tiposAplicados = []) {
  const id = alvo?.id ?? alvo?.uuid;
  const gatilho = _gatilhos.get(id);
  if ( !gatilho ) return null;
  if ( Date.now() > gatilho.expira ) { _gatilhos.delete(id); return null; }
  if ( !gatilho.fulgor ) {
    const bate = tiposAplicados.length === 0
      || tiposAplicados.some(t => CONDICOES_DANO[String(t).toLowerCase()]);
    if ( !bate ) return null;
  }
  return gatilho;
}

/**
 * Consome o gatilho do alvo e aplica a condição de dano (com salvaguarda).
 * Chamado pelos pontos de aplicação de dano (damage-application e hook
 * dnd5e.applyDamage).
 * @returns {Promise<boolean>} true se uma condição foi aplicada.
 */
export async function aplicarCondicaoPorDano(alvo, { tiposAplicados = [], atacante = null } = {}) {
  if ( !alvo?.system?.attributes?.hp ) return false;
  const gatilho = condicaoDoGatilho(alvo, tiposAplicados);
  if ( !gatilho ) return false;
  _gatilhos.delete(alvo.id ?? alvo.uuid);

  // Primeiro tipo da gatilho que tenha condição associada (a técnica pode
  // causar mais de um tipo; o livro associa um tipo → uma condição).
  const tipos = tiposAplicados.length ? tiposAplicados : [...gatilho.tipos];
  const condKey = tipos.map(t => String(t).toLowerCase()).find(t => CONDICOES_DANO[t])
    ?? Object.keys(CONDICOES_DANO).find(k => gatilho.tipos.includes(k));
  const cond = CONDICOES_DANO[condKey];
  if ( !cond ) return false;
  return aplicarCondicaoDano(alvo, condKey, { cd: gatilho.cd, atacante: gatilho.atacante, atacanteUuid: gatilho.atacanteUuid });
}

/**
 * Rola a salvaguarda do alvo e, falhando, aplica a condição com duração.
 * Reaplicar apenas reseta a duração (não acumula).
 */
export async function aplicarCondicaoDano(alvo, condKey, { cd = CD_BASE, atacante = "o atacante", atacanteUuid = null } = {}) {
  const cond = CONDICOES_DANO[condKey];
  if ( !cond || !alvo?.system?.abilities?.[cond.save] ) return false;
  // Doença Sobrenatural (peculiaridade): imune às condições de DANO.
  if ( temPeculiaridade(alvo, "doenca-sobrenatural") ) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: alvo }),
      content: `☣️ <strong>${alvo.name}</strong> é imune a condições de Dano (Doença Sobrenatural).` });
    return false;
  }
  const atributo = cond.save === "wis" ? "Sabedoria" : "Constituição";

  const roll = await alvo.rollAbilitySave?.(cond.save, {
    flavor: `${cond.label} — CD ${cd} (gerada por ${atacante})`,
    messageData: { flavor: `${cond.label} — CD ${cd} (gerada por ${atacante})` }
  });
  const total = roll?.total ?? 0;
  if ( total >= cd ) {
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: alvo }),
      content: `🛡️ <strong>${alvo.name}</strong> passa na Salvaguarda de ${atributo} (CD ${cd}) e evita <strong>${cond.label}</strong>.` });
    return false;
  }

  const combate = game.combat;
  const existente = alvo.effects.find(e => e.statuses?.has(cond.status));
  // Duração: condições com rodadas expiram sozinhas; o Estremecido (turnos +
  // expiry turnEnd) dura até o FIM do turno da própria criatura; sem combate,
  // condições sem rodadas permanecem até serem removidas.
  const duracao = cond.turnos
    ? (combate ? { turns: cond.turnos, expiry: cond.expiry ?? "turnEnd" } : undefined)
    : cond.rodadas
      ? (combate
        ? { rounds: cond.rodadas, startRound: combate.round, startTurn: combate.turn, turns: cond.rodadas }
        : { seconds: cond.rodadas * 6 })
      : undefined;
  const textoDuracao = cond.turnos
    ? " — dura até o fim do seu turno"
    : cond.rodadas ? ` — duração resetada para ${cond.rodadas} rodada(s)` : " (permanece até removida)";
  if ( existente ) {
    await existente.update({ duration: duracao,
      ...(atacanteUuid ? { origin: atacanteUuid, "flags.jujutsu-system.conditionSourceActor": atacanteUuid } : {}) });
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: alvo }),
      content: `☠️ <strong>${alvo.name}</strong> sofre novamente <strong>${cond.label}</strong>${textoDuracao} (Salv. de ${atributo} ${total} vs CD ${cd}).` });
  } else {
    await alvo.createEmbeddedDocuments("ActiveEffect", [{
      name: cond.label,
      icon: "systems/jujutsu-system/icons/svg/items/feature.svg",
      origin: atacanteUuid,
      statuses: [cond.status, ...cond.extra].flatMap(s => statusesParaCondicao(s)),
      changes: [cond.status, ...cond.extra].flatMap(s => MODIFICADORES_MOVIMENTO[s] ?? []),
      duration: duracao,
      flags: { "jujutsu-system": { condicaoDano: { chave: condKey, cd, save: cond.save },
        ...(atacanteUuid ? { conditionSourceActor: atacanteUuid } : {}) } },
      disabled: false,
      transfer: false
    }]);
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: alvo }),
      content: `☠️ <strong>${alvo.name}</strong> falha na Salvaguarda de ${atributo} (${total} vs CD ${cd}) e sofre <strong>${cond.label}</strong>${cond.turnos ? " até o fim do seu turno" : cond.rodadas ? ` por ${cond.rodadas} rodada(s)` : ""}!` });
  }
  return true;
}

/**
 * Ação "Remover": 2 Pontos de Ação + Teste de Sabedoria (Medicina) contra a
 * CD da condição remove uma condição de dano antes do tempo. Abre o modal
 * de teste — cancelar o modal não consome os Pontos de Ação.
 */
export async function removerCondicaoDano(actor, condAtiva) {
  const cd = condAtiva.cd ?? 10;
  const pa = Number(actor.system?.legacy2?.actions?.value ?? 0);
  if ( pa < 2 ) {
    ui.notifications.warn("São necessários 2 Pontos de Ação [⬢⬢] para usar Remover!");
    return false;
  }
  const resultado = await actor.rollSkill?.({ skill: "rel", ability: "wis" });
  if ( !resultado ) return false; // modal cancelado — nada consumido
  const roll = Array.isArray(resultado) ? resultado[0] : resultado;
  const total = roll?.total ?? 0;
  await actor.update({ "system.legacy2.actions.value": Math.max(0, pa - 2) });
  if ( total >= cd ) {
    await condAtiva.effect.delete();
    ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
      content: `🩹 <strong>${actor.name}</strong> usa <strong>Remover</strong> (Medicina ${total} vs CD ${cd}) e remove <strong>${condAtiva.label}</strong>!` });
    return true;
  }
  ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }),
    content: `🩹 <strong>${actor.name}</strong> tenta <strong>Remover</strong> ${condAtiva.label} (Medicina ${total} vs CD ${cd}) e falha — a condição permanece.` });
  return false;
}

/** Dano aplicado pelos cards nativos do dnd5e também consome o gatilho. */
Hooks.on("dnd5e.applyDamage", (actor, amount, options) => {
  const tipos = (options?.damages ?? options?.items ?? []).flatMap(d => Array.isArray(d?.types) ? d.types : (d?.type ? [d.type] : []));
  return aplicarCondicaoPorDano(actor, { tiposAplicados: tipos });
});
