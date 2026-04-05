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
      getHint: (username) => electron.ipcRenderer.invoke("auth:get-hint", username),
      changeUsername: (data) => electron.ipcRenderer.invoke("auth:change-username", data),
      changePassword: (data) => electron.ipcRenderer.invoke("auth:change-password", data)
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
      upload: (filePath, tokens, folderId, title) => electron.ipcRenderer.invoke("drive:upload", { filePath, tokens, folderId, title }),
      logout: () => electron.ipcRenderer.invoke("drive:logout"),
      getSession: () => electron.ipcRenderer.invoke("drive:get-session"),
      listFolders: (parentId, tokens) => electron.ipcRenderer.invoke("drive:list-folders", { parentId, tokens }),
      sendEmail: (data) => electron.ipcRenderer.invoke("drive:send-email", data)
    },
    library: {
      getContents: (data) => electron.ipcRenderer.invoke("library:get-contents", data),
      createFolder: (data) => electron.ipcRenderer.invoke("library:create-folder", data),
      deleteItem: (data) => electron.ipcRenderer.invoke("library:delete-item", data),
      renameItem: (data) => electron.ipcRenderer.invoke("library:rename-item", data),
      moveItem: (data) => electron.ipcRenderer.invoke("library:move-item", data),
      copyItem: (data) => electron.ipcRenderer.invoke("library:copy-item", data)
    },
    history: {
      add: (data) => electron.ipcRenderer.invoke("history:add", data),
      get: (data) => electron.ipcRenderer.invoke("history:get", data),
      delete: (data) => electron.ipcRenderer.invoke("history:delete", data),
      getFragmentByName: (data) => electron.ipcRenderer.invoke("history:get-fragment-by-name", data)
    },
    admin: {
      getUsers: (data) => electron.ipcRenderer.invoke("admin:get-users", data),
      deleteUser: (data) => electron.ipcRenderer.invoke("admin:delete-user", data),
      resetPassword: (data) => electron.ipcRenderer.invoke("admin:reset-password", data),
      changeUsername: (data) => electron.ipcRenderer.invoke("admin:change-username", data)
    },
    archive: {
      create: (data) => electron.ipcRenderer.invoke("archive:create", data)
    }
  });
  console.log("--- PRELOAD SCRIPT FINISHED ---");
} catch (error) {
  console.error("--- PRELOAD SCRIPT ERROR ---");
  console.error(error);
}
