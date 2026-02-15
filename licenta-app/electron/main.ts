import { app, BrowserWindow } from 'electron'
import './db' // Initialize database
import { setupAuthHandlers } from './auth';
import { setupRecorderHandlers } from './recorder';
import { setupDriveHandlers } from './drive';

setupAuthHandlers();
setupRecorderHandlers();
setupDriveHandlers();
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
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
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

app.whenReady().then(() => {
  // Intercept requests to YouTube to fake the Referer header
  // This tricks YouTube into thinking the request comes from YouTube itself or a valid browser
  const { session } = require('electron');

  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] },
    (details: any, callback: any) => {
      details.requestHeaders['Referer'] = 'https://www.youtube.com/';
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // Allow YouTube to work by adjusting CSP
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *; media-src * blob:; frame-src *;"
        ]
      }
    })
  });

  createWindow();
})
