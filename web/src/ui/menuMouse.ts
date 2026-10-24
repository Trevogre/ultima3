import type { MenuWindow } from './menus.ts';

/** Hit testing in the same cell coordinates used by the bitmap menu renderer. */
export function menuItemAt(menu: MenuWindow, x: number, y: number): number | null {
  const row = Math.floor(y - menu.y - 1);
  if (row < 0 || row >= menu.visibleRows || x < menu.x + 1 || x >= menu.x + menu.width - 1) return null;
  const width = Math.floor((menu.width - 3) / menu.columns);
  let col = menu.columns === 1 ? 0 : Math.floor((x - menu.x - 1) / width);
  const start = (menu.top + row) * menu.columns;
  if (menu.spreadLastRow && start + menu.columns > menu.items.length && start < menu.items.length) {
    col = x < menu.x + menu.width / 2 ? 0 : menu.items.length - start - 1;
  }
  if (col < 0 || col >= menu.columns) return null;
  const index = start + col;
  return index < menu.items.length ? index : null;
}

export class MenuMouse {
  private press: { menu: MenuWindow; index: number; id: number; x: number; y: number } | null = null;
  private suppressContext = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cell: number,
    private readonly current: () => MenuWindow | null,
    private readonly enabled: () => boolean,
    private readonly hover: () => void,
    private readonly choose: () => void,
    private readonly move: (direction: 'up' | 'down') => void,
    private readonly back: () => void,
  ) {
    canvas.addEventListener('pointerdown', this.down, true);
    canvas.addEventListener('pointerup', this.up, true);
    canvas.addEventListener('pointermove', this.motion);
    canvas.addEventListener('pointercancel', () => {
      this.press = null;
    });
    canvas.addEventListener('wheel', this.wheel, { capture: true, passive: false });
    window.addEventListener('blur', () => {
      this.press = null;
    });
    canvas.addEventListener('contextmenu', (event) => {
      if (this.suppressContext || (this.enabled() && this.current())) event.preventDefault();
      this.suppressContext = false;
    });
  }

  private at(event: MouseEvent, menu: MenuWindow): number | null {
    const r = this.canvas.getBoundingClientRect();
    return menuItemAt(
      menu,
      ((event.clientX - r.left) * this.canvas.width) / r.width / this.cell,
      ((event.clientY - r.top) * this.canvas.height) / r.height / this.cell,
    );
  }

  private down = (event: PointerEvent): void => {
    const menu = this.enabled() ? this.current() : null;
    this.press = null;
    if (!menu || event.pointerType !== 'mouse' || (event.button !== 0 && event.button !== 2)) return;
    // Open menus own their pointer input, even outside an item. No camera drag.
    event.stopImmediatePropagation();
    event.preventDefault();
    if (event.button === 2) {
      this.suppressContext = true;
      this.back();
      return;
    }
    const index = this.at(event, menu);
    if (index === null) return;
    this.canvas.focus();
    this.press = { menu, index, id: event.pointerId, x: event.clientX, y: event.clientY };
    menu.cursor = index;
    this.hover();
  };

  private up = (event: PointerEvent): void => {
    const press = this.press;
    this.press = null;
    if (!press || press.id !== event.pointerId || press.menu !== this.current() || !this.enabled()) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6 || this.at(event, press.menu) !== press.index) return;
    press.menu.cursor = press.index;
    this.choose();
  };

  private motion = (event: PointerEvent): void => {
    const menu = this.enabled() ? this.current() : null;
    if (!menu || event.pointerType !== 'mouse' || event.buttons !== 0) return;
    const index = this.at(event, menu);
    if (index === null || index === menu.cursor) return;
    menu.cursor = index;
    this.hover();
  };

  private wheel = (event: WheelEvent): void => {
    const menu = this.enabled() ? this.current() : null;
    if (!menu || event.ctrlKey || !event.deltaY || this.at(event, menu) === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.move(event.deltaY > 0 ? 'down' : 'up');
  };
}
