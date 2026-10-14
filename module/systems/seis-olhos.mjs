/**
 * ── SEIS OLHOS (2.0) — funções puras ────────────────────────────────────────
 * Estado na flag flags.jujutsu-system.seisOlhosMode: "full" (Completo) ou
 * "sealed" (Vendado, também o padrão de fichas antigas). Detectado pelo IDENTIFICADOR
 * "seis-olhos" em uma característica (nome "Seis Olhos" como fallback).
 * Módulo sem imports — seguro para qualquer cadeia (character, attack-data,
 * acoes-combate, native-cards). A camada interativa vive em
 * applications/actor/jj/seis-olhos.mjs.
 */

const IDENTIFICADOR = "seis-olhos";

/** A ficha tem a característica dos Seis Olhos? */
export function temSeisOlhos(actor) {
  return (actor?.itemTypes?.feat ?? []).some(f =>
    f.system?.identifier === IDENTIFICADOR || f.name === "Seis Olhos");
}

/** With the feature, only full or sealed exists; an unset or obsolete flag means sealed. */
export function modoSeisOlhos(actor) {
  if (!temSeisOlhos(actor)) return "";
  return actor?.getFlag?.("jujutsu-system", "seisOlhosMode") === "full" ? "full" : "sealed";
}

/** Redução no custo de técnicas/feitiços. */
export function reducaoCustoSeisOlhos(actor) {
  const modo = modoSeisOlhos(actor);
  return modo === "full" ? 2 : modo === "sealed" ? 1 : 0;
}

/** Bônus de acerto de ataques (comuns e de técnica). */
export function acertoSeisOlhos(actor) {
  const modo = modoSeisOlhos(actor);
  return modo === "full" ? 2 : modo === "sealed" ? 1 : 0;
}

/** Bônus de Classe de Resistência (teto de 28 aplicado no prepare). */
export function crSeisOlhos(actor) {
  const modo = modoSeisOlhos(actor);
  return modo === "full" ? 2 : modo === "sealed" ? 1 : 0;
}

/** Progressão mínima de Feitiço (arc) e Percepção (prc): Mestre/Proficiente. */
export function rankSeisOlhos(actor) {
  const modo = modoSeisOlhos(actor);
  return modo === "full" ? 4 : modo === "sealed" ? 2 : 0;
}

/** Contexto do card em Recursos Extras (rotulos e bônus do estado atual). */
export function contextoSeisOlhos(actor, { nivel = 1 } = {}) {
  const modo = modoSeisOlhos(actor);
  const contexto = {
    tem: temSeisOlhos(actor),
    modo,
    rotulo: modo === "full" ? "Completo" : "Vendado",
    cr: crSeisOlhos(actor), acerto: acertoSeisOlhos(actor), custo: reducaoCustoSeisOlhos(actor),
    rankRotulo: modo === "full" ? "Mestre" : modo === "sealed" ? "Proficiente" : "—",
    leitura: modo === "full" && nivel >= 8
  };
  const TEXTO_FULL = [
    '<b>PODER COMPLETO</b>',
    'Enquanto estiver utilizando todas as habilidades dos seis olhos, você recebe as seguintes características:',
    '• Você recebe +2 na sua Classe de Resistência, até um máximo de 28;',
    '• Você recebe +2 em suas rolagens de acerto de ataques (comuns e de técnica);',
    '• Você reduz o custo de todas as técnicas e feitiços em 2 Pontos de Energia Amaldiçoada (PA);',
    '• Você recebe a progressão de proficiência "Mestre" em Feitiçaria e Percepção;',
    '• <b>Análise de Fluxo</b>: quando uma criatura utilizar uma técnica inata ou herdada, você pode gastar 1 Ponto de Ação [⬢] no seu turno para analisar o fluxo de energia amaldiçoada dela, realizando um Teste de Intelecto (Feitiço) CD 15 + ND da criatura. Em caso de sucesso, os feitiços dela não podem ter vantagem contra você e você não pode ter desvantagem em Salvaguardas contra seus efeitos;',
    '• <b>Leitura Completa</b>: a partir do 8º nível de personagem, você consegue entender todo o funcionamento e restrições de uma técnica inata apenas ao olhá-la uma única vez;',
    '• <b>Sobrecarga Mental</b>: enquanto os seis olhos estiverem desvendados, recebe 3d4 de dano Psíquico ao desvendá-los e no início de cada turno em combate (a cada minuto fora de combate). Utilizando-os por mais de 2 rodadas seguidas, recebe 1 nível de exaustão ao fim do encontro.'
  ].join('<br>');
  const TEXTO_SEALED = [
    '<b>SELADO</b>',
    'Ao usar um Ponto de Ação, o usuário pode vendar ou desvendar os seis olhos, utilizando faixas, óculos escuros ou similares. Quando estiver vendado:',
    '• Você recebe metade de todos os bônus numéricos dos seis olhos (arredondado para baixo);',
    '• Você recebe a progressão de proficiência "Proficiente" em Feitiçaria e Percepção;',
    '• Você perde o acesso a "Análise de Fluxo" e "Leitura Completa".'
  ].join('<br>');
  contexto.tooltip = modo === "full" ? TEXTO_FULL : TEXTO_SEALED;
  return contexto;
}
