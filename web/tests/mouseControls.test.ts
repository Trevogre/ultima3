import { afterEach, describe, expect, it, vi } from 'vitest';
import { layoutMenu, layoutKeyboard } from '../src/ui/menus.ts';
import { MenuMouse, menuItemAt } from '../src/ui/menuMouse.ts';
import { orbitButton } from '../src/ui/mapCameraControls.ts';
import { applyPresentationPreset, DEFAULT_3D_SETTINGS, presentationPreset, read3DSettings } from '../src/ui/view3DSettings.ts';

afterEach(() => vi.unstubAllGlobals());

describe('mouse preferences and orbit input', () => {
  it('supports ordinary and secondary mouse drag independently, without capturing touch or middle-click', () => {
    expect(orbitButton(0, 'mouse', DEFAULT_3D_SETTINGS)).toBe(true);
    expect(orbitButton(2, 'mouse', DEFAULT_3D_SETTINGS)).toBe(true);
    expect(orbitButton(0, 'mouse', { leftDrag: false, rightDrag: true })).toBe(false);
    expect(orbitButton(2, 'mouse', { leftDrag: true, rightDrag: false })).toBe(false);
    expect(orbitButton(0, 'touch', DEFAULT_3D_SETTINGS)).toBe(false);
    expect(orbitButton(1, 'mouse', DEFAULT_3D_SETTINGS)).toBe(false);
  });

  it('preserves mouse overrides through upgrades and presentation presets', () => {
    const settings = read3DSettings({ leftDrag: false, rightDrag: false, wheelZoom: false, menuClicks: false });
    expect(settings).toMatchObject({ leftDrag: false, rightDrag: false, wheelZoom: false, menuClicks: false });
    expect(presentationPreset(settings)).toBe('Depth');
    expect(applyPresentationPreset(settings, 'Depth')).toMatchObject({ leftDrag: false, menuClicks: false });
  });
});

describe('canvas menu pointer hit testing', () => {
  it('accounts for scrolled rows and rejects borders, hints and empty grid cells', () => {
    const menu = layoutMenu(
      'Choices',
      Array.from({ length: 20 }, (_, i) => String(i)),
    );
    menu.top = 5;
    expect(menuItemAt(menu, menu.x + 2, menu.y + 1.5)).toBe(5);
    expect(menuItemAt(menu, menu.x, menu.y + 1.5)).toBeNull();
    expect(menuItemAt(menu, menu.x + 2, menu.y)).toBeNull();
    expect(menuItemAt(menu, menu.x + 2, menu.y + menu.visibleRows + 2)).toBeNull();
    const grid = layoutMenu('Grid', ['a', 'b', 'c'], 2);
    expect(menuItemAt(grid, grid.x + grid.width - 2, grid.y + 2.5)).toBeNull();
  });

  it('recognizes both stretched action keys on the on-screen keyboard', () => {
    const menu = layoutKeyboard('Name');
    const lastY = menu.y + Math.ceil(menu.items.length / menu.columns) - 0.5 + 1;
    expect(menuItemAt(menu, menu.x + 2, lastY)).toBe(menu.items.length - 2);
    expect(menuItemAt(menu, menu.x + menu.width - 2, lastY)).toBe(menu.items.length - 1);
  });

  it('clicks a scaled menu, supports hover/wheel/back, and refuses stale or dragged clicks', () => {
    vi.stubGlobal('window', new EventTarget());
    const canvas = Object.assign(new EventTarget(), {
      width: 800,
      height: 480,
      focus: vi.fn(),
      getBoundingClientRect: () => ({ left: 100, top: 50, width: 400, height: 240 }),
    });
    let menu = layoutMenu('Menu', ['One', 'Two', 'Back']);
    const choose = vi.fn(),
      hover = vi.fn(),
      wheel = vi.fn(),
      back = vi.fn();
    let enabled = true;
    new MenuMouse(
      canvas as unknown as HTMLCanvasElement,
      20,
      () => menu,
      () => enabled,
      hover,
      choose,
      wheel,
      back,
    );
    const dispatch = (type: string, row: number, overrides = {}) => {
      const event = Object.assign(new Event(type, { cancelable: true }), {
        clientX: 100 + (menu.x + 2) * 10,
        clientY: 50 + (menu.y + row + 1.5) * 10,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        buttons: 0,
        deltaY: 0,
        ctrlKey: false,
        ...overrides,
      });
      canvas.dispatchEvent(event);
      return event;
    };
    dispatch('pointermove', 1);
    expect(menu.cursor).toBe(1);
    dispatch('pointerdown', 1);
    dispatch('pointerup', 1);
    expect(choose).toHaveBeenCalledTimes(1);
    dispatch('pointerdown', 1);
    dispatch('pointerup', 2);
    expect(choose).toHaveBeenCalledTimes(1);
    dispatch('pointerdown', 1);
    menu = layoutMenu('New', ['Other']);
    dispatch('pointerup', 0);
    expect(choose).toHaveBeenCalledTimes(1);
    dispatch('wheel', 0, { deltaY: 100 });
    expect(wheel).toHaveBeenCalledWith('down');
    dispatch('pointerdown', 0, { button: 2 });
    expect(back).toHaveBeenCalledTimes(1);
    enabled = false;
    expect(dispatch('contextmenu', 0).defaultPrevented).toBe(true);
    dispatch('pointerdown', 0);
    dispatch('pointerup', 0);
    expect(choose).toHaveBeenCalledTimes(1);
    expect(hover).toHaveBeenCalled();
  });
});
