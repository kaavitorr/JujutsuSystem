const NS = "jujutsu-system";
const VERSION = 1;
const number = value => Math.max(0, Math.trunc(Number(value) || 0));
const legacy = () => (globalThis.game?.settings?.get(NS, "rulesetVersion") ?? "1.0") === "1.0";
const definitions = {
  "restricao-celestial-incompleta": { rule: "incompleteRestriction", automatic: "Energia base de 5 PA por nível e concessão de Perito em Fuga.",
    manual: "Distribua os 10 pontos entre os atributos físicos. O acesso às técnicas de Restringido não altera seu Estilo de Combate." },
  "pontos-de-maldicao": { rule: "cursePoints", automatic: "+1 Ponto de Maldição por nível por cópia, até cinco cópias; preserva pontos já gastos." },
  "pontos-de-treinamento": { rule: "trainingPoints", automatic: "+1 Ponto de Treinamento por nível por cópia, até cinco cópias; preserva gastos e perdas." },
  "vida-adicional": { rule: "hitPoints", automatic: "+1 PV máximo por nível por cópia, até cinco cópias, quando os PV são calculados automaticamente." },
  "reencarnacao-em-objeto-amaldicoado": { manual: "O narrador controla os fragmentos consumidos, o aumento de nível e a percepção exclusiva dos fragmentos em 500 metros." },
  "reducao-de-penalidade-seis-olhos": { rule: "reducedEyesPenalty", automatic: "Seis Olhos: penalidade de 2d8 ao liberar e depois a cada 10 minutos de uso.",
    manual: "A exaustão depende das circunstâncias de uso; com Energia Reversa, esta penalidade não causa exaustão." },
  "energia-amaldicoada-variante": { manual: "Escolha e adicione somente a variante correspondente ao elemento do Feitiço Inato. Os efeitos que dependem do alvo ou do tipo de ataque exigem o contexto da descrição." },
  "conhecimento-da-alma": { rule: "soulKnowledge", automatic: "Resistência ao dano de Alma.",
    manual: "O narrador determina quais seres só podem ser destruídos ao atingir a alma e a criação de objetos amaldiçoados." },
  "estrutura-corporal-anomala": { rule: "anomalousBody", automatic: "Imunidade à condição Surpreso.",
    manual: "As dispensas de ação, encantamentos e selos dependem dos membros disponíveis; mantenha esse controle durante o uso das técnicas." },
  "receptaculo-destinado": { rule: "destinedVessel", automatic: "Conhecimento da Alma e margem principal de Fulgor Negro ampliada em 1.",
    manual: "Requer a Origem Receptáculo. A escolha e conservação do caminho Mestre do Fulgor seguem as regras da característica." },
  "seis-olhos": { rule: "sixEyes", automatic: "Disponibiliza os controles existentes dos Seis Olhos.",
    manual: "O narrador verifica a linhagem, o clã e a existência de outro usuário vivo. Não altera sua Origem de Poder." },
  "energia-colossal": { rule: "colossal", automatic: "Energia base de 30 PA por nível; cada Evolução na Prática concede 7 PA máximos em lugar de 5." }
};

function sourceKey(item) {
  const source = item?.flags?.[NS]?.seresAmaldicoados1;
  if (item?.type !== "feat" || source?.ruleset !== "1.0" || source.kind !== "benefit") return null;
  const key = item.system?.identifier;
  return Object.hasOwn(definitions, key ?? "") ? key : null;
}

function effectId(text) {
  let a = 2166136261, b = 2166136261;
  for (const char of text) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b ^ char.charCodeAt(0), 2246822519); }
  return [a, b].map(n => (n >>> 0).toString(16).padStart(8, "0")).join("");
}

/** Only these curated 1.0 benefits receive rules; similarly named ordinary feats are untouched. */
export function benefitEffectPlan1(item) {
  const key = sourceKey(item);
  if (!key) return null;
  const definition = definitions[key];
  const effects = Array.from(item.effects ?? [], effect => structuredClone(effect.toObject?.() ?? effect));
  if (definition.rule) {
    const index = effects.findIndex(effect => effect.flags?.[NS]?.cursedBenefitAutomation1?.key === key);
    const previous = index < 0 ? null : effects[index];
    const effect = { ...previous, _id: previous?._id ?? effectId(`${item._id ?? item.id}:cursed-benefit-1:${key}`),
      name: `${item.name} — Benefício automático`, type: "base", img: item.img, transfer: true,
      disabled: previous?.disabled ?? false, description: [definition.automatic, definition.manual].filter(Boolean).join(" "),
      system: { ...previous?.system, changes: [{ key: `flags.${NS}.cursedBenefits1.${definition.rule}`,
        value: 1, type: "add", phase: "initial", priority: 20 }] },
      flags: { ...previous?.flags, [NS]: { ...previous?.flags?.[NS], cursedBenefitAutomation1: { version: VERSION, key } } } };
    if (index < 0) effects.push(effect); else effects[index] = effect;
  }
  return { effects, flags: { ...item.flags, [NS]: { ...item.flags?.[NS], cursedBenefitAutomation1: {
    version: VERSION, key, automatic: definition.automatic ?? "", manual: definition.manual ?? ""
  } } } };
}

/** Markers are supplied by native, enabled, transferable Item effects. */
export function cursedBenefitRules1(actor) {
  const rules = legacy() ? actor?.flags?.[NS]?.cursedBenefits1 ?? {} : {};
  return Object.fromEntries(Object.values(definitions).filter(d => d.rule).map(({ rule }) =>
    [rule, Math.min(["cursePoints", "trainingPoints", "hitPoints"].includes(rule) ? 5 : 1, number(rules[rule]))]));
}

const levelOf = actor => number(actor?.system?.details?.level);
export const cursedHitPointBonus1 = actor => levelOf(actor) * cursedBenefitRules1(actor).hitPoints;

/** Stronger origin replacements remain valid; an explicit energy restriction takes precedence. */
export function intensiveEnergyGain1(actor, enormous=false) {
  return Math.max(enormous ? 10 : 5, cursedBenefitRules1(actor).colossal ? 7 : 0);
}

/** Base + training + independent bonuses, before the existing permanent energy penalties. */
export function cursedEnergyFormula1(actor, { enormous=false, bonus=0 }={}) {
  const rules = cursedBenefitRules1(actor);
  const base = rules.incompleteRestriction ? 5 : Math.max(enormous ? 40 : 20, rules.colossal ? 30 : 0);
  return levelOf(actor) * base + number(actor?.system?.energy?.intensiveTraining?.maxEnergy)
    * intensiveEnergyGain1(actor, enormous) + (Number(bonus) || 0);
}

export function applyCursedBenefitTraits1(actor) {
  const rules = cursedBenefitRules1(actor), traits = actor?.system?.traits;
  if (rules.soulKnowledge || rules.destinedVessel) traits?.dr?.value?.add("soul");
  if (rules.anomalousBody) traits?.ci?.value?.add("surprised");
}

/** Keep a configured base separate from the benefit so editing the margin never compounds the reduction. */
export function cursedPrimaryMargin1(actor, base=20) {
  return Math.min(20, Math.max(1, (Number(base) || 20) - cursedBenefitRules1(actor).destinedVessel));
}

export function cursedSixEyesOwned1(actor) {
  if (cursedBenefitRules1(actor).sixEyes) return true;
  const feats = actor?.itemTypes?.feat;
  return Array.from(feats ?? actor?.items ?? []).some(item => (feats || item.type === "feat")
    && item.flags?.[NS]?.seresAmaldicoados1?.ruleset !== "1.0"
    && (item.system?.identifier === "seis-olhos" || item.name === "Seis Olhos"));
}

/** Persistent resource differences prevent preparing a sheet from refunding spent points. */
export function cursedBenefitResourceUpdates1(actor) {
  const resources = actor?.system?.curseResources;
  if (!resources) return {};
  const rules = cursedBenefitRules1(actor), level = levelOf(actor);
  const previous = actor.flags?.[NS]?.cursedBenefitGrants1 ?? {};
  const next = {}, updates = {};
  for (const key of ["cursePoints", "trainingPoints"]) {
    const granted = rules[key] * level, old = previous[key] ?? {};
    const total = number(resources[key]) + granted - number(old.granted) - number(old.deficit);
    const value = Math.max(0, total), deficit = Math.max(0, -total);
    next[key] = { granted, deficit };
    if (value !== number(resources[key])) updates[`system.curseResources.${key}`] = value;
  }
  if (Object.keys(next).some(key => next[key].granted !== number(previous[key]?.granted)
    || next[key].deficit !== number(previous[key]?.deficit))) updates[`flags.${NS}.cursedBenefitGrants1`] = next;
  return updates;
}

const resourceSyncs = new WeakMap();
export function syncCursedBenefitResources1(actor) {
  const previous = resourceSyncs.get(actor) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const updates = cursedBenefitResourceUpdates1(actor);
    if (Object.keys(updates).length) await actor.update(updates, { cursedBenefitSync1: true });
  });
  resourceSyncs.set(actor, next);
  return next.finally(() => { if (resourceSyncs.get(actor) === next) resourceSyncs.delete(actor); });
}

/** World time, not round numbers: the reduced surcharge recurs every ten minutes of continuous use. */
export function reducedEyesSchedule1(actor, now, { start=false }={}) {
  const time = number(now);
  if (!cursedBenefitRules1(actor).reducedEyesPenalty || !cursedSixEyesOwned1(actor)
    || actor.flags?.[NS]?.seisOlhosMode !== "full") return { charges: 0, last: time };
  if (start) return { charges: 1, last: time };
  const saved = actor.flags?.[NS]?.cursedEyesLast1;
  if (saved === undefined || !Number.isFinite(Number(saved))) return { charges: 0, last: time };
  const last = number(saved), charges = Math.max(0, Math.floor((time - last) / 600));
  return { charges, last: last + charges * 600 };
}
