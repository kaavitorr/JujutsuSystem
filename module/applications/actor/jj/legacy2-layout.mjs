const WINDOW_ICONS = {
  toggleControls: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  copyUuid: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V3H4v13h4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>'
};

/** Keep native controls and part containers intact while arranging the 2.0 layout. */
export function mountLegacy2Layout(element) {
  const header = element.querySelector(".window-header");
  for ( const [action, paths] of Object.entries(WINDOW_ICONS) ) {
    const button = header?.querySelector(`[data-action="${action}"]`);
    if ( !button || button.querySelector(":scope > .jj2-window-icon") ) continue;
    const icon = element.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("class", "jj2-window-icon");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "1.8");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = paths;
    button.classList.add("jj2-window-control");
    button.replaceChildren(icon);
  }
  const mode = header?.querySelector(".mode-slider");
  const controls = header?.querySelector('[data-action="toggleControls"]');
  // Move the existing toggle so its native state, listeners and permissions are retained.
  if ( mode && controls && controls.previousElementSibling !== mode ) controls.before(mode);
  const main = element.querySelector(".main-content");
  const body = element.querySelector(".tab-body");
  if ( !main || !body ) return;
  const attributes = element.querySelector(".jj2-attributes");
  const navigation = element.querySelector(".jj2-tabs-nav");
  if ( attributes && attributes.parentElement !== main ) main.append(attributes);
  if ( navigation && navigation.parentElement !== main ) main.append(navigation);
}
