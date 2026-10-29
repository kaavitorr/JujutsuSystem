import { alternativeSaveDefinition, alternativeSavesEnabled } from "./legacy2-alternative-saves.mjs";

const NS = "jujutsu-system";
const VERSION = 1;
const normalize = name => String(name ?? "").replace(/\s*\([^)]*\)\s*$/, "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const change = (key, value, type="add", priority=20) => ({ key, value, type, priority, phase: "initial" });
const bonus = (scope, value) => change(`system.${scope}.bonus`, value);
const mode = scope => change(`system.${scope}.mode`, -1);
const rule = (key, value=true) => change(`flags.${NS}.flawRules.${key}`, value, "override");
const allD20 = value => ["rolls.ability.check", "rolls.ability.save", "rolls.attack"].map(scope => bonus(scope, value));
const allDisadvantages = () => ["rolls.ability.check", "rolls.ability.save", "rolls.attack"].map(mode);
const skill = key => `skills.${key}.roll`;

/** Curated from the descriptions of the two compendium editions; no narrative triggers are inferred. */
export function flawEffectDefinitions(name, edition="2.0") {
  const key = normalize(name), v2 = edition === "2.0", definitions = [];
  const add = (slot, label, changes, trigger="", duration={}) => definitions.push({ slot, label, changes, trigger, duration });
  const passive = (changes, label="Penalidade permanente") => add("passive", label, changes);
  const conditional = (changes, trigger, label="Penalidade condicional", duration) => add("conditional", label, changes, trigger, duration);
  switch (key) {
    case "mentiroso": passive([bonus(skill("dec"), -2)]); break;
    case "convencido": passive([bonus(skill("prf"), -2)]); break;
    case "retrucador": passive([v2 ? bonus(skill("per"), -2) : mode(skill("per"))]); break;
    case "compulsivo": passive([bonus(skill("inv"), -2)]); break;
    case "distraido": passive(["ins", "prc", "his", "inv"].map(k => bonus(skill(k), -2))); break;
    case "ma fama": case "megalomaniaco": passive([bonus(skill("per"), -2)]); break;
    case "ruim com nomes": passive([bonus("abilities.cha.check.roll", -1)]); break;
    case "sinceridade excessiva": passive([mode(skill("dec"))]); break;
    case "timidez": passive([v2 ? mode(skill("prf")) : bonus(skill("prf"), -2)]); break;
    case "churriado": passive([mode("abilities.str.check.roll"), mode("abilities.str.save.roll")]); break;
    case "medroso": passive([rule("initiativeLast")], "Último na iniciativa"); break;
    case "mediocre": if (v2) passive([rule("noCriticals")], "Sem sucessos críticos"); break;
    case "demente":
      if (v2) passive([change("system.abilities.wis.value", 16, "downgrade", 1000)], "Sabedoria limitada a 16");
      break;
    case "falta de higiene":
      passive([rule("failSkills.per"), change("system.skills.per.bonuses.passive", -10)], "Falha em Persuasão e −10 no passivo"); break;
    case "analfabeto":
      if (!v2) {
        passive([change("system.abilities.wis.value", -1)], "−1 em Sabedoria");
        conditional([rule("failChecks")], "Ative somente para um teste que dependa de leitura; desative após o teste.", "Teste de leitura");
      }
      break;
    case "narcisista": conditional([bonus("abilities.wis.check.roll", -1)], "Ative enquanto estiver sujo ou sem se arrumar."); break;
    case "ganancioso": conditional(allD20(-1), "Ative ao recusar ou perder uma oportunidade de enriquecer. Role 1d6 dias e desative ao terminar esse prazo."); break;
    case "cleptomaniaco": conditional(allD20(-1), "Ative enquanto não roubar o objeto desejado. Não acumule o efeito; desative quando satisfizer a compulsão."); break;
    case "dependente": conditional(allD20(-1), "Ative enquanto nenhum companheiro ou criatura cooperativa estiver visível."); break;
    case "curioso": conditional([bonus("rolls.ability.check", -1)], "Ative enquanto ignorar o mistério que despertou sua curiosidade."); break;
    case "obsessivo":
      if (!v2) passive([bonus(skill("ins"), -2)]);
      conditional([bonus("rolls.ability.check", -1)], "Ative enquanto ignorar sua obsessão; desative ao voltar a alimentá-la."); break;
    case "sedutor incorrigivel": conditional([bonus("rolls.ability.check", -1)], "Ative enquanto estiver na presença do seu interesse amoroso."); break;
    case "viajante": conditional([...allD20(-1), ...allDisadvantages()], "Ative após passar mais de um mês no mesmo lugar, respeitando a exceção de treinamento da descrição."); break;
    case "trauma profundo/fobia": conditional(allD20(-5), "Ative após falhar na salvaguarda do trauma. Dura 1 minuto; depois repita a salvaguarda conforme a descrição.", "Trauma desencadeado", { seconds: 60 }); break;
    case "visao ruim": conditional([mode("rolls.ability.check")], "Ative somente para testes relacionados à visão quando não estiver usando a correção visual; desative após o teste.", "Teste de visão"); break;
    case "audicao ruim": conditional([mode("rolls.ability.check")], "Ative somente para um teste relacionado à audição; desative após o teste.", "Teste de audição"); break;
    case "cego": conditional(v2 ? [rule("failChecks")] : [mode("rolls.ability.check"), mode("rolls.ability.save")], "Ative somente para um teste dependente da visão; desative após o teste. Os demais sentidos não sofrem a penalidade.", "Teste de visão"); break;
    case "surdo": conditional([rule("failChecks")], "Ative somente para um teste dependente da audição; desative após o teste. Os demais sentidos não sofrem a penalidade.", "Teste de audição"); break;
    case "mudo": conditional([rule("failChecks")], "Ative somente para um teste dependente da fala; desative após o teste.", "Teste de fala"); break;
    case "amnesia": conditional([mode("abilities.wis.check.roll")], "Ative somente para testes de Sabedoria para lembrar algo; desative após o teste.", "Teste de memória"); break;
    case "olfato ruim": conditional([mode(skill("prc"))], "Ative somente para um teste de Percepção relacionado ao olfato; desative após o teste.", "Percepção pelo olfato"); break;
    case "ingenuo": conditional([mode(skill("ins"))], "Ative para Intuição contra mentiras sutis ou meias-verdades, respeitando a exceção de afirmações absurdas.", "Intuição contra mentiras"); break;
    case "voz fina": conditional([mode(skill("itm"))], "Ative para Intimidação contra uma criatura que possa ouvir sua voz; desative após o teste.", "Intimidação pela voz"); break;
    case "furia incontrolavel": conditional(v2 ? [rule("saveDisadvantages", 2)] : [mode("rolls.ability.save")], "Ative somente para a salvaguarda contra Provocação; desative após o teste.", "Salvaguarda contra Provocação"); break;
    case "orgulho cego": conditional([rule("failAllSaves")], "Ative somente para a salvaguarda contra Provocação; desative após o teste.", "Falha contra Provocação"); break;
    case "dupla personalidade":
      if (v2) conditional([rule("trainedSkillDisadvantages", 1), rule("failSaves.wis"), rule("failSaves.int")], "Ative enquanto a personalidade secundária estiver no controle; desative no descanso longo ou quando o controle voltar, conforme a descrição.", "Personalidade secundária");
      else {
        add("personality-penalty", "Personalidade com penalidade", allD20(-2), "Ative somente enquanto a personalidade escolhida para sofrer −2 estiver no controle. Desative o efeito da outra personalidade.");
        add("personality-bonus", "Personalidade com bônus", allD20(1), "Ative somente enquanto a personalidade escolhida para receber +1 estiver no controle. Desative o efeito da outra personalidade.");
      }
      break;
    case "coracao mole": conditional([mode("rolls.attack")], "Ative somente para ataques contra criaturas que despertem sua empatia; desative após o ataque."); break;
    case "lixo da sociedade":
      if (!v2) conditional([bonus("rolls.ability.check", -1)], "Ative somente para o teste de interação social com um membro comum da sociedade; desative após o teste.", "Interação com a sociedade");
      break;
    case "instinto assassino":
      if (!v2) conditional([rule("failChecks")], "Ative somente para um teste para saber como uma criatura está se sentindo; desative após o teste.", "Teste sobre sentimentos");
      break;
    case "ferida fantasma":
      if (!v2) conditional([mode("rolls.ability.save")], "Ative somente para a salvaguarda da Ferida Fantasma diante de quem causou o trauma ou de acontecimentos relacionados; desative após o teste. O dano, o bloqueio de ações e o limite entre descansos continuam dependendo de acompanhamento.", "Salvaguarda diante do trauma");
      break;
    case "depressivo": conditional([
      ...Array.from({ length: v2 ? 6 : 1 }, () => change("system.rolls.attack.mode", -1, "downgrade")),
      rule("attackNoAdvantages")
    ], "Ative somente para sua primeira jogada de ataque de cada encontro contra inimigos, mesmo que possua vantagens. Desative imediatamente após essa jogada.", "Primeiro ataque do encontro"); break;
    case "vicio": conditional([mode("attributes.init.roll")], "Ative a partir do primeiro dia sem consumo. Os dias de abstinência, os descansos e a perda cumulativa de energia continuam dependendo de acompanhamento.", "Abstinência: iniciativa"); break;
  }
  return { key, edition, definitions };
}

// Deterministic embedded IDs keep repeated imports/migrations idempotent without a browser crypto dependency.
function effectId(text) {
  let a = 2166136261, b = 2166136261;
  for (const char of text) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b ^ char.charCodeAt(0), 2246822519); }
  return [a, b].map(n => (n >>> 0).toString(16).padStart(8, "0")).join("");
}
const legacyKey = key => key.replace(/^(system\.skills\.\w+)\.bonuses\.check$/, "$1.roll.bonus");
const effectChanges = effect => effect.system?.changes ?? effect.changes ?? [];
function legacyEquivalent(effect, definition) {
  if (effect.flags?.[NS]?.flawAutomation) return false;
  const old = effectChanges(effect);
  return old.length === definition.changes.length && old.every((c, i) => legacyKey(c.key) === definition.changes[i].key
    && Number(c.value) === definition.changes[i].value && c.type === definition.changes[i].type);
}
function wrongLegacyEffect(effect, key) {
  if (!["vicio", "viajante"].includes(key) || normalize(effect.name) !== "vicio") return false;
  const changes = effectChanges(effect);
  return changes.length === 1 && changes[0].key === "system.abilities.con.bonuses.save"
    && String(changes[0].value).replace(/\s/g, "") === "-2" && changes[0].type === "custom";
}

/** Produce native transferable effects, retaining user effects and the enabled state of existing automation. */
export function flawEffectPlan(item, edition="2.0") {
  const { key, definitions } = flawEffectDefinitions(item.name, edition);
  const original = Array.from(item.effects ?? [], effect => effect.toObject?.() ?? effect);
  const effects = original.filter(e => !wrongLegacyEffect(e, key)).map(e => structuredClone(e));
  for (const definition of definitions) {
    const index = effects.findIndex(e => (e.flags?.[NS]?.flawAutomation?.slot === definition.slot
      && e.flags[NS].flawAutomation.key === key) || (definition.slot === "passive"
        && normalize(e.name) === key && legacyEquivalent(e, definition)));
    const existing = index >= 0 ? effects[index] : null;
    const effect = { ...existing, _id: existing?._id ?? effectId(`${item._id ?? item.id}:${edition}:${key}:${definition.slot}`),
      name: `${item.name.replace(/\s*\([^)]*\)\s*$/, "")} — ${definition.label}`, type: "base", img: item.img,
      description: definition.trigger || "Penalidade permanente concedida por este defeito. O efeito acompanha o item e deixa de se aplicar quando ele é removido.",
      disabled: existing?.disabled ?? !!definition.trigger, transfer: true,
      system: { ...existing?.system, changes: definition.changes }, duration: { ...existing?.duration, ...definition.duration },
      flags: { ...existing?.flags, [NS]: { ...existing?.flags?.[NS], flawAutomation: { version: VERSION, edition, key, slot: definition.slot, conditional: !!definition.trigger } } } };
    if (index < 0) effects.push(effect); else effects[index] = effect;
  }
  return { effects, flags: { ...item.flags, [NS]: { ...item.flags?.[NS], flawAutomation: { version: VERSION, edition, key } } } };
}

export const flawRules = actor => actor?.flags?.[NS]?.flawRules ?? {};
const enabled = value => value === true || value === "true";
const sameData = (a, b) => a === b || (!!a && !!b && typeof a === "object" && typeof b === "object"
  && Array.isArray(a) === Array.isArray(b) && Object.keys(a).length === Object.keys(b).length
  && Object.keys(a).every(key => Object.hasOwn(b, key) && sameData(a[key], b[key])));
export const flawInitiativeLast = actor => enabled(flawRules(actor).initiativeLast);
export const flawPreventsCriticals = actor => enabled(flawRules(actor).noCriticals);

export function flawRollDisadvantages(actor, { kind, skill, rank=0 }) {
  const rules = flawRules(actor);
  return kind === "save" ? Math.max(0, Number(rules.saveDisadvantages) || 0)
    : kind === "check" && skill && rank >= 1 ? Math.max(0, Number(rules.trainedSkillDisadvantages) || 0) : 0;
}

/** Carry explicit rule exceptions on the serialized roll; never fake automatic failure with a large penalty. */
export function configureFlawRoll(roll, process) {
  const actor = process?.subject?.actor ?? process?.subject?.item?.actor ?? process?.subject;
  if (!actor?.system?.abilities) return roll;
  const rules = flawRules(actor), save = process.hookNames?.some(name => /saving|save/i.test(name));
  const check = !save && !process.subject?.item && !!(process.skill || process.tool || process.ability)
    && !process.hookNames?.includes("initiativeDialog");
  const ability = roll.data?.abilityId ?? roll.data?.roll?.ability ?? process.ability;
  const abilities = save && alternativeSavesEnabled() ? alternativeSaveDefinition(ability)?.abilities ?? [ability] : [ability];
  roll.options ??= {};
  roll.options.jjFlawNoCriticals = flawPreventsCriticals(actor);
  roll.options.jjFlawAutoFailure = !!(check && (enabled(rules.failChecks) || enabled(rules.failSkills?.[process.skill]))
    || save && (enabled(rules.failAllSaves) || abilities.some(id => enabled(rules.failSaves?.[id]))));
  return roll;
}

/** Refresh proven, unedited compendium copies, including synthetic actors. Native Items own their effects. */
export async function refreshFlawEffects(world=game) {
  if (!world.user.isGM || world.users.activeGM?.id !== world.user.id) return;
  const sources = new Map();
  for (const name of ["geral-2-0", "geral"]) {
    const pack = world.packs.get(`jujutsu-compendium.${name}`);
    if (!pack) continue;
    for (const item of await pack.getDocuments()) {
      if (item.flags?.[NS]?.flawAutomation) sources.set(item.uuid, item);
    }
  }
  const update = async item => {
    const origin = item._stats?.compendiumSource ?? item.flags?.core?.sourceId;
    const source = sources.get(origin);
    if (!source || source.type !== "feat" || item.type !== "feat"
      || item.system?.description?.value !== source.system?.description?.value) return;
    const edition = source.flags[NS].flawAutomation.edition, before = item.toObject();
    const plan = flawEffectPlan(before, edition);
    if (sameData(before.effects, plan.effects)
      && sameData(before.flags?.[NS]?.flawAutomation, plan.flags[NS].flawAutomation)) return;
    // Core updates the Item's embedded effects atomically, without creating independent Actor effects.
    await item.update({ effects: plan.effects, [`flags.${NS}.flawAutomation`]: plan.flags[NS].flawAutomation });
  };
  for (const item of world.items ?? []) await update(item);
  const actors = new Set(world.actors ?? []);
  for (const scene of world.scenes ?? []) for (const token of scene.tokens ?? []) if (!token.actorLink && token.actor) actors.add(token.actor);
  for (const actor of actors) for (const item of actor.items ?? []) await update(item);
}

export function registerFlawEffectHooks(hooks=Hooks) {
  hooks.once("dnd5e.ready", () => refreshFlawEffects().catch(error => {
    console.error("Jujutsu: falha ao atualizar os Active Effects de defeitos.", error);
    ui.notifications.error("Não foi possível atualizar os efeitos de defeitos das fichas.");
  }));
}
