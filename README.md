# HabitForge

HabitForge is a personal habit tracker, calendar, reminders panel, and productivity dashboard. It is a single React application backed by a conventional Spring Boot REST API and PostgreSQL database. The AI Coach is deliberately a clearly labeled **Work in Progress**: it does not call an AI service, create synthetic answers, or require an API key.

## What is implemented

- Email/password registration and sign-in, BCrypt password hashes, expiring signed JWTs, and user-scoped API lookups.
- Habit create/edit/archive/delete, weekday schedules, daily completions, a 30-day history screen, and schedule-aware streak/rate calculations. Editing a habit leaves completion records intact; permanent delete explicitly removes them.
- Month, week, and day calendar views, recurring weekday habit indicators, all-day and timed events, event create/edit/delete/detail, local time zone capture, categories, and reminders.
- Persisted in-app reminder records with upcoming/overdue status and dismiss/complete actions. Browser notification permission is requested only by the user; notifications require the app to be open when a reminder becomes due.
- Dashboard and analytics are calculated from database records. New accounts start empty; there are no fake dashboard numbers or bundled demo records.
- Responsive dark UI, keyboard-operable controls, client-side Zod validation, API error messages, confirmation prompts, empty states, and charts.
- Flyway schema migration, OpenAPI/Swagger UI, PostgreSQL Docker Compose configuration, Java 21 Dockerfile, and GitHub Actions checks.

The initial release does not include recurring events, event export/import, password reset, profile editing, server-side push/email notifications, notification delivery while the browser is closed, or AI coaching. Browser notifications are best-effort and are not a replacement for a server notification provider. Existing reminders are not automatically delivered after the app has been closed.

## Requirements

- Node.js 22 or newer and npm.
- Java 21 and Maven 3.9+ for the local backend, **or** Docker Desktop with Compose for the API and PostgreSQL containers.
- PostgreSQL 16+ if running the backend directly without Compose.

HabitForge was scaffolded in an environment with Node.js 25, Java 17, and Maven 3.9.9; Docker and PostgreSQL were unavailable. The backend sources target Java 21. Backend compilation, Flyway migration execution, and API integration tests were verified with a Java 17 compatibility override and H2; run them again with Java 21 and PostgreSQL before deployment.

## Run locally (PowerShell)

1. Copy `.env.example` to `.env`. Use a local-only password and generate a fresh signing key:

   ```powershell
   Copy-Item .env.example .env
   $bytes = [byte[]]::new(32)
   [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
   $secret = [Convert]::ToBase64String($bytes)
   ```

   Edit `.env` and replace `DATABASE_PASSWORD` and `JWT_SECRET` with your local password and `$secret`. Do not commit `.env`. The JWT secret must be a base64-encoded random key of at least 32 bytes. `CORS_ALLOWED_ORIGINS` defaults to the Vite origin `http://localhost:5173`; for a different frontend origin, set it to that origin (or a comma-separated list of allowed origins).

2. Start PostgreSQL and the API using Compose:

   ```powershell
   docker compose up --build
   ```

   Compose waits for PostgreSQL's health check before starting the API. Flyway creates the schema automatically on API startup. The API listens on `http://localhost:8080`; the interactive OpenAPI page is `http://localhost:8080/swagger-ui.html`.

3. In a second terminal, install and start the frontend:

   ```powershell
   npm ci
   Copy-Item .env.example .env.local
   npm run dev
   ```

   Open the Vite URL (normally `http://localhost:5173`). The frontend uses `VITE_API_URL` from `.env.local`; its default is `http://localhost:8080/api`.

To stop containers, use `docker compose down`. To also erase the local PostgreSQL data, use `docker compose down -v` (this permanently removes the named database volume).

### Run with an already installed PostgreSQL and Java/Maven

Create a PostgreSQL database and user that match your local configuration. Flyway applies migrations on startup; do not use Hibernate schema auto-generation. Set these variables before launching the API in PowerShell:

```powershell
$env:DATABASE_URL = 'jdbc:postgresql://localhost:5432/habitforge'
$env:DATABASE_USERNAME = 'habitforge'
$env:DATABASE_PASSWORD = 'your-local-database-password'
$env:JWT_SECRET = 'your-base64-encoded-random-32-byte-key'
Set-Location backend
mvn spring-boot:run
```

The backend stores calendar wall-clock dates/times as local values plus an IANA time-zone identifier captured at event creation. All-day dates are stored as local midnight values with an exclusive end in storage and are shown with an inclusive end date in the form. This avoids UTC-midnight conversions changing the calendar day. Nonexistent local times during daylight-saving jumps are rejected; ambiguous fall-back times use the earlier valid offset. Habit schedule dates are interpreted in the browser's reported time zone. Keep the device's time-zone setting accurate. Event start/end wall times use PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` plus `timezone_id`; creation and modification times and reminder due instants use `TIMESTAMP WITH TIME ZONE`.

## Quality checks

```powershell
npm ci
npm run lint
npm test
npm run build
Set-Location backend
mvn verify
```

The backend tests cover schedule-aware streak/rate logic, all-day leap-day conversion, reminder persistence, invalid event time ranges, and an API integration flow for registration/login, password hashing, authentication, duplicate completion prevention, history-preserving edits, database-derived analytics, and cross-user isolation. `application-test.properties` configures H2 in PostgreSQL compatibility mode for that integration test; H2 is not identical to PostgreSQL, so migration and SQL behavior should also be exercised against PostgreSQL before deployment.

## API outline

All paths below are prefixed by `/api`. Protected routes require `Authorization: Bearer <token>`. Resource IDs are UUIDs, and every owner-scoped repository lookup includes the authenticated user's ID.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/register` | Create account and return token/profile |
| POST | `/auth/login` | Sign in and return token/profile |
| GET | `/profile` | Read the authenticated user's profile |
| GET, POST | `/habits` | List active habits / create one |
| PUT, DELETE | `/habits/{id}` | Edit / permanently delete a habit |
| POST | `/habits/{id}/archive` | Archive while preserving completion history |
| GET | `/habits/{id}/completions?from=&to=` | Read a date-bounded completion history |
| PUT, DELETE | `/habits/{id}/completions/{yyyy-MM-dd}` | Mark complete / reverse a completion |
| GET, POST | `/events` | List events (optional `from`/`to` filters) / create |
| GET, PUT, DELETE | `/events/{id}` | Read / edit / delete an event |
| GET | `/reminders` | List this user's persisted reminders |
| PATCH | `/reminders/{id}` | Mark a reminder `COMPLETED` or `DISMISSED` |
| GET | `/analytics` | Read data-derived weekly/monthly/activity metrics |

`X-Time-Zone` carries the browser's IANA time-zone identifier for habit summaries and analytics. Swagger documents the DTOs and is served at `/swagger-ui.html`.

## Reminders and browser notification limits

An event can have one persisted reminder at event time, 5 minutes before, 15 minutes before, or 1 hour before. A unique event constraint prevents duplicate reminder rows. Editing an event updates its reminder rather than adding a second row. The in-app panel calculates whether an upcoming reminder is overdue. There is no background scheduler, email, SMS, web-push service worker, or delivery guarantee: a browser notification is best-effort only when the app is open, permission has been granted, and the browser remains capable of displaying notifications. Permission is requested only after clicking **Enable browser notifications**.

The JWT is kept in `sessionStorage`, not `localStorage`, so a normal tab close clears the session and the token is not sent automatically as a cookie (mitigating CSRF). A script running through an XSS flaw can still read it; session storage is not an XSS defense. Production deployments should serve over HTTPS, use a strict content security policy, rotate the signing key, and consider a carefully configured HttpOnly/SameSite cookie or backend-for-frontend session. Never put `JWT_SECRET` in Vite environment variables: Vite variables are public client code.

## Demo data

There is intentionally no demo seed on login and no synthetic analytics. Register a separate account and add habits, completions, events, and reminders through the UI to create a demonstrable dataset. This keeps sample activity isolated from real user records. For a clean demo, create another account or reset only the local Compose database volume.

## Project map

```text
src/                         React + TypeScript UI, routing, charts, calendar, API client
backend/src/main/java/       Spring controllers, services, repositories, JPA models, JWT security
backend/src/main/resources/  PostgreSQL settings and Flyway migrations
backend/src/test/java/       Habit/event unit tests and API integration coverage
compose.yaml                 PostgreSQL and API containers for local development
.github/workflows/ci.yml     Frontend and Java 21 build/test checks
```

## Beginner-friendly architecture tour

1. A React page gathers form data and uses Zod for client validation.
2. `src/api.ts` adds the tab's session token and browser time zone to API requests.
3. Spring Security verifies the signed JWT before protected controllers run.
4. Controllers validate transport-level input and pass it to a focused service.
5. Services apply ownership checks and business rules, then call Spring Data repositories.
6. JPA maps domain entities to PostgreSQL tables; Flyway owns schema changes.
7. Response records (DTOs) are returned instead of serializing JPA entities.
8. Analytics are derived from persisted habit schedules and completion rows.
9. Database constraints provide the final safeguard against duplicate completion rows.
10. React renders loading, empty, success, and error states from actual API responses.

## Ten interview concepts to understand

1. **REST and HTTP semantics:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, status codes, and idempotent completion updates.
2. **Authentication vs. authorization:** JWT verification is authentication; owner-scoped database lookups enforce authorization.
3. **Password hashing:** BCrypt stores a salted one-way hash; passwords are never stored as plaintext.
4. **DTOs and validation:** request/response records keep persistence internals out of the public API.
5. **Layered architecture:** controllers handle HTTP, services own business decisions, repositories own persistence access.
6. **Database constraints and transactions:** unique constraints protect against races that application checks alone cannot prevent.
7. **Date/time modeling:** a calendar date, local wall time, instant, and IANA time zone have different meanings.
8. **Derived metrics:** streaks skip unscheduled weekdays, while a missed scheduled weekday breaks a streak.
9. **React state and effects:** API calls synchronize component state with external services; state drives rendering.
10. **Testing strategy:** unit tests cover business rules; PostgreSQL-backed integration tests catch provider and migration differences.

## GitHub setup and commits

Initialize a repository in this folder, review `.gitignore` to confirm `.env` and `backend/target` are excluded, then:

```powershell
git init
git add .
git status
git commit -m "Build HabitForge habit tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Do not add `.env`; commit `.env.example` only. GitHub Actions runs frontend checks and Java 21 Maven verification on pushes and pull requests.
