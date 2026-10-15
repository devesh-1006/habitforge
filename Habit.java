package com.habitforge.habit;

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
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Entity
@Table(name = "habits")
@Getter
@Setter
@NoArgsConstructor
public class Habit {
    @Id
    private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(length = 1000)
    private String description;
    @Column(nullable = false, length = 60)
    private String category;
    @Column(nullable = false, length = 7)
    private String color;
    @Column(length = 120)
    private String target;
    @Column(name = "weekdays", nullable = false, length = 20)
    private String weekdayValues;
    @Column(nullable = false)
    private boolean archived;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Set<Integer> weekdays() {
        return Arrays.stream(weekdayValues.split(",")).map(Integer::parseInt).collect(Collectors.toSet());
    }

    public void weekdays(Set<Integer> days) {
        weekdayValues = days.stream().sorted().map(String::valueOf).collect(Collectors.joining(","));
    }
}
