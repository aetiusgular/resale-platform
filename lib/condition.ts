/** Condition rubric definitions for the 1–10 scale. */
export const CONDITION_DEFINITIONS: Record<number, string> = {
  10: 'new with tags, unworn.',
  9:  'new without tags, tried on once.',
  8:  "light wear, no flaws visible at arm's length.",
  7:  'light wear, minor flaws on close inspection.',
  6:  "moderate wear, flaws visible at arm's length.",
  5:  'heavy wear, significant flaws.',
  4:  'heavy wear, multiple significant flaws.',
  3:  'very heavy wear, damage present.',
  2:  'heavily damaged, parts missing.',
  1:  'for parts only.',
}

/** Damage flags shown in the condition checklist. */
export const DAMAGE_FLAGS = ['stains', 'repairs', 'fading', 'odor'] as const
export type DamageFlag = typeof DAMAGE_FLAGS[number]
