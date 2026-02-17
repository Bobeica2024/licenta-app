"use strict";
const electron = require("electron");
console.log("--- PRELOAD SCRIPT STARTED ---");
try {
  console.log("ipcRenderer available:", !!electron.ipcRenderer);
  electron.contextBridge.exposeInMainWorld("ipcRenderer", {
    on(...args) {
      const [channel, listener] = args;
      return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
    },
    off(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.off(channel, ...omit);
    },
    send(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.send(channel, ...omit);
    },
    invoke(...args) {
      const [channel, ...omit] = args;
      return electron.ipcRenderer.invoke(channel, ...omit);
    }
  });
  electron.contextBridge.exposeInMainWorld("api", {
    auth: {
      login: (credentials) => electron.ipcRenderer.invoke("auth:login", credentials),
      register: (details) => electron.ipcRenderer.invoke("auth:register", details),
      getHint: (username) => electron.ipcRenderer.invoke("auth:get-hint", username)
    },
    recorder: {
      getSources: () => electron.ipcRenderer.invoke("recorder:get-sources"),
      // selectPath: () => ipcRenderer.invoke('recorder:select-path'), // Deprecated
      getTempPath: () => electron.ipcRenderer.invoke("recorder:get-temp-path"),
      startSave: (filePath) => electron.ipcRenderer.invoke("recorder:start-save", filePath),
      writeChunk: (filePath, chunk) => electron.ipcRenderer.invoke("recorder:write-chunk", { filePath, chunk }),
      stopSave: (data) => electron.ipcRenderer.invoke("recorder:stop-save", data),
      cropVideo: (data) => electron.ipcRenderer.invoke("recorder:crop-video", data),
      deleteTempFile: (filePath) => electron.ipcRenderer.invoke("recorder:delete-temp-file", filePath),
      saveFile: (data) => electron.ipcRenderer.invoke("recorder:save-file", data)
    },
    drive: {
      authenticate: () => electron.ipcRenderer.invoke("drive:authenticate"),
      upload: (filePath, tokens) => electron.ipcRenderer.invoke("drive:upload", { filePath, tokens }),
      logout: () => electron.ipcRenderer.invoke("drive:logout"),
      getSession: () => electron.ipcRenderer.invoke("drive:get-session")
    },
    library: {
      getContents: (data) => electron.ipcRenderer.invoke("library:get-contents", data),
      createFolder: (data) => electron.ipcRenderer.invoke("library:create-folder", data),
      deleteItem: (data) => electron.ipcRenderer.invoke("library:delete-item", data)
    }
  });
  console.log("--- PRELOAD SCRIPT FINISHED ---");
} catch (error) {
  console.error("--- PRELOAD SCRIPT ERROR ---");
  console.error(error);
}
