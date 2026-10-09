const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  buildFfmpegArgs,
  buildYtDlpArgs,
  coverDataUrl,
  copyWithoutOverwrite,
  friendlyError,
  sanitizeFilename,
  validateHttpUrl,
  STAGES
} = require('../electron/services/extractor');

test('sanitizeFilename preserves Chinese while removing forbidden characters', () => {
  assert.equal(sanitizeFilename('  夜曲: live / 2026?  '), '夜曲 live 2026');
  assert.equal(sanitizeFilename('***'), 'audio');
});

test('validateHttpUrl accepts only complete HTTP URLs', () => {
  assert.equal(validateHttpUrl('plain text'), null);
  assert.equal(validateHttpUrl('ftp://example.com/file'), null);
  assert.equal(validateHttpUrl(' https://www.youtube.com/watch?v=abc '), 'https://www.youtube.com/watch?v=abc');
});

test('yt-dlp is configured to use Electron as its bundled Node runtime', () => {
  const args = buildYtDlpArgs('/Applications/听了么.app/Contents/MacOS/听了么', ['--version']);
  assert.deepEqual(args.slice(0, 4), [
    '--ignore-config',
    '--no-playlist',
    '--js-runtimes',
    'node:/Applications/听了么.app/Contents/MacOS/听了么'
  ]);
});

test('M4A copies compatible AAC sources and transcodes incompatible sources', () => {
  const common = {
    source: '/tmp/source',
    cover: null,
    output: '/tmp/output.m4a',
    format: 'm4a',
    metadata: { title: 'Song', artist: '', album: '' }
  };
  const copyArgs = buildFfmpegArgs({ ...common, sourceCodec: 'aac' });
  const mp4aArgs = buildFfmpegArgs({ ...common, sourceCodec: 'mp4a.40.2' });
  const transcodeArgs = buildFfmpegArgs({ ...common, sourceCodec: 'opus' });
  assert.deepEqual(copyArgs.slice(copyArgs.indexOf('-c:a'), copyArgs.indexOf('-c:a') + 2), ['-c:a', 'copy']);
  assert.deepEqual(mp4aArgs.slice(mp4aArgs.indexOf('-c:a'), mp4aArgs.indexOf('-c:a') + 2), ['-c:a', 'copy']);
  assert.deepEqual(transcodeArgs.slice(transcodeArgs.indexOf('-c:a'), transcodeArgs.indexOf('-c:a') + 2), ['-c:a', 'aac']);
});

test('ALAC uses the ALAC encoder and MP3 uses high bitrate encoding', () => {
  const base = { source: 'source', cover: 'cover.webp', output: 'output', metadata: {}, sourceCodec: 'opus' };
  const alac = buildFfmpegArgs({ ...base, format: 'alac' });
  const mp3 = buildFfmpegArgs({ ...base, format: 'mp3' });
  assert.ok(alac.includes('alac'));
  assert.ok(mp3.includes('libmp3lame'));
  assert.ok(mp3.includes('320k'));
  assert.ok(mp3.includes('attached_pic'));
});

test('attached cover streams do not stop the whole audio transcode', () => {
  const args = buildFfmpegArgs({
    source: 'source.webm',
    cover: 'source.webp',
    output: 'output.m4a',
    format: 'm4a',
    metadata: {},
    sourceCodec: 'opus'
  });
  assert.ok(!args.includes('-frames:v'));
  assert.ok(args.includes('attached_pic'));
});

test('coverDataUrl turns a local thumbnail into an IPC-safe data URL', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ting-le-me-cover-test-'));
  try {
    const cover = path.join(directory, 'source.jpg');
    await fs.writeFile(cover, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
    assert.equal(await coverDataUrl(cover), 'data:image/jpeg;base64,/9j/2Q==');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('copyWithoutOverwrite generates a readable non-conflicting filename', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ting-le-me-test-'));
  try {
    const source = path.join(directory, 'source.tmp');
    const target = path.join(directory, 'target');
    await fs.mkdir(target);
    await fs.writeFile(source, 'audio');
    await fs.writeFile(path.join(target, '歌曲.mp3'), 'old');
    const copied = await copyWithoutOverwrite(source, target, '歌曲.mp3');
    assert.equal(path.basename(copied), '歌曲 (2).mp3');
    assert.equal(await fs.readFile(copied, 'utf8'), 'audio');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('friendlyError maps common access and processing failures', () => {
  assert.equal(friendlyError({ stderr: 'ERROR: Private video' }, STAGES.INFO).code, 'PRIVATE');
  assert.equal(friendlyError({ stderr: 'permission denied' }, STAGES.IMPORTING).code, 'PERMISSION');
  assert.equal(friendlyError({ stderr: 'encoder failed' }, STAGES.PROCESSING).code, 'FORMAT');
});
