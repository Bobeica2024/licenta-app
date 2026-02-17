import { app, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
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

    // 6. Get Temp Path
    ipcMain.handle('recorder:get-temp-path', async () => {
        const tempPath = path.join(app.getPath('temp'), `recording-${Date.now()}.webm`);
        return tempPath;
    });

    // 7. Crop Video
    ipcMain.handle('recorder:crop-video', async (_, { inputPath, crop }) => {
        // ffmpeg and ffmpegPath are imported at top level

        // We need to set the path. It's safe to call this multiple times, or we can do it once at module level.
        // Doing it here ensures it's set before use.
        if (ffmpegPath) {
            ffmpeg.setFfmpegPath(ffmpegPath);
        } else {
            console.error('FFmpeg path is null!');
            return { success: false, error: 'FFmpeg binary not found' };
        }

        const outputPath = inputPath.replace('.webm', '-cropped.webm');

        return new Promise((resolve) => {
            // crop=w:h:x:y
            const w = Math.floor(crop.width);
            const h = Math.floor(crop.height);
            const x = Math.floor(crop.x);
            const y = Math.floor(crop.y);

            console.log(`Starting FFmpeg crop: ${w}x${h} at ${x},${y}`);

            ffmpeg(inputPath)
                .videoFilters(`crop=${w}:${h}:${x}:${y}`)
                .output(outputPath)
                .on('end', () => {
                    console.log('FFmpeg crop finished:', outputPath);
                    resolve({ success: true, outputPath });
                })
                .on('error', (err: any) => {
                    console.error('FFmpeg Error:', err);
                    resolve({ success: false, error: err.message });
                })
                .run();
        });
    });

    // 8. Delete Temp File
    ipcMain.handle('recorder:delete-temp-file', async (_, filePath) => {
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    });

    // 9. Save File (Move Temp to Final)
    ipcMain.handle('recorder:save-file', async (_, { tempPath, destination, userId, title, sourceUrl, folderId }) => {
        try {
            if (!fs.existsSync(tempPath)) {
                return { success: false, error: 'Temp file not found' };
            }

            let finalPath = '';

            if (destination === 'local') {
                const { filePath } = await dialog.showSaveDialog({
                    buttonLabel: 'Save Recording',
                    defaultPath: `recording-${Date.now()}.webm`,
                    filters: [{ name: 'WebM Video', extensions: ['webm'] }]
                });

                if (!filePath) return { success: false, error: 'Cancelled' };
                finalPath = filePath;

                fs.copyFileSync(tempPath, finalPath);
            } else if (destination === 'drive') {
                return { success: true, filePath: tempPath };
            } else {
                // SQLite / DB - save to a dedicated app folder
                const docsPath = app.getPath('documents');
                const recordingsDir = path.join(docsPath, 'LicentaApp_Recordings');
                if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);

                finalPath = path.join(recordingsDir, path.basename(tempPath));
                fs.copyFileSync(tempPath, finalPath);
            }

            // DB Logging
            if (userId) {
                try {
                    const stmt = db.prepare('INSERT INTO fragments (user_id, folder_id, title, source_url, file_path) VALUES (?, ?, ?, ?, ?)');
                    stmt.run(userId, folderId || null, title || 'Untitled Recording', sourceUrl || '', finalPath || tempPath);
                } catch (dbErr) {
                    console.error('DB Insert Error:', dbErr);
                }
            }

            return { success: true, filePath: finalPath };

        } catch (err: any) {
            console.error('Save File Error:', err);
            return { success: false, error: err.message };
        }
    });
}
