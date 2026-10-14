/**
 * jj/popup.mjs
 * Popup de gif fullscreen (Black Flash, Satoru, etc.)
 */

export function showBlackFlashPopup(src = "systems/jujutsu-system/assets/black-flash.gif", duration = 7000) {
  const secs = (duration / 1000).toFixed(1) + "s";
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0);
    pointer-events: none;
    animation: jj-bf-overlay ${secs} ease-out forwards;
  `;

  const img = document.createElement("img");
  img.src = src;
  img.style.cssText = `
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    animation: jj-bf-img ${secs} ease-out forwards;
  `;

  // Injetar keyframes se ainda não existem
  if ( !document.getElementById("jj-bf-keyframes") ) {
    const style = document.createElement("style");
    style.id = "jj-bf-keyframes";
    style.textContent = `
      @keyframes jj-bf-overlay {
        0%   { background: rgba(0,0,0,0); }
        10%  { background: rgba(0,0,0,0.85); }
        75%  { background: rgba(0,0,0,0.85); }
        100% { background: rgba(0,0,0,0); }
      }
      @keyframes jj-bf-img {
        0%   { opacity: 0; transform: scale(0.8); }
        10%  { opacity: 1; transform: scale(1); }
        75%  { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(1.05); }
      }
    `;
    document.head.appendChild(style);
  }

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  // Tocar áudio do Black Flash (apenas quando for o gif padrão)
  if ( src.includes("black-flash") ) {
    const audio = new Audio("systems/jujutsu-system/assets/itadori-black.ogg");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }

  setTimeout(() => overlay.remove(), duration);
}

/**
 * Injeta data-jj-ref nos cards de habilidade de manipulação para tooltip via fromUuid.
 * @param {HTMLElement} root
 */
