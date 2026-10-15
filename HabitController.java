package com.habitforge.habit;

import com.habitforge.user.AppUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/habits")
public class HabitController {
    public record HabitPayload(@NotBlank @Size(min = 2, max = 120) String name,
                               @Size(max = 1000) String description,
                               @NotBlank @Size(max = 60) String category,
                               @NotBlank @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color,
                               @Size(max = 120) String target,
                               @NotEmpty Set<Integer> weekdays) {}
    private final HabitService service;

    public HabitController(HabitService service) {
        this.service = service;
    }

    @GetMapping
    public List<HabitService.HabitResponse> list(@AuthenticationPrincipal AppUser user,
                                                  @RequestHeader(name = "X-Time-Zone", required = false) String timezone) {
        return service.list(user, service.userZone(timezone));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HabitService.HabitResponse create(@Valid @RequestBody HabitPayload request, @AuthenticationPrincipal AppUser user,
                                              @RequestHeader(name = "X-Time-Zone", required = false) String timezone) {
        return service.create(user, toRequest(request), service.userZone(timezone));
    }

    @PutMapping("/{id}")
    public HabitService.HabitResponse update(@PathVariable UUID id, @Valid @RequestBody HabitPayload request,
                                              @AuthenticationPrincipal AppUser user,
                                              @RequestHeader(name = "X-Time-Zone", required = false) String timezone) {
        return service.update(id, user, toRequest(request), service.userZone(timezone));
    }

    @PostMapping("/{id}/archive")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void archive(@PathVariable UUID id, @AuthenticationPrincipal AppUser user) {
        service.archive(id, user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @AuthenticationPrincipal AppUser user) {
        service.delete(id, user);
    }

    @PutMapping("/{id}/completions/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void complete(@PathVariable UUID id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                         @AuthenticationPrincipal AppUser user) {
        service.complete(id, date, user);
    }

    @DeleteMapping("/{id}/completions/{date}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reverse(@PathVariable UUID id, @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                        @AuthenticationPrincipal AppUser user) {
        service.reverse(id, date, user);
    }

    @GetMapping("/{id}/completions")
    public Set<LocalDate> history(@PathVariable UUID id,
                                  @org.springframework.web.bind.annotation.RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @org.springframework.web.bind.annotation.RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @AuthenticationPrincipal AppUser user) {
        if (to.isBefore(from)) throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST, "End date cannot be before start date.");
        return service.history(id, from, to, user);
    }

    private HabitService.HabitRequest toRequest(HabitPayload payload) {
        return new HabitService.HabitRequest(payload.name(), payload.description(), payload.category(),
                payload.color(), payload.target(), payload.weekdays());
    }
}
