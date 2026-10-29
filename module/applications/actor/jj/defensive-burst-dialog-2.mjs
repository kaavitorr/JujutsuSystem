import { mountLegacy2DocumentTheme } from "../../shared/legacy2-document-theme.mjs";

const shield = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12h8"/></svg>`;
const minus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 12h14"/></svg>`;
const plus = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;

/** Native dialog content: choice and reduction persist in the existing handler. */
export function defensiveBurstContent({ limiteDados, nivel, maxDados, physicalImpulse = false, available = 0 }) {
  const unit = physicalImpulse ? "PE" : "d4", dicePerPoint = physicalImpulse ? 2 : 1;
  return `<section class="jj2-defense-panel" data-defense-dice-per-point="${dicePerPoint}" data-defense-unit="${unit}">
    <header class="jj2-defense-heading"><span>${shield}</span><div><small>Proteção contra o próximo dano</small><h2>${physicalImpulse ? "Impulso Físico · Defesa" : "Explosão Defensiva"}</h2></div></header>
    <div class="jj2-defense-resources"><div><span>${physicalImpulse ? "Estamina disponível" : "Redução máxima"}</span><strong>${physicalImpulse ? available : maxDados}<small>${unit}</small></strong></div><div><span>Limite do nível ${nivel}</span><strong>${limiteDados}<small>${unit}</small></strong></div></div>
    <p class="jj2-defense-intro">${physicalImpulse ? "Cada PE gasto concede <strong>2d4 de redução</strong> no próximo dano." : `Cada <strong>1 PA de energia refinada</strong> concede <strong>1d4 de redução</strong> no próximo dano. Disponível: <strong>${available} PA</strong>.`}</p>
    <div class="jj2-defense-choice"><label for="jj2-expdef-input">${physicalImpulse ? "PE a gastar" : "Dados de redução"}</label>
      <div class="jj2-counter jj2-defense-counter">
        <button type="button" data-action="jj2StepCounter" data-step="-1" aria-label="Diminuir ${physicalImpulse ? "PE" : "dados de redução"}">${minus}</button>
        <div><input type="number" id="jj2-expdef-input" value="1" min="1" max="${maxDados}" step="1" inputmode="numeric"><span>${unit}</span></div>
        <button type="button" data-action="jj2StepCounter" data-step="1" aria-label="Aumentar ${physicalImpulse ? "PE" : "dados de redução"}">${plus}</button>
      </div><small>Até ${maxDados} ${physicalImpulse ? "PE" : "dados"} neste nível</small>
    </div>
    <div class="jj2-defense-summary" aria-live="polite"><span>Redução <strong data-defense-formula>${dicePerPoint}d4</strong></span><span data-defense-cost>${physicalImpulse ? "1 PE" : "1 PA · Energia refinada"}</span></div>
  </section>`;
}

/** Update the local preview; actor resources are modified only after confirmation. */
export function mountDefensiveBurstDialog(dialog) {
  const element = dialog.element;
  mountLegacy2DocumentTheme(element, "defense");
  const input = element?.querySelector("#jj2-expdef-input");
  if (!input) return;
  const panel = element.querySelector(".jj2-defense-panel");
  const preview = () => {
    const n = Number(input.value);
    const dados = Number.isFinite(n) ? Math.max(1, Math.min(Math.floor(n), Number(input.max))) : 1;
    const formula = element.querySelector("[data-defense-formula]");
    if ( formula ) formula.textContent = `${dados * Number(panel?.dataset.defenseDicePerPoint ?? 1)}d4`;
    element.querySelector("[data-defense-cost]").textContent = panel?.dataset.defenseUnit === "PE" ? `${dados} PE` : `${dados} PA · Energia refinada`;
  };
  input.addEventListener("input", preview);
  input.addEventListener("change", preview);
  preview();
}
