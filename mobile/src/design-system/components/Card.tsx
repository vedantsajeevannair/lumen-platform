// ============================================================
// LUMEN DS — Card Component
// ============================================================
import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from "react-native";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing } from "../tokens";

export type CardVariant = "default" | "elevated" | "glass" | "outlined" | "flat";

export interface CardProps {
  children?: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  radius?: number;
  testID?: string;
}

export function Card({
  children,
  variant = "elevated",
  onPress,
  style,
  padding = Spacing[5],
  radius = Radius["2xl"],
  testID,
}: CardProps) {
  const { colors, shadows, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 5 }).start();

  const cardStyles: Record<CardVariant, ViewStyle> = {
    default: {
      backgroundColor: colors.bgSurface,
    },
    elevated: {
      backgroundColor: colors.bgSurface,
      ...shadows.lg,
    },
    glass: {
      backgroundColor: colors.bgGlass,
      borderWidth: 1,
      borderColor: colors.borderGlass,
      ...shadows.glass,
    },
    outlined: {
      backgroundColor: colors.bgSurface,
      borderWidth: 1,
      borderColor: colors.borderDefault,
    },
    flat: {
      backgroundColor: colors.bgSubtle,
    },
  };

  const containerStyle = [s.card, cardStyles[variant], { padding, borderRadius: radius }, style];

  if (onPress) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={containerStyle}
          testID={testID}
          accessibilityRole="button"
        >
          {children}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    overflow: "hidden",
  },
});
