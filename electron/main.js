const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { ExtractionManager, ensureWritableDirectory } = require('./services/extractor');
const { SettingsStore } = require('./services/settings');

let mainWindow;
let extractionManager;
let settingsStore;

function createTaskId() {
  return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
}

async function cleanOldTasks(userDataPath) {
  const directory = path.join(userDataPath, 'tasks');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  try {
    for (const name of await fs.readdir(directory)) {
      const target = path.join(directory, name);
      const stat = await fs.stat(target);
      if (stat.mtimeMs < cutoff) await fs.rm(target, { recursive: true, force: true });
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('清理旧任务失败', error.message);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 940,
    minHeight: 680,
    backgroundColor: '#0d0d0d',
    title: '听了么',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function registerIpc() {
  ipcMain.handle('app:get-info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged
  }));

  ipcMain.handle('settings:get', () => settingsStore.get());
  ipcMain.handle('settings:update', (_event, patch) => settingsStore.update(patch));

  ipcMain.handle('directory:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Apple Music/iTunes 自动添加目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const directory = result.filePaths[0];
    try {
      await ensureWritableDirectory(directory);
      await settingsStore.update({ importDirectory: directory });
      return { canceled: false, directory, valid: true };
    } catch (error) {
      return { canceled: false, directory, valid: false, message: error.message };
    }
  });

  ipcMain.handle('directory:validate', async (_event, directory) => {
    try {
      await ensureWritableDirectory(directory);
      return { valid: true };
    } catch (error) {
      return { valid: false, message: error.message };
    }
  });

  ipcMain.handle('task:start', async (_event, options) => {
    const taskId = createTaskId();
    await extractionManager.start(taskId, options);
    return { taskId };
  });

  ipcMain.handle('task:cancel', (_event, taskId) => extractionManager.cancel(taskId));

  ipcMain.handle('task:save', async (_event, taskId) => {
    const result = extractionManager.getResult(taskId);
    if (!result) throw new Error('结果文件已不可用，请重新提取。');
    const chosen = await dialog.showSaveDialog(mainWindow, {
      title: '保存音频文件',
      defaultPath: result.fileName,
      filters: [{ name: result.format.toUpperCase(), extensions: [path.extname(result.fileName).slice(1)] }],
      properties: ['showOverwriteConfirmation', 'createDirectory']
    });
    if (chosen.canceled || !chosen.filePath) return { canceled: true };
    await fs.copyFile(result.outputPath, chosen.filePath);
    return { canceled: false, filePath: chosen.filePath };
  });

  ipcMain.handle('task:import-again', async (_event, taskId, directory) => {
    return extractionManager.importAgain(taskId, directory);
  });

  ipcMain.handle('path:reveal', async (_event, filePath) => {
    if (typeof filePath !== 'string' || !filePath) return false;
    shell.showItemInFolder(filePath);
    return true;
  });
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  settingsStore = new SettingsStore(userDataPath);
  await settingsStore.load();
  await cleanOldTasks(userDataPath);
  extractionManager = new ExtractionManager({
    userDataPath,
    resourcesPath: process.resourcesPath,
    isPackaged: app.isPackaged,
    rootPath: path.join(__dirname, '..'),
    nodeRuntimePath: process.execPath,
    emit: (payload) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('task:event', payload);
      }
    }
  });
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
