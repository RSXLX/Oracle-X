const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oracleDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  getConfigStatus: () => ipcRenderer.invoke('config-status:get'),
  listDecisionLogs: (limit) => ipcRenderer.invoke('decision-log:list', limit),
  testConnection: () => ipcRenderer.invoke('connection:test'),
});
