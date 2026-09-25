// ============================================================
// LUMEN Design System — Motion & Animation Tokens
// ============================================================

import type { EasingFunction } from "react-native";
import { Easing } from "react-native";

// Duration constants (ms)
export const Duration = {
  instant: 0,
  fast: 150,
  normal: 250,
  moderate: 350,
  slow: 500,
  xSlow: 700,
} as const;

// Easing curves
export const Ease = {
  // Standard
  linear: Easing.linear,
  // Ease in/out — for transitions
  inOut: Easing.inOut(Easing.ease),
  // Spring-like ease out — for elements entering
  out: Easing.out(Easing.cubic),
  // Ease in — for elements leaving
  in: Easing.in(Easing.cubic),
  // Custom expressive — for premium feel
  expressive: Easing.bezier(0.16, 1, 0.3, 1),
  bounce: Easing.bezier(0.34, 1.56, 0.64, 1),
} as const;

// Reanimated spring configs
export const Spring = {
  // Quick snappy response — for button presses
  snappy: {
    damping: 20,
    stiffness: 400,
    mass: 0.8,
  },
  // Standard — for cards, panels
  standard: {
    damping: 18,
    stiffness: 300,
    mass: 1,
  },
  // Smooth — for page transitions
  smooth: {
    damping: 22,
    stiffness: 250,
    mass: 1.1,
  },
  // Bouncy — for FAB, success states
  bouncy: {
    damping: 12,
    stiffness: 280,
    mass: 0.9,
  },
  // Gentle — for overlays and sheets
  gentle: {
    damping: 24,
    stiffness: 200,
    mass: 1,
  },
} as const;

// Scale values for press states
export const PressScale = {
  subtle: 0.98,
  normal: 0.96,
  strong: 0.92,
} as const;
