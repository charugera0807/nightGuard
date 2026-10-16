const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

const dbPath = process.env.DB_PATH || "./data/nightguard.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS trips (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start             TEXT NOT NULL,
  destination       TEXT NOT NULL,
  date              TEXT NOT NULL,
  departure         TEXT NOT NULL,
  arrival           TEXT,
  transport         TEXT NOT NULL,
  transport_details TEXT NOT NULL,
  share_token       TEXT NOT NULL UNIQUE,
  status            TEXT NOT NULL DEFAULT 'active',
  saved_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trips_user ON trips(user_id, status);

CREATE TABLE IF NOT EXISTS contacts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);

CREATE TABLE IF NOT EXISTS locations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id     INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  accuracy    REAL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_locations_trip ON locations(trip_id, id DESC);

CREATE TABLE IF NOT EXISTS sos_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id    INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  message    TEXT NOT NULL,
  latitude   REAL,
  longitude  REAL,
  sms_sent   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

module.exports = db;
