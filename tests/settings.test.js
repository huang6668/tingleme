const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SettingsStore } = require('../electron/services/settings');

test('settings persist valid values and sanitize invalid formats', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'yt-settings-test-'));
  try {
    const first = new SettingsStore(directory);
    await first.load();
    await first.update({ format: 'alac', autoImport: true, importDirectory: '/music' });

    const second = new SettingsStore(directory);
    assert.deepEqual(await second.load(), {
      format: 'alac',
      autoImport: true,
      importDirectory: '/music'
    });
    assert.equal((await second.update({ format: 'wav' })).format, 'mp3');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

