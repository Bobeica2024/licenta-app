import { ipcMain } from 'electron';
import db from './db';

export function setupHistoryHandlers() {
    // Adaugă o acțiune în istoric
    ipcMain.handle('history:add', async (_, { userId, actionType, itemName }) => {
        try {
            const stmt = db.prepare('INSERT INTO history (user_id, action_type, item_name) VALUES (?, ?, ?)');
            stmt.run(userId, actionType, itemName);
            return { success: true };
        } catch (error: any) {
            console.error('Add history error:', error);
            return { success: false, error: 'Failed to add history element' };
        }
    });

    // Preluare istoric (Admin preia pentru toți utilzatorii, Userul normal doar pentru el)
    ipcMain.handle('history:get', async (_, { userId, isAdmin }) => {
        try {
            if (isAdmin) {
                // Admin gets all history with username attached
                const stmt = db.prepare(`
                    SELECT h.*, u.username 
                    FROM history h 
                    JOIN users u ON h.user_id = u.id 
                    ORDER BY h.created_at DESC
                `);
                return { success: true, history: stmt.all() };
            } else {
                // Normal user gets only their own
                const stmt = db.prepare(`
                    SELECT h.*, u.username 
                    FROM history h 
                    JOIN users u ON h.user_id = u.id 
                    WHERE h.user_id = ? 
                    ORDER BY h.created_at DESC
                `);
                return { success: true, history: stmt.all(userId) };
            }
        } catch (error: any) {
            console.error('Get history error:', error);
            return { success: false, error: 'Failed to get history' };
        }
    });

    // Ștergere istoric
    ipcMain.handle('history:delete', async (_, { id, userId, isAdmin }) => {
        try {
            if (isAdmin) {
                const stmt = db.prepare('DELETE FROM history WHERE id = ?');
                stmt.run(id);
            } else {
                // Dacă nu e admin, verificăm sigur că este propriul lui istoric
                const stmt = db.prepare('DELETE FROM history WHERE id = ? AND user_id = ?');
                stmt.run(id, userId);
            }
            return { success: true };
        } catch (error: any) {
            console.error('Delete history error:', error);
            return { success: false, error: 'Failed to delete history item' };
        }
    });

    // Preluare fragment dupa nume (pentru preview din istoric)
    ipcMain.handle('history:get-fragment-by-name', async (_, { itemName, ownerId }) => {
        try {
            // itemName in history is usually the fragment title (sometimes with .zip for archives, but mostly just title)
            // Remove .zip or .webm if present just to match against title
            let searchTitle = itemName;
            if (searchTitle.endsWith('.webm')) searchTitle = searchTitle.slice(0, -5);
            if (searchTitle.endsWith('.zip')) searchTitle = searchTitle.slice(0, -4);

            const stmt = db.prepare(`
                SELECT id, title, type, file_path, source_url, drive_id 
                FROM fragments 
                WHERE title = ? AND user_id = ?
                LIMIT 1
            `);
            const fragment = stmt.get(searchTitle, ownerId);
            
            if (fragment) {
                return { success: true, fragment };
            } else {
                return { success: false, error: 'Fragmentul nu a putut fi găsit în baza de date (poate a fost șters sau redenumit).' };
            }
        } catch (error: any) {
            console.error('Get fragment by name error:', error);
            return { success: false, error: 'Failed to fetch fragment details.' };
        }
    });

    // Preluare toți userii (doar pentru admin)
    ipcMain.handle('admin:get-users', async (_, { isAdmin }) => {
        try {
            if (!isAdmin) return { success: false, error: 'Unauthorized' };
            const stmt = db.prepare('SELECT id, username, is_admin FROM users ORDER BY username ASC');
            return { success: true, users: stmt.all() };
        } catch (error: any) {
            console.error('Get users error:', error);
            return { success: false, error: 'Failed to get users' };
        }
    });

    // Ștergere user (doar pentru admin)
    ipcMain.handle('admin:delete-user', async (_, { targetUserId, isAdmin }) => {
        try {
            if (!isAdmin) return { success: false, error: 'Unauthorized' };

            // Check target is not admin
            const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(targetUserId) as any;
            if (!target) return { success: false, error: 'User not found' };
            if (target.is_admin) return { success: false, error: 'Cannot delete admin accounts' };

            // Delete related data first (tables without ON DELETE CASCADE)
            db.prepare('DELETE FROM fragments WHERE user_id = ?').run(targetUserId);
            db.prepare('DELETE FROM folders WHERE user_id = ?').run(targetUserId);
            // history has ON DELETE CASCADE, but delete explicitly for safety
            db.prepare('DELETE FROM history WHERE user_id = ?').run(targetUserId);

            // Now delete the user
            const result = db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
            if (result.changes === 0) {
                return { success: false, error: 'Could not delete user' };
            }
            return { success: true };
        } catch (error: any) {
            console.error('Delete user error:', error);
            return { success: false, error: 'Failed to delete user' };
        }
    });

    // Resetare parola user (doar pentru admin)
    ipcMain.handle('admin:reset-password', async (_, { targetUserId, newPassword, isAdmin }) => {
        try {
            if (!isAdmin) return { success: false, error: 'Unauthorized' };

            const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(targetUserId) as any;
            if (!target) return { success: false, error: 'User not found' };
            if (target.is_admin) return { success: false, error: 'Cannot change admin password from here' };

            const bcrypt = await import('bcryptjs');
            const hash = await bcrypt.hash(newPassword, 10);
            db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, targetUserId);
            return { success: true };
        } catch (error: any) {
            console.error('Reset password error:', error);
            return { success: false, error: 'Failed to reset password' };
        }
    });

    // Schimbare username user (doar pentru admin)
    ipcMain.handle('admin:change-username', async (_, { targetUserId, newUsername, isAdmin }) => {
        try {
            if (!isAdmin) return { success: false, error: 'Unauthorized' };

            const target = db.prepare('SELECT id, is_admin FROM users WHERE id = ?').get(targetUserId) as any;
            if (!target) return { success: false, error: 'User not found' };
            if (target.is_admin) return { success: false, error: 'Cannot change admin username from here' };

            db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, targetUserId);
            return { success: true };
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                return { success: false, error: 'Acest nume de utilizator este deja folosit. Vă rugăm să alegeți altul!' };
            }
            console.error('Change username error:', error);
            return { success: false, error: 'Failed to change username' };
        }
    });
}
