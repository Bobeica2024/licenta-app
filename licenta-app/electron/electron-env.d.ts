/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    
    APP_ROOT: string
    
    VITE_PUBLIC: string
  }
}

interface Window {
  ipcRenderer: import('electron').IpcRenderer;
  api: {
    auth: {
      login: (credentials: any) => Promise<any>;
      register: (details: any) => Promise<any>;
      getHint: (username: string) => Promise<any>;
    };
    recorder: {
      getSources: () => Promise<any[]>;
      selectPath: () => Promise<string>;
      getTempPath: () => Promise<string>;
      startSave: (filePath: string) => Promise<any>;
      writeChunk: (filePath: string, chunk: ArrayBuffer) => Promise<any>;
      stopSave: (data: any) => Promise<any>;
      cropVideo: (data: { inputPath: string, crop: { x: number, y: number, width: number, height: number } }) => Promise<{ success: boolean, outputPath?: string, error?: string }>;
      deleteTempFile: (filePath: string) => Promise<any>;
      saveFile: (data: { tempPath: string, destination: string, userId?: number, title?: string, sourceUrl?: string, folderId?: number | null }) => Promise<{ success: boolean, filePath?: string, error?: string }>;
    };
    drive: {
      authenticate: () => Promise<any>;
      upload: (filePath: string, tokens: any, folderId?: string, title?: string) => Promise<any>;
      logout: () => Promise<any>;
      getSession: () => Promise<any>;
      listFolders: (parentId?: string, tokens?: any) => Promise<{ success: boolean, folders?: { id: string, name: string }[], error?: string }>;
    };
    library: {
      getContents: (data: { folderId: number | null, userId: number }) => Promise<any[]>;
      createFolder: (data: { name: string, parentId: number | null, userId: number }) => Promise<any>;
      deleteItem: (data: { id: number, type: 'folder' | 'file', userId: number }) => Promise<any>;
    };
  };
}
