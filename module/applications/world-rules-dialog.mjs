import { paintLegacy2DocumentIcons } from "./shared/legacy2-document-theme.mjs";

const SCOPE = "jujutsu-system";

/** The prompt reflects the existing world settings and never rewrites actor data. */
export function worldRulesContent({ version, alternativeSaves }) {
  return `<div class="jj-world-rules-content">
    <p class="jj-world-rules-intro">Quais regras vamos usar neste mundo?</p>
    <fieldset class="jj-world-rules-versions">
      <legend>Versão das regras</legend>
      <label><input type="radio" name="rulesetVersion" value="1.0" ${version === "1.0" ? "checked" : ""}>
        <span><strong>1.0</strong><small>Jujutsu Legacy</small></span></label>
      <label><input type="radio" name="rulesetVersion" value="2.0" ${version === "2.0" ? "checked" : ""}>
        <span><strong>2.0</strong><small>Jujutsu Legacy</small></span></label>
    </fieldset>
    <fieldset class="jj-world-rules-saves" ${version !== "2.0" ? "disabled" : ""}>
      <legend>Salvaguardas da 2.0</legend>
      <label><span class="jj-world-rules-checkbox"><input type="checkbox" name="regraSalvaguarda" ${alternativeSaves ? "checked" : ""}></span>
        <span><strong>Fortitude, Vontade e Reflexo</strong>
        <small>Substituir as seis salvaguardas dos atributos por estas três.</small></span></label>
    </fieldset>
    <p class="jj-world-rules-note">Desmarcado: salvaguardas originais. Na 1.0, as originais são sempre usadas.</p>
    <p class="jj-world-rules-reload">As escolhas valem para todos. Se houver alterações, os clientes serão recarregados.</p>
    <p class="jj-world-rules-note">Não mostrar novamente também salva as escolhas. Você pode reativar esta janela nas configurações do sistema.</p>
  </div>`;
}

/** Keep the save option available only while 2.0 is selected. */
export function mountWorldRulesDialog(dialog) {
  const element = dialog.element;
  if ( !element ) return;
  paintLegacy2DocumentIcons(element);
  // DialogV2 sanitizes SVG in string content, so add the check after rendering.
  for ( const control of element.querySelectorAll(".jj-world-rules-checkbox") ) {
    if ( control.querySelector("svg") ) continue;
    const svg = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    for ( const [name, value] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
      "stroke-width": "3.2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }) ) {
      svg.setAttribute(name, value);
    }
    const check = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "path");
    check.setAttribute("d", "m5 12 4 4L19 6");
    svg.append(check);
    control.append(svg);
  }
  const versions = element.querySelector(".jj-world-rules-versions");
  const saves = element.querySelector(".jj-world-rules-saves");
  if ( !versions || !saves ) return;
  const update = () => { saves.disabled = versions.querySelector("input:checked")?.value !== "2.0"; };
  versions.addEventListener("change", update);
  update();
}

function currentRules() {
  return {
    version: game.settings.get(SCOPE, "rulesetVersion") === "2.0" ? "2.0" : "1.0",
    alternativeSaves: game.settings.get(SCOPE, "regraSalvaguarda") === true
  };
}

function skipReloadPrompt(key, rules) {
  try {
    const value = globalThis.sessionStorage?.getItem(key);
    if ( !value ) return false;
    globalThis.sessionStorage.removeItem(key);
    const previous = JSON.parse(value);
    return previous.expires > Date.now() && previous.version === rules.version
      && previous.alternativeSaves === rules.alternativeSaves;
  } catch { return false; }
}

/** Ask on world entry, only on the active GM's client, after system migrations. */
export async function presentWorldRules() {
  if ( !game.user?.isGM || (game.users?.activeGM && game.users.activeGM.id !== game.user.id) ) return false;
  const current = currentRules();
  const reloadKey = `${SCOPE}.worldRulesReload.${game.world.id}.${game.user.id}`;
  if ( skipReloadPrompt(reloadKey, current) ) return false;
  if ( game.settings.get(SCOPE, "showWorldRulesOnEntry") === false ) return false;

  const readChoice = (_event, _button, dialog) => ({
    version: dialog.element.querySelector('input[name="rulesetVersion"]:checked')?.value,
    alternativeSaves: dialog.element.querySelector('input[name="regraSalvaguarda"]')?.checked === true
  });

  const choice = await foundry.applications.api.DialogV2.wait({
    id: "jujutsu-world-rules", modal: true,
    classes: ["dnd5e2", "jj2-document", "jj-world-rules"],
    position: { width: 440 }, window: { title: "Regras do mundo" },
    content: worldRulesContent(current), render: (_event, dialog) => mountWorldRulesDialog(dialog),
    buttons: [{
      action: "apply", label: "Aplicar e entrar", default: true,
      callback: readChoice
    }, { action: "keep", label: "Manter regras atuais", callback: () => null }, {
      action: "hide", label: "Não mostrar novamente",
      callback: (...args) => ({ ...readChoice(...args), dontShowAgain: true })
    }],
    rejectClose: false, close: () => null
  });
  if ( !choice ) return false;
  if ( !["1.0", "2.0"].includes(choice.version) ) throw new Error("Escolha uma versão de regras válida.");
  const next = { version: choice.version, alternativeSaves: choice.version === "2.0" && choice.alternativeSaves === true };
  const changes = [
    ["rulesetVersion", current.version, next.version],
    ["regraSalvaguarda", current.alternativeSaves, next.alternativeSaves],
    ["showWorldRulesOnEntry", game.settings.get(SCOPE, "showWorldRulesOnEntry") !== false, !choice.dontShowAgain]
  ].filter(([, before, after]) => before !== after);
  if ( !changes.length ) return false;

  const written = [];
  try {
    for ( const [key, before, after] of changes ) {
      await game.settings.set(SCOPE, key, after);
      written.push([key, before]);
    }
  } catch (error) {
    for ( const [key, before] of written.reverse() ) {
      try { await game.settings.set(SCOPE, key, before); }
      catch (rollbackError) { console.error("Jujutsu Legacy | Não foi possível restaurar a regra anterior.", rollbackError); }
    }
    throw error;
  }

  if ( !changes.some(([key]) => key !== "showWorldRulesOnEntry") ) return false;

  // Suppress only the immediate reload this submission causes, never later world entries.
  try { globalThis.sessionStorage?.setItem(reloadKey, JSON.stringify({ ...next, expires: Date.now() + 30_000 })); }
  catch { /* Storage can be disabled by the browser; the saved rules still apply. */ }
  game.socket.emit("reload");
  foundry.utils.debouncedReload();
  return true;
}
