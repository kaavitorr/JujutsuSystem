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
