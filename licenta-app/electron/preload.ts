import { ipcRenderer, contextBridge } from 'electron'

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
  },
  recorder: {
    getSources: () => ipcRenderer.invoke('recorder:get-sources'),
    selectPath: () => ipcRenderer.invoke('recorder:select-path'),
    startSave: (filePath: string) => ipcRenderer.invoke('recorder:start-save', filePath),
    writeChunk: (filePath: string, chunk: ArrayBuffer) => ipcRenderer.invoke('recorder:write-chunk', { filePath, chunk }),
    stopSave: (data: any) => ipcRenderer.invoke('recorder:stop-save', data),
  }
})
