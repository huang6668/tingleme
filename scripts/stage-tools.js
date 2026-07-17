const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'build-tools');
const gunzip = promisify(zlib.gunzip);
const FFMPEG_RELEASE = 'b6.0';
const FFMPEG_BASE = `https://github.com/eugeneware/ffmpeg-static/releases/download/${FFMPEG_RELEASE}`;
const YT_DLP_RELEASE = process.env.YT_DLP_RELEASE || 'latest';

function executableName(name) {
  return process.platform === 'win32' ? `${name}.exe` : name;
}

async function sha256(filePath) {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function downloadBytes(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Ting-Le-Me-Build/1.0' }
  });
  if (!response.ok) throw new Error(`下载失败 (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function download(url, destination, { compressed = false, executable = false } = {}) {
  const sourceBytes = await downloadBytes(url);
  const bytes = compressed ? await gunzip(sourceBytes) : sourceBytes;
  await fs.writeFile(destination, bytes);
  if (executable && process.platform !== 'win32') await fs.chmod(destination, 0o755);
  return destination;
}

function ffmpegAsset() {
  const supported = {
    'win32:x64': 'win32-x64',
    'darwin:x64': 'darwin-x64',
    'darwin:arm64': 'darwin-arm64'
  };
  const target = supported[`${process.platform}:${process.arch}`];
  if (!target) throw new Error(`不支持构建目标：${process.platform}/${process.arch}`);
  return target;
}

async function verifyYtDlpChecksum(assetName, bytes) {
  const sumsUrl = YT_DLP_RELEASE === 'latest'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS'
    : `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_RELEASE}/SHA2-256SUMS`;
  const sums = (await downloadBytes(sumsUrl)).toString('utf8');
  const match = sums.split(/\r?\n/).find((line) => line.trim().endsWith(`  ${assetName}`));
  if (!match) throw new Error(`未找到 ${assetName} 的官方校验值。`);
  const expected = match.trim().split(/\s+/)[0].toLowerCase();
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`${assetName} 校验失败，已停止构建。`);
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  const ffmpegTarget = ffmpegAsset();
  const ffmpegPath = path.join(outputDir, executableName('ffmpeg'));
  await download(`${FFMPEG_BASE}/ffmpeg-${ffmpegTarget}.gz`, ffmpegPath, {
    compressed: true,
    executable: true
  });
  await download(`${FFMPEG_BASE}/${ffmpegTarget}.LICENSE`, path.join(outputDir, 'FFMPEG_LICENSE.txt'));
  await download(`${FFMPEG_BASE}/${ffmpegTarget}.README`, path.join(outputDir, 'FFMPEG_README.txt'));

  const ytDlpAsset = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';
  const ytDlpPath = path.join(outputDir, executableName('yt-dlp'));
  const ytDlpBase = YT_DLP_RELEASE === 'latest'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download'
    : `https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_RELEASE}`;
  const ytDlpBytes = await downloadBytes(`${ytDlpBase}/${ytDlpAsset}`);
  await verifyYtDlpChecksum(ytDlpAsset, ytDlpBytes);
  await fs.writeFile(ytDlpPath, ytDlpBytes);
  if (process.platform !== 'win32') await fs.chmod(ytDlpPath, 0o755);
  const ytDlpSourceRef = YT_DLP_RELEASE === 'latest' ? 'master' : YT_DLP_RELEASE;
  await download(
    `https://raw.githubusercontent.com/yt-dlp/yt-dlp/${ytDlpSourceRef}/THIRD_PARTY_LICENSES.txt`,
    path.join(outputDir, 'YT_DLP_THIRD_PARTY_LICENSES.txt')
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    ffmpegRelease: FFMPEG_RELEASE,
    ytDlpRelease: YT_DLP_RELEASE,
    sourceNotice: '这些文件由 GitHub Actions 在构建时下载，不应提交到源码仓库。',
    files: {
      ffmpeg: await sha256(ffmpegPath),
      ytDlp: await sha256(ytDlpPath)
    }
  };
  await fs.writeFile(
    path.join(outputDir, 'tool-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );

  process.stdout.write(`已准备 ${process.platform}/${process.arch} 构建工具。\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
