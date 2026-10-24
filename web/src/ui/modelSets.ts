/** Model sets are independent of the F6 sprite/Classic tile selection. */
export const MODEL_SETS = ['Low-poly', 'Van Gogh', 'Composed'] as const;
export type ModelSet = (typeof MODEL_SETS)[number];
export const MODEL_SET_INFO: Record<ModelSet, { description: string; smooth: boolean }> = {
  'Low-poly': { description: 'Faceted models with articulated animation.', smooth: false },
  'Van Gogh': { description: 'The existing painted model presentation.', smooth: true },
  Composed: {
    description: 'Preview: varied scenery, connected shores and a rigged ranger. Asset quality remains in progress.',
    smooth: true,
  },
};
export function readModelSet(value: unknown): ModelSet {
  return MODEL_SETS.find((set) => set === value) ?? 'Low-poly';
}
export function nextModelSet(current: ModelSet): ModelSet {
  return MODEL_SETS[(MODEL_SETS.indexOf(current) + 1) % MODEL_SETS.length];
}
