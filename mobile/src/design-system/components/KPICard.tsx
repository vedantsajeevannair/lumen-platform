import { LinearGradient } from "expo-linear-gradient";
import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useTheme } from "../ThemeContext";
import { AnimatedCounter } from "./AnimatedCounter";
import { GlassCard } from "./GlassCard";

interface KPICardProps {
  title: string;
  value: number;
  previousValue?: number;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
  gradient?: [string, string];
  formatValue?: (value: number) => string;
}

export function KPICard({
  title,
  value,
  previousValue,
  prefix = "",
  suffix = "",
  icon,
  style,
  gradient,
  formatValue,
}: KPICardProps) {
  const { colors, fontSize, fontWeight, spacing } = useTheme();

  const trend = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const isPositive = trend > 0;
  const isNegative = trend < 0;
  const isNeutral = trend === 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive
    ? colors.successText
    : isNegative
      ? colors.errorText
      : colors.textSecondary;

  return (
    <GlassCard style={StyleSheet.flatten([styles.container, style])}>
      <LinearGradient
        colors={gradient || [colors.bgSurface, colors.bgSurfaceRaised]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
            ]}
          >
            {title}
          </Text>
          {icon && <View style={styles.icon}>{icon}</View>}
        </View>
        <AnimatedCounter
          value={value}
          prefix={prefix}
          suffix={suffix}
          formatValue={formatValue}
          style={[
            styles.value,
            { fontSize: fontSize["3xl"], fontWeight: fontWeight.bold, color: colors.textPrimary },
          ]}
        />
        {previousValue && (
          <View style={styles.trend}>
            <TrendIcon size={16} color={trendColor} />
            <Text
              style={[
                styles.trendText,
                { color: trendColor, fontSize: fontSize.sm, fontWeight: fontWeight.semiBold },
              ]}
            >
              {Math.abs(trend).toFixed(1)}%
            </Text>
            <Text
              style={[styles.trendLabel, { color: colors.textTertiary, fontSize: fontSize.xs }]}
            >
              vs last period
            </Text>
          </View>
        )}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 140,
  },
  content: {
    padding: 20,
    flex: 1,
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  title: {
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  icon: {
    opacity: 0.8,
  },
  value: {
    marginBottom: 12,
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendText: {
    fontVariant: ["tabular-nums"],
  },
  trendLabel: {
    marginLeft: 6,
  },
});
