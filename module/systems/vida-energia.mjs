import Ruleset from "./ruleset.mjs";

/**
 * ── VIDA COMO ENERGIA (2.0 — Espíritos Amaldiçoados) ─────────────────────────
 * Espíritos amaldiçoados não têm um pool de energia separado: os Pontos de
 * Vida deles (20 × ND × categoria) SÃO a energia que gastam. Toda vez que um
 * custo de energia baixa `system.energy.total` ou `system.energy.generated`,
 * o mesmo valor sai dos Pontos de Vida — na MESMA update, atomicamente.
 *
 * Transferências (geração de PA no turno: total −X com gerada +X) não são
 * custo e não ferem o espírito.
 */
Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
  if ( !Ruleset.vidaEnergia(actor) ) return;
  const energy = foundry.utils.getProperty(changes, "system.energy");
  if ( energy === undefined ) return;

  const atual = actor.system.energy ?? {};
  const novoTotal = energy.total ?? atual.total ?? 0;
  const novoGerada = energy.generated ?? atual.generated ?? 0;

  // Quanto cada pool BAIXOU nesta update
  const baixaTotal = Math.max(0, (atual.total ?? 0) - novoTotal);
  const baixaGerada = Math.max(0, (atual.generated ?? 0) - novoGerada);
  // Ganho de gerada na mesma update = transferência interna, não custo
  const ganhoGerada = Math.max(0, novoGerada - (atual.generated ?? 0));

  const custo = Math.max(0, baixaTotal - ganhoGerada) + baixaGerada;
  if ( custo <= 0 ) return;

  const hpAtual = actor.system.attributes?.hp?.value ?? 0;
  foundry.utils.setProperty(changes, "system.attributes.hp.value", Math.max(0, hpAtual - custo));
});
