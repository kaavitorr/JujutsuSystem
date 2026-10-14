/**
 * jj/fulgor-negro.mjs
 * Fulgor Negro — lógica de ativação, Zona e reset por combate.
 */
import { showBlackFlashPopup } from "./popup.mjs";


/**
 * Verifica se um resultado de d20 ativa o Fulgor Negro.
 * Chamado diretamente pelo _handleAttackRoll do card customizado.
 */
// Map em memória: actorId → true/false (fulgor ativado neste combate)
const fulgorAtivadoCombate = new Map();

/**
 * Se o ator tem o TREINAMENTO de energia amaldiçoada "Fulgor Certeiro"
 * (rank ≥ 1, em system.trainings.fulgorCerteiro). O efeito base já reduz a
 * margem do dado secundário do Fulgor Negro para 11–20.
 * @param {Actor5e} actor
 * @returns {boolean}
 */
export function hasFulgorCerteiro(actor) {
  return (Number(actor?.system?.trainings?.fulgorCerteiro?.rank) || 0) > 0;
}

/**
 * Limiar do dado SECUNDÁRIO do Fulgor Negro (resultado ≥ X ativa).
 * Padrão 15 (margem 15–20). Com o treinamento "Fulgor Certeiro", a margem cai
 * para 11–20 (limiar ≤ 11). Um valor manual mais generoso é respeitado.
 * @param {Actor5e} actor
 * @returns {number}
 */
export function getFulgorSecundaria(actor) {
  const certeiro = hasFulgorCerteiro(actor);
  const flag = Number(actor?.getFlag?.("jujutsu-system", "fulgorSecundaria"));
  let v = Number.isFinite(flag) ? flag : (certeiro ? 11 : 15);
  if ( certeiro ) v = Math.min(v, 11); // Fulgor Certeiro garante no mínimo 11–20
  return v;
}

export async function checkFulgorNegro(actor, d20Result) {
  if ( !actor || !d20Result ) return false;
  if ( !actor.system.manipulation?.abilities?.fulgorNegro?.unlocked ) return false;

  const primaria   = Number(actor.getFlag("jujutsu-system", "fulgorPrimaria")  ?? 20);
  const secundaria = getFulgorSecundaria(actor);
  const jaAtivou   = fulgorAtivadoCombate.get(actor.id) ?? false;

  // Verificar se possui a subclasse Mestre do Fulgor
  const mestredoFulgor = actor.itemTypes.subclass?.some(s =>
    (s.identifier ?? s.system?.identifier) === "mestre-do-fulgor"
  ) ?? false;

  // Já ativou o primeiro Fulgor nesse combate: >= primária ativa direto
  if ( jaAtivou ) {
    if ( d20Result >= primaria ) {
      showBlackFlashPopup();
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<strong>⚡ FULGOR NEGRO!</strong> ${actor.name} ativou o Fulgor Negro! (${d20Result} ≥ ${primaria})`
      });
      Hooks.callAll("jujutsu.fulgorNegro", actor);
      return true;
    }
    return false;
  }

  // Primeiro Fulgor do combate: precisa >= primária → rola secundário (a menos que seja Mestre do Fulgor)
  if ( d20Result < primaria ) return false;

  // Mestre do Fulgor: ativa direto sem secundário
  if ( mestredoFulgor ) {
    fulgorAtivadoCombate.set(actor.id, true);
    showBlackFlashPopup();
    await actor.setFlag("jujutsu-system", "fulgorZona", true);
    await applyFulgorZonaEffect(actor, true);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<strong>⚡ FULGOR NEGRO!</strong> ${actor.name} ativou o Fulgor Negro! (${d20Result} ≥ ${primaria})<br><em>Mestre do Fulgor — sem dado secundário. A partir de agora, todo resultado ≥ ${primaria} ativa o Fulgor.</em>`
    });
    Hooks.callAll("jujutsu.fulgorNegro", actor);
    return true;
  }

  const rollSecundario = await new Roll("1d20").evaluate();
  const resultSecundario = rollSecundario.dice[0].results[0].result;

  const certeiro = hasFulgorCerteiro(actor);
  const acertou = resultSecundario >= secundaria;
  const certeiroNota = certeiro ? ` <em>(Fulgor Certeiro: ${secundaria}–20)</em>` : "";
  const veredito = acertou
    ? `<strong style="color:#2e8b57;">✓ ${resultSecundario} ≥ ${secundaria} — ATIVOU!</strong>`
    : `<strong style="color:#b22222;">✗ ${resultSecundario} &lt; ${secundaria} — não ativou.</strong>`;

  await rollSecundario.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `🎯 Dado Secundário do Fulgor — precisa <strong>≥ ${secundaria}</strong>${certeiroNota}<br>${veredito}`
  });

  if ( !acertou ) return false;

  // Primeiro Fulgor ativado!
  fulgorAtivadoCombate.set(actor.id, true);
  showBlackFlashPopup();

  // Ativar a Zona automaticamente
  await actor.setFlag("jujutsu-system", "fulgorZona", true);
  await applyFulgorZonaEffect(actor, true);

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<strong>⚡ FULGOR NEGRO!</strong> ${actor.name} ativou o Fulgor Negro! (${d20Result} ≥ ${primaria}, secundário ${resultSecundario} ≥ ${secundaria})<br><em>A partir de agora, todo resultado ≥ ${primaria} ativa o Fulgor até o fim do encontro.</em>`
  });
  Hooks.callAll("jujutsu.fulgorNegro", actor);
  return true;
}

/**
 * Aplica ou remove o Active Effect de +5 em ataques da Zona do Fulgor Negro.
 */
export async function applyFulgorZonaEffect(actor, active) {
  const FLAG_ID = "jj-fulgor-zona";
  const existing = actor.effects.find(e => e.getFlag("jujutsu-system", "fulgorZonaId") === FLAG_ID);
  if ( existing ) await existing.delete();
  if ( !active ) return;

  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: "Fulgor Negro — Zona",
    icon: "icons/magic/lightning/bolt-strike-gold-orange.webp",
    origin: actor.uuid,
    disabled: false,
    changes: [
      { key: "system.bonuses.mwak.attack", mode: 2, value: "5", priority: 20 },
      { key: "system.bonuses.rwak.attack", mode: 2, value: "5", priority: 20 },
      { key: "system.bonuses.msak.attack", mode: 2, value: "5", priority: 20 },
      { key: "system.bonuses.rsak.attack", mode: 2, value: "5", priority: 20 }
    ],
    flags: { "jujutsu-system": { fulgorZonaId: FLAG_ID } }
  }]);
}

/**
 * Configura os listeners da caixa de Fulgor Negro no sidebar.
 */
export function setupFulgorNegro(element, actor) {
  const box = element.querySelector(".jj-fulgor-box");
  if ( !box ) return;

  const inputPrimaria = box.querySelector("[name='flags.jujutsu-system.fulgorPrimaria']");
  if ( inputPrimaria ) {
    inputPrimaria.addEventListener("change", async () => {
      const val = Math.min(20, Math.max(1, parseInt(inputPrimaria.value) || 20));
      inputPrimaria.value = val;
      await actor.setFlag("jujutsu-system", "fulgorPrimaria", val);
    });
  }

  const inputSecundaria = box.querySelector("[name='flags.jujutsu-system.fulgorSecundaria']");
  if ( inputSecundaria ) {
    inputSecundaria.addEventListener("change", async () => {
      const val = Math.min(20, Math.max(1, parseInt(inputSecundaria.value) || 15));
      inputSecundaria.value = val;
      await actor.setFlag("jujutsu-system", "fulgorSecundaria", val);
    });
  }

  const btnZona = box.querySelector("[data-action='jj-fulgor-zona']");
  if ( btnZona ) {
    btnZona.addEventListener("click", async () => {
      const current = actor.getFlag("jujutsu-system", "fulgorZona") ?? false;
      const next = !current;
      await actor.setFlag("jujutsu-system", "fulgorZona", next);
      await applyFulgorZonaEffect(actor, next);
      btnZona.classList.toggle("active", next);
      btnZona.innerHTML = next
        ? `<i class="fas fa-eye" inert></i> <span>Desativar Zona</span>`
        : `<i class="fas fa-eye" inert></i> <span>Ativar Zona</span>`;
    });
  }
}

async function resetFulgorZona(combat) {
  for ( const combatant of combat.combatants ) {
    const actor = combatant.actor;
    if ( !actor ) continue;
    if ( !actor.system.manipulation?.abilities?.fulgorNegro?.unlocked ) continue;
    // Limpar estado em memória
    fulgorAtivadoCombate.delete(actor.id);
    // Desativar a zona também
    const zonaAtiva = actor.getFlag("jujutsu-system", "fulgorZona") ?? false;
    if ( zonaAtiva ) {
      await actor.setFlag("jujutsu-system", "fulgorZona", false);
      await applyFulgorZonaEffect(actor, false);
    }
  }
}

// Resetar no início de um novo combate
Hooks.on("combatStart", async (combat) => {
  await resetFulgorZona(combat);
});

// Resetar ao encerrar o combate
Hooks.on("deleteCombat", async (combat) => {
  await resetFulgorZona(combat);
});

