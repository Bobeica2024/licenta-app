import { ipcMain } from 'electron';
import db from './db';

// Helper interface for DB results
interface DBFolder {
    id: number;
    name: string;
    parent_id: number | null;
    user_id: number;
    created_at: string;
}

export function setupLibraryHandlers() {
    // Get Contents (Folders + Files)
    ipcMain.handle('library:get-contents', async (_, { folderId, userId }) => {
        try {
            // Get folders
            let foldersQuery = 'SELECT * FROM folders WHERE user_id = ? AND parent_id IS ?';
            let foldersParams: any[] = [userId, folderId];

            // If folderId is provided (not null/undefined), check equality. 
            // If it is null, we check IS NULL.
            if (folderId !== null && folderId !== undefined) {
                foldersQuery = 'SELECT * FROM folders WHERE user_id = ? AND parent_id = ?';
                foldersParams = [userId, folderId];
            } else {
                // Root folder: parent_id IS NULL
                foldersParams = [userId, null];
            }

            const folders = db.prepare(foldersQuery).all(...foldersParams) as DBFolder[];

            // Get files (fragments)
            let filesQuery = 'SELECT * FROM fragments WHERE user_id = ? AND folder_id IS ?';
            let filesParams: any[] = [userId, folderId];

            if (folderId !== null && folderId !== undefined) {
                filesQuery = 'SELECT * FROM fragments WHERE user_id = ? AND folder_id = ?';
                filesParams = [userId, folderId];
            } else {
                filesParams = [userId, null];
            }

            const files = db.prepare(filesQuery).all(...filesParams) as any[];

            // Map to unified format
            const mappedFolders = folders.map(f => ({
                id: f.id,
                name: f.name,
                type: 'folder',
                parentId: f.parent_id,
                createdAt: f.created_at
            }));

            const mappedFiles = files.map(f => ({
                id: f.id,
                name: f.title,
                type: 'file',
                parentId: f.folder_id,
                createdAt: f.created_at,
                filePath: f.file_path,
                // duration: ...
            }));

            return [...mappedFolders, ...mappedFiles];
        } catch (err) {
            console.error('Error fetching library contents:', err);
            return [];
        }
    });

    // Create Folder
    ipcMain.handle('library:create-folder', async (_, { name, parentId, userId }) => {
        try {
            if (!name || !userId) throw new Error('Invalid arguments');

            const stmt = db.prepare('INSERT INTO folders (name, parent_id, user_id) VALUES (?, ?, ?)');
            const info = stmt.run(name, parentId || null, userId);

            return { success: true, id: info.lastInsertRowid };
        } catch (err: any) {
            console.error('Error creating folder:', err);
            return { success: false, error: err.message };
        }
    });

    // Delete Item
    ipcMain.handle('library:delete-item', async (_, { id, type, userId }) => {
        try {
            if (type === 'folder') {
                // Recursive deletion
                // 1. Get all folder IDs (target + subfolders)
                const getIds = db.prepare(`
                    WITH RECURSIVE subdirectory_ids(id) AS (
                        SELECT id FROM folders WHERE id = ? AND user_id = ?
                        UNION ALL
                        SELECT f.id FROM folders f
                        JOIN subdirectory_ids s ON f.parent_id = s.id
                    )
                    SELECT id FROM subdirectory_ids;
                `);

                const foldersAndSubfolders = getIds.all(id, userId) as { id: number }[];
                const idsToDelete = foldersAndSubfolders.map(f => f.id);

                if (idsToDelete.length > 0) {
                    const placeHolders = idsToDelete.map(() => '?').join(',');

                    // 2. Delete all fragments in these folders
                    const deleteFragments = db.prepare(`DELETE FROM fragments WHERE folder_id IN (${placeHolders}) AND user_id = ?`);
                    deleteFragments.run(...idsToDelete, userId);

                    // 3. Delete the folders (Cascade will likely handle this if constraints are on, but explicit is safe or just delete root)
                    // If ON DELETE CASCADE is enabled, deleting the root folder is enough. 
                    // However, we want to be sure.
                    // Given schemas often differ, let's delete the specific folder and let SQLite Cascade handle the subfolders 
                    // OR delete all explicitly. 
                    // Since 'folders' table has ON DELETE CASCADE on parent_id, deleting the root `id` should suffice for folders.
                    const deleteFolder = db.prepare('DELETE FROM folders WHERE id = ? AND user_id = ?');
                    deleteFolder.run(id, userId);
                }
            } else {
                const stmt = db.prepare('DELETE FROM fragments WHERE id = ? AND user_id = ?');
                stmt.run(id, userId);
            }
            return { success: true };
        } catch (err: any) {
            console.error('Error deleting item:', err);
            return { success: false, error: err.message };
        }
    });
}

