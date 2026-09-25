import React from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "../ThemeContext";

interface IconProps {
  icon: React.ReactNode;
  size?: number;
  color?: string;
  backgroundColor?: string;
}

export function Icon({ icon, size = 24, color, backgroundColor }: IconProps) {
  const { colors } = useTheme();
  const iconColor = color || colors.textSecondary;

  if (backgroundColor) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor,
          },
        ]}
      >
        <View style={styles.iconWrapper}>
          {React.cloneElement(icon as React.ReactElement<any>, { size, color: iconColor })}
        </View>
      </View>
    );
  }

  return React.cloneElement(icon as React.ReactElement<any>, { size, color: iconColor });
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
});
