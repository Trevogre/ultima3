import { Key } from '../game/io.ts';
import type { Keyboard } from './input.ts';

/** Keep the game and its menu in place while browsing the comparison table. */
export async function showSpriteSheet(keyboard: Keyboard, page = { title: 'Sprite sheet', file: 'tiles.html' }): Promise<void> {
  const previous = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-label', page.title);
  dialog.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#111;color:#ddd;';
  const back = document.createElement('button');
  back.textContent = '← Back to game';
  back.style.cssText = 'margin:10px 16px;padding:8px 14px;font:16px system-ui;cursor:pointer;';
  const frame = document.createElement('iframe');
  frame.title = page.title;
  frame.src = `${import.meta.env.BASE_URL}${page.file}`;
  frame.style.cssText = 'display:block;width:100%;height:calc(100% - 60px);border:0;';
  const close = () => keyboard.push(Key.Escape);
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
    // Native controls retain their keyboard behaviour without feeding the game.
    event.stopPropagation();
  };
  window.addEventListener('keydown', onKey, true);
  frame.addEventListener('load', () => frame.contentWindow?.addEventListener('keydown', onKey, true));
  back.onclick = close;
  dialog.oncancel = (event) => {
    event.preventDefault();
    close();
  };
  dialog.append(back, frame);
  document.body.append(dialog);
  dialog.showModal();
  keyboard.flush();
  try {
    for (;;) {
      const key = await keyboard.nextKey();
      // Focusing the iframe blurs the game window, which queues Pause. Keep
      // browsing in that case; Escape, B and the Back button close the sheet.
      if (key === Key.Escape || key === Key.B) break;
      const table = frame.contentDocument?.getElementById('sets');
      if (key === Key.Down) table?.scrollBy({ top: 100 });
      if (key === Key.Up) table?.scrollBy({ top: -100 });
      if (key === Key.Right) table?.scrollBy({ left: 130 });
      if (key === Key.Left) table?.scrollBy({ left: -130 });
    }
  } finally {
    window.removeEventListener('keydown', onKey, true);
    dialog.close();
    dialog.remove();
    keyboard.flush();
    previous?.focus();
  }
}
