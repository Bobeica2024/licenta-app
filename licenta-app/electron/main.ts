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

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

import fs from 'node:fs'; // Import fs for checking file existence

// Set the display name of the application (does NOT affect userData path - safe to change)
app.setName('FragMan');

function createWindow() {
  // Debug paths
  const appPath = app.getAppPath();
  const preloadPathRef = path.join(__dirname, 'preload.cjs');
  const preloadPathRoot = path.join(appPath, 'dist-electron', 'preload.cjs');

  console.log('--- PATH DEBUGGING ---');
  console.log('App Path:', appPath);
  console.log('__dirname:', __dirname);
  console.log('Preload (ref):', preloadPathRef, '| Exists:', fs.existsSync(preloadPathRef));
  console.log('Preload (root):', preloadPathRoot, '| Exists:', fs.existsSync(preloadPathRoot));
  console.log('----------------------');

  // const finalPreload = fs.existsSync(preloadPathRef) ? preloadPathRef : preloadPathRoot;
  // FORCE CJS: The preload script MUST be loaded as .cjs because the project is ESM but preload requires CommonJS context
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
      webSecurity: true, // Ensure web security is enabled
    },
  })

  win.webContents.on('preload-error', (event, preloadPath, error) => {
    console.error('!!! PRELOAD ERROR DETECTED !!!');
    console.error('Path:', preloadPath);
    console.error('Error:', error);
  });

  console.log('Final Preload Path used:', finalPreload);

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Force autoplay to work without interaction
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Fix for black screen on some Windows systems (forces software rendering)
app.disableHardwareAcceleration();

// Register custom protocol 'media' to be privileged
import { protocol, net } from 'electron';
import { pathToFileURL } from 'node:url'; // Import pathToFileURL

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      standard: true, // Behaves like http/file
      stream: true
    }
  }
])

app.whenReady().then(() => {
  // Handle 'media' protocol to serve local files
  // Handle 'media' protocol to serve local files with Range support
  protocol.handle('media', (request) => {
    try {
      const urlObj = new URL(request.url);
      let filePath = urlObj.pathname;

      // Handle Windows drive letters
      if (urlObj.host && /^[a-z]$/i.test(urlObj.host)) {
        filePath = `${urlObj.host}:${filePath}`;
      } else if (process.platform === 'win32' && filePath.startsWith('/') && /^[a-zA-Z]:/.test(filePath.slice(1))) {
        filePath = filePath.slice(1);
      }

      const decodedPath = decodeURIComponent(filePath);
      // console.log(`[Media Protocol] Path: ${decodedPath}`);

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

        // console.log(`[Media Protocol] Range: ${start}-${end}/${fileSize}`);

        const fileStream = fs.createReadStream(decodedPath, { start, end });

        // Convert Node stream to Web ReadableStream
        const stream = new ReadableStream({
          start(controller) {
            fileStream.on('data', (chunk) => {
              try {
                controller.enqueue(chunk);
              } catch (e) {
                // Controller might be closed if request was cancelled
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
            'Content-Type': 'video/webm', // Adjust based on file type if needed, but we mostly use webm
          }
        });
      } else {
        // console.log(`[Media Protocol] Full file request`);
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
            'Accept-Ranges': 'bytes', // Advertise range support even on full request
          }
        });
      }

    } catch (error) {
      console.error('[Media Protocol] Error:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  });

  // Intercept requests to YouTube to fake the Referer header
  // This tricks YouTube into thinking the request comes from YouTube itself or a valid browser
  const { session } = require('electron');

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] },
    (details: any, callback: any) => {
      // details.requestHeaders['Referer'] = 'https://www.youtube.com/';
      // Force a standard browser User-Agent to prevent YouTube from blocking Electron
      // details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'; (Commented out for testing)
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // Allow YouTube to work by adjusting CSP
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
