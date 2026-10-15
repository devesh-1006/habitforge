package com.habitforge.event;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PlannerEventRepository extends JpaRepository<PlannerEvent, UUID> {
    List<PlannerEvent> findAllByUser_IdOrderByStartAtAsc(UUID userId);
    Optional<PlannerEvent> findByIdAndUser_Id(UUID id, UUID userId);
}
