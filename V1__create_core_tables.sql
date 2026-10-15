CREATE TABLE users (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE habits (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    description VARCHAR(1000),
    category VARCHAR(60) NOT NULL,
    color VARCHAR(7) NOT NULL,
    target VARCHAR(120),
    weekdays VARCHAR(20) NOT NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT habit_weekdays_nonempty CHECK (weekdays <> '')
);

CREATE TABLE habit_completions (
    id UUID PRIMARY KEY,
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_on DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_habit_completion UNIQUE (habit_id, completed_on)
);
CREATE INDEX idx_habit_completions_user_date ON habit_completions(user_id, completed_on);

CREATE TABLE planner_events (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(2000),
    start_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    end_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT FALSE,
    location VARCHAR(250),
    category VARCHAR(60) NOT NULL,
    color VARCHAR(7) NOT NULL,
    reminder_minutes INTEGER,
    timezone_id VARCHAR(80) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT event_end_not_before_start CHECK (end_at >= start_at),
    CONSTRAINT event_reminder_range CHECK (reminder_minutes IS NULL OR reminder_minutes IN (0, 5, 15, 60))
);
CREATE INDEX idx_planner_events_user_start ON planner_events(user_id, start_at);

CREATE TABLE reminders (
    id UUID PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE REFERENCES planner_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    due_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT reminder_status_valid CHECK (status IN ('UPCOMING', 'DISMISSED', 'COMPLETED'))
);
CREATE INDEX idx_reminders_user_due ON reminders(user_id, due_at);
