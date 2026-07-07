import { app, BrowserWindow } from 'electron'
import './db' // Initialize database
import { setupAuthHandlers } from './auth';
import { setupRecorderHandlers } from './recorder';
import { setupDriveHandlers } from './drive';
import { setupLibraryHandlers } from './library';
import { setupHistoryHandlers } from './history';
import { setupArchiveHandlers } from './archive';

setupAuthHandlers();
setupRecorderHandlers();
setupDriveHandlers();
setupLibraryHandlers();
setupHistoryHandlers();
setupArchiveHandlers();
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))


process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

import fs from 'node:fs';

app.setName('FragMan');

function createWindow() {
  const appPath = app.getAppPath();
  const preloadPathRef = path.join(__dirname, 'preload.cjs');
  const preloadPathRoot = path.join(appPath, 'dist-electron', 'preload.cjs');

  console.log('--- PATH DEBUGGING ---');
  console.log('App Path:', appPath);
  console.log('__dirname:', __dirname);
  console.log('Preload (ref):', preloadPathRef, '| Exists:', fs.existsSync(preloadPathRef));
  console.log('Preload (root):', preloadPathRoot, '| Exists:', fs.existsSync(preloadPathRoot));
  console.log('----------------------');


  const finalPreload = path.join(appPath, 'dist-electron', 'preload.cjs');

  const preloadExists = fs.existsSync(finalPreload);
  console.log('Final Preload Path used:', finalPreload, '| Exists:', preloadExists);

  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: finalPreload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true, 
    },
  })

  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('!!! PRELOAD ERROR DETECTED !!!');
    console.error('Path:', preloadPath);
    console.error('Error:', error);
  });

  console.log('Final Preload Path used:', finalPreload);

 
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.disableHardwareAcceleration();

import { protocol } from 'electron';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      standard: true, 
      stream: true
    }
  }
])

app.whenReady().then(() => {

  protocol.handle('media', (request) => {
    try {
      const urlObj = new URL(request.url);
      let filePath = urlObj.pathname;

      if (urlObj.host && /^[a-z]$/i.test(urlObj.host)) {
        filePath = `${urlObj.host}:${filePath}`;
      } else if (process.platform === 'win32' && filePath.startsWith('/') && /^[a-zA-Z]:/.test(filePath.slice(1))) {
        filePath = filePath.slice(1);
      }

      const decodedPath = decodeURIComponent(filePath);

      if (!fs.existsSync(decodedPath)) {
        console.error(`[Media Protocol] File not found: ${decodedPath}`);
        return new Response('File not found', { status: 404 });
      }

      const stat = fs.statSync(decodedPath);
      const fileSize = stat.size;
      const range = request.headers.get('Range');

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;


        const fileStream = fs.createReadStream(decodedPath, { start, end });

        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                fileStream.destroy();
              }
            });
            fileStream.on('end', () => {
              try { controller.close(); } catch (e) { }
            });
            fileStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new Response(stream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': 'video/webm', 
          }
        });
      } else {
        const fileStream = fs.createReadStream(decodedPath);

        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                fileStream.destroy();
              }
            });
            fileStream.on('end', () => {
              try { controller.close(); } catch (e) { }
            });
            fileStream.on('error', (err) => controller.error(err));
          },
          cancel() {
            fileStream.destroy();
          }
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': 'video/webm',
            'Accept-Ranges': 'bytes',
          }
        });
      }

    } catch (error) {
      console.error('[Media Protocol] Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  const { session } = require('electron');

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] },
    (details: any, callback: any) => {
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: media: *; media-src * blob: media:; frame-src *;"
        ]
      }
    })
  });

  createWindow();
})
