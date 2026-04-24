/**
 * cursed-energy-consumption.mjs
 * JujutsuLegacy — Branch 5.3.x
 *
 * Carregado diretamente pelo Foundry via system.json → esmodules.
 * NÃO precisa de build / Rollup. NÃO importa nada de outros módulos.
 * Se auto-registra via Hooks.once("init") e Hooks.once("setup").
 *
 * ─── INSTALAÇÃO ──────────────────────────────────────────────────────────────
 *
 *  1. Salve este arquivo em:
 *       Data/systems/jujutsu-system/module/systems/cursed-energy-consumption.mjs
 *
 *  2. Edite system.json — altere o bloco "esmodules":
 *       "esmodules": [
 *         "dnd5e.mjs",
 *         "module/systems/cursed-energy-consumption.mjs"
 *       ],
 *
 *  3. NÃO adicione nenhum import/require no dnd5e.mjs.
 *     (se você já adicionou, remova a linha do import e a chamada de registerCursedEnergyConsumption())
 *
 *  4. Reinicie o Foundry. Sem npm run build necessário.
 *
 * ─── O QUE ESTE ARQUIVO FAZ ──────────────────────────────────────────────────
 *
 *  • Garante que system.energy.generated e system.energy.total
 *    apareçam como opções no dropdown "Attribute" do Consumption
 *
 *  • Substitui os labels técnicos por nomes amigáveis na UI
 *    ("⚡ Energia Gerada (PA)" e "🔮 Energia Total (PA)")
 *
 *  • Valida PA disponível antes do uso e exibe aviso legível
 *    (o dnd5e também valida, mas a mensagem nativa mostra o path técnico)
 *
 * ─── COMO O GM CONFIGURA UMA TÉCNICA ─────────────────────────────────────────
 *
 *  1. Abre a técnica (spell) → aba ACTIVITIES → seleciona a Activity
 *  2. ACTIVATION → CONSUMPTION → clica no "+"
 *  3. TYPE: "Attribute"
 *  4. TARGET: digita ou seleciona:
 *       system.energy.generated   → PA Gerada (pool de combate)
 *       system.energy.total       → PA Total  (pool permanente)
 *  5. AMOUNT: custo em PA (ex: 5)
 *  6. SCALING → AMOUNT → "whole" ou formula: deixar como está
 *     MAX: número máximo de PA extras permitidos (ex: 20)
 *     Cada step do scaling = +1 PA
 */

// ─── PATHS ───────────────────────────────────────────────────────────────────

const PATH_GERADA = "system.energy.generated";
const PATH_TOTAL  = "system.energy.total";

// ─── 1. REGISTRAR OS ATRIBUTOS COMO CONSUMÍVEIS ──────────────────────────────
// CONFIG.DND5E.consumableResources é populado em Hooks.once("setup"),
// então garantimos a adição nos dois momentos.

function _addConsumableAttributes() {
  if ( !CONFIG.DND5E?.consumableResources ) return;
  for ( const path of [PATH_GERADA, PATH_TOTAL] ) {
    if ( !CONFIG.DND5E.consumableResources.includes(path) ) {
      CONFIG.DND5E.consumableResources.push(path);
    }
  }
}

Hooks.once("init",  _addConsumableAttributes);
Hooks.once("setup", _addConsumableAttributes);

// ─── 2. LABELS AMIGÁVEIS NA FICHA DE ATIVIDADE ───────────────────────────────

function _injectLabels(app, html) {
  const name = app.constructor?.name ?? "";
  if ( !name.toLowerCase().includes("activity") ) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if ( !root ) return;

  // Labels nos <option> dos selects de target
  root.querySelectorAll("option").forEach(opt => {
    if ( opt.value === PATH_GERADA ) opt.textContent = "⚡ Energia Gerada (PA)";
    if ( opt.value === PATH_TOTAL  ) opt.textContent = "🔮 Energia Total (PA)";
  });

  // Tooltip em inputs que mostram o path
  root.querySelectorAll(`input[value="${PATH_GERADA}"]`).forEach(el => {
    el.title = "PA Gerada — energia disponível neste turno";
  });
  root.querySelectorAll(`input[value="${PATH_TOTAL}"]`).forEach(el => {
    el.title = "PA Total — reserva permanente de energia";
  });
}

Hooks.on("renderApplication",   _injectLabels);
Hooks.on("renderDocumentSheet", _injectLabels);

// ─── 3. VALIDAÇÃO ANTES DO USO ───────────────────────────────────────────────

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialog) => {
  const actor = activity.item?.actor ?? activity.actor;
  if ( !actor ) return;

  const targets = activity.consumption?.targets ?? [];
  const energy  = actor.system?.energy;
  if ( !energy ) return;

  for ( const target of targets ) {
    const isGerada = target.target === PATH_GERADA;
    const isTotal  = target.target === PATH_TOTAL;
    if ( !isGerada && !isTotal ) continue;

    const available = isGerada ? (energy.generated ?? 0) : (energy.total ?? 0);
    const needed    = Number(target.value ?? 0);
    const label     = isGerada ? "PA Gerada" : "PA Total";

    if ( available < needed ) {
      ui.notifications.warn(
        `${actor.name} não tem ${label} suficiente! ` +
        `(${available} disponível, ${needed} necessário)`
      );
      return false;
    }
  }
});

// ── Redução de PA do Seis Olhos via activityConsumption ──────────────────────
// Este hook dispara APÓS o cálculo dos updates mas ANTES de aplicá-los,
// permitindo modificar o valor real que será descontado.

Hooks.on("dnd5e.activityConsumption", (activity, usageConfig, messageConfig, updates) => {
  const actor = activity.item?.actor ?? activity.actor;
  if ( !actor ) return;

  const seisOlhosItem = actor.items?.find(i => i.name === "Seis Olhos" && i.type === "feat");
  const seisOlhosMode = actor.getFlag("jujutsu-system", "seisOlhosMode");
  if ( !seisOlhosItem || !seisOlhosMode ) return;

  const prof     = actor.system.attributes?.prof ?? 2;
  const halfProf = Math.max(1, Math.floor(prof / 2));
  const reduction = seisOlhosMode === "full" ? prof : halfProf;

  // updates.actor contém os paths que serão atualizados no actor
  // ex: { "system.energy.generated": 10 } (novo valor após consumo)
  for ( const [key, newValue] of Object.entries(updates.actor ?? {}) ) {
    if ( !key.includes("energy.generated") && !key.includes("energy.total") ) continue;

    // O valor atual antes do consumo
    const currentValue = foundry.utils.getProperty(actor, key) ?? 0;
    // Custo calculado pelo sistema
    const cost = currentValue - newValue;
    if ( cost <= 0 ) continue;

    // Aplicar redução: o novo valor pós-consumo fica maior (gasta menos)
    const reducedCost = Math.max(1, cost - reduction);
    updates.actor[key] = currentValue - reducedCost;
  }
});

console.log("JujutsuLegacy | cursed-energy-consumption.mjs carregado ✓");
