/** Model sets are independent of the F6 sprite/Classic tile selection. */
export const MODEL_SETS = ['Low-poly', 'Van Gogh'] as const;
export type ModelSet = (typeof MODEL_SETS)[number];
export const MODEL_SET_INFO: Record<ModelSet, { description: string; smooth: boolean }> = {
  'Low-poly': { description: 'Faceted models with articulated animation.', smooth: false },
  'Van Gogh': { description: 'Rounded models using the generated paintings, with articulated animation.', smooth: true },
};
export function readModelSet(value: unknown): ModelSet {
  return MODEL_SETS.find((set) => set === value) ?? 'Low-poly';
}
export function nextModelSet(current: ModelSet): ModelSet {
  return MODEL_SETS[(MODEL_SETS.indexOf(current) + 1) % MODEL_SETS.length];
}
