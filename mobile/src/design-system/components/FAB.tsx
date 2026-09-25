// ============================================================
// LUMEN DS — FAB (Floating Action Button)
// ============================================================
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View, Animated } from "react-native";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, TextStyles } from "../tokens";

export interface FABProps {
  icon: LumenIconName;
  label?: string;
  onPress: () => void;
  color?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = { sm: 44, md: 56, lg: 64 };
const ICON_SZ: Record<string, "sm" | "md" | "lg"> = { sm: "sm", md: "md", lg: "lg" };

export function FAB({ icon, label, onPress, color, size = "md" }: FABProps) {
  const { colors, shadows } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const bgColor = color ?? colors.brand;
  const dim = SIZES[size];

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

  const isExtended = !!label;

  return (
    <Animated.View style={[{ transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={label ?? icon}
        style={[
          s.fab,
          shadows.xl,
          {
            backgroundColor: bgColor,
            height: dim,
            borderRadius: isExtended ? dim / 2 : dim / 2,
            paddingHorizontal: isExtended ? 20 : 0,
            width: isExtended ? undefined : dim,
          },
        ]}
      >
        <LumenIcon name={icon} size={ICON_SZ[size]} color="#FFFFFF" strokeWidth={2.5} />
        {label && (
          <Text style={[TextStyles.button, { color: "#FFFFFF", marginLeft: 8 }]}>{label}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
