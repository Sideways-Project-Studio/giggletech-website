CREATE TABLE IF NOT EXISTS interest_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS interest_events_name_created_at
  ON interest_events (event_name, created_at);
