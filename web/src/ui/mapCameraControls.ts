import type { TileMapScene } from './tileMapScene.ts';

/** Mouse camera controls scoped to the map; they never send game commands. */
export class MapCameraControls {
  private active = false;
  private drag: { id: number; x: number; y: number } | null = null;
  private readonly reset = document.createElement('button');
  private readonly fit = document.createElement('button');
  private readonly toolbar = document.createElement('div');
  private readonly observer: ResizeObserver;
  private readonly originalTitle: string;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly map: TileMapScene,
  ) {
    this.originalTitle = canvas.title;
    this.reset.type = 'button';
    this.reset.id = 'map-camera-reset';
    this.reset.textContent = 'Reset view';
    this.reset.title = 'Reset the current camera mode';
    this.toolbar.style.cssText = 'position:absolute;z-index:2;display:none;transform:translateX(-100%);gap:5px;';
    this.fit.type = 'button';
    this.fit.id = 'map-camera-fit';
    this.fit.textContent = 'Whole map';
    this.fit.title = 'Zoom out to see the whole landscape; creatures remain limited to party visibility';
    for (const button of [this.fit, this.reset]) {
      button.style.cssText =
        'padding:5px 8px;background:#111e;color:#fff;border:1px solid #888;border-radius:3px;font:12px sans-serif;cursor:pointer;';
      button.addEventListener('keydown', (event) => event.stopPropagation());
    }
    this.reset.addEventListener('click', this.onReset);
    this.fit.addEventListener('click', this.onFit);
    this.toolbar.append(this.fit, this.reset);
    canvas.after(this.toolbar);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('lostpointercapture', this.onUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('blur', this.cancelDrag);
    window.addEventListener('resize', this.layout);
    this.observer = new ResizeObserver(this.layout);
    this.observer.observe(canvas);
  }

  setActive(active: boolean): void {
    if (this.map.fixedCamera) this.cancelDrag();
    this.canvas.title = active
      ? this.map.fixedCamera
        ? 'Fixed angled view. F4: free camera; scroll to zoom.'
        : 'Free camera. F4: fixed angled view; right-drag to rotate and tilt; scroll to zoom.'
      : this.originalTitle;
    if (this.active !== active) {
      this.active = active;
      if (!active) this.cancelDrag();
    }
    const wholeMap = this.map.inspectionMode && this.map.hasLandscape;
    const display = active && (wholeMap || !this.map.isDefault) ? 'flex' : 'none';
    this.reset.style.display = this.map.isDefault ? 'none' : 'block';
    this.fit.style.display = wholeMap ? 'block' : 'none';
    if (this.toolbar.style.display !== display) {
      this.toolbar.style.display = display;
      this.layout();
    }
  }

  private contains(clientX: number, clientY: number): boolean {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) * this.canvas.width) / r.width;
    const y = ((clientY - r.top) * this.canvas.height) / r.height;
    const map = this.map.rect;
    return x >= map.x && x < map.x + map.w && y >= map.y && y < map.y + map.h;
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (!this.active || this.map.fixedCamera || event.button !== 2 || !this.contains(event.clientX, event.clientY)) return;
    event.preventDefault();
    this.canvas.focus();
    this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    // Normalize the drag to the logical canvas size, independent of CSS scaling.
    const r = this.canvas.getBoundingClientRect();
    this.map.orbit(
      ((event.clientX - this.drag.x) * this.canvas.width) / r.width,
      ((event.clientY - this.drag.y) * this.canvas.height) / r.height,
    );
    this.drag.x = event.clientX;
    this.drag.y = event.clientY;
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (this.drag?.id === event.pointerId) this.cancelDrag();
  };

  private readonly cancelDrag = (): void => {
    if (!this.drag) return;
    const id = this.drag.id;
    this.drag = null;
    if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.active && this.contains(event.clientX, event.clientY)) event.preventDefault();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (!this.active || event.ctrlKey || !this.contains(event.clientX, event.clientY)) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.canvas.clientHeight : 1;
    this.map.zoomBy(Math.max(-500, Math.min(500, event.deltaY * unit)));
  };

  private readonly onReset = (): void => {
    this.map.reset();
    this.setActive(this.active);
    this.canvas.focus();
  };

  private readonly onFit = (): void => {
    this.map.fit();
    this.setActive(this.active);
    this.canvas.focus();
  };

  private readonly layout = (): void => {
    const r = this.canvas.getBoundingClientRect();
    const map = this.map.rect;
    this.toolbar.style.left = `${window.scrollX + r.left + ((map.x + map.w) * r.width) / this.canvas.width - 8}px`;
    this.toolbar.style.top = `${window.scrollY + r.top + (map.y * r.height) / this.canvas.height + 8}px`;
  };

  dispose(): void {
    this.cancelDrag();
    this.observer.disconnect();
    window.removeEventListener('blur', this.cancelDrag);
    window.removeEventListener('resize', this.layout);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    this.canvas.removeEventListener('lostpointercapture', this.onUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.title = this.originalTitle;
    this.toolbar.remove();
  }
}
