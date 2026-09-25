// ============================================================
// LUMEN Design System — Spacing Scale (4pt grid)
// ============================================================

export const Spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

export const Radius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
} as const;

export const IconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  "2xl": 40,
} as const;

export const TouchTarget = {
  min: 44, // WCAG minimum
  md: 48,
  lg: 56,
} as const;
