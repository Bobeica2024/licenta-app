import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import db from './db';

// Store active recording streams if needed (usually handled in renderer, but file streams here)
let writeStreams: { [key: string]: fs.WriteStream } = {};

export function setupRecorderHandlers() {

    // 1. Select Save Path
    ipcMain.handle('recorder:select-path', async () => {
        const { filePath } = await dialog.showSaveDialog({
            buttonLabel: 'Save Video',
            defaultPath: `recording-${Date.now()}.webm`,
            filters: [{ name: 'WebM Video', extensions: ['webm'] }]
        });
        return filePath;
    });

    // 2. Start Writing File
    ipcMain.handle('recorder:start-save', async (_, filePath) => {
        try {
            const stream = fs.createWriteStream(filePath);
            writeStreams[filePath] = stream;
            return { success: true };
        } catch (err: any) {
            console.error('Start Save Error:', err);
            return { success: false, error: err.message };
        }
    });

    // 3. Write Chunk
    ipcMain.handle('recorder:write-chunk', async (_, { filePath, chunk }) => {
        const stream = writeStreams[filePath];
        if (stream) {
            stream.write(Buffer.from(chunk));
            return { success: true };
        }
        return { success: false, error: 'Stream not found' };
    });

    // 4. Stop Writing
    ipcMain.handle('recorder:stop-save', async (_, { filePath, userId, title, sourceUrl, saveToDb }) => {
        const stream = writeStreams[filePath];
        if (stream) {
            stream.end();
            delete writeStreams[filePath];

            // Save to SQLite if requested
            if (saveToDb && userId) {
                try {
                    const stmt = db.prepare('INSERT INTO fragments (user_id, title, source_url, file_path) VALUES (?, ?, ?, ?)');
                    stmt.run(userId, title || 'Untitled Recording', sourceUrl, filePath);
                } catch (dbErr) {
                    console.error('DB Save Error:', dbErr);
                }
            }

            return { success: true };
        }
        return { success: false, error: 'Stream not found' };
    });

    // 5. Get available sources for recording (Desktop Capturer)
    ipcMain.handle('recorder:get-sources', async () => {
        const { desktopCapturer } = await import('electron');
        const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
        return sources.map(source => ({
            id: source.id,
            name: source.name,
            thumbnail: source.thumbnail.toDataURL()
        }));
    });
}
