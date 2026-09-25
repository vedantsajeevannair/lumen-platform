// ============================================================
// LUMEN DS — StatCard Component
// ============================================================
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing, TextStyles } from "../tokens";

export type StatCardVariant = "default" | "brand" | "success" | "warning" | "error";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LumenIconName;
  trend?: { value: string; up: boolean };
  variant?: StatCardVariant;
  compact?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  variant = "default",
  compact = false,
}: StatCardProps) {
  const { colors, shadows } = useTheme();

  const variantColors: Record<StatCardVariant, { iconBg: string; iconColor: string }> = {
    default: { iconBg: colors.bgSubtle, iconColor: colors.textSecondary },
    brand: { iconBg: colors.brandSoft, iconColor: colors.brand },
    success: { iconBg: colors.successBg, iconColor: colors.successText },
    warning: { iconBg: colors.warningBg, iconColor: colors.warningText },
    error: { iconBg: colors.errorBg, iconColor: colors.errorText },
  };

  const vc = variantColors[variant];

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderDefault,
          borderRadius: Radius["2xl"],
          padding: compact ? Spacing[4] : Spacing[5],
          ...shadows.md,
        },
      ]}
    >
      {icon && (
        <View style={[s.iconBox, { backgroundColor: vc.iconBg, borderRadius: Radius.lg }]}>
          <LumenIcon name={icon} size="md" color={vc.iconColor} strokeWidth={2} />
        </View>
      )}
      <Text
        style={[
          compact ? TextStyles.title : TextStyles.heading2,
          { color: colors.textPrimary, marginTop: icon ? Spacing[3] : 0 },
        ]}
      >
        {value}
      </Text>
      <Text style={[TextStyles.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
      {trend && (
        <View style={s.trend}>
          <LumenIcon
            name={trend.up ? "trend" : "chevronDown"}
            size="xs"
            color={trend.up ? colors.successText : colors.errorText}
            strokeWidth={2.5}
          />
          <Text
            style={[
              TextStyles.caption,
              { color: trend.up ? colors.successText : colors.errorText },
            ]}
          >
            {trend.value}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderWidth: 1,
    gap: 8,
    minHeight: 120,
    justifyContent: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  trend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
});
