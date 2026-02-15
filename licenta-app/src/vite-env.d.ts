/// <reference types="vite/client" />

interface Window {
    ipcRenderer: import('electron').IpcRenderer
    api: {
        auth: {
            login: (credentials: any) => Promise<{ success: boolean; user?: any; error?: string }>;
            register: (details: any) => Promise<{ success: boolean; userId?: number; error?: string }>;
            getHint: (username: string) => Promise<{ success: boolean; hint?: string; error?: string }>;
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
            saveFile: (data: { tempPath: string; destination: string; userId?: number; title?: string; sourceUrl?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
        };
        drive: {
            authenticate: () => Promise<{ success: boolean; tokens?: any; error?: string }>;
            upload: (filePath: string, tokens: any) => Promise<{ success: boolean; error?: string }>;
            logout: () => Promise<{ success: boolean; error?: string }>;
            getSession: () => Promise<{ isLoggedIn: boolean; user?: any }>;
        }
    }
}
