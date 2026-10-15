package com.habitforge.habit;

import com.habitforge.user.AppUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class HabitService {
    public record HabitRequest(String name, String description, String category, String color,
                               String target, Set<Integer> weekdays) {}
    public record HabitResponse(UUID id, String name, String description, String category, String color,
                                String target, Set<Integer> weekdays, Set<LocalDate> completedDates,
                                int currentStreak, int longestStreak, int completionRate) {}

    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private final HabitRepository habits;
    private final HabitCompletionRepository completions;

    public HabitService(HabitRepository habits, HabitCompletionRepository completions) {
        this.habits = habits;
        this.completions = completions;
    }

    @Transactional(readOnly = true)
    public List<HabitResponse> list(AppUser user, ZoneId zone) {
        return habits.findAllByUser_IdAndArchivedFalseOrderByCreatedAtDesc(user.getId()).stream()
                .map(habit -> toResponse(habit, zone)).toList();
    }

    @Transactional
    public HabitResponse create(AppUser user, HabitRequest request, ZoneId zone) {
        validate(request);
        Instant now = Instant.now();
        Habit habit = new Habit();
        habit.setId(UUID.randomUUID());
        habit.setUser(user);
        habit.setCreatedAt(now);
        habit.setUpdatedAt(now);
        apply(habit, request);
        return toResponse(habits.save(habit), zone);
    }

    @Transactional
    public HabitResponse update(UUID id, AppUser user, HabitRequest request, ZoneId zone) {
        validate(request);
        Habit habit = owned(id, user);
        apply(habit, request);
        habit.setUpdatedAt(Instant.now());
        return toResponse(habit, zone);
    }

    @Transactional
    public void archive(UUID id, AppUser user) {
        Habit habit = owned(id, user);
        habit.setArchived(true);
        habit.setUpdatedAt(Instant.now());
    }

    @Transactional
    public void delete(UUID id, AppUser user) {
        habits.delete(owned(id, user));
    }

    @Transactional
    public void complete(UUID id, LocalDate date, AppUser user) {
        Habit habit = owned(id, user);
        if (completions.findByHabit_IdAndUser_IdAndCompletedOn(id, user.getId(), date).isPresent()) return;
        HabitCompletion completion = new HabitCompletion();
        completion.setId(UUID.randomUUID());
        completion.setHabit(habit);
        completion.setUser(user);
        completion.setCompletedOn(date);
        completion.setCreatedAt(Instant.now());
        completions.save(completion);
    }

    @Transactional
    public void reverse(UUID id, LocalDate date, AppUser user) {
        owned(id, user);
        completions.findByHabit_IdAndUser_IdAndCompletedOn(id, user.getId(), date).ifPresent(completions::delete);
    }

    @Transactional(readOnly = true)
    public Set<LocalDate> history(UUID id, LocalDate from, LocalDate to, AppUser user) {
        owned(id, user);
        return completions.findAllByHabit_IdOrderByCompletedOnAsc(id).stream()
                .map(HabitCompletion::getCompletedOn)
                .filter(date -> !date.isBefore(from) && !date.isAfter(to))
                .collect(java.util.stream.Collectors.toSet());
    }

    @Transactional(readOnly = true)
    public List<Habit> activeHabits(AppUser user) {
        return habits.findAllByUser_IdAndArchivedFalseOrderByCreatedAtDesc(user.getId());
    }

    private Habit owned(UUID id, AppUser user) {
        return habits.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Habit not found."));
    }

    private void validate(HabitRequest request) {
        if (request.name() == null || request.name().trim().length() < 2 || request.name().trim().length() > 120)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Habit name must contain 2 to 120 characters.");
        if (request.category() == null || request.category().isBlank() || request.category().length() > 60)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a habit category.");
        if (request.color() == null || !COLOR.matcher(request.color()).matches())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid six-digit color.");
        if (request.weekdays() == null || request.weekdays().isEmpty() || request.weekdays().stream().anyMatch(day -> day < 0 || day > 6))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose at least one valid weekday.");
        if (request.description() != null && request.description().length() > 1000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Description is too long.");
    }

    private void apply(Habit habit, HabitRequest request) {
        habit.setName(request.name().trim());
        habit.setDescription(request.description());
        habit.setCategory(request.category().trim());
        habit.setColor(request.color());
        habit.setTarget(request.target());
        habit.weekdays(request.weekdays());
    }

    public ZoneId userZone(String value) {
        if (value == null || value.isBlank()) return ZoneId.systemDefault();
        try {
            return ZoneId.of(value);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid time zone.");
        }
    }

    private HabitResponse toResponse(Habit habit, ZoneId zone) {
        Set<LocalDate> allDates = completions.findAllByHabit_IdOrderByCompletedOnAsc(habit.getId()).stream()
                .map(HabitCompletion::getCompletedOn).collect(java.util.stream.Collectors.toSet());
        LocalDate today = LocalDate.now(zone);
        Set<LocalDate> recent = allDates.stream().filter(date -> !date.isBefore(today.minusDays(365))).collect(java.util.stream.Collectors.toSet());
        Set<Integer> weekdays = habit.weekdays();
        return new HabitResponse(habit.getId(), habit.getName(), habit.getDescription(), habit.getCategory(),
                habit.getColor(), habit.getTarget(), weekdays, recent,
                HabitMetrics.currentStreak(allDates, weekdays, today),
                HabitMetrics.longestStreak(allDates, weekdays),
                HabitMetrics.completionRate(allDates, weekdays, today.minusDays(29), today));
    }
}
