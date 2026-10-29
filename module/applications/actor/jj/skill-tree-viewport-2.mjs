/** Pan and zoom for an embedded skill map. No actor or draft mutations. */
export class SkillTreeViewport {
  zoom = 1;
  x = 0;
  y = 0;

  mount(root, map, key) {
    this.destroy();
    this.viewport = root?.querySelector(".jj2m-viewport");
    this.stage = root?.querySelector(".jj2m-stage");
    this.label = root?.querySelector(".jj2m-zoom-value");
    this.map = map;
    if (key !== this.key) { this.key = key;this.reset(); }
    if (!this.viewport || !this.stage) return;
    const Controller = this.viewport.ownerDocument.defaultView.AbortController;
    this.controller = new Controller();
    const listen = (name, fn, options = {}) => this.viewport.addEventListener(name, fn, { ...options, signal: this.controller.signal });
    listen("wheel", event => {
      event.preventDefault();
      const rect = this.viewport.getBoundingClientRect();
      this.zoomAt(this.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX - rect.left, event.clientY - rect.top);
    }, { passive: false });
    listen("pointerdown", event => {
      if (event.button !== 0 || event.target.closest("button,a,input,select")) return;
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: this.x, panY: this.y };
      this.viewport.setPointerCapture?.(event.pointerId);
      this.viewport.classList.add("arrastando");event.preventDefault();
    });
    listen("pointermove", event => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      this.x = this.drag.panX + event.clientX - this.drag.x;
      this.y = this.drag.panY + event.clientY - this.drag.y;this.apply();
    });
    const release = event => {
      if (!this.drag || this.drag.id !== event.pointerId) return;
      if (this.viewport.hasPointerCapture?.(event.pointerId)) this.viewport.releasePointerCapture(event.pointerId);
      this.drag = null;this.viewport.classList.remove("arrastando");
    };
    listen("pointerup", release);listen("pointercancel", release);
    listen("dblclick", event => { if (!event.target.closest("button")) this.reset(); });
    listen("focusin", event => {
      const button = event.target.closest(".jj2m-node");
      if (!button || event.target.matches(":focus-visible") === false) return;
      this.focus(button.dataset.nome);
    });
    this.apply();
  }

  apply() {
    if (this.stage) this.stage.style.transform = `translate(${this.x}px, ${this.y}px) scale(${this.zoom})`;
    if (this.label) this.label.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  zoomAt(value, x = this.viewport?.clientWidth / 2, y = this.viewport?.clientHeight / 2) {
    if (!this.viewport) return;
    const next = Math.min(1.75, Math.max(0.2, value)), factor = next / this.zoom;
    this.x = x - (x - this.x) * factor;this.y = y - (y - this.y) * factor;
    this.zoom = next;this.apply();
  }

  fit() {
    if (!this.viewport || !this.map) return;
    this.zoom = Math.min(1, Math.max(0.2, Math.min(this.viewport.clientWidth / this.map.largura, this.viewport.clientHeight / this.map.altura)));
    this.x = (this.viewport.clientWidth - this.map.largura * this.zoom) / 2;
    this.y = (this.viewport.clientHeight - this.map.altura * this.zoom) / 2;this.apply();
  }

  focus(name) {
    const node = this.map?.nos.find(node => node.nome === name);
    if (!node || !this.viewport) return;
    this.x = this.viewport.clientWidth / 2 - (node.x + this.map.noLargura / 2) * this.zoom;
    this.y = this.viewport.clientHeight / 2 - (node.y + this.map.noAltura / 2) * this.zoom;this.apply();
  }

  reset() { this.zoom = 1;this.x = 0;this.y = 0;this.apply(); }
  destroy() { this.controller?.abort();this.drag = null; }
}
