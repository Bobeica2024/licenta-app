const { ipcRenderer } = require('electron');

console.log('!!! DEBUG PRELOAD LOADED (No Context Isolation) !!!');

// Direct assignment when contextIsolation is false
window.ipcRenderer = ipcRenderer;

window.api = {
    status: 'working_direct',
    auth: {},
    recorder: {},
    drive: {}
};

console.log('!!! WINDOW API ASSIGNED DIRECTLY !!!');
