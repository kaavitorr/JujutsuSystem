/** Shared weapon groups for both 2.0 presentation and roll calculations. */
export const WEAPON_GROUPS = [
  { key: "martialM", label: "Pesada", aliases: ["siege"] },
  { key: "simpleM", label: "Leve", aliases: [] },
  { key: "simpleR", label: "Projétil", aliases: ["martialR"] },
  { key: "improv", label: "Desarmado", aliases: [] },
  { key: "natural", label: "Natural", aliases: [] }
];

const rankOf = value => Math.floor(Math.min(4, Math.max(0, Number(value) || 0)));

/** A saved canonical rank wins; otherwise preserve the old category's proficiency. */
export function weaponGroupRank(ranks, category) {
  const group = WEAPON_GROUPS.find(g => g.key === category || g.aliases.includes(category));
  if ( !group ) return rankOf(ranks?.[category]);
  if ( ranks?.[group.key] !== undefined && ranks?.[group.key] !== null ) return rankOf(ranks[group.key]);
  return Math.max(0, ...group.aliases.map(key => rankOf(ranks?.[key])));
}

/* ── Proficiência por Defeitos (regra 2.0) ────────────────────────────── */

/** Cada 2 Pontos de Defeito convertem em 1 Ponto de Proficiência. */
export const CONVERSAO_DEFEITO = 2;

/** Pontos de um feat de Defeito: flag `defeitoPontos` (gravada pelo
 * importador da personalização) ou, na falta dela, o sufixo "(N pontos)" no
 * nome; feats sem nenhum dos dois não pontuam. */
export function pontosDoItem(item) {
  const flag = Math.trunc(Number(item?.getFlag?.("jujutsu-system", "defeitoPontos")
    ?? item?.flags?.["jujutsu-system"]?.defeitoPontos));
  if ( Number.isFinite(flag) && flag > 0 ) return flag;
  return Number(/\((\d+)\s*pontos?\)/i.exec(item?.name ?? "")?.[1]) || 0;
}

/** Pontos totais dos Defeitos da ficha (soma de pontosDoItem dos feats da
 * seção jj-flaws). */
export function pontosDefeitos(actor) {
  return Array.from(actor?.items ?? [])
    .filter(item => (item.type === "feat")
      && (item.getFlag?.("jujutsu-system", "featureSection") ?? item.flags?.["jujutsu-system"]?.featureSection) === "jj-flaws")
    .reduce((total, item) => total + pontosDoItem(item), 0);
}

/** Proficiência concedida pelos Defeitos da ficha (pontos ÷ 2, piso inteiro). */
export function proficienciaPorDefeitos(actor) {
  return Math.floor(pontosDefeitos(actor) / CONVERSAO_DEFEITO);
}
