package com.habitforge.habit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HabitRepository extends JpaRepository<Habit, UUID> {
    List<Habit> findAllByUser_IdAndArchivedFalseOrderByCreatedAtDesc(UUID userId);
    Optional<Habit> findByIdAndUser_Id(UUID id, UUID userId);
    List<Habit> findAllByUser_Id(UUID userId);
}
