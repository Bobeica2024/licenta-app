import { ipcMain } from 'electron';
import db from './db';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export function setupAuthHandlers() {
    ipcMain.handle('auth:register', async (_, { username, password, hint }) => {
        try {
            const stmt = db.prepare('INSERT INTO users (username, password_hash, hint) VALUES (?, ?, ?)');
            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            const info = stmt.run(username, hash, hint);
            return { success: true, userId: info.lastInsertRowid };
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, error: 'Username already exists' };
            }
            console.error('Registration error:', error);
            return { success: false, error: 'Registration failed' };
        }
    });

    ipcMain.handle('auth:login', async (_, { username, password }) => {
        try {
            const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
            const user = stmt.get(username) as any;

            if (!user) {
                return { success: false, error: 'Utilizatorul nu a fost găsit! Verificați introducerea username-ului și a parolei.' };
            }

            const match = await bcrypt.compare(password, user.password_hash);
            if (match) {
                return { success: true, user: { id: user.id, username: user.username, isAdmin: !!user.is_admin } };
            } else {
                return { success: false, error: 'Parolă incorectă! Verificați introducerea username-ului și a parolei.' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Login failed' };
        }
    });

    ipcMain.handle('auth:get-hint', async (_, username) => {
        try {
            const stmt = db.prepare('SELECT hint FROM users WHERE username = ?');
            const user = stmt.get(username) as any;
            return { success: true, hint: user ? user.hint : null };
        } catch (error) {
            console.error('Get hint error:', error);
            return { success: false, error: 'Failed to retrieve hint' };
        }
    });

    ipcMain.handle('auth:change-username', async (_, { userId, newUsername }) => {
        try {
            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
            return { success: true };
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, error: 'Acest nume de utilizator este deja folosit. Vă rugăm să alegeți altul!' };
            }
            console.error('Change username error:', error);
            return { success: false, error: 'Eroare la schimbarea numelui' };
        }
    });

    ipcMain.handle('auth:change-password', async (_, { userId, newPassword }) => {
        try {
            const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
            return { success: true };
        } catch (error: any) {
            console.error('Change password error:', error);
            return { success: false, error: 'Eroare la schimbarea parolei' };
        }
    });
}
