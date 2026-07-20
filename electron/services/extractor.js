const { spawn } = require('node:child_process');
const { constants } = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');

const FORMATS = new Set(['mp3', 'm4a', 'alac']);
const STAGES = Object.freeze({
  PREPARING: 'preparing',
  INFO: 'info',
  DOWNLOADING: 'downloading',
  PROCESSING: 'processing',
  IMPORTING: 'importing',
  COMPLETED: 'completed',
  WARNING: 'warning',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
});

function toolName(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

function getToolPaths(resourcesPath, isPackaged, rootPath) {
  const directory = isPackaged
    ? path.join(resourcesPath, 'tools')
    : path.join(rootPath, 'build-tools');
  return {
    directory,
    ytDlp: path.join(directory, toolName('yt-dlp')),
    ffmpeg: path.join(directory, toolName('ffmpeg'))
  };
}

function sanitizeFilename(value, fallback = 'audio') {
  const cleaned = String(value || '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/[. ]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
  return cleaned || fallback;
}

function trimText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateHttpUrl(value) {
  try {
    const parsed = new URL(String(value).trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function friendlyError(error, stage) {
  if (error?.code === 'CANCELLED') {
    return { code: 'CANCELLED', message: '任务已取消。', suggestion: '可以修改设置后重新开始。' };
  }
  const raw = String(error?.stderr || error?.message || error || '');
  const lower = raw.toLowerCase();
  if (lower.includes('private video') || lower.includes('仅限')) {
    return { code: 'PRIVATE', message: '该视频是私有内容，当前无法访问。', suggestion: '请更换公开可访问的链接。' };
  }
  if (lower.includes('video unavailable') || lower.includes('not available') || lower.includes('已失效')) {
    return { code: 'UNAVAILABLE', message: '该内容已删除、不可用或受到地区限制。', suggestion: '请确认链接可在浏览器中正常播放。' };
  }
  if (lower.includes('unsupported url') || lower.includes('no suitable extractor')) {
    return { code: 'UNSUPPORTED', message: '暂不支持这个网站或链接类型。', suggestion: '当前优先支持 YouTube、Bilibili 及 yt-dlp 兼容站点的单个视频。' };
  }
  if (lower.includes('timed out') || lower.includes('network') || lower.includes('connection') || lower.includes('http error')) {
    return { code: 'NETWORK', message: '网络连接失败或被中断。', suggestion: '请检查网络后重试，也可确认视频是否能在浏览器中播放。' };
  }
  if (lower.includes('no space left')) {
    return { code: 'NO_SPACE', message: '磁盘可用空间不足。', suggestion: '请释放空间后重试。' };
  }
  if (lower.includes('permission denied') || lower.includes('eacces') || lower.includes('eperm')) {
    return { code: 'PERMISSION', message: '没有权限写入目标位置。', suggestion: '请选择有写入权限的文件夹。' };
  }
  if (stage === STAGES.PROCESSING) {
    return { code: 'FORMAT', message: '无法生成所选音频格式。', suggestion: '请重试或更换输出格式。' };
  }
  return { code: 'UNKNOWN', message: '提取未能完成。', suggestion: '请检查链接和网络后重试；如果问题持续，可尝试其他格式。' };
}

function spawnProcess(command, args, options = {}) {
  const {
    onStdout,
    onStderr,
    maxOutputBytes = 512 * 1024,
    ...spawnOptions
  } = options;
  const child = spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...spawnOptions
  });
  let stdout = '';
  let stderr = '';
  const appendLimited = (current, text) => `${current}${text}`.slice(-maxOutputBytes);
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    stdout = appendLimited(stdout, text);
    onStdout?.(text);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stderr = appendLimited(stderr, text);
    onStderr?.(text);
  });
  const promise = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) return resolve({ stdout, stderr });
      const error = new Error(`进程退出 (${code ?? signal})`);
      error.exitCode = code;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
  return { child, promise };
}

function buildYtDlpArgs(nodeRuntimePath, args) {
  return [
    '--ignore-config',
    '--no-playlist',
    '--js-runtimes', `node:${nodeRuntimePath}`,
    ...args
  ];
}

async function ensureTools(tools) {
  for (const [name, filePath] of Object.entries({
    'yt-dlp': tools.ytDlp,
    ffmpeg: tools.ffmpeg
  })) {
    try {
      await fs.access(filePath, process.platform === 'win32' ? undefined : 1);
    } catch {
      const error = new Error(`安装包缺少 ${name}。请从 GitHub Actions 或 Release 获取完整安装包。`);
      error.code = 'MISSING_TOOL';
      throw error;
    }
  }
}

async function ensureWritableDirectory(directory) {
  if (!directory) throw new Error('尚未选择 Apple Music/iTunes 自动导入目录。');
  const stat = await fs.stat(directory);
  if (!stat.isDirectory()) throw new Error('自动导入位置不是文件夹。');
  await fs.access(directory, 2);
}

async function findDownloadedFiles(taskDirectory) {
  const names = await fs.readdir(taskDirectory);
  const audio = names
    .filter((name) => name.startsWith('source.'))
    .filter((name) => !name.endsWith('.part'))
    .filter((name) => !/\.(jpg|jpeg|png|webp|avif)$/i.test(name))
    .map((name) => path.join(taskDirectory, name))[0];
  const cover = names
    .filter((name) => /^source\.(jpg|jpeg|png|webp|avif)$/i.test(name))
    .map((name) => path.join(taskDirectory, name))[0];
  return { audio, cover };
}

function coverMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.avif': 'image/avif'
  }[extension] || 'application/octet-stream';
}

async function coverDataUrl(filePath) {
  if (!filePath) return '';
  const stat = await fs.stat(filePath);
  // A video thumbnail should be small. Avoid sending an unexpectedly large
  // source image through IPC while keeping the embedded audio unaffected.
  if (stat.size > 12 * 1024 * 1024) return '';
  const bytes = await fs.readFile(filePath);
  return `data:${coverMimeType(filePath)};base64,${bytes.toString('base64')}`;
}

function metadataArgs(metadata) {
  const pairs = [
    ['title', metadata.title],
    ['artist', metadata.artist],
    ['album', metadata.album]
  ];
  return pairs.flatMap(([key, value]) => value ? ['-metadata', `${key}=${value}`] : []);
}

function buildFfmpegArgs({ source, cover, output, format, metadata, sourceCodec }) {
  const normalizedCodec = String(sourceCodec).toLowerCase();
  const args = ['-hide_banner', '-y', '-i', source];
  if (cover) args.push('-i', cover);
  args.push('-map', '0:a:0');
  if (cover) args.push('-map', '1:v:0');

  if (format === 'mp3') {
    args.push('-c:a', 'libmp3lame', '-b:a', '320k', '-id3v2_version', '3');
  } else if (format === 'alac') {
    args.push('-c:a', 'alac');
  } else if (normalizedCodec === 'aac' || normalizedCodec.startsWith('mp4a') || normalizedCodec === 'alac') {
    args.push('-c:a', 'copy');
  } else {
    args.push('-c:a', 'aac', '-b:a', '256k');
  }

  if (cover) {
    args.push(
      '-c:v', 'mjpeg',
      '-frames:v', '1',
      '-disposition:v:0', 'attached_pic',
      '-metadata:s:v', 'title=Album cover',
      '-metadata:s:v', 'comment=Cover (front)'
    );
  }
  args.push(...metadataArgs(metadata), '-progress', 'pipe:1', '-nostats', output);
  return args;
}

async function copyWithoutOverwrite(source, targetDirectory, fileName) {
  const extension = path.extname(fileName);
  const stem = path.basename(fileName, extension);
  for (let index = 0; index < 1000; index += 1) {
    const candidateName = index === 0 ? fileName : `${stem} (${index + 1})${extension}`;
    const target = path.join(targetDirectory, candidateName);
    try {
      await fs.copyFile(source, target, constants.COPYFILE_EXCL);
      return target;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
  }
  throw new Error('目标目录中存在过多同名文件。');
}

class ExtractionManager {
  constructor({ userDataPath, resourcesPath, isPackaged, rootPath, nodeRuntimePath, emit }) {
    this.tasksDirectory = path.join(userDataPath, 'tasks');
    this.tools = getToolPaths(resourcesPath, isPackaged, rootPath);
    this.nodeRuntimePath = nodeRuntimePath;
    this.emit = emit;
    this.active = null;
    this.results = new Map();
  }

  async start(taskId, rawOptions) {
    if (this.active) throw new Error('已有任务正在处理中，请等待完成或先取消。');
    const url = validateHttpUrl(rawOptions.url);
    if (!url) throw new Error('请输入完整的 http:// 或 https:// 视频链接。');
    if (!FORMATS.has(rawOptions.format)) throw new Error('不支持所选输出格式。');

    const options = {
      url,
      format: rawOptions.format,
      title: trimText(rawOptions.title),
      artist: trimText(rawOptions.artist),
      album: trimText(rawOptions.album),
      autoImport: Boolean(rawOptions.autoImport),
      importDirectory: trimText(rawOptions.importDirectory)
    };
    if (options.autoImport) await ensureWritableDirectory(options.importDirectory);
    await ensureTools(this.tools);

    const controller = { taskId, child: null, cancelled: false };
    this.active = controller;
    this.run(controller, options).catch((error) => {
      console.error('未处理的任务错误', error);
    });
    return { taskId };
  }

  cancel(taskId) {
    if (!this.active || this.active.taskId !== taskId) return false;
    this.active.cancelled = true;
    if (this.active.child && !this.active.child.killed) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(this.active.child.pid), '/t', '/f'], {
          windowsHide: true,
          stdio: 'ignore'
        });
      } else {
        this.active.child.kill('SIGTERM');
      }
    }
    return true;
  }

  assertNotCancelled(controller) {
    if (controller.cancelled) {
      const error = new Error('任务已取消');
      error.code = 'CANCELLED';
      throw error;
    }
  }

  send(taskId, payload) {
    this.emit({ taskId, ...payload });
  }

  async runChild(controller, command, args, callbacks) {
    this.assertNotCancelled(controller);
    const processHandle = spawnProcess(command, args, callbacks);
    controller.child = processHandle.child;
    try {
      return await processHandle.promise;
    } finally {
      controller.child = null;
    }
  }

  runYtDlp(controller, args, callbacks = {}) {
    return this.runChild(
      controller,
      this.tools.ytDlp,
      buildYtDlpArgs(this.nodeRuntimePath, args),
      {
        ...callbacks,
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
      }
    );
  }

  async run(controller, options) {
    const taskId = controller.taskId;
    const taskDirectory = path.join(this.tasksDirectory, taskId);
    let stage = STAGES.PREPARING;
    try {
      await fs.rm(taskDirectory, { recursive: true, force: true });
      await fs.mkdir(taskDirectory, { recursive: true });
      this.send(taskId, { type: 'stage', stage, progress: 2, message: '正在创建任务并检查输入…' });

      stage = STAGES.INFO;
      this.send(taskId, { type: 'stage', stage, progress: 7, message: '正在获取视频信息…' });
      const infoResult = await this.runYtDlp(controller, [
        '--skip-download', '--dump-single-json', '-f', 'bestaudio/best',
        '--no-warnings', '--ffmpeg-location', this.tools.directory, options.url
      ], { maxOutputBytes: 8 * 1024 * 1024 });
      this.assertNotCancelled(controller);
      const info = JSON.parse(infoResult.stdout);
      const sourceTitle = trimText(info.title) || '未命名音频';
      const title = options.title || sourceTitle;
      const artist = options.artist || trimText(info.artist) || trimText(info.uploader);
      const album = options.album || trimText(info.album);
      const metadata = { title, artist, album };
      this.send(taskId, {
        type: 'metadata',
        title,
        artist,
        album,
        sourceTitle,
        site: trimText(info.extractor_key) || trimText(info.extractor),
        playlistIgnored: Boolean(info.playlist || info.playlist_id)
      });

      stage = STAGES.DOWNLOADING;
      this.send(taskId, { type: 'stage', stage, progress: 12, message: '正在下载最佳可用音频和封面…' });
      let downloadBuffer = '';
      const handleDownloadText = (text) => {
        downloadBuffer += text;
        const lines = downloadBuffer.split(/\r?\n/);
        downloadBuffer = lines.pop() || '';
        for (const line of lines) {
          const match = line.match(/DOWNLOAD_PROGRESS:\s*([\d.]+)%/);
          if (match) {
            const value = Math.min(100, Math.max(0, Number(match[1])));
            this.send(taskId, {
              type: 'progress',
              stage,
              downloadProgress: value,
              progress: 12 + value * 0.58,
              message: `正在下载音频… ${value.toFixed(1)}%`
            });
          }
        }
      };
      await this.runYtDlp(controller, [
        '--newline', '--no-overwrites',
        '--ffmpeg-location', this.tools.directory,
        '--progress-template', 'download:DOWNLOAD_PROGRESS:%(progress._percent_str)s',
        '--write-thumbnail', '-f', 'bestaudio/best',
        '-o', path.join(taskDirectory, 'source.%(ext)s'), options.url
      ], { onStdout: handleDownloadText, onStderr: handleDownloadText });
      this.assertNotCancelled(controller);

      const files = await findDownloadedFiles(taskDirectory);
      if (!files.audio) throw new Error('下载完成后未找到来源音频文件。');
      let coverPreview = '';
      if (files.cover) {
        try {
          coverPreview = await coverDataUrl(files.cover);
        } catch {
          // The cover is still passed to FFmpeg below; preview failure should
          // not make an otherwise valid audio extraction fail.
        }
      }
      const sourceCodec = trimText(info.acodec) || trimText(
        (info.requested_formats || []).find((format) => format.acodec && format.acodec !== 'none')?.acodec
      );
      const sourceDuration = Number(info.duration || 0);
      const extension = options.format === 'mp3' ? 'mp3' : 'm4a';
      const outputName = `${sanitizeFilename(title)}.${extension}`;
      const outputPath = path.join(taskDirectory, outputName);

      stage = STAGES.PROCESSING;
      this.send(taskId, { type: 'stage', stage, progress: 72, message: '正在转换格式并写入歌曲信息…' });
      let coverEmbedded = Boolean(files.cover);
      let coverWarning = files.cover ? '' : '来源未提供可用封面，音频已正常生成。';
      const processAudio = async (cover) => {
        let progressBuffer = '';
        const handleProgress = (text) => {
          progressBuffer += text;
          const lines = progressBuffer.split(/\r?\n/);
          progressBuffer = lines.pop() || '';
          for (const line of lines) {
            const [key, value] = line.split('=');
            if ((key === 'out_time_us' || key === 'out_time_ms') && sourceDuration > 0) {
              const seconds = Number(value) / 1_000_000;
              const ratio = Math.min(1, Math.max(0, seconds / sourceDuration));
              this.send(taskId, {
                type: 'progress', stage, progress: 72 + ratio * 20,
                message: '正在转换格式并嵌入封面…'
              });
            }
          }
        };
        return this.runChild(
          controller,
          this.tools.ffmpeg,
          buildFfmpegArgs({
            source: files.audio,
            cover,
            output: outputPath,
            format: options.format,
            metadata,
            sourceCodec
          }),
          { onStdout: handleProgress }
        );
      };

      if (files.cover) {
        try {
          await processAudio(files.cover);
        } catch (error) {
          this.assertNotCancelled(controller);
          await fs.rm(outputPath, { force: true });
          await processAudio(null);
          coverEmbedded = false;
          coverWarning = '封面写入失败，音频文件仍已正常生成。';
        }
      } else {
        await processAudio(null);
      }
      const outputStat = await fs.stat(outputPath);
      if (!outputStat.isFile() || outputStat.size === 0) throw new Error('没有生成有效的音频文件。');

      let importedPath = '';
      let importWarning = '';
      if (options.autoImport) {
        stage = STAGES.IMPORTING;
        this.send(taskId, { type: 'stage', stage, progress: 94, message: '正在复制到 Apple Music/iTunes 自动添加目录…' });
        try {
          await ensureWritableDirectory(options.importDirectory);
          importedPath = await copyWithoutOverwrite(outputPath, options.importDirectory, outputName);
        } catch {
          importWarning = '音频已生成，但自动导入失败。请重新选择有效目录后再次导入。';
        }
      }

      const warnings = [coverWarning, importWarning].filter(Boolean);
      const result = {
        taskId,
        title,
        artist,
        album,
        format: options.format,
        fileName: outputName,
        outputPath,
        coverPath: files.cover || '',
        coverDataUrl: coverPreview,
        coverEmbedded,
        autoImportRequested: options.autoImport,
        imported: Boolean(importedPath),
        importedPath,
        warnings
      };
      this.results.set(taskId, result);
      this.send(taskId, {
        type: 'complete',
        stage: warnings.length ? STAGES.WARNING : STAGES.COMPLETED,
        progress: 100,
        result: {
          ...result,
          outputPath: undefined,
          coverPath: undefined,
          importedPath: importedPath ? options.importDirectory : ''
        }
      });
    } catch (error) {
      if (controller.cancelled || error.code === 'CANCELLED') {
        this.send(taskId, { type: 'cancelled', stage: STAGES.CANCELLED, message: '任务已取消。' });
      } else {
        const friendly = error.code === 'MISSING_TOOL'
          ? { code: error.code, message: error.message, suggestion: '请使用 GitHub Actions 生成的完整安装包。' }
          : friendlyError(error, stage);
        this.send(taskId, { type: 'error', stage: STAGES.FAILED, error: friendly });
      }
    } finally {
      if (this.active?.taskId === taskId) this.active = null;
    }
  }

  getResult(taskId) {
    return this.results.get(taskId) || null;
  }

  async importAgain(taskId, directory) {
    const result = this.getResult(taskId);
    if (!result) throw new Error('结果文件已不可用，请重新提取。');
    await ensureWritableDirectory(directory);
    const importedPath = await copyWithoutOverwrite(result.outputPath, directory, result.fileName);
    result.imported = true;
    result.importedPath = importedPath;
    return { directory, fileName: path.basename(importedPath) };
  }
}

module.exports = {
  ExtractionManager,
  STAGES,
  buildFfmpegArgs,
  buildYtDlpArgs,
  coverDataUrl,
  copyWithoutOverwrite,
  friendlyError,
  sanitizeFilename,
  validateHttpUrl,
  ensureWritableDirectory
};
