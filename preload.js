// --- START OF FILE preload.js ---
// Exposes a minimal, safe API to the renderer via the context bridge.

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    loadConfig: () => ipcRenderer.invoke('config:load'),
    saveConfig: (data) => ipcRenderer.invoke('config:save', data),
    exportConfig: (data) => ipcRenderer.invoke('config:export', data),
    importConfig: () => ipcRenderer.invoke('config:import')
});

// --- END OF FILE preload.js ---