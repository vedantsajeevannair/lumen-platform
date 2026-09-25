// ============================================================
// LUMEN DS — EmptyState, StatusBanner, SearchBar
// ============================================================
import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Animated } from "react-native";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { useTheme } from "../ThemeContext";
import { Radius, Spacing, TextStyles, TouchTarget } from "../tokens";
import { Button } from "./Button";

// ---- EmptyState ----
export interface EmptyStateProps {
  icon?: LumenIconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={es.root}>
      {icon && (
        <View style={[es.iconWrap, { backgroundColor: colors.bgSubtle }]}>
          <LumenIcon name={icon} size="xl" color={colors.textTertiary} strokeWidth={1.5} />
        </View>
      )}
      <Text style={[TextStyles.title, { color: colors.textPrimary, textAlign: "center" }]}>
        {title}
      </Text>
      {description && (
        <Text style={[TextStyles.body, { color: colors.textSecondary, textAlign: "center" }]}>
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="secondary" size="md" />
      )}
    </View>
  );
}

const es = StyleSheet.create({
  root: {
    alignItems: "center",
    gap: Spacing[4],
    paddingVertical: Spacing[12],
    paddingHorizontal: Spacing[6],
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ---- StatusBanner ----
export type BannerVariant = "info" | "warning" | "error" | "success";

export interface StatusBannerProps {
  variant: BannerVariant;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

export function StatusBanner({ variant, title, message, onDismiss }: StatusBannerProps) {
  const { colors } = useTheme();

  const config: Record<BannerVariant, { bg: string; text: string; icon: LumenIconName }> = {
    info: { bg: colors.infoBg, text: colors.infoText, icon: "info" },
    warning: { bg: colors.warningBg, text: colors.warningText, icon: "alert" },
    error: { bg: colors.errorBg, text: colors.errorText, icon: "error" },
    success: { bg: colors.successBg, text: colors.successText, icon: "success" },
  };

  const c = config[variant];

  return (
    <View style={[sb.root, { backgroundColor: c.bg, borderColor: c.text + "33" }]}>
      <LumenIcon name={c.icon} size="md" color={c.text} strokeWidth={2} />
      <View style={sb.text}>
        <Text style={[TextStyles.label, { color: c.text }]}>{title}</Text>
        {message && <Text style={[TextStyles.caption, { color: c.text }]}>{message}</Text>}
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <LumenIcon name="close" size="sm" color={c.text} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const sb = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing[3],
    padding: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
});

// ---- SearchBar ----
export interface SearchBarProps {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search…",
  onFocus,
  onBlur,
}: SearchBarProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const widthAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setFocused(true);
    Animated.spring(widthAnim, {
      toValue: 1,
      useNativeDriver: false,
      speed: 40,
      bounciness: 0,
    }).start();
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    if (!value) {
      Animated.spring(widthAnim, {
        toValue: 0,
        useNativeDriver: false,
        speed: 40,
        bounciness: 0,
      }).start();
    }
    onBlur?.();
  };

  const borderColor = focused ? colors.brand : colors.borderDefault;

  return (
    <View
      style={[
        srch.container,
        {
          backgroundColor: colors.bgSubtle,
          borderColor,
          borderRadius: Radius.full,
        },
      ]}
    >
      <LumenIcon
        name="search"
        size="sm"
        color={focused ? colors.brand : colors.textTertiary}
        strokeWidth={2}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={[TextStyles.body, { flex: 1, color: colors.textPrimary }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}>
          <LumenIcon name="close" size="sm" color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      )}
    </View>
  );
}

const srch = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2.5],
    paddingHorizontal: Spacing[4],
    height: TouchTarget.md,
    borderWidth: 1.5,
  },
});
