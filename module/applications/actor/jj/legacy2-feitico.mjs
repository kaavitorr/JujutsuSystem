import Ruleset from "../../../systems/ruleset.mjs";
import { tem } from "../../../systems/especializacoes-2.mjs";

const EVOLUTIONS = [
  { id: "basico", label: "Básico", mainReq: 1 },
  { id: "estendido", label: "Estendido", mainReq: 4 },
  { id: "maximo", label: "Máximo", mainReq: 8 },
  { id: "expansao", label: "Expansão de Domínio", mainReq: 10, ability: "Expansão de Domínio", identifier: "expansao-de-dominio" },
  { id: "semBarreiras", label: "Expansão sem Barreiras", mainReq: 16, ability: "Expansão sem Barreiras", identifier: "expansao-sem-barreiras" }
];

/** Same learned choices as the skill tree; also accept feats added directly from the compendium. */
function hasAbility(actor, evolution) {
  return tem(actor, evolution.ability) || Array.from(actor.items ?? []).some(item => item.type === "feat"
    && (item.name === evolution.ability || item.system?.identifier === evolution.identifier));
}

/** Read-only evolution state for 2.0. Levels never grant a domain specialization on their own. */
export function feiticoProgression2(actor) {
  const nivel = Ruleset.nivel(actor);
  const semBarreiras = hasAbility(actor, EVOLUTIONS[4]);
  const tiers = EVOLUTIONS.map(evolution => {
    const abilityMet = !evolution.ability || hasAbility(actor, evolution) || (evolution.id === "expansao" && semBarreiras);
    return { ...evolution, reqMet: nivel >= evolution.mainReq && abilityMet,
      abilityMet, requirementText: `Nível ${evolution.mainReq}${evolution.ability ? ` e habilidade ${evolution.ability}` : ""}` };
  });
  const current = [...tiers].reverse().find(tier => tier.reqMet);
  for (const tier of tiers) tier.isCurrent = tier.id === current?.id;
  return { nivel, tiers, proficiencia: { id: current?.id ?? "none", label: current?.label ?? "—" } };
}
