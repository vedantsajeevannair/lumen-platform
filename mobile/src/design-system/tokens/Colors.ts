// ============================================================
// LUMEN Design System — Semantic Color Tokens
// ============================================================

export const Palette = {
  // Brand
  brand50: "#EBF5FF",
  brand100: "#DBEAFE",
  brand200: "#BFDBFE",
  brand400: "#60A5FA",
  brand500: "#208AEF",
  brand600: "#1D6FD1",
  brand700: "#1558A8",
  brand900: "#0C2D6B",

  // Neutrals
  neutral0: "#FFFFFF",
  neutral50: "#F9FAFB",
  neutral100: "#F2F4F7",
  neutral200: "#E4E7EC",
  neutral300: "#D0D5DD",
  neutral400: "#98A2B3",
  neutral500: "#667085",
  neutral600: "#475467",
  neutral700: "#344054",
  neutral800: "#1D2939",
  neutral900: "#101828",
  neutral950: "#0B1120",

  // Semantic
  green50: "#ECFDF3",
  green500: "#12B76A",
  green700: "#027A48",

  amber50: "#FFFAEB",
  amber500: "#F79009",
  amber700: "#B54708",

  red50: "#FEF3F2",
  red400: "#F97066",
  red500: "#F04438",
  red700: "#B42318",

  cyan50: "#ECFEFF",
  cyan500: "#06B6D4",
  cyan700: "#0E7490",

  purple50: "#F5F3FF",
  purple500: "#7C3AED",
  purple700: "#5B21B6",
} as const;

export const LightColors = {
  // Backgrounds
  bgBase: Palette.neutral50,
  bgSurface: Palette.neutral0,
  bgSurfaceRaised: Palette.neutral0,
  bgOverlay: "rgba(255,255,255,0.85)",
  bgGlass: "rgba(255,255,255,0.72)",
  bgSubtle: Palette.neutral100,

  // Brand
  brand: Palette.brand500,
  brandMuted: Palette.brand600,
  brandSoft: Palette.brand50,
  brandBorder: Palette.brand200,

  // Text
  textPrimary: Palette.neutral900,
  textSecondary: Palette.neutral600,
  textTertiary: Palette.neutral400,
  textInverse: Palette.neutral0,
  textBrand: Palette.brand500,
  textDisabled: Palette.neutral300,

  // Borders
  borderDefault: Palette.neutral200,
  borderStrong: Palette.neutral300,
  borderFocus: Palette.brand500,
  borderGlass: "rgba(255,255,255,0.6)",

  // Status
  successBg: Palette.green50,
  successText: Palette.green700,
  successBorder: "#A9EFC5",

  warningBg: Palette.amber50,
  warningText: Palette.amber700,
  warningBorder: "#FEDF89",

  errorBg: Palette.red50,
  errorText: Palette.red700,
  errorBorder: "#FECDCA",

  infoBg: Palette.cyan50,
  infoText: Palette.cyan700,
  infoBorder: "#A5F0FC",

  // Interactive
  pressedOverlay: "rgba(0,0,0,0.06)",
  focusRing: Palette.brand500,

  // Gradients (expressed as [from, to])
  gradientHero: ["#EBF5FF", "#F0F7FF"] as [string, string],
  gradientBrand: [Palette.brand500, Palette.brand700] as [string, string],
  gradientCard: ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.75)"] as [string, string],
  gradientAccent: ["#667EEA", "#764BA2"] as [string, string],
  gradientSuccess: ["#10B981", "#059669"] as [string, string],
  gradientWarning: ["#F59E0B", "#D97706"] as [string, string],
  gradientError: ["#EF4444", "#DC2626"] as [string, string],

  // Glassmorphism
  glassLight: "rgba(255, 255, 255, 0.72)",
  glassLightBorder: "rgba(255, 255, 255, 0.6)",
  glassDark: "rgba(16, 24, 40, 0.72)",
  glassDarkBorder: "rgba(255, 255, 255, 0.1)",
} as const;

export const DarkColors = {
  // Backgrounds
  bgBase: Palette.neutral950,
  bgSurface: Palette.neutral900,
  bgSurfaceRaised: Palette.neutral800,
  bgOverlay: "rgba(16,24,40,0.90)",
  bgGlass: "rgba(16,24,40,0.72)",
  bgSubtle: "#13202F",

  // Brand
  brand: "#67B3FF",
  brandMuted: "#93C5FD",
  brandSoft: "#12324D",
  brandBorder: "#1E4D7B",

  // Text
  textPrimary: Palette.neutral50,
  textSecondary: Palette.neutral400,
  textTertiary: Palette.neutral500,
  textInverse: Palette.neutral900,
  textBrand: "#67B3FF",
  textDisabled: Palette.neutral700,

  // Borders
  borderDefault: Palette.neutral800,
  borderStrong: Palette.neutral700,
  borderFocus: "#67B3FF",
  borderGlass: "rgba(255,255,255,0.1)",

  // Status
  successBg: "#052E16",
  successText: "#4ADE80",
  successBorder: "#14532D",

  warningBg: "#1C1200",
  warningText: "#FDE047",
  warningBorder: "#713F12",

  errorBg: "#1C0A09",
  errorText: "#FCA5A5",
  errorBorder: "#7F1D1D",

  infoBg: "#083344",
  infoText: "#67E8F9",
  infoBorder: "#164E63",

  // Interactive
  pressedOverlay: "rgba(255,255,255,0.06)",
  focusRing: "#67B3FF",

  // Gradients
  gradientHero: ["#0B1120", "#0D1B2E"] as [string, string],
  gradientBrand: ["#1D6FD1", "#1558A8"] as [string, string],
  gradientCard: ["rgba(29,41,57,0.95)", "rgba(29,41,57,0.75)"] as [string, string],
  gradientAccent: ["#4F46E5", "#7C3AED"] as [string, string],
  gradientSuccess: ["#059669", "#047857"] as [string, string],
  gradientWarning: ["#D97706", "#B45309"] as [string, string],
  gradientError: ["#DC2626", "#B91C1C"] as [string, string],

  // Glassmorphism
  glassLight: "rgba(255, 255, 255, 0.72)",
  glassLightBorder: "rgba(255, 255, 255, 0.6)",
  glassDark: "rgba(16, 24, 40, 0.72)",
  glassDarkBorder: "rgba(255, 255, 255, 0.1)",
} as const;

export type ColorTokens = typeof LightColors;
