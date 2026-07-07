import { app, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import AdmZip from 'adm-zip';
import db from './db';

function getFolderFilesRecursively(folderId: number, userId: number, basePath: string): { dbPath: string, actualPath: string }[] {
    let results: { dbPath: string, actualPath: string }[] = [];

    const files = db.prepare('SELECT title, file_path FROM fragments WHERE folder_id = ? AND user_id = ?').all(folderId, userId) as any[];
    for (const file of files) {
        if (file.file_path && fs.existsSync(file.file_path)) {
            const ext = path.extname(file.file_path) || '.webm';
            const safeTitle = file.title.replace(/[^\w\s-]/gi, '') + ext;
            results.push({
                dbPath: path.join(basePath, safeTitle),
                actualPath: file.file_path
            });
        }
    }

    const subfolders = db.prepare('SELECT id, name FROM folders WHERE parent_id = ? AND user_id = ?').all(folderId, userId) as any[];
    for (const sub of subfolders) {
        const safeFolderName = sub.name.replace(/[^\w\s-]/gi, '');
        const subFiles = getFolderFilesRecursively(sub.id, userId, path.join(basePath, safeFolderName));
        results = results.concat(subFiles);
    }

    return results;
}


export function setupArchiveHandlers() {
    ipcMain.handle('archive:create', async (_, { items, targetFolderId, archiveName, userId, destination = 'db' }) => {
        try {
            if (!items || items.length === 0) return { success: false, error: 'No items selected for archiving' };

            const zip = new AdmZip();
            let addedFilesCount = 0;

            for (const item of items) {
                if (item.type === 'file') {
                    const file = db.prepare('SELECT title, file_path FROM fragments WHERE id = ? AND user_id = ?').get(item.id, userId) as any;
                    if (file && file.file_path && fs.existsSync(file.file_path)) {
                        const ext = path.extname(file.file_path) || '.webm';
                        const safeTitle = file.title.replace(/[^\w\s\-\.]/gi, '').replace(/\.zip$/i, '');
                        const entryName = safeTitle + ext;
                        const content = fs.readFileSync(file.file_path);
                        zip.addFile(entryName, content);
                        addedFilesCount++;
                    }
                } else if (item.type === 'folder') {
                    const folder = db.prepare('SELECT name FROM folders WHERE id = ? AND user_id = ?').get(item.id, userId) as any;
                    if (folder) {
                        const folderName = folder.name.replace(/[^\w\s\-]/gi, '');
                        const allFiles = getFolderFilesRecursively(item.id, userId, folderName);

                        for (const f of allFiles) {
                            if (fs.existsSync(f.actualPath)) {
                                const content = fs.readFileSync(f.actualPath);
                                const entryName = f.dbPath.replace(/\\/g, '/');
                                zip.addFile(entryName, content);
                                addedFilesCount++;
                            }
                        }
                    }
                }
            }

            if (addedFilesCount === 0) {
                return { success: false, error: 'Nu s-au putut găsi fișierele selectate pe disc.' };
            }

            const safeArchiveName = (archiveName || 'Archive').replace(/[^\w\s-]/gi, '') + '.zip';

            if (destination === 'local') {
                const { canceled, filePath } = await dialog.showSaveDialog({
                    title: 'Salvăm Arhiva',
                    defaultPath: safeArchiveName,
                    filters: [{ name: 'Zip Files', extensions: ['zip'] }]
                });

                if (canceled || !filePath) return { success: false, error: 'Salvare anulată' };
                zip.writeZip(filePath);
                return { success: true, filePath: filePath, destination: 'local' };
            }

            const userDataPath = app.getPath('userData');
            const archivesDir = path.join(userDataPath, 'storage', 'archives');

            if (!fs.existsSync(archivesDir)) {
                fs.mkdirSync(archivesDir, { recursive: true });
            }

            let finalName = safeArchiveName;
            let counter = 1;
            while (fs.existsSync(path.join(archivesDir, finalName))) {
                finalName = safeArchiveName.replace('.zip', ` (${counter}).zip`);
                counter++;
            }

            const finalPath = path.join(archivesDir, finalName);
            zip.writeZip(finalPath);

            if (destination === 'db') {
                const stmt = db.prepare('INSERT INTO fragments (user_id, folder_id, title, file_path, type) VALUES (?, ?, ?, ?, ?)');
                stmt.run(userId, targetFolderId || null, finalName.replace('.zip', ''), finalPath, 'archive');
                return { success: true, filePath: finalPath, destination: 'db' };
            }

            if (destination === 'drive') {
                return { success: true, filePath: finalPath, destination: 'drive', fileName: finalName };
            }

            return { success: false, error: 'Invalid destination' };

        } catch (error: any) {
            console.error('Archiving error:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('archive:list', async (_, filePath: string) => {
        try {
            if (!fs.existsSync(filePath)) {
                return { success: false, error: 'Fișierul arhivă nu există.' };
            }

            const zip = new AdmZip(filePath);
            const zipEntries = zip.getEntries();
            const files = zipEntries.map(entry => ({
                name: entry.entryName,
                isDirectory: entry.isDirectory,
                size: entry.header.size
            }));

            return { success: true, files };
        } catch (error: any) {
            console.error('Error listing archive:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('archive:extract-item', async (_, archivePath: string, entryName: string) => {
        try {
            if (!fs.existsSync(archivePath)) {
                return { success: false, error: 'Fișierul arhivă nu există.' };
            }

            const zip = new AdmZip(archivePath);
            const tempDir = path.join(app.getPath('temp'), 'fragman-extracted', Date.now().toString());
            fs.mkdirSync(tempDir, { recursive: true });
            
            zip.extractEntryTo(entryName, tempDir, false, true);
            
            const baseName = path.basename(entryName);
            const absoluteTempPath = path.join(tempDir, baseName);
            
            if (fs.existsSync(absoluteTempPath)) {
                return { success: true, filePath: absoluteTempPath };
            } else {
                return { success: false, error: 'Nu s-a putut extrage fișierul temporar pentru redare.' };
            }
        } catch (error: any) {
            console.error('Extraction error:', error);
            return { success: false, error: error.message };
        }
    });
}
