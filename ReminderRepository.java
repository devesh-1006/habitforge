package com.habitforge.reminder;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {
    List<Reminder> findAllByUser_IdOrderByDueAtAsc(UUID userId);
    Optional<Reminder> findByEvent_IdAndUser_Id(UUID eventId, UUID userId);
    Optional<Reminder> findByIdAndUser_Id(UUID id, UUID userId);
}
