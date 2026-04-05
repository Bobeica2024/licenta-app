/// <reference types="vite/client" />

interface Window {
    ipcRenderer: import('electron').IpcRenderer
    api: {
        auth: {
            login: (credentials: any) => Promise<{ success: boolean; user?: any; error?: string }>;
            register: (details: any) => Promise<{ success: boolean; userId?: number; error?: string }>;
            getHint: (username: string) => Promise<{ success: boolean; hint?: string; error?: string }>;
            changeUsername: (data: { userId: number; newUsername: string }) => Promise<{ success: boolean; error?: string }>;
            changePassword: (data: { userId: number; newPassword: string }) => Promise<{ success: boolean; error?: string }>;
            deleteAccount: (data: { userId: number }) => Promise<{ success: boolean; error?: string }>;
        };
        recorder: {
            getSources: () => Promise<Array<{ id: string; name: string; thumbnail: string }>>;
            // selectPath: () => Promise<string>;
            getTempPath: () => Promise<string>;
            startSave: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            writeChunk: (filePath: string, chunk: ArrayBuffer) => Promise<{ success: boolean; error?: string }>;
            stopSave: (data: { filePath: string; userId?: number; title?: string; sourceUrl?: string; saveToDb?: boolean }) => Promise<{ success: boolean; error?: string }>;
            cropVideo: (data: { inputPath: string; crop: { x: number; y: number; width: number; height: number } }) => Promise<{ success: boolean; outputPath?: string; error?: string }>;
            deleteTempFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
            saveFile: (data: { tempPath: string; destination: string; userId?: number; title?: string; sourceUrl?: string; folderId?: number | null }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        };
        drive: {
            authenticate: () => Promise<{ success: boolean; tokens?: any; error?: string }>;
            upload: (filePath: string, tokens?: any, folderId?: string, title?: string) => Promise<{ success: boolean; fileId?: string; link?: string; error?: string }>;
            logout: () => Promise<{ success: boolean; error?: string }>;
            getSession: () => Promise<{ isLoggedIn: boolean; user?: any }>;
            listFolders: (parentId?: string, tokens?: any) => Promise<{ success: boolean; folders?: { id: string; name: string }[]; error?: string }>;
            sendEmail: (data: { to: string; subject: string; text: string; filePath: string; fileName: string }) => Promise<{ success: boolean; error?: string }>;
        };
        library: {
            getContents: (data: { folderId: number | null; userId: number }) => Promise<any[]>;
            createFolder: (data: { name: string; parentId: number | null; userId: number }) => Promise<{ success: boolean; error?: string }>;
            deleteItem: (data: { id: number; type: 'folder' | 'file'; userId: number }) => Promise<{ success: boolean; error?: string }>;
            renameItem: (data: { id: number; type: string; newName: string; userId: number }) => Promise<{ success: boolean; error?: string }>;
            moveItem: (data: { id: number; type: string; targetFolderId: number | null; userId: number }) => Promise<{ success: boolean; error?: string }>;
            copyItem: (data: { id: number; type: string; targetFolderId: number | null; userId: number }) => Promise<{ success: boolean; error?: string }>;
        };
        history: {
            add: (data: { userId: number; actionType: string; itemName: string }) => Promise<{ success: boolean; error?: string }>;
            get: (data: { userId: number; isAdmin: boolean }) => Promise<{ success: boolean; history?: any[]; error?: string }>;
            delete: (data: { id: number; userId: number; isAdmin: boolean }) => Promise<{ success: boolean; error?: string }>;
            getFragmentByName: (data: { itemName: string; ownerId: number }) => Promise<{ success: boolean; fragment?: any; error?: string }>;
        };
        admin: {
            getUsers: (data: { isAdmin: boolean }) => Promise<{ success: boolean; users?: any[]; error?: string }>;
            deleteUser: (data: { targetUserId: number; isAdmin: boolean }) => Promise<{ success: boolean; error?: string }>;
            resetPassword: (data: { targetUserId: number; newPassword: string; isAdmin: boolean }) => Promise<{ success: boolean; error?: string }>;
            changeUsername: (data: { targetUserId: number; newUsername: string; isAdmin: boolean }) => Promise<{ success: boolean; error?: string }>;
        };
        archive: {
            create: (data: { items: { id: number; type: 'folder' | 'file' }[]; targetFolderId: number | null; archiveName?: string; userId: number; destination?: 'local' | 'db' | 'drive' }) => Promise<{ success: boolean; filePath?: string; destination?: string; fileName?: string; error?: string }>;
        };
    };
}
