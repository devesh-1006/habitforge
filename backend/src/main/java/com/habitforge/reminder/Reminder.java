package com.habitforge.reminder;

import com.habitforge.event.PlannerEvent;
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
import java.util.UUID;

@Entity
@Table(name = "reminders", uniqueConstraints = @UniqueConstraint(name = "uq_reminder_event", columnNames = "event_id"))
@Getter
@Setter
@NoArgsConstructor
public class Reminder {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private PlannerEvent event;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;
    @Column(name = "due_at", nullable = false)
    private Instant dueAt;
    @Column(nullable = false, length = 20)
    private String status;
}
