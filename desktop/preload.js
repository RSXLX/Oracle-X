/**
 * Oracle-X Desktop - Preload Script
 */

const { contextBridge, ipcRenderer } = require('electron');

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('oracleDesktop', {
  // Settings
  getSettings: () => ipcRenderer.invoke('getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('saveSettings', settings),
  
  // Connection
  testConnection: () => ipcRenderer.invoke('testConnection'),
  
  // Decision logs
  listDecisionLogs: (limit) => ipcRenderer.invoke('listDecisionLogs', limit),
  
  // Analysis
  analyzeNow: (data) => ipcRenderer.invoke('analyzeNow', data),
  
  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('takeScreenshot'),
  
  // Event listeners
  onAppActivated: (callback) => {
    ipcRenderer.on('app-activated', (event, appName) => callback(appName));
  },
  
  // Platform info
  platform: process.platform,
});
