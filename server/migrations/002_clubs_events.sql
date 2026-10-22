ALTER TABLE users
    ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student'
        CHECK (role IN ('student', 'club_admin', 'college_admin'));

UPDATE users SET name = username WHERE name = '';

-- login moves to email, so every account needs a unique one.
-- nullable until signup asks for it
ALTER TABLE users ALTER COLUMN email DROP NOT NULL, ALTER COLUMN email DROP DEFAULT;
UPDATE users SET email = username || '@campushub.local' WHERE email = '';
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE clubs (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    slug        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE club_members (
    club_id     INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);

CREATE INDEX idx_club_members_user ON club_members(user_id);

ALTER TABLE posts ADD COLUMN club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE;
CREATE INDEX idx_posts_club ON posts(club_id);

CREATE TABLE events (
    id          SERIAL PRIMARY KEY,
    club_id     INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    venue       VARCHAR(200) NOT NULL DEFAULT '',
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ,
    capacity    INTEGER NOT NULL CHECK (capacity > 0),
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_events_club ON events(club_id);
CREATE INDEX idx_events_starts ON events(starts_at);

CREATE TABLE registrations (
    id            SERIAL PRIMARY KEY,
    event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
    checked_in_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, user_id)
);

CREATE INDEX idx_registrations_user ON registrations(user_id);
CREATE INDEX idx_registrations_queue ON registrations(event_id, status, created_at);

CREATE TABLE tickets (
    id              SERIAL PRIMARY KEY,
    registration_id INTEGER UNIQUE NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    code            VARCHAR(64) UNIQUE NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE certificates (
    id              SERIAL PRIMARY KEY,
    registration_id INTEGER UNIQUE NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    code            VARCHAR(64) UNIQUE NOT NULL,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
