const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = Object.freeze({
  format: 'mp3',
  autoImport: false,
  importDirectory: ''
});

class SettingsStore {
  constructor(userDataPath) {
    this.filePath = path.join(userDataPath, 'settings.json');
    this.value = { ...DEFAULT_SETTINGS };
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.value = this.sanitize(parsed);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('无法读取设置，已恢复默认值。', error.message);
      }
    }
    return { ...this.value };
  }

  get() {
    return { ...this.value };
  }

  async update(patch) {
    this.value = this.sanitize({ ...this.value, ...patch });
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(this.value, null, 2)}\n`, 'utf8');
    await fs.rm(this.filePath, { force: true });
    await fs.rename(temporaryPath, this.filePath);
    return this.get();
  }

  sanitize(candidate) {
    const format = ['mp3', 'm4a', 'alac'].includes(candidate?.format)
      ? candidate.format
      : DEFAULT_SETTINGS.format;
    return {
      format,
      autoImport: Boolean(candidate?.autoImport),
      importDirectory:
        typeof candidate?.importDirectory === 'string' ? candidate.importDirectory : ''
    };
  }
}

module.exports = { SettingsStore, DEFAULT_SETTINGS };
