import { ipcMain, shell } from 'electron';
import http from 'http';
import url from 'url';
import fs from 'fs';
import path from 'path';

// Lazy load large libraries
// import { OAuth2Client } from 'google-auth-library';
// import { google } from 'googleapis';

// TODO: These should be provided by User or Env
const CLIENT_ID = '418678754293-h1hu29moqemeo88i26m7nppdpko4ikg3.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'http://localhost:5000/callback';

let oAuth2Client: any = null;
let server: http.Server | null = null;
let currentTokens: any = null; // Stored in memory for now

export function setupDriveHandlers() {

  ipcMain.handle('drive:get-session', async () => {
    return { isLoggedIn: !!currentTokens, user: null };
  });

  ipcMain.handle('drive:authenticate', async () => {
    return new Promise(async (resolve) => {
      const { OAuth2Client } = await import('google-auth-library');
      oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent select_account',
        scope: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/userinfo.profile',
          'https://www.googleapis.com/auth/userinfo.email',
          'https://www.googleapis.com/auth/gmail.send' // <-- Added scope
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

  ipcMain.handle('drive:logout', async () => {
    currentTokens = null;
    oAuth2Client = null;
    return { success: true };
  });

  ipcMain.handle('drive:upload', async (_, { filePath, tokens, folderId, title }) => {
    try {
      if (!tokens) {
        if (!currentTokens) throw new Error("No access tokens provided. Please login.");
        tokens = currentTokens;
      }

      if (!oAuth2Client) {
        const { OAuth2Client } = await import('google-auth-library');
        oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      }
      oAuth2Client.setCredentials(tokens);

      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      const ext = path.extname(filePath).toLowerCase();
      let mime = 'application/octet-stream';
      if (ext === '.mp4') mime = 'video/mp4';
      else if (ext === '.webm') mime = 'video/webm';
      else if (ext === '.zip') mime = 'application/zip';

      let finalName = title || path.basename(filePath);
      if (title && !title.toLowerCase().endsWith(ext)) {
        finalName += ext;
      }

      const requestBody: any = {
        name: finalName,
        mimeType: mime,
      };

      if (folderId) {
        requestBody.parents = [folderId];
      }

      const response = await drive.files.create({
        requestBody,
        media: {
          mimeType: mime,
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

  ipcMain.handle('drive:list-folders', async (_, { parentId, tokens }) => {
    try {
      if (!tokens) {
        if (!currentTokens) throw new Error("No access tokens provided. Please login.");
        tokens = currentTokens;
      }

      if (!oAuth2Client) {
        const { OAuth2Client } = await import('google-auth-library');
        oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      }
      oAuth2Client.setCredentials(tokens);

      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      const q = parentId
        ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `'root' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await drive.files.list({
        q: q,
        fields: 'files(id, name)',
        orderBy: 'name',
      });

      return { success: true, folders: response.data.files || [] };
    } catch (error: any) {
      console.error('List folders error:', error);
      return { success: false, error: error.message || 'Failed to list folders' };
    }
  });

  ipcMain.handle('drive:send-email', async (_, { to, subject, text, filePath, fileName }) => {
    try {
      if (!currentTokens) {
        return { success: false, error: 'Not authenticated with Google' };
      }

      if (!oAuth2Client) {
        const { OAuth2Client } = await import('google-auth-library');
        oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      }
      oAuth2Client.setCredentials(currentTokens);

      const { google } = await import('googleapis');

      const oauth2 = google.oauth2({ auth: oAuth2Client, version: 'v2' });
      const userInfo = await oauth2.userinfo.get();
      const userEmail = userInfo.data.email;
      if (!userEmail) throw new Error('Could not retrieve user email');

      const fileBuffer = fs.readFileSync(filePath);
      const fileBase64 = fileBuffer.toString('base64');
      const subjectEncoded = subject || 'Fișier atașat de la FragMan';
      const textBody = text || 'Găsește atașat fișierul tău.';

      const ext = path.extname(fileName).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.zip': 'application/zip',
        '.webm': 'video/webm',
        '.mp4': 'video/mp4',
        '.mkv': 'video/x-matroska',
        '.avi': 'video/x-msvideo',
      };
      const fileMime = mimeMap[ext] || 'application/octet-stream';

      const boundary = `boundary_${Date.now()}`;
      const rawLines = [
        `From: ${userEmail}`,
        `To: ${to}`,
        `Subject: ${subjectEncoded}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        textBody,
        '',
        `--${boundary}`,
        `Content-Type: ${fileMime}; name="${fileName}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${fileName}"`,
        '',
        fileBase64,
        '',
        `--${boundary}--`,
      ];

      const rawMessage = rawLines.join('\r\n');
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage }
      });

      return { success: true };

    } catch (error: any) {
      console.error('Email send error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }
  });
}
