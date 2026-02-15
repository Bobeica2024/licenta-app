const { contextBridge, ipcRenderer } = require('electron');

console.log('!!! DEBUG PRELOAD CJS LOADED !!!');

try {
    contextBridge.exposeInMainWorld('api', {
        status: 'working_cjs_contextBridge',
        auth: {},
        recorder: {},
        drive: {}
    });
    console.log('!!! WINDOW API EXPOSED VIA CONTEXT BRIDGE (CJS) !!!');
} catch (e) {
    console.error('!!! CONTEXT BRIDGE FAILED !!!', e);
    // Fallback if context isolation is somehow off
    try {
        window.api = { status: 'working_cjs_direct_fallback' };
        console.log('!!! FALLBACK TO DIRECT ASSIGNMENT !!!');
    } catch (err) {
        console.error('!!! FALLBACK FAILED !!!', err);
    }
}
