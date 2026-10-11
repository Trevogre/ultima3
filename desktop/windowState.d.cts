export interface WindowState {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fullScreen?: boolean;
}
export function readState(file: string): WindowState;
export function writeState(file: string, change: WindowState): void;
export function startsFullScreen(argv: string[], env: Record<string, string | undefined>, state: WindowState): boolean;
export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function placeOnScreen(state: WindowState, areas: Area[], primary: Area): WindowState;
