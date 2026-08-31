/**
 * session-log-journal.mjs
 * Cria (ou reaproveita) o Journal "Logs da Sessão" e monta o HTML de cada página.
 */

/**
 * Acha o Journal "Logs da Sessão" pelo nome, ou cria um novo — visível (leitura) a todos
 * os jogadores, editável só pelo GM.
 * @returns {Promise<JournalEntry>}
 */
export async function findOrCreateSessionLogJournal() {
  const existing = game.journal.getName("Logs da Sessão");
  if ( existing ) return existing;
  return JournalEntry.implementation.create({
    name: "Logs da Sessão",
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }
  });
}

/** Tem conteúdo de verdade (ignora HTML vazio tipo "<p></p>" que o ProseMirror deixa). */
function hasRichText(html) {
  return !!html && html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim().length > 0;
}

/** Formata Yen com separador de milhar (pt-BR: "100000" → "100.000"). */
export function formatYen(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("pt-BR");
}

/**
 * Monta o HTML de uma página do log a partir das concessões configuradas na sessão.
 * As notas (por jogador e a narrativa geral) já são HTML do ProseMirror, escritas pelo GM —
 * injetadas cruas de propósito (rich text confiável); só os nomes de ator/item são escapados.
 * @param {object[]} entries        Array de StagedGrant (ver session-log-app.mjs).
 * @param {string} [sessionNotes]   Narrativa geral da sessão (HTML do ProseMirror).
 * @returns {string}
 */
export function buildSessionLogPageHTML(entries, sessionNotes = "") {
  const intro = hasRichText(sessionNotes)
    ? `<h2>Narrativa da Sessão</h2>${sessionNotes}<hr>`
    : "";
  const sections = entries.map(e => {
    const rows = [];
    if ( e.trainingPoints ) rows.push(`<li>PT: +${e.trainingPoints}</li>`);
    if ( e.cursePoints ) rows.push(`<li>Pontos de Maldição: +${e.cursePoints}</li>`);
    if ( e.intensiveTrainingsNote ) rows.push(`<li>Treinamento Intenso: ${e.intensiveTrainingsNote}</li>`);
    if ( e.currency ) rows.push(`<li>Yen: +${formatYen(e.currency)}</li>`);
    if ( e.items.length ) {
      const names = e.items.map(i => foundry.utils.escapeHTML(i.name)).join(", ");
      rows.push(`<li>Itens: ${names}</li>`);
    }
    const notes = hasRichText(e.notes) ? `<div class="session-log-note">${e.notes}</div>` : "";
    return `<h3>${foundry.utils.escapeHTML(e.actorName)}</h3><ul>${rows.join("")}</ul>${notes}`;
  }).join("<hr>");
  // Só cai no aviso de "vazio" quando não há nem narrativa nem seções de jogador.
  const body = sections || (intro ? "" : "<p><em>Nenhum jogador configurado.</em></p>");
  return `<div class="session-log-page">${intro}${body}</div>`;
}
