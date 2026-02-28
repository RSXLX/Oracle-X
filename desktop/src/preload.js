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
  removeWallet: (address) => ipcRenderer.invoke('removeWallet', address),
  getWallets: () => ipcRenderer.invoke('getWallets'),
  getWalletTransactions: (address, chain, limit) => ipcRenderer.invoke('getWalletTransactions', address, chain, limit),
  analyzeWallet: (address, chain) => ipcRenderer.invoke('analyzeWallet', address, chain),
  aiAnalyzeWallet: (address, chain) => ipcRenderer.invoke('aiAnalyzeWallet', address, chain),
  saveWalletData: () => ipcRenderer.invoke('saveWalletData'),
  loadWalletData: () => ipcRenderer.invoke('loadWalletData'),

  // File import (CSV / XLSX)
  importFile: () => ipcRenderer.invoke('importFile'),

  // Import history
  getImportHistory: () => ipcRenderer.invoke('getImportHistory'),
  getTransactionsByBatch: (batchId) => ipcRenderer.invoke('getTransactionsByBatch', batchId),

  // AI trade analysis
  aiAnalyzeTrades: (transactions) => ipcRenderer.invoke('aiAnalyzeTrades', transactions),

  // Export
  exportData: (data, format) => ipcRenderer.invoke('exportData', data, format),

  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('takeScreenshot'),

  // Events
  onAppActivated: (callback) => ipcRenderer.on('app-activated', (event, appName) => callback(appName)),
  onScreenshotAnalyzed: (callback) => ipcRenderer.on('screenshot-analyzed', (event, result) => callback(result)),
  onScreenshotCaptured: (callback) => ipcRenderer.on('screenshot-captured', (event, data) => callback(data)),
  onScreenshotResult: (callback) => ipcRenderer.on('screenshot-result', (event, result) => callback(result)),
  onScreenshotError: (callback) => ipcRenderer.on('screenshot-error', (event, data) => callback(data)),

  // Permissions
  checkPermissions: () => ipcRenderer.invoke('checkPermissions'),
  toggleAutoMonitor: (enable) => ipcRenderer.invoke('toggleAutoMonitor', enable),

  // i18n
  setLocale: (lang) => ipcRenderer.invoke('setLocale', lang),

  platform: process.platform,
});
