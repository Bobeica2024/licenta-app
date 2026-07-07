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
    ipcMain.handle('library:get-contents', async (_, { folderId, userId, searchQuery }) => {
        try {
            let folders: DBFolder[] = [];
            let files: any[] = [];

            if (searchQuery && searchQuery.trim() !== '') {
                // Global search
                const queryStr = `%${searchQuery.trim()}%`;
                const foldersQuery = 'SELECT * FROM folders WHERE user_id = ? AND (name LIKE ? OR tags LIKE ? OR description LIKE ?)';
                folders = db.prepare(foldersQuery).all(userId, queryStr, queryStr, queryStr) as DBFolder[];

                const filesQuery = 'SELECT * FROM fragments WHERE user_id = ? AND (title LIKE ? OR tags LIKE ? OR description LIKE ? OR file_path LIKE ?)';
                files = db.prepare(filesQuery).all(userId, queryStr, queryStr, queryStr, queryStr) as any[];
            } else {
                // Folder browsing
                let foldersQuery = 'SELECT * FROM folders WHERE user_id = ? AND parent_id IS ?';
                let foldersParams: any[] = [userId, folderId];

                if (folderId !== null && folderId !== undefined) {
                    foldersQuery = 'SELECT * FROM folders WHERE user_id = ? AND parent_id = ?';
                    foldersParams = [userId, folderId];
                } else {
                    foldersParams = [userId, null];
                }

                folders = db.prepare(foldersQuery).all(...foldersParams) as DBFolder[];

                let filesQuery = 'SELECT * FROM fragments WHERE user_id = ? AND folder_id IS ?';
                let filesParams: any[] = [userId, folderId];

                if (folderId !== null && folderId !== undefined) {
                    filesQuery = 'SELECT * FROM fragments WHERE user_id = ? AND folder_id = ?';
                    filesParams = [userId, folderId];
                } else {
                    filesParams = [userId, null];
                }

                files = db.prepare(filesQuery).all(...filesParams) as any[];
            }

            // Map to unified format
            const mappedFolders = folders.map((f: any) => ({
                id: f.id,
                name: f.name,
                type: 'folder',
                parentId: f.parent_id,
                tags: f.tags,
                description: f.description,
                createdAt: f.created_at
            }));

            const mappedFiles = files.map(f => ({
                id: f.id,
                name: f.title,
                type: 'file', // React ui type
                fileType: f.type, // DB type ('video' | 'archive')
                parentId: f.folder_id,
                tags: f.tags,
                description: f.description,
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
    // Rename Item
    ipcMain.handle('library:rename-item', async (_, { id, type, newName, userId }) => {
        try {
            if (!newName || !newName.trim()) throw new Error('Invalid name');

            if (type === 'folder') {
                const stmt = db.prepare('UPDATE folders SET name = ? WHERE id = ? AND user_id = ?');
                stmt.run(newName, id, userId);
            } else {
                const stmt = db.prepare('UPDATE fragments SET title = ? WHERE id = ? AND user_id = ?');
                stmt.run(newName, id, userId);
            }
            return { success: true };
        } catch (err: any) {
            console.error('Error renaming item:', err);
            return { success: false, error: err.message };
        }
    });

    // Update Metadata
    ipcMain.handle('library:update-metadata', async (_, { id, type, name, tags, description, userId }) => {
        try {
            if (!name || !name.trim()) throw new Error('Numele nu poate fi gol');

            if (type === 'folder') {
                const stmt = db.prepare('UPDATE folders SET name = ?, tags = ?, description = ? WHERE id = ? AND user_id = ?');
                stmt.run(name, tags || '', description || '', id, userId);
            } else {
                const stmt = db.prepare('UPDATE fragments SET title = ?, tags = ?, description = ? WHERE id = ? AND user_id = ?');
                stmt.run(name, tags || '', description || '', id, userId);
            }
            return { success: true };
        } catch (err: any) {
            console.error('Error updating metadata:', err);
            return { success: false, error: err.message };
        }
    });

    // Move Item
    ipcMain.handle('library:move-item', async (_, { id, type, targetFolderId, userId }) => {
        try {
            if (type === 'folder') {
                // Prevent moving folder into itself or its children (cycle check)
                // Simple check: if targetFolderId is same as id, fail.
                // Deep check: ensure targetFolderId is not a child of id.
                if (id === targetFolderId) throw new Error("Cannot move folder into itself");

                // Get all children recursively to check for cycles
                const getChildren = db.prepare(`
                    WITH RECURSIVE subdirectory_ids(id) AS (
                        SELECT id FROM folders WHERE parent_id = ? AND user_id = ?
                        UNION ALL
                        SELECT f.id FROM folders f
                        JOIN subdirectory_ids s ON f.parent_id = s.id
                    )
                    SELECT id FROM subdirectory_ids;
                `);
                const children = getChildren.all(id, userId) as { id: number }[];
                if (children.some(c => c.id === targetFolderId)) {
                    throw new Error("Cannot move folder into its own subfolder");
                }

                const stmt = db.prepare('UPDATE folders SET parent_id = ? WHERE id = ? AND user_id = ?');
                stmt.run(targetFolderId || null, id, userId);
            } else {
                const stmt = db.prepare('UPDATE fragments SET folder_id = ? WHERE id = ? AND user_id = ?');
                stmt.run(targetFolderId || null, id, userId);
            }
            return { success: true };
        } catch (err: any) {
            console.error('Error moving item:', err);
            return { success: false, error: err.message };
        }
    });

    // Copy Item
    ipcMain.handle('library:copy-item', async (_, { id, type, targetFolderId, userId }) => {
        try {
            const copyFolderRecursive = (sourceId: number, targetParentId: number | null) => {
                // 1. Get source folder details
                const sourceFolder = db.prepare('SELECT * FROM folders WHERE id = ? AND user_id = ?').get(sourceId, userId) as DBFolder;
                if (!sourceFolder) return;

                // 2. Create new folder in target
                const createStmt = db.prepare('INSERT INTO folders (name, parent_id, user_id, tags, description) VALUES (?, ?, ?, ?, ?)');
                const result = createStmt.run(sourceFolder.name + (sourceId === id ? ' - Copy' : ''), targetParentId, userId, (sourceFolder as any).tags || '', (sourceFolder as any).description || '');
                const newFolderId = result.lastInsertRowid as number;

                // 3. Copy direct files
                const files = db.prepare('SELECT * FROM fragments WHERE folder_id = ? AND user_id = ?').all(sourceId, userId) as any[];
                const copyFileStmt = db.prepare('INSERT INTO fragments (user_id, title, type, source_url, file_path, drive_id, created_at, folder_id, tags, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                for (const file of files) {
                    copyFileStmt.run(userId, file.title, file.type, file.source_url, file.file_path, file.drive_id, new Date().toISOString(), newFolderId, file.tags || '', file.description || '');
                }

                // 4. Recurse for subfolders
                const subfolders = db.prepare('SELECT id FROM folders WHERE parent_id = ? AND user_id = ?').all(sourceId, userId) as { id: number }[];
                for (const sub of subfolders) {
                    copyFolderRecursive(sub.id, newFolderId);
                }
            };

            if (type === 'folder') {
                db.transaction(() => {
                    copyFolderRecursive(id, targetFolderId);
                })();
            } else {
                // Single file copy
                const file = db.prepare('SELECT * FROM fragments WHERE id = ? AND user_id = ?').get(id, userId) as any;
                if (file) {
                    const stmt = db.prepare('INSERT INTO fragments (user_id, title, type, source_url, file_path, drive_id, created_at, folder_id, tags, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
                    stmt.run(userId, file.title + ' - Copy', file.type, file.source_url, file.file_path, file.drive_id, new Date().toISOString(), targetFolderId || null, file.tags || '', file.description || '');
                }
            }
            return { success: true };
        } catch (err: any) {
            console.error('Error copying item:', err);
            return { success: false, error: err.message };
        }
    });

}

