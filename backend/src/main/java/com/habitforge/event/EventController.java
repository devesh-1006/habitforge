package com.habitforge.event;

import com.habitforge.user.AppUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/events")
public class EventController {
    public record EventPayload(@NotBlank @Size(min = 2, max = 160) String title,
                               @Size(max = 2000) String description,
                               @NotBlank String startAt, @NotBlank String endAt,
                               boolean allDay, @Size(max = 250) String location,
                               @NotBlank @Size(max = 60) String category,
                               @NotBlank @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color,
                               Integer reminderMinutes, @Size(max = 80) String timezoneId) {}

    private final EventService service;

    public EventController(EventService service) {
        this.service = service;
    }

    @GetMapping
    public java.util.List<EventService.EventResponse> list(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal AppUser user) {
        if (from != null && to != null && to.isBefore(from))
            throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "End date cannot be before start date.");
        return service.list(user, from, to);
    }

    @GetMapping("/{id}")
    public EventService.EventResponse get(@PathVariable UUID id, @AuthenticationPrincipal AppUser user) {
        return service.get(id, user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventService.EventResponse create(@Valid @RequestBody EventPayload request, @AuthenticationPrincipal AppUser user) {
        return service.create(toRequest(request), user);
    }

    @PutMapping("/{id}")
    public EventService.EventResponse update(@PathVariable UUID id, @Valid @RequestBody EventPayload request, @AuthenticationPrincipal AppUser user) {
        return service.update(id, toRequest(request), user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AppUser user) {
        service.delete(id, user);
    }

    private EventService.EventRequest toRequest(EventPayload payload) {
        return new EventService.EventRequest(payload.title(), payload.description(), payload.startAt(), payload.endAt(),
                payload.allDay(), payload.location(), payload.category(), payload.color(), payload.reminderMinutes(), payload.timezoneId());
    }
}
