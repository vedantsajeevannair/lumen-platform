// ============================================================
// LUMEN DS — Button Component
// ============================================================
import React, { useRef } from "react";
import {
  Pressable,
  Text,
  StyleSheet,
  View,
  Animated,
  ActivityIndicator,
  type PressableProps,
} from "react-native";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing, TextStyles, TouchTarget } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "style"> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: LumenIconName;
  iconRight?: LumenIconName;
  fullWidth?: boolean;
  style?: any;
}

export function Button({
  label,
  variant = "primary",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  fullWidth = false,
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  const bg: Record<ButtonVariant, string> = {
    primary: colors.brand,
    secondary: colors.bgSurface,
    ghost: "transparent",
    danger: "#F04438",
    success: "#12B76A",
    outline: "transparent",
  };

  const textColor: Record<ButtonVariant, string> = {
    primary: "#FFFFFF",
    secondary: colors.textPrimary,
    ghost: colors.brand,
    danger: "#FFFFFF",
    success: "#FFFFFF",
    outline: colors.textPrimary,
  };

  const borderColor: Record<ButtonVariant, string> = {
    primary: "transparent",
    secondary: colors.borderDefault,
    ghost: "transparent",
    danger: "transparent",
    success: "transparent",
    outline: colors.borderDefault,
  };

  const height: Record<ButtonSize, number> = { sm: 36, md: TouchTarget.md, lg: TouchTarget.lg };
  const px: Record<ButtonSize, number> = { sm: Spacing[3], md: Spacing[5], lg: Spacing[6] };
  const textStyle = size === "sm" ? TextStyles.buttonSmall : TextStyles.button;
  const iconSz: Record<ButtonSize, "sm" | "md"> = { sm: "sm", md: "md", lg: "md" };
  const radius: Record<ButtonSize, number> = { sm: Radius.md, md: Radius.xl, lg: Radius["2xl"] };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[fullWidth && s.full, style, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[
          s.base,
          {
            height: height[size],
            paddingHorizontal: px[size],
            backgroundColor: bg[variant],
            borderColor: borderColor[variant],
            borderRadius: radius[size],
            opacity: isDisabled ? 0.5 : 1,
          },
          fullWidth && s.full,
        ]}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor[variant]} />
        ) : (
          <>
            {iconLeft && (
              <View style={s.iconLeft}>
                <LumenIcon
                  name={iconLeft}
                  size={iconSz[size]}
                  color={textColor[variant]}
                  strokeWidth={2.5}
                />
              </View>
            )}
            <Text style={[textStyle, { color: textColor[variant] }]}>{label}</Text>
            {iconRight && (
              <View style={s.iconRight}>
                <LumenIcon
                  name={iconRight}
                  size={iconSz[size]}
                  color={textColor[variant]}
                  strokeWidth={2.5}
                />
              </View>
            )}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  full: { width: "100%" },
  iconLeft: { marginRight: 6 },
  iconRight: { marginLeft: 6 },
});
