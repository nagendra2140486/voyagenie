-- Voyagenie schema. Idempotent so it can be re-run against an existing database.

CREATE TABLE IF NOT EXISTS app_sessions (
    id            SERIAL PRIMARY KEY,
    session_id    TEXT UNIQUE NOT NULL,
    display_name  TEXT,
    email         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS destinations (
    id            SERIAL PRIMARY KEY,
    city          TEXT NOT NULL,
    country       TEXT NOT NULL,
    summary       TEXT NOT NULL,
    description   TEXT NOT NULL,
    budget_level  TEXT NOT NULL CHECK (budget_level IN ('low', 'medium', 'high')),
    best_season   TEXT NOT NULL,
    travel_style  TEXT NOT NULL,
    image_url     TEXT NOT NULL,
    attractions   JSONB NOT NULL DEFAULT '[]'::jsonb,
    travel_tips   JSONB NOT NULL DEFAULT '[]'::jsonb,
    estimated_budget_usd INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packages (
    id             SERIAL PRIMARY KEY,
    title          TEXT NOT NULL,
    destination_id INTEGER REFERENCES destinations(id) ON DELETE SET NULL,
    duration_days  INTEGER NOT NULL,
    price_range    TEXT NOT NULL,
    price_from_usd INTEGER NOT NULL,
    travel_style   TEXT NOT NULL,
    highlights     JSONB NOT NULL DEFAULT '[]'::jsonb,
    image_url      TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
    id             SERIAL PRIMARY KEY,
    session_id     TEXT NOT NULL,
    title          TEXT NOT NULL,
    destination    TEXT NOT NULL,
    days           INTEGER,
    budget         TEXT,
    travel_type    TEXT,
    source         TEXT NOT NULL DEFAULT 'ai_itinerary',
    itinerary_text TEXT NOT NULL,
    itinerary_json JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trips_session_idx ON trips (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_inquiries (
    id         SERIAL PRIMARY KEY,
    name       TEXT NOT NULL,
    email      TEXT NOT NULL,
    subject    TEXT,
    message    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS llm_audit_log (
    id            SERIAL PRIMARY KEY,
    session_id    TEXT NOT NULL,
    feature       TEXT NOT NULL,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    status        TEXT NOT NULL,
    detail        TEXT,
    prompt_chars  INTEGER NOT NULL DEFAULT 0,
    token_estimate INTEGER NOT NULL DEFAULT 0,
    latency_ms    INTEGER NOT NULL DEFAULT 0,
    cached        BOOLEAN NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS llm_audit_created_idx ON llm_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limit_counter (
    id            SERIAL PRIMARY KEY,
    session_id    TEXT NOT NULL,
    feature       TEXT NOT NULL,
    hour_window   TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    UNIQUE (session_id, feature, hour_window)
);

CREATE TABLE IF NOT EXISTS llm_cache (
    prompt_hash   TEXT PRIMARY KEY,
    feature       TEXT NOT NULL,
    provider      TEXT NOT NULL,
    model         TEXT NOT NULL,
    response_json JSONB NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
