/**
 * jj/energy-consumption.mjs
 * Registra os caminhos de consumo de PA e injeta labels nas atividades.
 */

(function _registerCursedEnergyConsumption() {
  const PATH_GERADA = "energy.generated";
  const PATH_TOTAL  = "energy.total";
  function _addPaths() {
    const res = CONFIG.DND5E?.consumableResources;
    if ( !Array.isArray(res) ) return;
    for ( const path of [PATH_GERADA, PATH_TOTAL] ) {
      if ( !res.includes(path) ) res.push(path);
    }
    const attrType = CONFIG.DND5E?.activityConsumptionTypes?.attribute;
    if ( attrType ) {
      attrType.scalingModes ??= [];
      if ( !attrType.scalingModes.some(m => m.value === "pa") ) {
        attrType.scalingModes.push({ value: "pa", label: "PA Extra (+1 por step)" });
      }
    }
  }
  Hooks.on("setup", _addPaths);
  Hooks.once("ready", _addPaths);
  function _injectLabels(app, html) {
    const name = app.constructor?.name ?? "";
    if ( !name.toLowerCase().includes("activity") ) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if ( !root ) return;
    root.querySelectorAll("option").forEach(opt => {
      if ( opt.value === PATH_GERADA ) opt.textContent = "⚡ Energia Gerada (PA)";
      if ( opt.value === PATH_TOTAL  ) opt.textContent = "🔮 Energia Total (PA)";
    });
  }
  Hooks.on("renderApplication",   _injectLabels);
  Hooks.on("renderDocumentSheet", _injectLabels);
  Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) => {
    const actor = activity.item?.actor ?? activity.actor;
    if ( !actor ) return;
    // Não bloqueamos mais aqui — o chat card customizado já trata isso
  });
})();

/* ============================================================

/* ============================================================
 * CAMPO DE CUSTO DE PA NA ABA DE ATIVIDADES
 * Injeta campo de custo (PA Gerada/Total) na listagem de
 * atividades do item sheet. Ao salvar, configura o Consumption
 * da atividade automaticamente — apenas se vazio.
 * ============================================================ */

(function _registerActivityCostField() {

  // Lê o consumption atual de PA de uma atividade
  function _getExistingPaCost(activity) {
    const targets = activity.consumption?.targets ?? [];
    const paTarget = targets.find(t =>
      t.type === "attribute" &&
      (t.target === "energy.generated" || t.target === "energy.total")
    );
    if ( !paTarget ) return { amount: "", pool: "generated" };
    return {
      amount: paTarget.value ?? "",
      pool: paTarget.target === "energy.total" ? "total" : "generated"
    };
  }

  // Injeta os campos de custo em todas as atividades visíveis
  function _injectCostFields(html, item) {
    // Seletor correto: li.item.activity[data-activity-id]
    const rows = html.querySelectorAll("li.activity[data-activity-id], li.item.activity[data-activity-id]");
    if ( !rows.length ) return;

    // Mesmo ator para todas as linhas deste item — calcular uma vez só, não por linha.
    const hasActor = !!item.actor;
    const actorRes = item.actor?.getFlag?.("jujutsu-system", "customResources") ?? [];
    const noResOptionLabel = hasActor ? "— sem recursos —" : "— item sem personagem —";

    rows.forEach(row => {
      // Evitar duplicação
      if ( row.querySelector(".jj-pa-cost-field") ) return;

      const activityId = row.dataset.activityId;
      if ( !activityId ) return;

      const activity = item.system.activities?.get(activityId);
      if ( !activity ) return;

      const { amount, pool } = _getExistingPaCost(activity);

      // Recurso customizado já configurado (flag na activity)
      const rc    = activity.flags?.["jujutsu-system"]?.resourceCost ?? {};
      const rcId  = rc.id ?? "";
      const rcAmt = Number(rc.amount) > 0 ? rc.amount : "";
      const poolAbbr = pool === "total" ? "T" : "G";
      const resOptions = actorRes.length
        ? `<option value="">—</option>` + actorRes.map(r =>
            `<option value="${foundry.utils.escapeHTML(String(r.id))}" ${r.id === rcId ? "selected" : ""}>${foundry.utils.escapeHTML(String(r.name ?? ""))}</option>`
          ).join("")
        : `<option value="">${noResOptionLabel}</option>`;

      // Campo de Custo (PA) — reserva mostra só G/T fechada; nome inteiro no dropdown
      const wrapper = document.createElement("div");
      wrapper.className = "jj-pa-cost-field";
      wrapper.innerHTML = `
        <input type="number" class="jj-pa-amount" value="${amount}" placeholder="PA" min="0"
               title="Custo em PA" ${amount ? 'disabled' : ''}>
        <span class="jj-pool-wrap">
          <select class="jj-pa-pool" title="Reserva de PA" ${amount ? 'disabled' : ''}>
            <option value="generated" ${pool === "generated" ? "selected" : ""}>⚡ Gerada</option>
            <option value="total"     ${pool === "total"     ? "selected" : ""}>🔮 Total</option>
          </select>
          <span class="jj-pool-abbr">${poolAbbr}</span>
        </span>
        ${amount ? `<button class="jj-pa-clear" title="Remover custo">✕</button>` : ""}
      `;

      // Campo de Recurso customizado (consumido ao usar a atividade)
      const resWrapper = document.createElement("div");
      resWrapper.className = "jj-resource-cost-field";
      resWrapper.innerHTML = `
        <select class="jj-res-select" title="Recurso consumido ao usar" ${actorRes.length ? "" : "disabled"}>
          ${resOptions}
        </select>
        <input type="number" class="jj-res-amount" value="${rcAmt}" placeholder="Qtd" min="0"
               title="Quantidade consumida" ${actorRes.length ? "" : "disabled"}>
      `;

      const input      = wrapper.querySelector(".jj-pa-amount");
      const select     = wrapper.querySelector(".jj-pa-pool");
      const poolAbbrEl = wrapper.querySelector(".jj-pool-abbr");
      const clearBtn   = wrapper.querySelector(".jj-pa-clear");
      const resSelect  = resWrapper.querySelector(".jj-res-select");
      const resAmount  = resWrapper.querySelector(".jj-res-amount");

      // Atualiza a abreviação G/T conforme a reserva escolhida
      select.addEventListener("change", () => {
        if ( poolAbbrEl ) poolAbbrEl.textContent = select.value === "total" ? "T" : "G";
      });

      async function _saveCost() {
        const val = parseInt(input.value);
        if ( !val || val <= 0 ) return;
        const target = select.value === "total" ? "energy.total" : "energy.generated";
        const existing = activity.consumption?.targets ?? [];
        const hasPa = existing.some(t =>
          t.type === "attribute" &&
          (t.target === "energy.generated" || t.target === "energy.total")
        );
        if ( hasPa ) return;
        await activity.update({
          "consumption.targets": [
            ...existing,
            { type: "attribute", target, value: val, scaling: { mode: "", formula: "" } }
          ]
        });
        ui.notifications.info(`Custo de ${val} PA (${select.value === "total" ? "Total" : "Gerada"}) salvo em "${activity.name}".`);
      }

      // Upsert/remoção do Recurso customizado consumido pela atividade (flag na activity)
      async function _saveResource() {
        const id  = resSelect.value;
        const amt = parseInt(resAmount.value) || 0;
        if ( !id || amt <= 0 ) {
          if ( activity.flags?.["jujutsu-system"]?.resourceCost ) {
            await activity.update({ "flags.jujutsu-system.-=resourceCost": null });
          }
          return;
        }
        const res = (item.actor?.getFlag?.("jujutsu-system", "customResources") ?? []).find(r => r.id === id);
        await activity.update({ "flags.jujutsu-system.resourceCost": { id, name: res?.name ?? "", amount: amt } });
        ui.notifications.info(`Recurso "${res?.name ?? id}" (${amt}) configurado em "${activity.name}".`);
      }

      input.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveCost(); } });
      input.addEventListener("blur", _saveCost);
      resSelect.addEventListener("change", _saveResource);
      resAmount.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveResource(); } });
      resAmount.addEventListener("blur", _saveResource);

      if ( clearBtn ) {
        clearBtn.addEventListener("click", async e => {
          e.stopPropagation();
          const existing = activity.consumption?.targets ?? [];
          const filtered = existing.filter(t =>
            !(t.type === "attribute" &&
              (t.target === "energy.generated" || t.target === "energy.total"))
          );
          await activity.update({ "consumption.targets": filtered });
          ui.notifications.info(`Custo de PA removido de "${activity.name}".`);
        });
      }

      // Inserir dentro de .item-row, antes dos controles (Custo + Recursos)
      const itemRow = row.querySelector(".item-row") ?? row;
      const controls = itemRow.querySelector(".item-controls, .activity-controls, .controls");
      if ( controls ) { itemRow.insertBefore(wrapper, controls); itemRow.insertBefore(resWrapper, controls); }
      else { itemRow.appendChild(wrapper); itemRow.appendChild(resWrapper); }
    });
  }

  // Mapa de observers por form ID para evitar duplicação
  const _formObservers = new Map();

  // Configura observer dentro de um form de item sheet
  function _watchForm(form, item) {
    if ( _formObservers.has(form.id) ) return;

    // _injectCostFields insere nós no próprio form observado — sem desconectar
    // durante a injeção, essas inserções disparam o observer de novo, causando
    // um passe redundante extra a cada mudança real.
    let obs;
    function runInject() {
      obs.disconnect();
      _injectCostFields(form, item);
      obs.observe(form, { childList: true, subtree: true });
    }

    obs = new MutationObserver(() => runInject());

    // Injetar imediatamente
    runInject();
    _formObservers.set(form.id, obs);

    // Limpar quando o form for removido do DOM
    const cleanup = new MutationObserver((muts) => {
      for ( const m of muts ) {
        for ( const n of m.removedNodes ) {
          if ( n === form || n.contains?.(form) ) {
            obs.disconnect();
            cleanup.disconnect();
            _formObservers.delete(form.id);
          }
        }
      }
    });
    cleanup.observe(document.body, { childList: true, subtree: true });
  }

  // Observer no body para detectar novos item sheets
  Hooks.once("ready", () => {
    const _bodyObserver = new MutationObserver((mutations) => {
      for ( const mutation of mutations ) {
        for ( const node of mutation.addedNodes ) {
          if ( !(node instanceof HTMLElement) ) continue;
          let form = node.id?.startsWith("ItemSheet5e") ? node
            : node.querySelector?.('form[id^="ItemSheet5e"]');
          if ( !form ) continue;
          const app = foundry.applications.instances.get(form.id);
          if ( !app ) return;
          const item = app.document;
          if ( !item?.system?.activities ) continue;
          setTimeout(() => _watchForm(form, item), 100);
        }
      }
    });
    _bodyObserver.observe(document.body, { childList: true, subtree: true });
  });

  // Fallback: clique na aba de atividades
  document.addEventListener("click", (e) => {
    const btn = e.target?.closest("[data-tab='activities']");
    if ( !btn ) return;
    const form = btn.closest('form[id^="ItemSheet5e"]');
    if ( !form ) return;
    const app = foundry.applications.instances.get(form.id);
    if ( !app ) return;
    const item = app.document;
    if ( !item?.system?.activities ) return;
    setTimeout(() => _watchForm(form, item), 150);
  }, true);

  // CSS inline (via <style> injetado no head)
  if ( !document.querySelector("#jj-pa-cost-style") ) {
    const style = document.createElement("style");
    style.id = "jj-pa-cost-style";
    style.textContent = `
      /* Cabeçalhos "Cargas" (usos limitados nativos) / "Custo" / "Recursos" —
         3 colunas de cabeçalho pras 3 colunas de conteúdo que a linha pode ter
         (usos limitados nativos do dnd5e, quando configurados, continuam
         renderizando ao lado do Custo/Recursos — sem cabeçalho próprio ficariam
         desalinhados). */
      .activities-element .items-header .jj-native-uses-header { width: 70px !important; flex: 0 0 70px !important; justify-content: center; }
      .activities-element .items-header .jj-cost-header { width: 96px !important; flex: 0 0 96px !important; justify-content: center; }
      .activities-element .items-header .jj-res-header  { width: 132px !important; flex: 0 0 132px !important; justify-content: center; text-align: center; }
      /* Esconde a coluna de cargas vazia nas linhas (some quando não há usos limitados) */
      .activities-element .item-detail.item-uses.empty { display: none !important; }

      .jj-pa-cost-field {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 96px;
        flex: none;
        box-sizing: border-box;
      }
      .jj-resource-cost-field {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 3px;
        width: 132px;
        flex: none;
        box-sizing: border-box;
      }
      .jj-pa-amount {
        width: 38px;
        height: 22px;
        padding: 0 4px;
        font-size: 11px;
        text-align: center;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c0a8ff;
      }
      .jj-pa-amount:disabled {
        color: #6060a0;
        opacity: 0.8;
      }
      /* Reserva de PA — fechada mostra só G/T (overlay); nome inteiro só no dropdown */
      .jj-pool-wrap { position: relative; display: inline-flex; align-items: center; }
      .jj-pa-pool {
        appearance: none;
        -webkit-appearance: none;
        height: 22px;
        width: 30px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: transparent;
        cursor: pointer;
      }
      .jj-pa-pool option { color: #cfc6ff; background: #0e0e18; }
      .jj-pa-pool:disabled { opacity: 0.7; cursor: default; }
      .jj-pool-abbr {
        position: absolute;
        left: 5px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        font-size: 11px;
        font-weight: 700;
        color: #b9a6ff;
      }
      .jj-pool-abbr::after { content: "⌄"; margin-left: 1px; font-size: 9px; color: #6a6a90; }

      /* Recurso customizado consumido ao usar a atividade */
      .jj-res-select {
        height: 22px;
        max-width: 86px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c8b0ff;
        cursor: pointer;
      }
      .jj-res-select:disabled { opacity: 0.6; cursor: default; }
      .jj-res-amount {
        width: 34px;
        height: 22px;
        padding: 0 3px;
        font-size: 11px;
        text-align: center;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #c8b0ff;
      }
      .jj-res-amount:disabled { opacity: 0.6; }
      .jj-pa-clear {
        width: 18px;
        height: 18px;
        font-size: 9px;
        background: #1a0808;
        border: 1px solid #5a1a1a;
        border-radius: 3px;
        color: #c05050;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      .jj-pa-clear:hover { background: #2a0808; color: #ff6060; }
    `;
    document.head.appendChild(style);
  }

})();
