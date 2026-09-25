import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { useTheme } from "../ThemeContext";

interface GlassCardProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  border?: boolean;
}

export function GlassCard({
  children,
  style,
  intensity = 20,
  tint = "default",
  border = true,
}: GlassCardProps) {
  const { colors, isDark } = useTheme();

  const glassColor = isDark ? colors.glassDark : colors.glassLight;
  const borderColor = isDark ? colors.glassDarkBorder : colors.glassLightBorder;

  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={[glassColor, glassColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </BlurView>
      {border && <View style={[StyleSheet.absoluteFill, styles.border, { borderColor }]} />}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    borderRadius: 20,
  },
  border: {
    borderWidth: 1,
    borderRadius: 20,
  },
  content: {
    padding: 20,
  },
});
