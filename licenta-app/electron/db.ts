import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    hint TEXT
  );

  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(parent_id) REFERENCES folders(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS fragments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    folder_id INTEGER,
    title TEXT NOT NULL,
    source_url TEXT,
    file_path TEXT,
    drive_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
  );
`);

// Migration: Add folder_id to fragments if it doesn't exist
try {
  const columns = db.pragma('table_info(fragments)') as { name: string }[];
  const hasFolderId = columns.some(c => c.name === 'folder_id');

  if (!hasFolderId) {
    console.log('Migrating database: Adding folder_id to fragments table');
    db.exec('ALTER TABLE fragments ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
  }
} catch (err) {
  console.error('Migration error:', err);
}

export default db;
