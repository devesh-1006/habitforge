package com.habitforge.event;

import com.habitforge.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "planner_events")
@Getter
@Setter
@NoArgsConstructor
public class PlannerEvent {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;
    @Column(nullable = false, length = 160)
    private String title;
    @Column(length = 2000)
    private String description;
    @Column(name = "start_at", nullable = false)
    private LocalDateTime startAt;
    @Column(name = "end_at", nullable = false)
    private LocalDateTime endAt;
    @Column(name = "all_day", nullable = false)
    private boolean allDay;
    @Column(length = 250)
    private String location;
    @Column(nullable = false, length = 60)
    private String category;
    @Column(nullable = false, length = 7)
    private String color;
    @Column(name = "reminder_minutes")
    private Integer reminderMinutes;
    @Column(name = "timezone_id", nullable = false, length = 80)
    private String timezoneId;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
