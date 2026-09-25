// ============================================================
// LUMEN Design System — Typography Scale
// ============================================================

export const FontFamily = {
  regular: "System",
  medium: "System",
  semiBold: "System",
  bold: "System",
  extraBold: "System",
  black: "System",
} as const;

export const FontSize = {
  // Scale in 4pt increments anchored at 16
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
  "5xl": 48,
} as const;

export const FontWeight = {
  regular: "400" as const,
  medium: "500" as const,
  semiBold: "600" as const,
  bold: "700" as const,
  extraBold: "800" as const,
  black: "900" as const,
} as const;

export const LineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const LetterSpacing = {
  tighter: -1.2,
  tight: -0.5,
  normal: 0,
  wide: 0.3,
  wider: 0.8,
  widest: 1.6,
} as const;

// Pre-composed text styles — use these in StyleSheet
export const TextStyles = {
  display: {
    fontSize: FontSize["5xl"],
    fontWeight: FontWeight.black,
    lineHeight: FontSize["5xl"] * LineHeight.tight,
    letterSpacing: LetterSpacing.tighter,
  },
  heading1: {
    fontSize: FontSize["4xl"],
    fontWeight: FontWeight.extraBold,
    lineHeight: FontSize["4xl"] * LineHeight.snug,
    letterSpacing: LetterSpacing.tighter,
  },
  heading2: {
    fontSize: FontSize["3xl"],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize["3xl"] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  title: {
    fontSize: FontSize["2xl"],
    fontWeight: FontWeight.bold,
    lineHeight: FontSize["2xl"] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  subtitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.xl * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  body: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.md * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  bodyMedium: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    lineHeight: FontSize.md * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  bodySmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.sm * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  caption: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.regular,
    lineHeight: FontSize.xs * LineHeight.normal,
    letterSpacing: LetterSpacing.normal,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.sm * LineHeight.snug,
    letterSpacing: LetterSpacing.wide,
  },
  labelSmall: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xs * LineHeight.snug,
    letterSpacing: LetterSpacing.wider,
  },
  button: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.md * LineHeight.snug,
    letterSpacing: LetterSpacing.wide,
  },
  buttonSmall: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semiBold,
    lineHeight: FontSize.sm * LineHeight.snug,
    letterSpacing: LetterSpacing.wide,
  },
  badge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    lineHeight: FontSize.xs * LineHeight.snug,
    letterSpacing: LetterSpacing.widest,
    textTransform: "uppercase" as const,
  },
  mono: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    letterSpacing: LetterSpacing.normal,
    fontVariant: ["tabular-nums"] as any,
  },
} as const;
