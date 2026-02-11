import { ipcMain, shell } from 'electron';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

// TODO: These should be provided by User or Env
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:5000/callback';

let oAuth2Client: OAuth2Client | null = null;
let server: http.Server | null = null;
let currentTokens: any = null; // Stored in memory for now

export function setupDriveHandlers() {

  // 1. Check Session
  ipcMain.handle('drive:get-session', async () => {
    // In a real app, strict validation of tokens would happen here
    return { isLoggedIn: !!currentTokens, user: null };
  });

  // 2. Start Auth Flow
  ipcMain.handle('drive:authenticate', async () => {
    return new Promise((resolve) => {
      oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
      });

      if (server) {
        server.close();
        server = null;
      }

      server = http.createServer(async (req, res) => {
        try {
          if (req.url && req.url.startsWith('/callback')) {
            const qs = new url.URL(req.url, 'http://localhost:5000').searchParams;
            const code = qs.get('code');

            if (code) {
              res.end('Authentication successful! You can close this window.');

              const { tokens } = await oAuth2Client!.getToken(code);
              oAuth2Client!.setCredentials(tokens);
              currentTokens = tokens;

              if (server) {
                server.close();
                server = null;
              }
              resolve({ success: true, tokens });
            } else {
              res.end('Authentication failed: No code received.');
              resolve({ success: false, error: 'No code received' });
            }
          }
        } catch (e: any) {
          res.end('Authentication failed: ' + e.message);
          resolve({ success: false, error: e.message });
        }
      });

      server.listen(5000, () => {
        shell.openExternal(authorizeUrl);
      });
    });
  });

  // 3. Logout
  ipcMain.handle('drive:logout', async () => {
    currentTokens = null;
    oAuth2Client = null;
    return { success: true };
  });

  // 4. Upload File
  ipcMain.handle('drive:upload', async (_, { filePath, tokens }) => {
    try {
      if (!tokens) {
        if (!currentTokens) throw new Error("No access tokens provided. Please login.");
        tokens = currentTokens;
      }

      // Ensure client has credentials
      if (!oAuth2Client) {
        oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      }
      oAuth2Client.setCredentials(tokens);

      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      const response = await drive.files.create({
        requestBody: {
          name: path.basename(filePath),
          mimeType: 'video/webm',
        },
        media: {
          mimeType: 'video/webm',
          body: fs.createReadStream(filePath),
        },
        fields: 'id, webViewLink, name',
      });

      return { success: true, fileId: response.data.id, link: response.data.webViewLink };

    } catch (error: any) {
      console.error('Upload error:', error);
      return { success: false, error: error.message || 'Upload failed' };
    }
  });
}
