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

    rows.forEach(row => {
      // Evitar duplicação
      if ( row.querySelector(".jj-pa-cost-field") ) return;

      const activityId = row.dataset.activityId;
      if ( !activityId ) return;

      const activity = item.system.activities?.get(activityId);
      if ( !activity ) return;

      const { amount, pool } = _getExistingPaCost(activity);

      // Criar campo inline
      const wrapper = document.createElement("div");
      wrapper.className = "jj-pa-cost-field";
      wrapper.innerHTML = `
        <input type="number" class="jj-pa-amount" value="${amount}" placeholder="PA" min="0"
               title="Custo em PA" ${amount ? 'disabled' : ''}>
        <select class="jj-pa-pool" ${amount ? 'disabled' : ''}>
          <option value="generated" ${pool === "generated" ? "selected" : ""}>⚡ Gerada</option>
          <option value="total"     ${pool === "total"     ? "selected" : ""}>🔮 Total</option>
        </select>
        ${amount ? `<button class="jj-pa-clear" title="Remover custo">✕</button>` : ""}
      `;

      const input    = wrapper.querySelector(".jj-pa-amount");
      const select   = wrapper.querySelector(".jj-pa-pool");
      const clearBtn = wrapper.querySelector(".jj-pa-clear");

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

      input.addEventListener("keydown", e => { if ( e.key === "Enter" ) { e.preventDefault(); _saveCost(); } });
      input.addEventListener("blur", _saveCost);

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

      // Inserir dentro de .item-row, antes dos controles
      const itemRow = row.querySelector(".item-row") ?? row;
      const controls = itemRow.querySelector(".item-controls, .activity-controls, .controls");
      if ( controls ) itemRow.insertBefore(wrapper, controls);
      else itemRow.appendChild(wrapper);
    });
  }

  // Mapa de observers por form ID para evitar duplicação
  const _formObservers = new Map();

  // Configura observer dentro de um form de item sheet
  function _watchForm(form, item) {
    if ( _formObservers.has(form.id) ) return;

    // Injetar imediatamente
    _injectCostFields(form, item);

    // Observer dentro do form — re-injeta quando a lista mudar
    const obs = new MutationObserver(() => {
      _injectCostFields(form, item);
    });
    obs.observe(form, { childList: true, subtree: true });
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
      .jj-pa-cost-field {
        display: flex;
        align-items: center;
        gap: 3px;
        flex: none;
      }
      .jj-pa-amount {
        width: 44px;
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
      .jj-pa-pool {
        height: 22px;
        font-size: 10px;
        padding: 0 2px;
        background: #0e0e18;
        border: 1px solid #2a2a40;
        border-radius: 3px;
        color: #a0a0c0;
        cursor: pointer;
      }
      .jj-pa-pool:disabled { opacity: 0.7; cursor: default; }
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
