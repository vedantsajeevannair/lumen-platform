import React from "react";
import { StyleSheet, View } from "react-native";
import { Defs, Path, Stop, Svg, LinearGradient as SvgLinearGradient } from "react-native-svg";
import { useTheme } from "../ThemeContext";

interface LineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showGradient?: boolean;
  showPoints?: boolean;
}

export function LineChart({
  data,
  width = 300,
  height = 120,
  color,
  showGradient = true,
  showPoints = true,
}: LineChartProps) {
  const { colors } = useTheme();
  const chartColor = color || colors.brand;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const pathData = `M ${points.join(" L ")}`;

  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          {showGradient && (
            <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={chartColor} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={chartColor} stopOpacity="0" />
            </SvgLinearGradient>
          )}
        </Defs>
        {showGradient && (
          <Path
            d={`${pathData} L ${width},${height} L 0,${height} Z`}
            fill={`url(#${gradientId})`}
          />
        )}
        <Path
          d={pathData}
          fill="none"
          stroke={chartColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {showPoints &&
          data.map((value, index) => {
            const x = (index / (data.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            const pointKey = `point-${index}`;
            return (
              <Path
                key={pointKey}
                d={`M ${x - 4},${y} L ${x + 4},${y} M ${x},${y - 4} L ${x},${y + 4}`}
                stroke={chartColor}
                strokeWidth={2}
                strokeLinecap="round"
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
