// ============================================================
// LUMEN Design System — Production Bottom Navigation
// ============================================================

import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../ThemeContext";
import { LumenIcon, type LumenIconName } from "../icons/LumenIcon";
import { Spacing } from "../tokens";

export interface NavItem {
  name: string;
  icon: LumenIconName;
  label: string;
  isFAB?: boolean;
  /** Unread count shown on the icon. Omitted or 0 draws nothing. */
  badge?: number;
}

export interface BottomNavigationProps {
  items: NavItem[];
  activeTab: string;
  onTabPress: (name: string) => void;
  showFAB?: boolean;
  fabIcon?: LumenIconName;
  fabOnPress?: () => void;
}

interface TabItemProps {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}

function TabItem({ item, isActive, onPress, colors, isDark }: TabItemProps) {
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    activeProgress.value = withSpring(isActive ? 1 : 0, {
      damping: 18,
      stiffness: 150,
    });
  }, [isActive]);

  const handlePress = () => {
    onPress();
  };

  const iconStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: interpolate(activeProgress.value, [0, 1], [0, -6]) },
        { scale: interpolate(activeProgress.value, [0, 1], [1, 1.15]) },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    return {
      opacity: activeProgress.value,
      transform: [
        { scale: interpolate(activeProgress.value, [0, 1], [0.8, 1]) },
        { translateY: interpolate(activeProgress.value, [0, 1], [6, 0]) },
      ],
    };
  });

  const pillStyle = useAnimatedStyle(() => {
    return {
      opacity: activeProgress.value,
      transform: [{ scale: interpolate(activeProgress.value, [0, 1], [0.85, 1.05]) }],
    };
  });

  return (
    <Pressable onPress={handlePress} style={styles.tabItem}>
      <Animated.View
        style={
          [
            styles.pill,
            pillStyle,
            {
              backgroundColor: isDark ? "rgba(103, 179, 255, 0.12)" : "rgba(32, 138, 239, 0.08)",
            },
          ] as any
        }
      />
      <Animated.View style={[styles.iconWrapper, iconStyle] as any}>
        <LumenIcon
          name={item.icon}
          size="md"
          color={isActive ? colors.brand : colors.textTertiary}
          strokeWidth={isActive ? 2.3 : 1.8}
        />
        {!!item.badge && (
          <View style={[styles.badge, { backgroundColor: colors.errorText ?? "#D92D20" }]}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {item.badge > 9 ? "9+" : String(item.badge)}
            </Text>
          </View>
        )}
      </Animated.View>
      <Animated.View style={[styles.labelContainer, labelStyle] as any}>
        <Text style={[styles.label, { color: colors.brand }]} numberOfLines={1}>
          {item.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function FABItem({
  icon,
  onPress,
  colors,
}: {
  icon: LumenIconName;
  onPress: () => void;
  colors: any;
}) {
  const scaleValue = useSharedValue(1);

  const handlePressIn = () => {
    scaleValue.value = withSpring(0.9, { damping: 10 });
  };

  const handlePressOut = () => {
    scaleValue.value = withSpring(1, { damping: 10 });
  };

  const handlePress = () => {
    onPress();
  };

  const fabStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleValue.value }],
    };
  });

  return (
    <View style={styles.fabContainer}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.fabTouchTarget}
      >
        <Animated.View
          style={
            [
              styles.fab,
              fabStyle,
              {
                backgroundColor: colors.brand,
                // Grey, not brand-coloured: a shadow tinted with the button's
                // own colour reads as a glow around it rather than a shadow
                // under it.
                shadowColor: "#000000",
              },
            ] as any
          }
        >
          <LumenIcon name={icon} size="lg" color="#FFFFFF" strokeWidth={2} />
        </Animated.View>
      </Pressable>
    </View>
  );
}

export function BottomNavigation({
  items,
  activeTab,
  onTabPress,
  showFAB = false,
  fabIcon = "add",
  fabOnPress,
}: BottomNavigationProps) {
  const { colors, isDark, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const handleTabPress = (name: string, isFAB = false) => {
    if (isFAB) {
      fabOnPress?.();
    } else {
      onTabPress(name);
    }
  };

  const isTablet = width > 768;
  const navHeight = isTablet ? 80 : 70;
  const barWidth = isTablet ? 550 : width - Spacing[8];
  const bottomMargin = insets.bottom > 0 ? insets.bottom + Spacing[1] : Spacing[4];

  // Dynamic shadows
  const activeShadow = isDark ? shadows.lg : shadows.md;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <BlurView
        intensity={isDark ? 40 : 30}
        tint={isDark ? "dark" : "light"}
        style={[
          styles.shadowWrapper,
          {
            height: navHeight + insets.bottom,
            backgroundColor: isDark ? "rgba(15, 15, 25, 0.85)" : "rgba(255, 255, 255, 0.85)",
          },
        ]}
      >
        <LinearGradient
          colors={[
            isDark ? "rgba(30, 30, 50, 0.3)" : "rgba(255, 255, 255, 0.3)",
            isDark ? "rgba(20, 20, 35, 0.5)" : "rgba(248, 248, 252, 0.5)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          {items.map((item, index) => {
            const isCenterFAB = item.isFAB || (showFAB && index === Math.floor(items.length / 2));

            if (isCenterFAB) {
              return (
                <FABItem
                  key={item.name}
                  icon={item.isFAB ? item.icon : fabIcon}
                  onPress={() => handleTabPress(item.name, true)}
                  colors={colors}
                />
              );
            }

            const isActive = activeTab === item.name;

            return (
              <TabItem
                key={item.name}
                item={item}
                isActive={isActive}
                onPress={() => handleTabPress(item.name)}
                colors={colors}
                isDark={isDark}
              />
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  shadowWrapper: {
    overflow: "hidden",
  },
  navBar: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.05)",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    height: "100%",
    paddingHorizontal: Spacing[2],
  },
  tabItem: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  pill: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  labelContainer: {
    position: "absolute",
    bottom: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  fabContainer: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
    zIndex: 1010,
  },
  fabTouchTarget: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
  },
});
