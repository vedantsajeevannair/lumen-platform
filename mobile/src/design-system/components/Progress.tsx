// ============================================================
// LUMEN DS — ProgressRing Component (Animated)
// ============================================================
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing as RE,
} from "react-native-reanimated";
import { useTheme } from "../ThemeContext";
import { TextStyles } from "../tokens";

export interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export function ProgressRing({
  progress,
  size = 80,
  strokeWidth = 8,
  label,
  sublabel,
  color,
}: ProgressRingProps) {
  const { colors } = useTheme();
  const ringColor = color ?? colors.brand;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress / 100, {
      duration: 900,
      easing: RE.bezier(0.16, 1, 0.3, 1),
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `-90deg` }],
  }));

  // We use a simple View-based ring since SVG progress rings need react-native-svg
  // Using border-based circle approach for Expo Go compatibility
  const filled = (progress / 100) * 360;

  return (
    <View style={[s.root, { width: size, height: size }]}>
      {/* Track */}
      <View
        style={[
          s.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: colors.borderDefault,
          },
        ]}
      />
      {/* Progress half — simplified visual using opacity + color */}
      <View
        style={[
          s.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: progress > 0 ? ringColor : "transparent",
            opacity: progress / 100,
          },
        ]}
      />
      {/* Center label */}
      <View style={s.center}>
        {label && (
          <Text style={[TextStyles.subtitle, { color: colors.textPrimary, fontWeight: "800" }]}>
            {label}
          </Text>
        )}
        {sublabel && (
          <Text style={[TextStyles.caption, { color: colors.textSecondary }]}>{sublabel}</Text>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { position: "relative", alignItems: "center", justifyContent: "center" },
  track: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
});

// ============================================================
// LUMEN DS — LinearProgress
// ============================================================
export interface LinearProgressProps {
  progress: number; // 0-100
  color?: string;
  height?: number;
  animated?: boolean;
}

export function LinearProgress({
  progress,
  color,
  height = 6,
  animated = true,
}: LinearProgressProps) {
  const { colors } = useTheme();
  const barColor = color ?? colors.brand;
  const anim = useSharedValue(0);

  useEffect(() => {
    anim.value = withTiming(progress / 100, { duration: 700, easing: RE.bezier(0.16, 1, 0.3, 1) });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${anim.value * 100}%` as any,
  }));

  return (
    <View style={[lp.track, { height, backgroundColor: colors.bgSubtle, borderRadius: height }]}>
      <Animated.View
        style={[
          lp.bar,
          { height, backgroundColor: barColor, borderRadius: height },
          animated && barStyle,
        ]}
      />
    </View>
  );
}

const lp = StyleSheet.create({
  track: { overflow: "hidden", width: "100%" },
  bar: {},
});
