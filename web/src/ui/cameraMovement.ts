import { Key } from '../game/io.ts';

/** Four world directions with six degrees of hysteresis around 45° boundaries. */
export class CameraMovement {
  private sector: number | null = null;
  update(yaw: number, enabled: boolean): void {
    if (!enabled) {
      this.sector = null;
      return;
    }
    const quarter = Math.PI / 2;
    const nearest = ((Math.round(yaw / quarter) % 4) + 4) % 4;
    if (this.sector === null) this.sector = nearest;
    else {
      const offset = Math.atan2(Math.sin(yaw - this.sector * quarter), Math.cos(yaw - this.sector * quarter));
      if (Math.abs(offset) > (51 * Math.PI) / 180) this.sector = nearest;
    }
  }
  key(key: string): string {
    if (this.sector === null) return key;
    const index = ['w', 'a', 's', 'd'].indexOf(key.toLowerCase());
    if (index < 0) return key;
    return [Key.Up, Key.Left, Key.Down, Key.Right][(index + this.sector) % 4];
  }
}
