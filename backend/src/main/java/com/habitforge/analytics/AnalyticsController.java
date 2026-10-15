package com.habitforge.analytics;

import com.habitforge.habit.Habit;
import com.habitforge.habit.HabitCompletion;
import com.habitforge.habit.HabitCompletionRepository;
import com.habitforge.habit.HabitService;
import com.habitforge.user.AppUser;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
    public record DayMetric(String label, int completed, int scheduled) {}
    public record MonthMetric(String label, int rate) {}
    public record ActivityMetric(LocalDate date, int count) {}
    public record AnalyticsResponse(int scheduledToday, int completedToday, int todayRate,
                                    List<DayMetric> weekly, List<MonthMetric> monthly,
                                    List<ActivityMetric> activity) {}

    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("EEE");
    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM");
    private final HabitService habits;
    private final HabitCompletionRepository completions;

    public AnalyticsController(HabitService habits, HabitCompletionRepository completions) {
        this.habits = habits;
        this.completions = completions;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public AnalyticsResponse summary(@AuthenticationPrincipal AppUser user,
                                     @RequestHeader(name = "X-Time-Zone", required = false) String timeZone) {
        ZoneId zone = zone(timeZone);
        LocalDate today = LocalDate.now(zone);
        List<Habit> active = habits.activeHabits(user);
        LocalDate historyStart = YearMonth.from(today).minusMonths(5).atDay(1);
        List<HabitCompletion> recent = completions.findAllByUser_IdAndCompletedOnBetween(
                user.getId(), historyStart, today);
        Map<java.util.UUID, Set<LocalDate>> datesByHabit = recent.stream().collect(
                Collectors.groupingBy(completion -> completion.getHabit().getId(),
                        Collectors.mapping(HabitCompletion::getCompletedOn, Collectors.toSet())));

        List<DayMetric> weekly = java.util.stream.IntStream.rangeClosed(0, 6).mapToObj(offset -> {
            LocalDate date = today.minusDays(6L - offset);
            int scheduled = scheduled(active, date);
            int completed = (int) active.stream().filter(habit -> datesByHabit
                    .getOrDefault(habit.getId(), Set.of()).contains(date)
                    && scheduled(habit, date)).count();
            return new DayMetric(date.format(DAY_LABEL), completed, scheduled);
        }).toList();

        YearMonth currentMonth = YearMonth.from(today);
        List<MonthMetric> monthly = java.util.stream.IntStream.rangeClosed(0, 5).mapToObj(offset -> {
            YearMonth month = currentMonth.minusMonths(5L - offset);
            LocalDate from = month.atDay(1);
            LocalDate to = month.equals(currentMonth) ? today : month.atEndOfMonth();
            int scheduled = 0;
            int complete = 0;
            for (LocalDate date = from; !date.isAfter(to); date = date.plusDays(1)) {
                LocalDate day = date;
                scheduled += scheduled(active, day);
                complete += (int) active.stream().filter(habit -> scheduled(habit, day)
                        && datesByHabit.getOrDefault(habit.getId(), Set.of()).contains(day)).count();
            }
            return new MonthMetric(month.format(MONTH_LABEL),
                    scheduled == 0 ? 0 : Math.round(complete * 100.0f / scheduled));
        }).toList();

        List<ActivityMetric> activity = java.util.stream.IntStream.rangeClosed(0, 83).mapToObj(offset -> {
            LocalDate date = today.minusDays(83L - offset);
            int count = (int) recent.stream().filter(completion -> completion.getCompletedOn().equals(date)).count();
            return new ActivityMetric(date, count);
        }).toList();
        int scheduledToday = scheduled(active, today);
        int completedToday = weekly.get(weekly.size() - 1).completed();
        return new AnalyticsResponse(scheduledToday, completedToday,
                scheduledToday == 0 ? 0 : Math.round(completedToday * 100.0f / scheduledToday),
                weekly, monthly, activity);
    }

    private int scheduled(List<Habit> habits, LocalDate date) {
        return (int) habits.stream().filter(habit -> scheduled(habit, date)).count();
    }

    private boolean scheduled(Habit habit, LocalDate date) {
        return habit.weekdays().contains(date.getDayOfWeek().getValue() % 7);
    }

    private ZoneId zone(String value) {
        if (value == null || value.isBlank()) return ZoneId.systemDefault();
        try {
            return ZoneId.of(value);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid time zone.");
        }
    }
}
