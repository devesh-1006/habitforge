package com.habitforge.event;

import com.habitforge.reminder.Reminder;
import com.habitforge.reminder.ReminderRepository;
import com.habitforge.user.AppUser;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.DateTimeException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class EventService {
    public record EventRequest(String title, String description, String startAt, String endAt,
                               boolean allDay, String location, String category, String color,
                               Integer reminderMinutes, String timezoneId) {}
    public record EventResponse(UUID id, String title, String description, String startAt, String endAt,
                                boolean allDay, String location, String category, String color,
                                Integer reminderMinutes, String timezoneId) {}

    private static final Pattern COLOR = Pattern.compile("^#[0-9a-fA-F]{6}$");
    private final PlannerEventRepository events;
    private final ReminderRepository reminders;

    public EventService(PlannerEventRepository events, ReminderRepository reminders) {
        this.events = events;
        this.reminders = reminders;
    }

    @Transactional(readOnly = true)
    public List<EventResponse> list(AppUser user, LocalDate from, LocalDate to) {
        return events.findAllByUser_IdOrderByStartAtAsc(user.getId()).stream()
                .filter(event -> from == null || !event.getEndAt().toLocalDate().isBefore(from))
                .filter(event -> to == null || !event.getStartAt().toLocalDate().isAfter(to))
                .map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public EventResponse get(UUID id, AppUser user) {
        return response(owned(id, user));
    }

    @Transactional
    public EventResponse create(EventRequest request, AppUser user) {
        PlannerEvent event = new PlannerEvent();
        event.setId(UUID.randomUUID());
        event.setUser(user);
        event.setCreatedAt(Instant.now());
        apply(event, request);
        PlannerEvent saved = events.save(event);
        synchronizeReminder(saved);
        return response(saved);
    }

    @Transactional
    public EventResponse update(UUID id, EventRequest request, AppUser user) {
        PlannerEvent event = owned(id, user);
        apply(event, request);
        event.setUpdatedAt(Instant.now());
        synchronizeReminder(event);
        return response(event);
    }

    @Transactional
    public void delete(UUID id, AppUser user) {
        events.delete(owned(id, user));
    }

    private void synchronizeReminder(PlannerEvent event) {
        var existing = reminders.findByEvent_IdAndUser_Id(event.getId(), event.getUser().getId());
        if (event.getReminderMinutes() == null) {
            existing.ifPresent(reminders::delete);
            return;
        }
        Reminder reminder = existing.orElseGet(() -> {
            Reminder created = new Reminder();
            created.setId(UUID.randomUUID());
            created.setEvent(event);
            created.setUser(event.getUser());
            return created;
        });
        reminder.setDueAt(event.getStartAt().atZone(ZoneId.of(event.getTimezoneId())).toInstant()
                .minusSeconds(event.getReminderMinutes() * 60L));
        reminder.setStatus("UPCOMING");
        reminders.save(reminder);
    }

    private void apply(PlannerEvent event, EventRequest request) {
        if (request.title() == null || request.title().trim().length() < 2 || request.title().trim().length() > 160)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event title must contain 2 to 160 characters.");
        if (request.category() == null || request.category().isBlank() || request.category().length() > 60)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose an event category.");
        if (request.color() == null || !COLOR.matcher(request.color()).matches())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid six-digit color.");
        if (request.description() != null && request.description().length() > 2000)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event description is too long.");
        if (request.location() != null && request.location().length() > 250)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event location is too long.");
        if (request.reminderMinutes() != null && !List.of(0, 5, 15, 60).contains(request.reminderMinutes()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported reminder time.");
        String zone = request.timezoneId() == null || request.timezoneId().isBlank() ? "UTC" : request.timezoneId();
        try {
            ZoneId.of(zone);
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a valid time zone.");
        }
        LocalDateTime start;
        LocalDateTime end;
        try {
            if (request.allDay()) {
                LocalDate startDate = LocalDate.parse(request.startAt());
                LocalDate endDate = request.endAt() == null || request.endAt().isBlank()
                        ? startDate : LocalDate.parse(request.endAt());
                if (endDate.isBefore(startDate))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event cannot end before it starts.");
                start = startDate.atStartOfDay();
                end = endDate.plusDays(1).atStartOfDay();
            } else {
                start = LocalDateTime.parse(request.startAt());
                end = LocalDateTime.parse(request.endAt());
                if (end.isBefore(start))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event cannot end before it starts.");
                ZoneId eventZone = ZoneId.of(zone);
                if (eventZone.getRules().getValidOffsets(start).isEmpty()
                        || eventZone.getRules().getValidOffsets(end).isEmpty())
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That local time does not exist because of a daylight-saving transition.");
            }
        } catch (DateTimeException exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enter valid event dates and times.");
        }
        event.setTitle(request.title().trim());
        event.setDescription(request.description());
        event.setStartAt(start);
        event.setEndAt(end);
        event.setAllDay(request.allDay());
        event.setLocation(request.location());
        event.setCategory(request.category().trim());
        event.setColor(request.color());
        event.setReminderMinutes(request.reminderMinutes());
        event.setTimezoneId(zone);
        event.setUpdatedAt(Instant.now());
    }

    private EventResponse response(PlannerEvent event) {
        ZoneId zone = ZoneId.of(event.getTimezoneId());
        String start = event.isAllDay() ? event.getStartAt().toLocalDate().toString()
                : event.getStartAt().atZone(zone).toOffsetDateTime().toString();
        String end = event.isAllDay() ? event.getEndAt().toString()
                : event.getEndAt().atZone(zone).toOffsetDateTime().toString();
        return new EventResponse(event.getId(), event.getTitle(), event.getDescription(), start, end,
                event.isAllDay(), event.getLocation(), event.getCategory(), event.getColor(),
                event.getReminderMinutes(), event.getTimezoneId());
    }

    private PlannerEvent owned(UUID id, AppUser user) {
        return events.findByIdAndUser_Id(id, user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found."));
    }
}
