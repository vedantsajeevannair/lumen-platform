// ============================================================
// LUMEN DS — Badge & Chip Components
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing, TextStyles } from "../tokens";

export type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral" | "brand";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: LumenIconName;
  dot?: boolean;
}

export function Badge({ label, variant = "neutral", size = "md", icon, dot }: BadgeProps) {
  const { colors } = useTheme();

  const config: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
    success: { bg: colors.successBg, text: colors.successText, dot: colors.successText },
    warning: { bg: colors.warningBg, text: colors.warningText, dot: colors.warningText },
    error: { bg: colors.errorBg, text: colors.errorText, dot: colors.errorText },
    info: { bg: colors.infoBg, text: colors.infoText, dot: colors.infoText },
    neutral: { bg: colors.bgSubtle, text: colors.textSecondary, dot: colors.textTertiary },
    brand: { bg: colors.brandSoft, text: colors.brand, dot: colors.brand },
  };

  const c = config[variant];
  const textSt = size === "sm" ? TextStyles.labelSmall : TextStyles.label;
  const px = size === "sm" ? Spacing[1.5] : Spacing[2.5];
  const py = size === "sm" ? 2 : 4;

  return (
    <View style={[s.badge, { backgroundColor: c.bg, paddingHorizontal: px, paddingVertical: py }]}>
      {dot && <View style={[s.dot, { backgroundColor: c.dot }]} />}
      {icon && (
        <View style={s.iconWrap}>
          <LumenIcon name={icon} size="xs" color={c.text} strokeWidth={2.5} />
        </View>
      )}
      <Text style={[textSt, { color: c.text }]}>{label}</Text>
    </View>
  );
}

// ---- Chip ----
export type ChipVariant = "filter" | "status" | "removable";

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  icon?: LumenIconName;
  variant?: ChipVariant;
}

export function Chip({
  label,
  selected = false,
  onPress,
  onRemove,
  icon,
  variant = "filter",
}: ChipProps) {
  const { colors } = useTheme();

  const bg = selected ? colors.brandSoft : colors.bgSubtle;
  const textColor = selected ? colors.brand : colors.textSecondary;
  const borderColor = selected ? colors.brandBorder : colors.borderDefault;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[s.chip, { backgroundColor: bg, borderColor }]}
    >
      {icon && (
        <View style={s.chipIcon}>
          <LumenIcon name={icon} size="xs" color={textColor} strokeWidth={2.5} />
        </View>
      )}
      <Text style={[TextStyles.label, { color: textColor }]}>{label}</Text>
      {onRemove && (
        <Pressable onPress={onRemove} style={s.removeBtn} hitSlop={8}>
          <LumenIcon name="close" size="xs" color={textColor} strokeWidth={2.5} />
        </Pressable>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: Radius.full,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconWrap: { marginRight: 1 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[1.5],
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: 4,
  },
  chipIcon: { marginRight: 1 },
  removeBtn: { marginLeft: 2 },
});
