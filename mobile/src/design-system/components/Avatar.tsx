// ============================================================
// LUMEN DS — Avatar Component
// ============================================================
import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useTheme } from "../ThemeContext";
import { Radius, TextStyles } from "../tokens";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
export interface AvatarProps {
  name?: string;
  size?: AvatarSize;
  color?: string;
  online?: boolean;
  role?: "citizen" | "engineer" | "admin";
  uri?: string | null;
}

const SIZES: Record<AvatarSize, number> = { xs: 28, sm: 36, md: 44, lg: 56, xl: 72 };
const FONT_SIZES: Record<AvatarSize, number> = { xs: 10, sm: 13, md: 16, lg: 20, xl: 26 };

const ROLE_COLORS: Record<string, [string, string]> = {
  citizen: ["#208AEF", "#1558A8"],
  engineer: ["#7C3AED", "#5B21B6"],
  admin: ["#D97706", "#B45309"],
};

export function Avatar({ name = "?", size = "md", color, online = false, role, uri }: AvatarProps) {
  const { colors } = useTheme();
  const dim = SIZES[size];
  const fontSize = FONT_SIZES[size];

  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const [bg] = role
    ? (ROLE_COLORS[role] ?? [colors.brand, colors.brandMuted])
    : [color ?? colors.brand, colors.brandMuted];

  const onlineDotSize = size === "xs" ? 7 : size === "sm" ? 9 : 11;

  return (
    <View style={[s.root, { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: bg }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: dim, height: dim, borderRadius: dim / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[TextStyles.label, { fontSize, color: "#FFFFFF", fontWeight: "700" }]}>
          {initials}
        </Text>
      )}
      {online && (
        <View
          style={[
            s.onlineDot,
            {
              width: onlineDotSize,
              height: onlineDotSize,
              borderRadius: onlineDotSize / 2,
              borderColor: colors.bgSurface,
            },
          ]}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    backgroundColor: "#12B76A",
    borderWidth: 2,
  },
});
