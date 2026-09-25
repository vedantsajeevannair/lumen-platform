import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useTheme } from "../ThemeContext";
import { FilterChip } from "./FilterChip";

type TimeFilterValue = "week" | "month" | "year" | "all";

interface TimeFilterProps {
  value?: TimeFilterValue;
  onChange?: (value: TimeFilterValue) => void;
}

export function TimeFilter({ value = "week", onChange }: TimeFilterProps) {
  const { spacing } = useTheme();

  const filters: { label: string; value: TimeFilterValue }[] = [
    { label: "This Week", value: "week" },
    { label: "This Month", value: "month" },
    { label: "This Year", value: "year" },
    { label: "All Time", value: "all" },
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.container, { gap: spacing[2] }]}
    >
      {filters.map((filter) => {
        const filterKey = filter.value;
        return (
          <FilterChip
            label={filter.label}
            selected={value === filter.value}
            onToggle={() => onChange?.(filter.value)}
          />
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
