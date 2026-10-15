package com.habitforge.reminder;

import com.habitforge.user.AppUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reminders")
public class ReminderController {
    public record ReminderResponse(UUID id, UUID eventId, String eventTitle, OffsetDateTime dueAt, String status) {}
    public record ReminderUpdate(@NotBlank String status) {}

    private final ReminderRepository reminders;

    public ReminderController(ReminderRepository reminders) {
        this.reminders = reminders;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<ReminderResponse> list(@AuthenticationPrincipal AppUser user) {
        return reminders.findAllByUser_IdOrderByDueAtAsc(user.getId()).stream().map(reminder -> {
            String status = reminder.getStatus();
            ZoneId eventZone = ZoneId.of(reminder.getEvent().getTimezoneId());
            if (status.equals("UPCOMING") && reminder.getDueAt().isBefore(Instant.now()))
                status = "OVERDUE";
            return new ReminderResponse(reminder.getId(), reminder.getEvent().getId(),
                    reminder.getEvent().getTitle(), reminder.getDueAt().atZone(eventZone).toOffsetDateTime(), status);
        }).toList();
    }

    @PatchMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void update(@PathVariable UUID id, @Valid @RequestBody ReminderUpdate request,
                       @AuthenticationPrincipal AppUser user) {
        if (!List.of("DISMISSED", "COMPLETED").contains(request.status()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Reminder status must be DISMISSED or COMPLETED.");
        Reminder reminder = reminders.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reminder not found."));
        reminder.setStatus(request.status());
    }
}
