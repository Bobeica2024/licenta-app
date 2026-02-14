"use strict";
const electron = require("electron");
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
    selectPath: () => electron.ipcRenderer.invoke("recorder:select-path"),
    startSave: (filePath) => electron.ipcRenderer.invoke("recorder:start-save", filePath),
    writeChunk: (filePath, chunk) => electron.ipcRenderer.invoke("recorder:write-chunk", { filePath, chunk }),
    stopSave: (data) => electron.ipcRenderer.invoke("recorder:stop-save", data)
  },
  drive: {
    authenticate: () => electron.ipcRenderer.invoke("drive:authenticate"),
    upload: (filePath, tokens) => electron.ipcRenderer.invoke("drive:upload", { filePath, tokens }),
    logout: () => electron.ipcRenderer.invoke("drive:logout"),
    getSession: () => electron.ipcRenderer.invoke("drive:get-session")
  }
});
