// ============================================================
// LUMEN DS — Skeleton / Shimmer Component
// ============================================================
import React, { useEffect } from "react";
import { View, StyleSheet, type ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../ThemeContext";
import { Radius } from "../tokens/Spacing";

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = Radius.md,
  style,
}: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + shimmer.value * 0.4,
  }));

  const baseColor = isDark ? colors.bgSurfaceRaised : colors.bgSubtle;
  const highlightColor = isDark ? colors.borderStrong : colors.borderDefault;

  return (
    <Animated.View
      style={[
        s.skeleton,
        {
          width: width as any,
          height,
          borderRadius: radius,
          backgroundColor: baseColor,
        },
        animStyle,
        style,
      ]}
    />
  );
}

// Pre-built skeleton layouts
export function SkeletonCard() {
  return (
    <View style={sk.card}>
      <View style={sk.row}>
        <Skeleton width={44} height={44} radius={22} />
        <View style={sk.flex}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={11} width="40%" />
        </View>
      </View>
      <Skeleton height={11} />
      <Skeleton height={11} width="80%" />
      <Skeleton height={11} width="65%" />
    </View>
  );
}

export function SkeletonStatRow() {
  return (
    <View style={sk.statRow}>
      {[1, 2, 3, 4].map((k) => (
        <View key={k} style={sk.statCard}>
          <Skeleton width={40} height={40} radius={12} />
          <Skeleton height={22} width="70%" />
          <Skeleton height={11} width="90%" />
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({ skeleton: {} });
const sk = StyleSheet.create({
  card: { gap: 10, padding: 16 },
  row: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex: { flex: 1, gap: 6 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, gap: 8, alignItems: "center", padding: 12 },
});
