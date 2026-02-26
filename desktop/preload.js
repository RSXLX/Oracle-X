/**
 * Oracle-X Desktop - Preload Script
 */

const { contextBridge, ipcRenderer } = require('electron');

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
  
  // Wallet
  addWallet: (address, chain, label) => ipcRenderer.invoke('addWallet', address, chain, label),
  getWallets: () => ipcRenderer.invoke('getWallets'),
  getWalletTransactions: (address, chain, limit) => ipcRenderer.invoke('getWalletTransactions', address, chain, limit),
  analyzeWallet: (address, chain) => ipcRenderer.invoke('analyzeWallet', address, chain),
  
  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('takeScreenshot'),
  
  // Events
  onAppActivated: (callback) => ipcRenderer.on('app-activated', (event, appName) => callback(appName)),
  onScreenshotAnalyzed: (callback) => ipcRenderer.on('screenshot-analyzed', (event, result) => callback(result)),
  
  platform: process.platform,
});
