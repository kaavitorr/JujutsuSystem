/**
 * systems/escala-dano.mjs
 * Escala de Dano de NPC (Capítulo da 2.0): qualquer arma de NPC é configurada
 * dentro da escala — os dados de dano saem da linha do ND do ator e o
 * "+ atributo" é o @mod do ataque (o valor do atributo selecionado, mesma
 * convenção do bônus de acerto dos NPCs).
 *
 * A tabela define os NDs pares e a faixa 0–1; ND ímpar cai na linha do par
 * anterior (ND 11 usa a linha do 10, ND 25 a do 24 etc.), e ND acima do teto
 * usa a última linha.
 */
export const ESCALA_DANO = Object.freeze([
  Object.freeze({ nd: 0, dados: "1d4" }),
  Object.freeze({ nd: 2, dados: "1d6" }),
  Object.freeze({ nd: 4, dados: "1d8" }),
  Object.freeze({ nd: 6, dados: "1d10" }),
  Object.freeze({ nd: 8, dados: "1d12" }),
  Object.freeze({ nd: 10, dados: "2d8" }),
  Object.freeze({ nd: 12, dados: "3d6" }),
  Object.freeze({ nd: 14, dados: "2d10" }),
  Object.freeze({ nd: 16, dados: "3d8" }),
  Object.freeze({ nd: 18, dados: "3d10" }),
  Object.freeze({ nd: 20, dados: "4d8" }),
  Object.freeze({ nd: 22, dados: "3d12" }),
  Object.freeze({ nd: 24, dados: "3d12" }),
  Object.freeze({ nd: 26, dados: "5d8" }),
  Object.freeze({ nd: 28, dados: "4d12" }),
  Object.freeze({ nd: 30, dados: "5d10" })
]);

/** Linha da escala para um ND: o maior par definido que não o excede. */
export function linhaEscalaDano(nd) {
  const alvo = Math.max(0, Math.trunc(Number(nd) || 0));
  let linha = ESCALA_DANO[0];
  for ( const candidata of ESCALA_DANO ) {
    if ( candidata.nd <= alvo ) linha = candidata;
    else break;
  }
  return linha;
}

/**
 * Fórmula de dano da escala. `atributo` pode ser um número (o valor do
 * atributo: "1d6 + 3", negativo vira "1d6 - 1", zero omite) ou um placeholder
 * de rolldata ("1d6 + @mod").
 */
export function formulaEscalaDano(nd, { atributo = 0 } = {}) {
  const { dados } = linhaEscalaDano(nd);
  if ( typeof atributo === "string" ) return `${dados} + ${atributo}`;
  const valor = Math.trunc(Number(atributo) || 0);
  if ( valor > 0 ) return `${dados} + ${valor}`;
  if ( valor < 0 ) return `${dados} - ${Math.abs(valor)}`;
  return dados;
}

/**
 * Dado extra dos modificadores "+1 dado de dano / 4 ND" (Mordida, Chifres,
 * Ferrão): 1 dado do MESMO tipo da linha da escala a cada 4 ND completos.
 * Retorna o termo pronto para concatenar à fórmula — "" quando não há extra
 * (ND < 4) — ex.: ND 9 (linha 1d12) → " + 2d12".
 */
export function extraEscalaDano(nd) {
  const { dados } = linhaEscalaDano(nd);
  const dado = /^(\d+)d(\d+)$/.exec(dados);
  if ( !dado ) return "";
  const quantidade = Math.floor(Math.max(0, Math.trunc(Number(nd) || 0)) / 4);
  return quantidade > 0 ? ` + ${quantidade}d${dado[2]}` : "";
}
