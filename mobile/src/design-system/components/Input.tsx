// ============================================================
// LUMEN DS — Input Component (Premium Redesign)
// ============================================================
import React, { useEffect, useState } from "react";
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  interpolateColor,
} from "react-native-reanimated";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing, TextStyles, TouchTarget } from "../tokens";
import * as Haptics from "expo-haptics";

export interface InputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  isValid?: boolean;
  iconLeft?: LumenIconName;
  iconRight?: LumenIconName;
  onIconRightPress?: () => void;
  containerStyle?: ViewStyle;
  size?: "sm" | "md" | "lg";
}

export function Input({
  label,
  hint,
  error,
  isValid,
  iconLeft,
  iconRight,
  onIconRightPress,
  containerStyle,
  size = "md",
  secureTextEntry,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry ?? false);

  // Animations
  const focusAnim = useSharedValue(0);
  const shakeAnim = useSharedValue(0);
  const errorAnim = useSharedValue(0);

  useEffect(() => {
    if (error) {
      errorAnim.value = withTiming(1, { duration: 300 });
      // Shake animation
      shakeAnim.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      errorAnim.value = withTiming(0, { duration: 300 });
    }
  }, [error]);

  const handleFocus = (e: any) => {
    setFocused(true);
    focusAnim.value = withSpring(1, { stiffness: 300, damping: 20 });
    rest.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setFocused(false);
    focusAnim.value = withTiming(0, { duration: 200 });
    rest.onBlur?.(e);
  };

  const animatedWrapStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      errorAnim.value,
      [0, 1],
      [
        interpolateColor(focusAnim.value, [0, 1], [colors.borderDefault, colors.brand]),
        colors.errorText,
      ]
    );

    const shadowOpacity = interpolateColor(
      errorAnim.value,
      [0, 1],
      [interpolateColor(focusAnim.value, [0, 1], [0, 0.15]), 0.15]
    );

    const shadowColor = errorAnim.value > 0.5 ? colors.errorText : colors.brand;

    return {
      borderColor,
      transform: [{ translateX: shakeAnim.value }],
      shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity,
      shadowRadius: 8,
      elevation: focusAnim.value > 0 ? 4 : 0,
    };
  });

  const heights: Record<string, number> = { sm: 40, md: TouchTarget.md, lg: TouchTarget.lg };
  const pxLeft = iconLeft ? Spacing[5] + 26 : Spacing[4];
  const pxRight = iconRight || secureTextEntry || isValid ? Spacing[5] + 26 : Spacing[4];

  return (
    <View style={[s.container, containerStyle]}>
      {label && (
        <Text
          style={[
            TextStyles.label,
            { color: error ? colors.errorText : colors.textSecondary, marginBottom: 6 },
          ]}
        >
          {label}
        </Text>
      )}

      <Animated.View
        style={[
          s.inputWrap,
          animatedWrapStyle,
          {
            height: heights[size],
            backgroundColor: colors.bgSubtle,
            borderRadius: Radius.xl,
          },
        ]}
      >
        {iconLeft && (
          <View style={s.iconLeft}>
            <LumenIcon
              name={iconLeft}
              size="sm"
              color={error ? colors.errorText : focused ? colors.brand : colors.textTertiary}
              strokeWidth={2}
            />
          </View>
        )}

        <TextInput
          {...rest}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textTertiary}
          style={[
            TextStyles.body,
            s.input,
            {
              color: colors.textPrimary,
              paddingLeft: pxLeft,
              paddingRight: pxRight,
            },
          ]}
        />

        {(secureTextEntry || iconRight || isValid) && (
          <View style={s.iconRightContainer}>
            {isValid && !error && (
              <LumenIcon name="checkCircle" size="sm" color="#12B76A" strokeWidth={2} />
            )}

            {secureTextEntry && (
              <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} style={{ marginLeft: 8 }}>
                <LumenIcon
                  name={hidden ? "eye" : "eyeOff"}
                  size="sm"
                  color={colors.textTertiary}
                  strokeWidth={2}
                />
              </Pressable>
            )}

            {iconRight && !secureTextEntry && (
              <Pressable onPress={onIconRightPress} hitSlop={8} style={{ marginLeft: 8 }}>
                <LumenIcon
                  name={iconRight}
                  size="sm"
                  color={focused ? colors.brand : colors.textTertiary}
                  strokeWidth={2}
                />
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>

      {error ? (
        <Animated.Text style={[TextStyles.caption, { color: colors.errorText, marginTop: 4 }]}>
          {error}
        </Animated.Text>
      ) : hint ? (
        <Text style={[TextStyles.caption, { color: colors.textTertiary, marginTop: 4 }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: 0 },
  inputWrap: {
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  input: { flex: 1, height: "100%" },
  iconLeft: { position: "absolute", left: Spacing[4], zIndex: 1 },
  iconRightContainer: {
    position: "absolute",
    right: Spacing[4],
    zIndex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
});
