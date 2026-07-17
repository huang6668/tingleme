const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopAPI', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  selectDirectory: () => ipcRenderer.invoke('directory:select'),
  validateDirectory: (directory) => ipcRenderer.invoke('directory:validate', directory),
  startTask: (options) => ipcRenderer.invoke('task:start', options),
  cancelTask: (taskId) => ipcRenderer.invoke('task:cancel', taskId),
  saveResult: (taskId) => ipcRenderer.invoke('task:save', taskId),
  importAgain: (taskId, directory) => ipcRenderer.invoke('task:import-again', taskId, directory),
  revealPath: (filePath) => ipcRenderer.invoke('path:reveal', filePath),
  onTaskEvent: (listener) => {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('task:event', wrapped);
    return () => ipcRenderer.removeListener('task:event', wrapped);
  }
});

