import Ruleset from "./ruleset.mjs";

/**
 * ── INICIATIVA DINÂMICA (2.0, cap. 2.1) ─────────────────────────────────────
 * No início de CADA rodada (incluindo a 1ª) a iniciativa de todos os
 * combatentes é rolada novamente de forma automática — o resultado aparece
 * num único card compacto no chat, ordenado do maior para o menor.
 *
 * Regras especiais: Incapacitado/Morto → 0; Desatento (surpreso) → 1.
 * Rolagem individual: 1d20 [Vantagens] + ((AGI + INT) / 2) — o
 * getInitiativeRoll do ator já aplica a fórmula 2.0.
 *
 * Setting world "iniciativaDinamica" (padrão: ligado).
 * Roda somente no cliente GM — um único cliente rola e posta o card.
 */

/** Linhas do card: [{ nome, total }] ordenado decrescente pelo total. */
export function ordenarIniciativa(linhas) {
  return [...linhas].sort((a, b) => b.total - a.total);
}

const iniciativaIcon = '<svg class="jj2-initiative-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m13 2-9 12h7l-1 8 10-12h-7z"/></svg>';
const combatenteIcon = '<svg class="jj2-initiative-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="7" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3M3 3h4M3 3v4m18-4h-4m4 0v4"/></svg>';

/** Snapshot da ordem da rodada; apenas apresentação, sem novos controles ou rolagens. */
export function cardCompactoHtml(round, linhas) {
  const rodada = Number.isFinite(Number(round)) ? Math.max(1, Math.floor(Number(round))) : 1;
  const itens = ordenarIniciativa(linhas).map((l, i) => {
    const nome = foundry.utils.escapeHTML(String(l.nome ?? "Combatente"));
    const total = Number.isFinite(Number(l.total)) ? Number(l.total) : 0;
    const retrato = l.img ? `<img src="${foundry.utils.escapeHTML(String(l.img))}" alt="" loading="lazy">`
      : `<span class="jj2-initiative-avatar-fallback">${combatenteIcon}</span>`;
    return `<li class="jj2-initiative-row${i === 0 ? " is-leading" : ""}">
      <span class="jj2-initiative-position" aria-label="Posição ${i + 1}">${String(i + 1).padStart(2, "0")}</span>
      <span class="jj2-initiative-portrait">${retrato}</span>
      <span class="jj2-initiative-name" title="${nome}">${nome}</span>
      <strong class="jj2-initiative-score" aria-label="Iniciativa ${total}">${total.toLocaleString("pt-BR")}</strong>
    </li>`;
  }).join("");
  return `
    <section class="jj2-initiative-card" aria-label="Ordem de iniciativa da rodada ${rodada}">
      <header class="jj2-initiative-header">
        <span class="jj2-initiative-emblem">${iniciativaIcon}</span>
        <div class="jj2-initiative-heading"><span class="jj2-initiative-kicker">Ordem de combate</span><strong class="jj2-initiative-title">Iniciativa</strong></div>
        <div class="jj2-initiative-round"><span>Rodada</span><strong>${String(rodada).padStart(2, "0")}</strong></div>
      </header>
      <div class="jj2-initiative-columns" aria-hidden="true"><span>Pos.</span><span>Combatente</span><span>Ini.</span></div>
      <ol class="jj2-initiative-list">${itens}</ol>
      <footer class="jj2-initiative-footer"><span>Iniciativa dinâmica</span><span>${linhas.length} ${linhas.length === 1 ? "combatente" : "combatentes"}</span></footer>
    </section>`;
}

// Foundry can sanitize SVG out of stored HTML. Restore only this card's decorative icons after rendering.
Hooks.on("renderChatMessageHTML", (message, html) => {
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root) return;
  // Upgrade the previous inline-only card when reading chat history, without editing the message.
  if (message?.speaker?.alias === "Iniciativa Dinâmica" && !root.querySelector(".jj2-initiative-card")) {
    for (const oldCard of root.querySelectorAll(".message-content > div")) {
      const header = oldCard.firstElementChild, list = oldCard.querySelector(":scope > ol");
      const round = header?.lastElementChild?.textContent.match(/rodada\s+(\d+)/i)?.[1];
      if (!round || !/INICIATIVA$/i.test(header?.firstElementChild?.textContent.trim() ?? "") || !list) continue;
      const rows = Array.from(list.children).map(row => ({
        nome: row.querySelector("span:nth-child(2)")?.textContent,
        total: Number(row.querySelector("strong")?.textContent)
      }));
      if (!rows.length || rows.some(row => !row.nome || !Number.isFinite(row.total))) continue;
      const template = root.ownerDocument.createElement("template");
      template.innerHTML = cardCompactoHtml(round, rows);
      oldCard.replaceWith(template.content);
    }
  }
  for (const emblem of root.querySelectorAll(".jj2-initiative-card .jj2-initiative-emblem")) {
    if (!emblem.querySelector("svg")) emblem.innerHTML = iniciativaIcon;
  }
  for (const portrait of root.querySelectorAll(".jj2-initiative-card .jj2-initiative-avatar-fallback")) {
    if (!portrait.querySelector("svg")) portrait.innerHTML = combatenteIcon;
  }
});

/**
 * Prepara a próxima ordem sem publicar turnos intermediários no tracker.
 */
export async function prepararIniciativaDaRodada(combat, { round = combat.round ?? 1, encerrarTurno = false } = {}) {
  const linhas = [];
  const updates = [];
  for ( const combatente of combat.combatants ) {
    const actor = combatente.actor;
    if ( !actor ) continue;
    let total;
    const status = actor.statuses;
    // Desatento (2.0): Iniciativa 1 e remove-se no início do próprio turno.
    const desatento = status.has("jj-desatento");
    if ( status.has("dead") || status.has("incapacitated") ) total = 0;
    else if ( desatento || status.has("surprised") ) total = 1;
    else {
      const roll = actor.getInitiativeRoll();
      await roll.evaluate();
      total = roll.total;
    }
    // Descomunal: arma equipada impõe 2 desvantagens à Iniciativa.
    const descomunal = (actor.itemTypes?.weapon ?? []).some(w =>
      w.system?.equipped && (typeof w.system.properties?.has === "function"
        ? w.system.properties.has("des") : !!w.system.properties?.des));
    if ( descomunal ) total -= 4;
    // Reservas de Ação (2.1): +1 de iniciativa por ação guardada no turno
    // anterior — não conta na primeira rodada; Desatento age na iniciativa 1.
    if ( round >= 2 && !(status.has("dead") || status.has("incapacitated") || status.has("surprised") || desatento) ) {
      const saldo = encerrarTurno && combat.started && combat.combatant?.id === combatente.id
        ? actor.system.legacy2?.actions?.value : actor.system.legacy2?.reservas?.value;
      const reservas = Math.max(0, Math.floor(Number(saldo ?? 0)));
      if ( reservas > 0 ) total += reservas;
    }
    updates.push({ _id: combatente.id, initiative: total });
    const img = combatente.img ?? actor.img;
    linhas.push({ nome: combatente.name ?? actor.name, total, ...(img ? { img } : {}) });
  }
  return { linhas, updates };
}

/** Rolagem avulsa mantém o combatente ativo, como as rolagens nativas. */
export async function rolarIniciativaDaRodada(combat) {
  const { linhas, updates } = await prepararIniciativaDaRodada(combat);
  if (updates.length) await combat.updateEmbeddedDocuments("Combatant", updates);
  return linhas;
}

// The updating GM already rolled before the atomic round update. Other clients only render its result.
Hooks.on("updateCombat", async (combat, changed, options, userId) => {
  if (!Ruleset.isV2() || !game.user.isGM || game.user.id !== userId) return;
  const rodada = options?.jj2RoundInitiative;
  if (!rodada?.linhas?.length || changed.round !== rodada.round) return;
  await ChatMessage.create({
    speaker: { alias: "Iniciativa Dinâmica" },
    content: cardCompactoHtml(rodada.round, rodada.linhas)
  });
});
