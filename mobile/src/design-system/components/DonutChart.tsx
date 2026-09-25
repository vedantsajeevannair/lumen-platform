import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Circle, Svg } from "react-native-svg";
import { useTheme } from "../ThemeContext";

interface DonutChartProps {
  data: { value: number; color: string; label: string }[];
  size?: number;
  strokeWidth?: number;
  showLabels?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function DonutChart({
  data,
  size = 120,
  strokeWidth = 12,
  showLabels = true,
}: DonutChartProps) {
  const { colors, fontSize } = useTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let currentOffset = 0;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {data.map((item, index) => {
          const percentage = item.value / total;
          const strokeDasharray = percentage * circumference;
          const strokeDashoffset = -currentOffset;

          currentOffset += strokeDasharray;

          return (
            <Circle
              key={`donut-slice-${index}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${strokeDasharray} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
      {showLabels && (
        <View style={styles.legend}>
          {data.map((item, index) => {
            const legendKey = `legend-${index}`;
            return (
              <View key={legendKey} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                <Text
                  style={[
                    styles.legendLabel,
                    { color: colors.textSecondary, fontSize: fontSize.sm },
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  legend: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 12,
  },
});
