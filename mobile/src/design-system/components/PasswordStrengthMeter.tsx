import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from "react-native-reanimated";
import { useTheme } from "../ThemeContext";
import { LumenIcon } from "../icons/LumenIcon";
import { Radius, Spacing, TextStyles } from "../tokens";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const { colors } = useTheme();

  const criteria = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(criteria).filter(Boolean).length; // 0 to 5

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(score, { duration: 300 });
  }, [score]);

  const animatedBarStyle = useAnimatedStyle(() => {
    return {
      width: `${(progress.value / 5) * 100}%`,
      backgroundColor: interpolateColor(
        progress.value,
        [0, 1, 2, 3, 4, 5],
        [
          colors.borderDefault,
          "#F04438", // Weak
          "#F79009", // Fair
          "#F79009", // Good
          "#12B76A", // Strong
          "#12B76A", // Very Strong
        ]
      ),
    };
  });

  const getLabel = () => {
    if (score === 0) return "Enter password";
    if (score <= 2) return "Weak";
    if (score === 3) return "Fair";
    if (score === 4) return "Strong";
    return "Very Strong";
  };

  const getLabelColor = () => {
    if (score === 0) return colors.textTertiary;
    if (score <= 2) return "#F04438";
    if (score <= 3) return "#F79009";
    return "#12B76A";
  };

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={[TextStyles.label, { color: colors.textSecondary }]}>Password Strength</Text>
        <Text style={[TextStyles.label, { color: getLabelColor() }]}>{getLabel()}</Text>
      </View>

      <View style={[s.barContainer, { backgroundColor: colors.bgSubtle }]}>
        <Animated.View style={[s.bar, animatedBarStyle]} />
      </View>

      <View style={s.criteriaGrid}>
        <CriteriaItem label="8+ characters" met={criteria.length} />
        <CriteriaItem label="Uppercase letter" met={criteria.upper} />
        <CriteriaItem label="Lowercase letter" met={criteria.lower} />
        <CriteriaItem label="Number" met={criteria.number} />
        <CriteriaItem label="Special character" met={criteria.special} />
      </View>
    </View>
  );
}

function CriteriaItem({ label, met }: { label: string; met: boolean }) {
  const { colors, isDark } = useTheme();
  const unmetColor = isDark ? "rgba(255, 255, 255, 0.45)" : colors.textTertiary;
  return (
    <View style={s.criteriaItem}>
      <LumenIcon
        name="checkCircle"
        size="sm"
        color={met ? "#12B76A" : unmetColor}
        strokeWidth={2}
      />
      <Text style={[TextStyles.caption, { color: met ? colors.textPrimary : unmetColor, flex: 1 }]}>
        {label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    gap: Spacing[3],
    marginTop: Spacing[2],
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  barContainer: {
    height: 4,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: Radius.full,
  },
  criteriaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing[2],
    rowGap: Spacing[2],
  },
  criteriaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[1],
    width: "100%",
  },
});
