const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oracleDesktop', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (next) => ipcRenderer.invoke('settings:set', next),
  getConfigStatus: () => ipcRenderer.invoke('config-status:get'),
  listDecisionLogs: (limit) => ipcRenderer.invoke('decision-log:list', limit),
});
