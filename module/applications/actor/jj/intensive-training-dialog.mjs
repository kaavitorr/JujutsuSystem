/** Presentation for the native intensive-training dialog; actor counters stay in the handler. */
export const refinementTrainingLimit = isV2 => isV2 ? 10 : 20;
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const energy = svg('<path d="m13 2-9 12h7l-1 8 10-12h-7z"/>');
const check = svg('<path d="m5 12 4 4 10-10"/>');
const arrow = svg('<path d="M4 12h16m-6-6 6 6-6 6"/>');
const clock = svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');

export function intensiveTrainingDialogContent({ isV2, currentMaxPA, trainingPAGain, maxEnergyTrainings,
  generatedTrainings, cursePoints, canTrainCursePoints }) {
  const maximum = number(currentMaxPA), gain = number(trainingPAGain), count = number(generatedTrainings);
  const limit = refinementTrainingLimit(isV2), atLimit = count >= limit;
  const refinementLabel = isV2 ? "Treinar Refinamento" : "Treinar PA Gerada";
  const refinementHint = isV2 ? "Refinamento +1 por turno" : "PA Gerada +1 por turno";
  return `<div class="jj2-training-content">
    <header class="jj2-training-masthead"><span class="jj2-training-emblem">${energy}</span><div><h2>Treinamento Intenso</h2><p>Evolução na prática</p></div><span class="jj2-training-duration">10 dias</span></header>
    <p class="jj2-training-intro">Escolha o benefício do seu treinamento.</p>
    <div class="jj2-training-choices">
      <label class="jj2-training-choice">
        <input type="radio" name="jj-training-choice" value="maxEnergy">
        <span class="jj2-training-radio">${check}</span>
        <div class="jj2-training-choice-info"><strong>Treinar Energia Máxima</strong><span>Aumente sua reserva de energia.</span><div class="jj2-training-stats"><span>Atual <b>${maximum}</b></span>${arrow}<span>Após <b>${maximum + gain}</b></span><small>Treino ${number(maxEnergyTrainings) + 1}</small></div></div>
        <span class="jj2-training-gain">+${gain}</span>
      </label>
      <label class="jj2-training-choice jj2-training-refinement ${atLimit ? "at-limit" : ""}">
        <input type="radio" name="jj-training-choice" value="generatedEnergy" ${atLimit ? "disabled" : ""}>
        <span class="jj2-training-radio">${check}</span>
        <div class="jj2-training-choice-info"><strong>${refinementLabel}</strong><span>${refinementHint}</span><div class="jj2-training-stats"><span>Treinos <b>${count} / ${limit}</b></span>${atLimit ? '<small class="jj2-training-limit">Limite atingido</small>' : `<span>Bônus <b>+${count}</b> ${arrow} <b>+${count + 1}</b></span>`}</div></div>
        <span class="jj2-training-gain">+1</span>
      </label>
      ${canTrainCursePoints ? `<label class="jj2-training-choice"><input type="radio" name="jj-training-choice" value="cursePoints"><span class="jj2-training-radio">${check}</span><div class="jj2-training-choice-info"><strong>Treinar Pontos de Maldição</strong><span>Atual: ${number(cursePoints)} PM · Após: ${number(cursePoints) + 4} PM</span></div><span class="jj2-training-gain">+4</span></label>` : ""}
    </div>
    <aside class="jj2-training-note">${clock}<span>O treino de <strong>${isV2 ? "Refinamento" : "PA Gerada"}</strong> requer <strong>10 dias de espera</strong> antes de repetir.</span></aside>
  </div>`;
}
