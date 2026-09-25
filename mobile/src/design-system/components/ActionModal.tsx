import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { BlurView } from "expo-blur";
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useTheme } from "../ThemeContext";
import { TextStyles, Spacing, Radius } from "../tokens";
import { LumenIcon } from "../icons/LumenIcon";
import type { LumenIconName } from "../index";

interface ActionModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  icon?: LumenIconName;
  children: React.ReactNode;
}

export function ActionModal({ visible, onClose, title, icon, children }: ActionModalProps) {
  const { colors, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {visible && (
        <>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={StyleSheet.absoluteFill}
          >
            <BlurView
              intensity={isDark ? 30 : 20}
              tint={isDark ? "dark" : "light"}
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.3)" },
              ]}
            >
              <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </BlurView>
          </Animated.View>

          <View style={s.container} pointerEvents="box-none">
            <Animated.View
              entering={SlideInDown.springify().damping(20).stiffness(150)}
              exiting={SlideOutDown.duration(200)}
              style={[s.content, { backgroundColor: colors.bgBase, shadowColor: "#000" }]}
            >
              <View style={[s.handle, { backgroundColor: colors.borderDefault }]} />

              <View style={s.header}>
                {icon && (
                  <View style={[s.iconBox, { backgroundColor: colors.brand + "15" }]}>
                    <LumenIcon name={icon} size="sm" color={colors.brand} />
                  </View>
                )}
                <Text style={[TextStyles.heading2, { color: colors.textPrimary, flex: 1 }]}>
                  {title}
                </Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [
                    s.closeBtn,
                    { backgroundColor: colors.bgSubtle, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <LumenIcon name="close" size="sm" color={colors.textSecondary} />
                </Pressable>
              </View>

              <View style={s.body}>{children}</View>
            </Animated.View>
          </View>
        </>
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  content: {
    borderTopLeftRadius: Radius["3xl"],
    borderTopRightRadius: Radius["3xl"],
    paddingBottom: Spacing[10],
    paddingTop: Spacing[3],
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing[5],
    paddingBottom: Spacing[4],
    gap: Spacing[3],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: Spacing[5],
  },
});
