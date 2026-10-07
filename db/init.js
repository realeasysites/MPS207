const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// On Render, set DB_PATH to a file on the persistent disk (e.g. /var/data/mps207.db)
// so quote requests survive restarts and redeploys. Without it, the database lives
// in the app folder, which Render wipes on every deploy.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'mps207.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
console.log(`[db] Using database at ${DB_PATH}`);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    services TEXT,
    preferred_date TEXT,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
