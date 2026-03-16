import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

const dbPath = path.join(app.getPath('userData'), 'database.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    hint TEXT,
    is_admin BOOLEAN DEFAULT 0
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
    type TEXT DEFAULT 'video',
    source_url TEXT,
    file_path TEXT,
    drive_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    item_name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

try {
  // Migrate fragments
  const fragmentsCols = db.pragma('table_info(fragments)') as { name: string }[];
  if (!fragmentsCols.some(c => c.name === 'folder_id')) {
    console.log('Migrating database: Adding folder_id to fragments table');
    db.exec('ALTER TABLE fragments ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
  }

  // Migrate users
  const usersCols = db.pragma('table_info(users)') as { name: string }[];
  if (!usersCols.some(c => c.name === 'is_admin')) {
    console.log('Migrating database: Adding is_admin to users table');
    db.exec('ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0');
  }

  // Migrate fragments to have type
  if (!fragmentsCols.some(c => c.name === 'type')) {
    console.log('Migrating database: Adding type to fragments table');
    db.exec('ALTER TABLE fragments ADD COLUMN type TEXT DEFAULT "video"');
  }

  // Create or ensure default admin 'bobeicastefan' has is_admin = 1
  const adminStmt = db.prepare('SELECT id, is_admin FROM users WHERE username = ?');
  const admin = adminStmt.get('bobeicastefan') as any;
  if (!admin) {
    console.log('Creating default admin user...');
    const insertAdmin = db.prepare('INSERT INTO users (username, password_hash, hint, is_admin) VALUES (?, ?, ?, ?)');
    const hash = bcrypt.hashSync('ProGoMoRe2026', SALT_ROUNDS);
    insertAdmin.run('bobeicastefan', hash, 'Admin default account', 1);
  } else if (!admin.is_admin) {
    // Account existed but is_admin was not set (e.g. created before migration)
    console.log('Updating bobeicastefan to admin...');
    db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('bobeicastefan');
  }

} catch (err) {
  console.error('Migration error:', err);
}

export default db;
