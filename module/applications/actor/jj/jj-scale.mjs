/**
 * jj/jj-scale.mjs
 * Escala de Energia customizada — substitui a escala nativa por spell level.
 *
 * Cada atividade (dano/cura/salvaguarda/redução) tem `system.jjScale`:
 *   - formula : incremento por nível (rolagem "2d8" ou valor fixo "5", inclusive "2d8+5")
 *   - cost    : PA por incremento
 *   - maxPA   : máximo de PA que pode ser gasto (0 = ilimitado)
 *
 * Ao rolar o valor, um dropdown lista cada nível (PA gasto → total resultante).
 * O PA sai do pool configurado no consumo da atividade (gerada ou total).
 * NÃO se aplica a jogadas de acerto (ataque mantém o modal de Explosão Ofensiva).
 */

/**
 * Multiplica uma fórmula simples por `k`, expandindo a contagem de dados.
 * Ex.: scaleFormula("2d8", 8) → "16d8"; scaleFormula("2d8+5", 3) → "6d8 + 15".
 * Termos não reconhecidos (ex.: @mod) viram `k * (termo)`.
 * @param {string} formula
 * @param {number} k
 * @returns {string}  Fórmula escalada, ou "" se k<=0/sem fórmula.
 */
export function scaleFormula(formula, k) {
  k = Math.floor(Number(k) || 0);
  if ( !formula || k <= 0 ) return "";
  const termos = String(formula).split("+").map(t => t.trim()).filter(Boolean);
  const out = termos.map(t => {
    const dado = t.match(/^(\d*)d(\d+)$/i);
    if ( dado ) {
      const n = (dado[1] ? parseInt(dado[1]) : 1) * k;
      return `${n}d${dado[2]}`;
    }
    if ( /^\d+(\.\d+)?$/.test(t) ) return String(Number(t) * k);
    return `${k} * (${t})`;
  });
  return out.join(" + ");
}

/**
 * Determina o pool de PA usado pela atividade (a partir do consumo configurado).
 * @param {Activity} activity
 * @returns {"generated"|"total"}
 */
export function getScalePool(activity) {
  for ( const t of (activity?.consumption?.targets ?? []) ) {
    if ( t.target === "energy.total" ) return "total";
    if ( t.target === "energy.generated" ) return "generated";
  }
  return "generated";
}

/**
 * Custo de ativação (PA do consumo configurado) que produz o valor BASE.
 * É o ponto de partida do dropdown: pagar a ativação = rolar a base.
 * @param {Activity} activity
 * @returns {number}
 */
export function getActivationCost(activity) {
  const pool = getScalePool(activity);
  const target = pool === "total" ? "energy.total" : "energy.generated";
  let cost = 0;
  for ( const t of (activity?.consumption?.targets ?? []) ) {
    if ( t.target === target ) cost += Number(t.value ?? 0) || 0;
  }
  return cost;
}

/**
 * Monta os dados/opções do dropdown de escala SEM exibir diálogo, para embutir
 * em outro diálogo (ex.: o da Redução de Dano).
 * @param {object} opts
 * @param {Actor5e}  opts.actor
 * @param {Activity} opts.activity
 * @param {string}   [opts.baseLabel]  Texto do valor base (ex.: "10d8") p/ mostrar o total.
 * @returns {{available:boolean, optionsHtml?:string, pool?:string, poolLabel?:string,
 *            cost?:number, formula?:string, disponivel?:number, maxIncrementos?:number, maxPA?:number}}
 */
export function getScaleOptions({ actor, activity, baseLabel = "", activationPaid = true }) {
  const scale = activity?.jjScale;
  const formula = (scale?.formula ?? "").trim();
  if ( !formula ) return { available: false };

  const cost  = Math.max(1, scale.cost ?? 1);
  const pool  = getScalePool(activity);
  const poolLabel = pool === "total" ? "PA Total" : "PA Gerada";
  const disponivel = actor.system?.energy?.[pool] ?? 0;
  const activationCost = getActivationCost(activity);
  // PA realmente disponível para INCREMENTOS (se a ativação ainda não foi paga,
  // reserva-a do total). Cada opção do dropdown soma a ativação no rótulo.
  const availableForInc = activationPaid ? disponivel : Math.max(0, disponivel - activationCost);
  // maxPA é o TOTAL gasto (ativação + incrementos) → os incrementos só podem usar (maxPA - ativação)
  const capByMax = (scale.maxPA && scale.maxPA > 0) ? Math.max(0, scale.maxPA - activationCost) : Infinity;
  const limiteInc = Math.min(capByMax, availableForInc);
  const maxIncrementos = Math.max(0, Math.floor(limiteInc / cost));

  const opts = [];
  for ( let k = 0; k <= maxIncrementos; k++ ) {
    const pa = activationCost + k * cost; // PA total = ativação + incrementos
    const bonus = scaleFormula(formula, k);
    const total = k === 0
      ? (baseLabel || "base")
      : (baseLabel ? `${baseLabel} + ${bonus}` : bonus);
    opts.push(`<option value="${k}">${pa} ${poolLabel} → ${total}</option>`);
  }

  return {
    available: true, optionsHtml: opts.join(""),
    pool, poolLabel, cost, formula, disponivel, activationCost, maxIncrementos, maxPA: scale.maxPA ?? 0
  };
}

/**
 * Aplica a escolha de escala: reclampa contra o PA atual, deduz o PA e devolve
 * o bônus a somar. Não exibe diálogo.
 * @param {object} opts
 * @param {Actor5e}  opts.actor
 * @param {Activity} opts.activity
 * @param {number}   opts.incrementos
 * @returns {Promise<{paGasto:number, bonusFormula:string, incrementos:number}>}
 */
export async function applyScaleChoice({ actor, activity, incrementos, activationPaid = true }) {
  const scale = activity?.jjScale;
  const formula = (scale?.formula ?? "").trim();
  const cost = Math.max(1, scale?.cost ?? 1);
  const realActivation = getActivationCost(activity);          // p/ o teto total maxPA
  const deductActivation = activationPaid ? 0 : realActivation; // p/ a dedução de fato
  let incr = Math.max(0, Math.floor(Number(incrementos) || 0));

  const pool = getScalePool(activity);
  const poolPath = pool === "total" ? "system.energy.total" : "system.energy.generated";
  const atual = actor.system?.energy?.[pool] ?? 0;

  // Não dá nem para pagar a ativação pendente → nada acontece
  if ( deductActivation > atual ) {
    return { paGasto: 0, bonusFormula: "", incrementos: 0, activationOk: false };
  }

  // Reclampa os incrementos por: PA restante (após reservar a ativação a deduzir)
  // E pelo teto maxPA, que é o TOTAL (ativação + incrementos) → (maxPA - ativação real).
  const dispInc = atual - deductActivation;
  const capByMax = (scale?.maxPA && scale.maxPA > 0) ? Math.max(0, scale.maxPA - realActivation) : Infinity;
  const capInc = Math.min(capByMax, dispInc);
  if ( formula ) incr = Math.min(incr, Math.floor(capInc / cost));
  else incr = 0;

  const incrPA = incr * cost;
  const paGasto = deductActivation + incrPA;
  if ( paGasto > 0 ) {
    await actor.update({ [poolPath]: atual - paGasto }, { isEnergySystem: true });
  }
  return {
    paGasto, incrementos: incr, activationOk: true,
    bonusFormula: (formula && incr > 0) ? scaleFormula(formula, incr) : ""
  };
}

/**
 * Abre o dropdown de escala e devolve APENAS a escolha (nº de incrementos),
 * SEM deduzir PA. Útil quando há outros diálogos depois (ex.: ataque) e a
 * dedução só deve ocorrer quando tudo for confirmado.
 * @param {object} opts
 * @param {Actor5e}  opts.actor
 * @param {Activity} opts.activity
 * @param {string}   [opts.baseLabel]
 * @returns {Promise<{incrementos:number}|null>}  null = cancelado.
 */
export async function chooseJJScale({ actor, activity, baseLabel = "" }) {
  const data = getScaleOptions({ actor, activity, baseLabel });
  // Sem escala configurada ou sem incrementos possíveis → segue sem diálogo
  if ( !data.available || data.maxIncrementos <= 0 ) return { incrementos: 0 };

  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: "⚡ Escala de Energia" },
    content: `
      <div style="padding:8px 0; font-size:13px; color:#ccc; line-height:1.6;">
        <p style="margin:0 0 8px;">Gastar ${data.poolLabel} para escalar (cada ${data.cost} = +${data.formula})?</p>
        <p style="margin:0 0 6px; font-size:12px; color:#aaa;">
          ${data.poolLabel} disponível: <strong>${data.disponivel}</strong>
          ${data.maxPA > 0 ? `&nbsp;|&nbsp; limite: <strong>${data.maxPA}</strong>` : ""}
        </p>
        <select id="jj-scale-sel" style="width:100%;">${data.optionsHtml}</select>
      </div>`,
    buttons: [
      {
        label: "Confirmar",
        action: "ok",
        default: true,
        callback: (event, button, dialog) => {
          const sel = (dialog.element ?? document).querySelector("#jj-scale-sel");
          return Number(sel?.value ?? 0);
        }
      },
      { label: "Cancelar", action: "cancel", callback: () => null }
    ],
    rejectClose: false,
    close: () => null
  });

  if ( escolha === null || escolha === undefined ) return null; // cancelado
  return { incrementos: Math.max(0, Math.floor(escolha)) };
}

/**
 * Abre o dropdown de escala, deduz o PA e devolve o bônus. Usado por
 * dano/cura/salvaguarda (cada um tem seu próprio botão de rolar).
 * @returns {Promise<{paGasto:number, bonusFormula:string, incrementos:number}|null>}
 *          null = cancelado; bonusFormula "" = nenhum bônus.
 */
export async function promptJJScale({ actor, activity, baseLabel = "" }) {
  const escolha = await chooseJJScale({ actor, activity, baseLabel });
  if ( escolha === null ) return null; // cancelado
  return applyScaleChoice({ actor, activity, incrementos: escolha.incrementos });
}
