/**
 * jj/mastery-milestones.mjs
 * Marcos de Nível de Maestria:
 *  - Maestria 3: o modificador principal (atributo de conjuração) é adicionado
 *                ao dano e à cura de TÉCNICAS (itens do tipo "spell").
 *  - Maestria 5: abre um modal (uma única vez) para o jogador colocar +2 em um
 *                atributo à escolha, até o máximo de 30.
 */

const MASTERY3_LEVEL = 3;
const MASTERY5_LEVEL = 5;
const ABILITY_MAX    = 30;
const FLAG_MASTERY5  = "mastery5Granted";

// ══════════════════════════════════════════════════════
//  MAESTRIA 3 — modificador principal em técnicas
// ══════════════════════════════════════════════════════

/**
 * Retorna o bônus de modificador principal a ser somado ao dano/cura de uma
 * técnica quando o ator atingiu Nível de Maestria 3+.
 * Retorna 0 para itens que não são técnicas (spell) ou maestria insuficiente.
 *
 * @param {Actor5e} actor
 * @param {Item5e}  item
 * @returns {number}
 */
export function getMasteryTechniqueBonus(actor, item) {
  if ( item?.type !== "spell" ) return 0;
  if ( (actor?.system?.masteryLevel ?? 0) < MASTERY3_LEVEL ) return 0;
  const ability = actor?.system?.attributes?.spellcasting;
  if ( !ability ) return 0;
  return actor?.system?.abilities?.[ability]?.mod ?? 0;
}

/**
 * Monta o badge HTML do bônus de Maestria 3 para o breakdown do card.
 * @param {number} bonus
 * @returns {string}
 */
export function masteryBonusBadge(bonus) {
  if ( !bonus ) return "";
  const sinal = bonus > 0 ? "+" : "";
  return `<span class="jj-pa-badge" style="color:#c0a0ff;border-color:#6040a0;" title="Maestria 3 — modificador principal">${sinal}${bonus} maestria</span>`;
}

// ══════════════════════════════════════════════════════
//  MAESTRIA 5 — modal de +2 atributo (uma vez)
// ══════════════════════════════════════════════════════

// Evita abrir múltiplos diálogos enquanto um já está pendente para o mesmo ator.
const _pending = new Set();

Hooks.on("updateActor", (actor, changes, options, userId) => {
  // Mostrar apenas no cliente que disparou a mudança (evita modal duplicado em várias telas)
  // e que tem permissão de dono sobre o ator. Funciona tanto para o jogador dono
  // quanto para o GM que estiver fazendo o treino/teste.
  if ( userId !== game.user.id ) return;
  if ( !actor.isOwner ) return;
  if ( actor.type !== "character" ) return;
  // Só dispara quando masteryPoints realmente mudou — evita spam em cada update do ator
  if ( !foundry.utils.hasProperty(changes, "system.masteryPoints") ) return;
  if ( (actor.system?.masteryLevel ?? 0) < MASTERY5_LEVEL ) return;
  if ( actor.getFlag("jujutsu-system", FLAG_MASTERY5) ) return;
  if ( _pending.has(actor.id) ) return;

  _pending.add(actor.id);
  _promptMastery5(actor).finally(() => _pending.delete(actor.id));
});

/**
 * Abre um modal para o jogador escolher um atributo e aumentá-lo, respeitando o
 * limite máximo (30). Reutilizado pela Maestria 5 e pela Expansão de Domínio.
 *
 * @param {Actor5e} actor
 * @param {object}  [opts]
 * @param {number}  [opts.amount=2]   Quantos pontos somar
 * @param {string}  [opts.title]      Título da janela
 * @param {string}  [opts.intro]      HTML de introdução exibido acima do select
 * @param {string}  [opts.flavor]     Prefixo da mensagem de chat de resultado
 * @returns {Promise<"applied"|"cancelled"|"none">}
 */
export async function promptAttributeIncrease(actor, { amount = 2, title = "Evolução de Atributo", intro, flavor } = {}) {
  const abilities = CONFIG.DND5E?.abilities ?? {};
  // Atributos que existem no ator E ainda estão abaixo do máximo
  const available = Object.entries(abilities).filter(([key]) => {
    if ( !actor.system?.abilities?.[key] ) return false;
    return (actor.system.abilities[key]?.value ?? 0) < ABILITY_MAX;
  });

  if ( !available.length ) {
    ui.notifications.info(`Todos os atributos já estão no máximo (${ABILITY_MAX}).`);
    return "none";
  }

  const allAbilityEntries = Object.entries(abilities).filter(([key]) => actor.system?.abilities?.[key]);
  const optionsHtml = allAbilityEntries.map(([key, cfg]) => {
    const current = actor.system.abilities[key]?.value ?? 0;
    const projected = Math.min(ABILITY_MAX, current + amount);
    const atMax = current >= ABILITY_MAX;
    const label = cfg.label ?? key.toUpperCase();
    return `<option value="${key}" ${atMax ? "disabled" : ""}>${label}: ${current} → ${projected}${atMax ? " (máx)" : ""}</option>`;
  }).join("");

  const introHtml = intro ?? `Escolha um atributo para receber <strong style="color:#c0a0ff;">+${amount}</strong> (limite de ${ABILITY_MAX}).`;

  const chosen = await foundry.applications.api.DialogV2.wait({
    window: { title },
    content: `
      <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.5;">
        <p style="margin:0 0 10px;">${introHtml}</p>
        <div style="display:flex; align-items:center; gap:8px;">
          <label style="flex:0 0 auto;">Atributo:</label>
          <select id="jj-attr-increase" style="flex:1 1 auto;">${optionsHtml}</select>
        </div>
      </div>`,
    buttons: [
      {
        label: `Confirmar +${amount}`,
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const sel = (dialog.element ?? document).querySelector("#jj-attr-increase");
          const opt = sel?.options[sel.selectedIndex];
          if ( !sel?.value || opt?.disabled ) return null;
          return sel.value;
        }
      },
      {
        label: "Decidir depois",
        action: "cancel",
        callback: () => null
      }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( !chosen ) return "cancelled";

  const current = actor.system.abilities[chosen]?.value ?? 0;
  const novoValor = Math.min(ABILITY_MAX, current + amount);
  const ganho = novoValor - current;
  const label = abilities[chosen]?.label ?? chosen.toUpperCase();

  await actor.update({ [`system.abilities.${chosen}.value`]: novoValor });

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `${flavor ?? `🌟 <strong>${actor.name}</strong>`} aumentou <strong>${label}</strong> em +${ganho} (agora ${novoValor}).`
  });
  ui.notifications.info(`${label} aumentado para ${novoValor}.`);
  return "applied";
}

/**
 * Abre o modal de melhoria de atributo da Maestria 5 e marca a flag.
 * @param {Actor5e} actor
 */
async function _promptMastery5(actor) {
  const result = await promptAttributeIncrease(actor, {
    amount: 2,
    title: "🌟 Maestria 5 — Evolução de Atributo",
    intro: `Você atingiu o <strong>5º Nível de Maestria</strong>! Escolha um atributo para receber <strong style="color:#c0a0ff;">+2</strong> (limite de ${ABILITY_MAX}).`,
    flavor: `🌟 <strong>${actor.name}</strong> atingiu a <strong>Maestria 5</strong> e`
  });
  // "Decidir depois" não marca a flag — o modal reaparece numa futura mudança de masteryPoints
  if ( result === "cancelled" ) return;
  await actor.setFlag("jujutsu-system", FLAG_MASTERY5, true);
}
