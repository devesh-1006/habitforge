package com.habitforge.event;

import com.habitforge.reminder.Reminder;
import com.habitforge.reminder.ReminderRepository;
import com.habitforge.user.AppUser;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import org.mockito.ArgumentCaptor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EventServiceTest {
    private final PlannerEventRepository events = mock(PlannerEventRepository.class);
    private final ReminderRepository reminders = mock(ReminderRepository.class);
    private final EventService service = new EventService(events, reminders);

    @Test
    void allDayEventUsesExclusiveEndAndReminderIsPersistedOnce() {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        when(events.save(any(PlannerEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reminders.findByEvent_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());

        EventService.EventResponse response = service.create(new EventService.EventRequest(
                "Leap day", null, "2024-02-29", "2024-02-29", true, null,
                "Personal", "#a4e276", 15, "Europe/London"), user);

        assertEquals("2024-02-29", response.startAt());
        assertEquals("2024-03-01T00:00", response.endAt());
        verify(reminders).save(any(Reminder.class));
    }

    @Test
    void timedEventRejectsEndBeforeStart() {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        assertThrows(ResponseStatusException.class, () -> service.create(new EventService.EventRequest(
                "Meeting", null, "2026-10-15T10:00:00", "2026-10-15T09:00:00",
                false, null, "Work", "#a4e276", null, "Asia/Kolkata"), user));
    }

    @Test
    void reminderOffsetUsesTheInstantAcrossDaylightSavingTransitions() {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());
        when(events.save(any(PlannerEvent.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(reminders.findByEvent_IdAndUser_Id(any(), any())).thenReturn(Optional.empty());

        service.create(new EventService.EventRequest("Clock change", null,
                "2024-03-31T03:00:00", "2024-03-31T04:00:00", false, null,
                "Personal", "#a4e276", 60, "Europe/London"), user);

        ArgumentCaptor<Reminder> saved = ArgumentCaptor.forClass(Reminder.class);
        verify(reminders).save(saved.capture());
        assertEquals(Instant.parse("2024-03-31T01:00:00Z"), saved.getValue().getDueAt());
    }

    @Test
    void rejectsTimedEventWithinDaylightSavingGap() {
        AppUser user = new AppUser();
        user.setId(UUID.randomUUID());

        assertThrows(ResponseStatusException.class, () -> service.create(new EventService.EventRequest(
                "Invalid local time", null, "2024-03-31T01:30:00", "2024-03-31T03:30:00",
                false, null, "Personal", "#a4e276", null, "Europe/London"), user));
    }
}
