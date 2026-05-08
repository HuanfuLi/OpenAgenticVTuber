import type { VariantEntry } from '@contracts/variant-entry'

export const PLACEHOLDER_REGEX = /^exp_?\d+$/i

export function usePlaceholderGate(variants: VariantEntry[]): {
  isDisabled: boolean
  placeholderCount: number
  firstPlaceholderIndex: number
} {
  const indices = variants
    .map((variant, index) => (PLACEHOLDER_REGEX.test(variant.code) ? index : -1))
    .filter((index) => index >= 0)

  return {
    isDisabled: indices.length > 0,
    placeholderCount: indices.length,
    firstPlaceholderIndex: indices[0] ?? -1
  }
}
