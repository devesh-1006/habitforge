package com.habitforge.habit;

import java.time.LocalDate;
import java.util.Set;

public final class HabitMetrics {
    private HabitMetrics() {}

    public static int currentStreak(Set<LocalDate> completions, Set<Integer> weekdays, LocalDate today) {
        if (weekdays.isEmpty()) return 0;
        LocalDate cursor = today;
        if (isScheduled(cursor, weekdays) && !completions.contains(cursor)) cursor = cursor.minusDays(1);
        while (!isScheduled(cursor, weekdays) && cursor.isAfter(today.minusDays(7))) cursor = cursor.minusDays(1);
        int streak = 0;
        for (int checked = 0; checked < 3660 && !cursor.isBefore(today.minusDays(3660)); cursor = cursor.minusDays(1)) {
            if (!isScheduled(cursor, weekdays)) continue;
            if (!completions.contains(cursor)) break;
            streak++;
        }
        return streak;
    }

    public static int longestStreak(Set<LocalDate> completions, Set<Integer> weekdays) {
        int longest = 0;
        for (LocalDate completion : completions) {
            if (!isScheduled(completion, weekdays)) continue;
            int streak = 1;
            LocalDate previous = previousScheduledDay(completion, weekdays);
            while (completions.contains(previous)) {
                streak++;
                previous = previousScheduledDay(previous, weekdays);
            }
            longest = Math.max(longest, streak);
        }
        return longest;
    }

    public static int completionRate(Set<LocalDate> completions, Set<Integer> weekdays, LocalDate from, LocalDate to) {
        int scheduled = 0;
        int completed = 0;
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            if (isScheduled(day, weekdays)) {
                scheduled++;
                if (completions.contains(day)) completed++;
            }
        }
        return scheduled == 0 ? 0 : Math.round(completed * 100.0f / scheduled);
    }

    private static LocalDate previousScheduledDay(LocalDate date, Set<Integer> weekdays) {
        LocalDate previous = date.minusDays(1);
        while (!isScheduled(previous, weekdays)) previous = previous.minusDays(1);
        return previous;
    }

    private static boolean isScheduled(LocalDate date, Set<Integer> weekdays) {
        return weekdays.contains(date.getDayOfWeek().getValue() % 7);
    }
}
