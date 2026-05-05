/**
 * jj/features.mjs
 * Seções customizadas da aba de Características (Features, Inventory, Spells).
 */

export function setupFeatureSectionCollapse(element) {
  ["features", "inventory", "spells"].forEach(tabId => {
    const tab = element.querySelector(`[data-tab="${tabId}"]`);
    if ( !tab ) return;
    tab.querySelectorAll(".items-section > header, .items-section > .items-header").forEach(header => {
      if ( header.dataset.jjCollapseBound ) return;
      header.dataset.jjCollapseBound = "1";
      header.style.cursor = "pointer";
      header.style.userSelect = "none";
      if ( !header.querySelector(".jj-collapse-icon") ) {
        const icon = document.createElement("i");
        icon.className = "fas fa-chevron-down jj-collapse-icon";
        icon.style.cssText = "margin-left: auto; font-size: 10px; opacity: 0.4; transition: transform 200ms ease; flex-shrink: 0;";
        header.appendChild(icon);
      }
      header.addEventListener("click", e => {
        if ( e.target.closest("button, a, input, [data-action]") ) return;
        const section = header.closest(".items-section");
        if ( !section ) return;
        const isCollapsed = section.classList.toggle("jj-collapsed");
        const icon = header.querySelector(".jj-collapse-icon");
        section.querySelectorAll(":scope > *:not(header):not(.items-header)").forEach(el => {
          el.style.display = isCollapsed ? "none" : "";
        });
        if ( icon ) icon.style.transform = isCollapsed ? "rotate(-90deg)" : "";
      });
    });
  });
}

export function unhideFeatureSections(element) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;
  ["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws", "jj-benefits", "jj-curses"].forEach(id => {
    const section = featuresTab.querySelector(`[data-group-origin="${id}"]`);
    if ( section ) section.removeAttribute("hidden");
  });
}

export const JJ_FEATURE_SECTIONS = new Set(["jj-origin", "jj-combat", "jj-path", "jj-basic", "jj-talents", "jj-flaws", "jj-benefits", "jj-curses"]);

export function setupFeatureSectionDrops(element, actor) {
  const featuresTab = element.querySelector('[data-tab="features"]');
  if ( !featuresTab ) return;

  JJ_FEATURE_SECTIONS.forEach(sectionId => {
    const section = featuresTab.querySelector(`[data-group-origin="${sectionId}"]`);
    if ( !section ) return;

    section.addEventListener("dragover", e => {
      e.preventDefault();
      section.classList.add("jj-drag-over");
    });

    section.addEventListener("dragleave", () => {
      section.classList.remove("jj-drag-over");
    });

    section.addEventListener("drop", async e => {
      section.classList.remove("jj-drag-over");
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor || item.type !== "feat" ) return;
      // Pequeno delay para o nativo processar primeiro
      setTimeout(async () => {
        await item.setFlag("jujutsu-system", "featureSection", sectionId);
      }, 50);
    });
  });

  // Seções nativas — limpar flag quando item volta
  const nativeSections = featuresTab.querySelectorAll("[data-group-origin]:not([data-group-origin^='jj-'])");
  nativeSections.forEach(section => {
    section.addEventListener("drop", async e => {
      let dragData;
      try { dragData = JSON.parse(e.dataTransfer.getData("text/plain")); }
      catch(err) { return; }
      if ( dragData?.type !== "Item" ) return;
      const item = dragData.uuid ? await fromUuid(dragData.uuid) : actor.items.get(dragData.id);
      if ( !item || item.parent !== actor ) return;
      const hasFlag = item.getFlag("jujutsu-system", "featureSection");
      if ( hasFlag ) await item.unsetFlag("jujutsu-system", "featureSection");
    });
  });
}

