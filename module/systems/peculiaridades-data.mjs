/** Identity and immunity rules without hooks, document writes or sheet dependencies. */
export const PECULIARIDADES = Object.freeze({
  "visoes-fugazes": "Visões Fugazes",
  "ferida-amaldicoada": "Ferida Amaldiçoada",
  "gemeo-amaldicoado": "Gêmeo Amaldiçoado",
  "fisico-limitado": "Físico Limitado",
  "apetite-canibal": "Apetite Canibal",
  "corpo-exaurido": "Corpo Exaurido",
  "pesadelos-terriveis": "Pesadelos Terríveis",
  "ma-cicatrizacao": "Má Cicatrização",
  "tremores-involuntarios": "Tremores Involuntários",
  "presenca-incomoda": "Presença Incômoda",
  "respiracao-instavel": "Respiração Instável",
  "azar-absurdo": "Azar Absurdo",
  "lembrete-sombrio": "Lembrete Sombrio",
  "energia-destrutiva": "Energia Destrutiva",
  "voz-amaldicoada": "Voz Amaldiçoada",
  "rastro-da-desgraca": "Rastro Da Desgraça",
  "reflexo-amaldicoado": "Reflexo Amaldiçoado",
  "sede-de-sangue-imposta": "Sede De Sangue Imposta",
  "olhar-do-abismo": "Olhar Do Abismo",
  "maldicao-descontrolada": "Maldição Descontrolada",
  "corpo-fragil": "Corpo Frágil",
  "voto-vinculativo": "Voto Vinculativo",
  "visao-deturpada-do-mundo": "Visão Deturpada Do Mundo",
  "destino-entrelacado": "Destino Entrelaçado",
  "doenca-sobrenatural": "Doença Sobrenatural",
  "cacador-sombrio": "Caçador Sombrio",
  "desejo-sombrio": "Desejo Sombrio"
});
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export function temPeculiaridade(actor, chave) {
  if (globalThis.game?.settings?.get?.("jujutsu-system", "rulesetVersion") !== "2.0" || !PECULIARIDADES[chave]) return false;
  return actor?.items?.some(item => {
    if (item.type !== "feat") return false;
    const flags = item.flags?.["jujutsu-system"] ?? {};
    const stable = item.getFlag?.("jujutsu-system", "peculiaridade") ?? flags.peculiaridade;
    if (stable) return stable === chave;
    return (item.getFlag?.("jujutsu-system", "featureSection") ?? flags.featureSection) === "jj-peculiarities"
      && normalize(item.name) === normalize(PECULIARIDADES[chave]);
  }) ?? false;
}
export const imuneReducaoPA = actor => temPeculiaridade(actor, "corpo-fragil");
const damageConditions = new Set(["jj-envenenado", "jj-chocado", "jj-congelando", "jj-confuso", "jj-corroendo", "jj-em-chamas", "jj-entropia", "jj-irradiado", "jj-sangramento"]);
export function imunidadeCondicao(actor, condId) {
  if (["jj-amedrontado", "frightened"].includes(condId) && temPeculiaridade(actor, "pesadelos-terriveis")) return true;
  if (["jj-atordoado", "stunned"].includes(condId) && temPeculiaridade(actor, "olhar-do-abismo")) return true;
  return damageConditions.has(condId) && temPeculiaridade(actor, "doenca-sobrenatural");
}
