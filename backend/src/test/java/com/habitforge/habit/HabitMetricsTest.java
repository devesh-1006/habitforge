package com.habitforge.habit;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;

class HabitMetricsTest {
    @Test
    void streaksSkipUnscheduledWeekdays() {
        Set<Integer> mondayWednesdayFriday = Set.of(1, 3, 5);
        Set<LocalDate> completed = Set.of(
                LocalDate.parse("2024-04-03"),
                LocalDate.parse("2024-04-05"),
                LocalDate.parse("2024-04-08"));

        assertEquals(3, HabitMetrics.currentStreak(completed, mondayWednesdayFriday, LocalDate.parse("2024-04-08")));
        assertEquals(3, HabitMetrics.longestStreak(completed, mondayWednesdayFriday));
    }

    @Test
    void currentStreakAllowsTodayToBeCompletedLater() {
        Set<Integer> weekdays = Set.of(1, 3, 5);
        Set<LocalDate> completed = Set.of(LocalDate.parse("2024-04-05"));

        assertEquals(1, HabitMetrics.currentStreak(completed, weekdays, LocalDate.parse("2024-04-08")));
        assertEquals(0, HabitMetrics.currentStreak(completed, weekdays, LocalDate.parse("2024-04-10")));
    }

    @Test
    void completionRateUsesOnlyScheduledDaysAcrossLeapDayAndMonthBoundary() {
        Set<Integer> weekdays = Set.of(1, 3, 5);
        Set<LocalDate> completed = Set.of(LocalDate.parse("2024-02-26"), LocalDate.parse("2024-03-01"));

        assertEquals(67, HabitMetrics.completionRate(completed, weekdays,
                LocalDate.parse("2024-02-26"), LocalDate.parse("2024-03-02")));
    }

    @Test
    void noScheduledDaysProducesZeroRate() {
        assertEquals(0, HabitMetrics.completionRate(Set.of(), Set.of(),
                LocalDate.parse("2024-01-01"), LocalDate.parse("2024-01-31")));
    }
}
