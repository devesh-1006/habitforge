package com.habitforge.habit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HabitCompletionRepository extends JpaRepository<HabitCompletion, UUID> {
    List<HabitCompletion> findAllByHabit_IdOrderByCompletedOnAsc(UUID habitId);
    List<HabitCompletion> findAllByUser_IdAndCompletedOnBetween(UUID userId, LocalDate from, LocalDate to);
    Optional<HabitCompletion> findByHabit_IdAndUser_IdAndCompletedOn(UUID habitId, UUID userId, LocalDate date);
}
