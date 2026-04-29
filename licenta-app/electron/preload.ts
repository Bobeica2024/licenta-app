import { ipcRenderer, contextBridge } from 'electron'

console.log('--- PRELOAD SCRIPT STARTED ---');

try {
  console.log('ipcRenderer available:', !!ipcRenderer);

  // --------- Expose some API to the Renderer process ---------
  contextBridge.exposeInMainWorld('ipcRenderer', {
    on(...args: Parameters<typeof ipcRenderer.on>) {
      const [channel, listener] = args
      return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
    },
    off(...args: Parameters<typeof ipcRenderer.off>) {
      const [channel, ...omit] = args
      return ipcRenderer.off(channel, ...omit)
    },
    send(...args: Parameters<typeof ipcRenderer.send>) {
      const [channel, ...omit] = args
      return ipcRenderer.send(channel, ...omit)
    },
    invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
      const [channel, ...omit] = args
      return ipcRenderer.invoke(channel, ...omit)
    },
  })

  contextBridge.exposeInMainWorld('api', {
    auth: {
      login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
      register: (details: any) => ipcRenderer.invoke('auth:register', details),
      getHint: (username: string) => ipcRenderer.invoke('auth:get-hint', username),
      changeUsername: (data: any) => ipcRenderer.invoke('auth:change-username', data),
      changePassword: (data: any) => ipcRenderer.invoke('auth:change-password', data),
      deleteAccount: (data: any) => ipcRenderer.invoke('auth:delete-account', data),
    },
    recorder: {
      getSources: () => ipcRenderer.invoke('recorder:get-sources'),
      selectVideo: () => ipcRenderer.invoke('recorder:select-video'),
      getTempPath: () => ipcRenderer.invoke('recorder:get-temp-path'),
      startSave: (filePath: string) => ipcRenderer.invoke('recorder:start-save', filePath),
      writeChunk: (filePath: string, chunk: ArrayBuffer) => ipcRenderer.invoke('recorder:write-chunk', { filePath, chunk }),
      stopSave: (data: any) => ipcRenderer.invoke('recorder:stop-save', data),
      cropVideo: (data: any) => ipcRenderer.invoke('recorder:crop-video', data),
      deleteTempFile: (filePath: string) => ipcRenderer.invoke('recorder:delete-temp-file', filePath),
      saveFile: (data: any) => ipcRenderer.invoke('recorder:save-file', data),
    },
    drive: {
      authenticate: () => ipcRenderer.invoke('drive:authenticate'),
      upload: (filePath: string, tokens: any, folderId?: string, title?: string) => ipcRenderer.invoke('drive:upload', { filePath, tokens, folderId, title }),
      logout: () => ipcRenderer.invoke('drive:logout'),
      getSession: () => ipcRenderer.invoke('drive:get-session'),
      listFolders: (parentId?: string, tokens?: any) => ipcRenderer.invoke('drive:list-folders', { parentId, tokens }),
      sendEmail: (data: any) => ipcRenderer.invoke('drive:send-email', data)
    },
    library: {
      getContents: (data: any) => ipcRenderer.invoke('library:get-contents', data),
      createFolder: (data: any) => ipcRenderer.invoke('library:create-folder', data),
      deleteItem: (data: any) => ipcRenderer.invoke('library:delete-item', data),
      renameItem: (data: any) => ipcRenderer.invoke('library:rename-item', data),
      moveItem: (data: any) => ipcRenderer.invoke('library:move-item', data),
      copyItem: (data: any) => ipcRenderer.invoke('library:copy-item', data),
    },
    history: {
      add: (data: any) => ipcRenderer.invoke('history:add', data),
      get: (data: any) => ipcRenderer.invoke('history:get', data),
      delete: (data: any) => ipcRenderer.invoke('history:delete', data),
      getFragmentByName: (data: any) => ipcRenderer.invoke('history:get-fragment-by-name', data),
    },
    admin: {
      getUsers: (data: any) => ipcRenderer.invoke('admin:get-users', data),
      deleteUser: (data: any) => ipcRenderer.invoke('admin:delete-user', data),
      resetPassword: (data: any) => ipcRenderer.invoke('admin:reset-password', data),
      changeUsername: (data: any) => ipcRenderer.invoke('admin:change-username', data),
    },
    archive: {
      create: (data: any) => ipcRenderer.invoke('archive:create', data),
      list: (filePath: string) => ipcRenderer.invoke('archive:list', filePath),
      extractItem: (archivePath: string, entryName: string) => ipcRenderer.invoke('archive:extract-item', archivePath, entryName)
    }
  })

  console.log('--- PRELOAD SCRIPT FINISHED ---');

} catch (error) {
  console.error('--- PRELOAD SCRIPT ERROR ---');
  console.error(error);
}
