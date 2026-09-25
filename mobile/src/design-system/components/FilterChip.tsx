import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../ThemeContext";
import { X } from "lucide-react-native";

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
  removable?: boolean;
}

export function FilterChip({
  label,
  selected = false,
  onToggle,
  onRemove,
  removable = false,
}: FilterChipProps) {
  const { colors, fontSize, fontWeight, spacing, radius } = useTheme();

  const backgroundColor = selected ? colors.brand : colors.bgSubtle;
  const textColor = selected ? colors.textInverse : colors.textSecondary;

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor: selected ? colors.brand : colors.borderDefault,
        },
      ]}
      accessibilityRole={removable ? "button" : "checkbox"}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
          },
        ]}
      >
        {label}
      </Text>
      {removable && onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <X size={14} color={textColor} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    alignSelf: "flex-start",
  },
  label: {
    textTransform: "capitalize",
  },
});
