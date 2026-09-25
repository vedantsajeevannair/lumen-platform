import React from "react";
import { StyleSheet, View } from "react-native";
import { Defs, Rect, Stop, Svg, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { useTheme } from "../ThemeContext";

interface BarChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
  barWidth?: number;
  spacing?: number;
}

export function BarChart({
  data,
  width = 300,
  height = 120,
  color,
  showGradient = true,
  barWidth = 20,
  spacing = 8,
}: BarChartProps) {
  const { colors } = useTheme();
  const chartColor = color || colors.brand;

  const max = Math.max(...data);
  const totalWidth = data.length * barWidth + (data.length - 1) * spacing;
  const startX = (width - totalWidth) / 2;

  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          {showGradient && (
            <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={chartColor} stopOpacity="1" />
              <Stop offset="100%" stopColor={chartColor} stopOpacity="0.6" />
            </SvgLinearGradient>
          )}
        </Defs>
        {data.map((value, index) => {
          const barHeight = (value / max) * height;
          const x = startX + index * (barWidth + spacing);
          const y = height - barHeight;
          return (
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={showGradient ? `url(#${gradientId})` : chartColor}
              rx={4}
            />
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
