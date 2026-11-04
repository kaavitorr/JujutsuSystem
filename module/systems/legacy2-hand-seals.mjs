/** Shared capacity for the activation dialog, learning and rest recovery. */
export const HAND_SEALS_VERSION = 1;
export const HAND_SEALS_ID = "jj2a000000000002";
export const HAND_SEALS_DESCRIPTION = "<p>Você aprendeu a adicionar complexidade à ativação de suas habilidades para facilitar sua execução. Ao aprender esta habilidade, você recebe <strong>8 usos de Selos</strong> e recebe <strong>1 uso adicional</strong> sempre que aprende uma nova habilidade deste caminho. Todos os usos gastos são recuperados ao realizar um Descanso Curto ou Longo.</p>"
  + "<p>Ao consumir um <strong>Selo</strong>, você deve ter pelo menos uma mão livre. Ao fazê-lo, reduz em 1 Ponto de Ação [⬢] o custo da sua próxima Técnica, até um mínimo de 1 Ponto de Ação.</p>";
const NS = "jujutsu-system", PATH = "Selos e Encantamentos", PROGRESS = "handSealsProgress";
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const flags = actor => actor?.flags?.[NS] ?? {};
const finite = value => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
export const isHandSeals = item => item?.type === "feat"
  && [normalize(item.system?.identifier), normalize(item.name)].includes("selos-de-mao");
export const isSealPathAbility = item => item?.type === "feat" && (isHandSeals(item)
  || (item.flags?.[NS]?.especializacao ?? item.getFlag?.(NS, "especializacao"))?.caminho === PATH);

export function handSealAbilities(actor, { exclude } = {}) {
  const learned = new Set(); let hasBase = false;
  for (const item of actor?.items ?? []) {
    if (item === exclude || !isSealPathAbility(item)) continue;
    const base = isHandSeals(item); hasBase ||= base;
    learned.add(base ? "selos-de-mao" : normalize(item.system?.identifier || item.name));
  }
  return { count: learned.size, hasBase, keys: [...learned] };
}
const maximum = (actor, state, base = 8) => state.hasBase
  ? Math.max(0, base + Math.max(0, state.count - 1) + finite(flags(actor).selosBonus)) : 0;
export const handSealsMax = actor => maximum(actor, handSealAbilities(actor));

export function handSealsRestUpdates(actor) {
  const state = handSealAbilities(actor);
  return state.hasBase ? { [`flags.${NS}.selos`]: maximum(actor, state),
    [`flags.${NS}.${PROGRESS}`]: { version: HAND_SEALS_VERSION, count: state.count,
      known: [...new Set([...(flags(actor)[PROGRESS]?.known ?? []), ...state.keys])].sort() } } : {};
}

/** Upgrade the old base once; later learning grants only the newly earned uses. */
export function handSealProgressUpdates(actor, { previousState, learnedBase = false } = {}) {
  const state = handSealAbilities(actor), saved = actor?._source?.flags?.[NS] ?? flags(actor), progress = saved[PROGRESS];
  if (!state.hasBase && !progress?.count) return {};
  const max = maximum(actor, state), current = saved.selos, upgraded = progress?.version >= HAND_SEALS_VERSION;
  const hasHistory = Array.isArray(progress?.known), known = new Set(hasHistory ? progress.known : []);
  const oldBase = known.has("selos-de-mao");
  let value;
  if (!state.hasBase) value = 0;
  else if (current === undefined && !(oldBase && !progress.count) || learnedBase && !oldBase && !progress?.count) value = max;
  else {
    const increase = upgraded ? hasHistory ? state.keys.filter(key => key !== "selos-de-mao" && !known.has(key)).length
      : Math.max(0, state.count - finite(progress.count))
      : Math.max(0, max - maximum(actor, previousState ?? state, 3));
    const balance = oldBase && !progress.count ? progress.dormant ?? current : current;
    value = Math.min(max, Math.max(0, finite(balance)) + increase);
  }
  const nextProgress = { version: HAND_SEALS_VERSION, count: state.hasBase ? state.count : 0,
    known: [...new Set([...known, ...state.keys, ...(!state.hasBase && progress?.count ? ["selos-de-mao"] : [])])].sort(),
    ...(!state.hasBase ? { dormant: Math.max(0, finite(current)) } : {}) }, updates = {};
  if (current !== value) updates[`flags.${NS}.selos`] = value;
  if (JSON.stringify(progress) !== JSON.stringify(nextProgress)) updates[`flags.${NS}.${PROGRESS}`] = nextProgress;
  return updates;
}
