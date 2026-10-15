package com.habitforge.habit;

import com.habitforge.user.AppUser;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "habit_completions", uniqueConstraints = @UniqueConstraint(name = "uq_habit_completion", columnNames = {"habit_id", "completed_on"}))
@Getter
@Setter
@NoArgsConstructor
public class HabitCompletion {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "habit_id", nullable = false)
    private Habit habit;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;
    @Column(name = "completed_on", nullable = false)
    private LocalDate completedOn;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
