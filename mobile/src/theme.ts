import { Platform, TextStyle, ViewStyle } from "react-native";
import {
  LightColors, Palette, LightShadows, Spacing, Radius, TextStyles,
} from "./design-system/tokens";

/**
 * One design system, so screens compose from tokens instead of inventing
 * numbers.
 *
 * The values below are no longer defined here: they map onto the LUMEN design
 * system tokens in `design-system/tokens`, which is the shared visual language
 * of the project. This file stays as the doorway the screens already import
 * (`C`, `S`, `R`, `F`, `E`), so adopting the design system did not require
 * editing eighteen screens — only the mapping underneath them.
 */

export const C = {
  brand: LightColors.brand,
  brandDeep: Palette.brand700,
  brandSoft: LightColors.brandSoft,
  accent: Palette.purple500,
  accentSoft: Palette.purple50,
  coral: Palette.red500,
  coralSoft: Palette.red50,
  sky: Palette.cyan500,
  skySoft: Palette.cyan50,

  // The emphasis surface. One per screen at most.
  dark: Palette.neutral900,
  darkSoft: Palette.neutral800,
  onDark: Palette.neutral0,
  onDarkMuted: Palette.neutral400,

  bg: LightColors.bgBase,
  surface: LightColors.bgSurface,
  raised: LightColors.bgSubtle,
  line: LightColors.borderDefault,
  lineStrong: LightColors.borderStrong,

  ink: LightColors.textPrimary,
  body: LightColors.textSecondary,
  muted: LightColors.textTertiary,
  // The brand is blue now, not yellow, so what sits on it is white rather
  // than ink. Getting this wrong is invisible in code and unreadable on screen.
  onBrand: LightColors.textInverse,

  ok: LightColors.successText,
  okSoft: LightColors.successBg,
  warn: LightColors.warningText,
  warnSoft: LightColors.warningBg,
  bad: LightColors.errorText,
  badSoft: LightColors.errorBg,
};

/**
 * Where a report has got to, in the three steps a citizen cares about.
 *
 * The workflow has more states than this, and none of them mean anything to
 * the person who filed it. Filed, being worked on, done.
 */
export const STAGES = ["Filed", "In progress", "Resolved"] as const;

export function stageOf(status?: string | null): number {
  switch ((status ?? "").toUpperCase()) {
    case "RESOLVED":
    case "CLOSED":
    case "REJECTED":
      return 2;
    case "ASSIGNED":
    case "IN_PROGRESS":
    case "PENDING_REVIEW":
      return 1;
    default:
      return 0;
  }
}

/** 4-point rhythm, from the design system's spacing scale. */
export const S = {
  xs: Spacing[1], sm: Spacing[2], md: Spacing[3], lg: Spacing[4],
  xl: Spacing[5], xxl: Spacing[7], xxxl: Spacing[10],
};

/**
 * Extra room a screen under the tab bar has to leave at the bottom.
 *
 * The bar itself sits below the content rather than over it, so it costs
 * nothing. The round action button is the problem: it is pulled 24pt up into
 * the screen, so whatever is last in a scroll ends up behind it with nothing
 * left to scroll. This is that overhang plus a comfortable gap.
 *
 * Only for the tab screens. Sheets hide the bar entirely and do not need it.
 */
export const TAB_CLEARANCE = 56;

export const R = {
  sm: Radius.sm, md: Radius.md, lg: Radius.lg, xl: Radius.xl, pill: Radius.full,
};

/**
 * Type scale. Sizes and weights come from the design system; the colour is
 * applied here because the tokens describe type, not meaning.
 */
export const F: Record<string, TextStyle> = {
  display: { ...TextStyles.heading1, color: C.ink },
  title: { ...TextStyles.title, color: C.ink },
  heading: { ...TextStyles.subtitle, color: C.ink },
  body: { ...TextStyles.body, color: C.body },
  bodyStrong: { ...TextStyles.bodyMedium, color: C.ink },
  caption: { ...TextStyles.caption, color: C.muted },
  overline: { ...TextStyles.labelSmall, textTransform: "uppercase", color: C.muted },
  mono: {
    ...TextStyles.mono,
    color: C.muted,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
  },
};

/** Two elevations only, taken from the design system's shadow scale. */
export const E: Record<"card" | "raised", ViewStyle> = {
  // Android reads `elevation` and ignores the iOS shadow fields; keeping the
  // whole token on both platforms is simpler than two shapes, and RN drops
  // what it does not use.
  card: LightShadows.sm as ViewStyle,
  raised: LightShadows.lg as ViewStyle,
};

export const card: ViewStyle = {
  backgroundColor: C.surface,
  borderRadius: R.lg,
  borderWidth: 1,
  borderColor: C.line,
  ...E.card,
};

/** Foreground/background pair for a status, so chips are legible either way. */
export function tone(priority?: string | null) {
  switch ((priority ?? "").toUpperCase()) {
    case "CRITICAL":
    case "HIGH":
      return { fg: C.bad, bg: C.badSoft };
    case "MEDIUM":
      return { fg: C.warn, bg: C.warnSoft };
    default:
      return { fg: C.ok, bg: C.okSoft };
  }
}

export function statusLabel(status?: string | null) {
  if (!status) return "—";
  return status
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

/** "3 days ago" reads better than a timestamp on a report you filed yourself. */
export function ago(iso?: string | null) {
  if (!iso) return "";
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Kept so existing imports keep working while screens migrate to C/S/F.
export const T = {
  navy: C.brand, navyDark: C.brandDeep, ink: C.ink, body: C.body,
  muted: C.muted, line: C.line, bg: C.bg, card: C.surface,
  accent: C.accent, ok: C.ok, warn: C.warn, bad: C.bad,
};
export const priorityColour = (p?: string | null) => tone(p).fg;


/**
 * The same tokens under the names the newer screens reach for.
 *
 * `C`/`S`/`R`/`F` are the originals and remain the source of truth; this is a
 * second doorway onto them, not a second palette. Two sets of values would
 * drift the moment one of them was edited, so every field here points at the
 * object above rather than repeating a hex code.
 */
export const theme = {
  colors: {
    primary: C.brand,
    background: C.bg,
    card: C.surface,
    border: C.line,
    text: C.ink,
    textMuted: C.muted,
    success: C.ok,
    warning: C.warn,
    danger: C.bad,
  },
  spacing: { xs: S.xs, sm: S.sm, md: S.md, lg: S.lg, xl: S.xl },
  radius: { sm: R.sm, md: R.md, lg: R.lg, xl: R.xl, full: R.pill },
  typography: {
    sizes: { xs: 11, sm: 13, md: 15, lg: 18 },
  },
} as const;
