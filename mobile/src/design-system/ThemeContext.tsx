import React, { createContext, useContext, useState } from "react";
import { useColorScheme } from "react-native";
import { DarkColors, LightColors, type ColorTokens } from "./tokens/Colors";
import { DarkShadows, LightShadows, type ShadowScale } from "./tokens/Shadows";
import { Radius, Spacing } from "./tokens/Spacing";
import { FontSize, FontWeight, TextStyles } from "./tokens/Typography";

export type ThemeMode = "light" | "dark" | "system";
export type ShadowTokens = ShadowScale;

export interface Theme {
  colors: ColorTokens;
  shadows: ShadowScale;
  text: typeof TextStyles;
  fontSize: typeof FontSize;
  fontWeight: typeof FontWeight;
  spacing: typeof Spacing;
  radius: typeof Radius;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  glassLight: string;
  glassLightBorder: string;
  glassDark: string;
  glassDarkBorder: string;
}

const ThemeContext = createContext<Theme | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  forcedMode?: ThemeMode;
}

export function ThemeProvider({ children, forcedMode }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const activeMode = forcedMode !== undefined ? forcedMode : mode;
  const isDark = activeMode === "system" ? systemScheme === "dark" : activeMode === "dark";

  const theme: Theme = {
    colors: isDark ? (DarkColors as unknown as ColorTokens) : LightColors,
    shadows: isDark ? DarkShadows : LightShadows,
    text: TextStyles,
    fontSize: FontSize,
    fontWeight: FontWeight,
    spacing: Spacing,
    radius: Radius,
    isDark,
    mode,
    setMode,
    glassLight: isDark ? DarkColors.glassDark : LightColors.glassLight,
    glassLightBorder: isDark ? DarkColors.glassDarkBorder : LightColors.glassLightBorder,
    glassDark: DarkColors.glassDark,
    glassDarkBorder: DarkColors.glassDarkBorder,
  };

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
