const api = window.desktopAPI;

const state = {
  view: 'input',
  taskId: null,
  pendingStart: false,
  format: 'mp3',
  autoImport: false,
  importDirectory: '',
  metadata: {},
  result: null,
  logs: []
};

const stageOrder = ['info', 'downloading', 'processing', 'importing'];
const stageLabels = {
  preparing: '正在准备任务',
  info: '正在获取视频信息',
  downloading: '正在下载最佳音频',
  processing: '正在处理音频文件',
  importing: '正在自动导入',
  completed: '提取完成',
  warning: '已完成，但有提示',
  failed: '任务未完成',
  cancelled: '任务已取消'
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function setHidden(element, hidden) {
  element.hidden = hidden;
}

function showView(name) {
  state.view = name;
  $$('.view').forEach((view) => view.classList.toggle('is-visible', view.id === `${name}-view`));
  $$('.step').forEach((step) => {
    const ownIndex = ['input', 'progress', 'result'].indexOf(step.dataset.step);
    const currentIndex = ['input', 'progress', 'result'].indexOf(name);
    step.classList.toggle('is-active', ownIndex === currentIndex);
    step.classList.toggle('is-done', ownIndex < currentIndex);
  });
  $('.workspace').scrollTo({ top: 0, behavior: 'smooth' });
}

function validUrl(value) {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function setFormError(message = '') {
  const element = $('#form-error');
  element.textContent = message;
  setHidden(element, !message);
}

function appendLog(message, tone = '') {
  if (!message) return;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  state.logs.push({ message, time, tone });
  state.logs = state.logs.slice(-30);
  const log = $('#task-log');
  log.innerHTML = '';
  state.logs.forEach((entry) => {
    const line = document.createElement('p');
    line.textContent = `[${entry.time}] ${entry.message}`;
    if (entry.tone) line.className = entry.tone;
    log.append(line);
  });
  log.scrollTop = log.scrollHeight;
}

function updateProgress(value) {
  const progress = Math.min(100, Math.max(0, Number(value) || 0));
  $('#progress-percent').textContent = `${Math.round(progress)}%`;
  const bar = $('#segmented-progress');
  bar.setAttribute('aria-valuenow', String(Math.round(progress)));
  const filled = Math.floor((progress / 100) * 12);
  [...bar.children].forEach((segment, index) => {
    segment.classList.toggle('is-filled', index < filled);
    segment.classList.toggle('is-current', index === filled && progress < 100);
  });
}

function updateTimeline(stage) {
  const currentIndex = stageOrder.indexOf(stage);
  $$('.timeline li').forEach((item) => {
    const index = stageOrder.indexOf(item.dataset.stage);
    item.classList.toggle('is-done', currentIndex > index || ['completed', 'warning'].includes(stage));
    item.classList.toggle('is-current', index === currentIndex);
    item.classList.toggle('is-skipped', item.dataset.stage === 'importing' && !state.autoImport);
  });
}

function setProgressState(stage, message) {
  $('#progress-title').textContent = stageLabels[stage] || '正在处理';
  $('#progress-subtitle').textContent = message || '';
  updateTimeline(stage);
  appendLog(message || stageLabels[stage]);
}

function resetProgress() {
  state.logs = [];
  $('#task-log').innerHTML = '';
  $('#task-error').hidden = true;
  $('#retry-button').hidden = true;
  $('#back-button').hidden = true;
  $('#cancel-button').hidden = false;
  $('#cancel-button').disabled = false;
  $('#progress-badge').textContent = '[IN_PROGRESS]';
  $('#progress-badge').className = 'status-badge';
  $('#download-detail').textContent = '等待开始';
  $('#import-stage-detail').textContent = state.autoImport ? '等待音频生成' : '本次未开启';
  updateProgress(0);
  updateTimeline('preparing');
}

function optionsFromForm() {
  return {
    url: $('#video-url').value.trim(),
    format: $('input[name="format"]:checked').value,
    title: $('#song-title').value.trim(),
    artist: $('#song-artist').value.trim(),
    album: $('#song-album').value.trim(),
    autoImport: $('#auto-import').checked,
    importDirectory: state.importDirectory
  };
}

async function beginTask() {
  const options = optionsFromForm();
  $('#url-error').textContent = '';
  $('#directory-error').textContent = '';
  setFormError();
  if (!validUrl(options.url)) {
    $('#url-error').textContent = '请输入完整的 http:// 或 https:// 视频链接。';
    $('#video-url').focus();
    return;
  }
  if (options.autoImport && !options.importDirectory) {
    $('#directory-error').textContent = '开启自动导入后，请先选择目标文件夹。';
    return;
  }
  if (!api) {
    setFormError('桌面桥接未加载。请通过打包后的桌面应用运行。');
    return;
  }

  state.format = options.format;
  state.autoImport = options.autoImport;
  state.metadata = { title: options.title, artist: options.artist, album: options.album };
  state.taskId = null;
  resetProgress();
  showView('progress');
  state.pendingStart = true;
  try {
    await api.updateSettings({
      format: options.format,
      autoImport: options.autoImport,
      importDirectory: options.importDirectory
    });
    const response = await api.startTask(options);
    state.taskId = response.taskId;
    appendLog('任务已创建，开始连接来源。');
  } catch (error) {
    state.pendingStart = false;
    showTaskError(error.message || '无法创建任务。', '请检查输入和自动导入目录后重试。');
  }
}

function showTaskError(message, suggestion) {
  $('#task-error-title').textContent = message;
  $('#task-error-suggestion').textContent = suggestion || '';
  $('#task-error').hidden = false;
  $('#progress-title').textContent = stageLabels.failed;
  $('#progress-subtitle').textContent = '请按提示修改后重试。';
  $('#progress-badge').textContent = '[FAILED]';
  $('#cancel-button').hidden = true;
  $('#retry-button').hidden = false;
  $('#back-button').hidden = false;
  appendLog(message, 'error-line');
}

function populateMetadata(payload) {
  state.metadata = payload;
  if (payload.thumbnail) {
    $('#cover-image').src = payload.thumbnail;
    $('#cover-image').hidden = false;
    $('#cover-placeholder').hidden = true;
  } else {
    $('#cover-image').hidden = true;
    $('#cover-placeholder').hidden = false;
  }
  appendLog(`已识别：${payload.title}`);
  if (payload.playlistIgnored) appendLog('检测到播放列表参数，本次只处理当前视频。');
}

function renderResult(result, stage) {
  state.result = result;
  $('#result-song').textContent = result.title || '—';
  $('#result-artist').textContent = result.artist || '未提供';
  $('#result-album').textContent = result.album || '未提供';
  $('#result-format').textContent = result.format.toUpperCase();

  const hasWarning = stage === 'warning' || result.warnings?.length;
  $('#result-kicker').textContent = hasWarning ? 'TASK_COMPLETE_WITH_WARNING' : 'TASK_COMPLETE';
  $('#result-title').firstChild.textContent = hasWarning ? '已完成，但有提示' : '提取完成';
  $('#result-summary').textContent = hasWarning ? '核心音频已生成，部分附加操作未能完成。' : '音频文件已经可以保存和使用。';
  $('#result-badge').textContent = hasWarning ? '[WARNING]' : '[COMPLETED]';
  $('#result-badge').className = `status-badge ${hasWarning ? '' : 'mint'}`;

  const coverRow = $('#cover-result-row');
  if (result.coverEmbedded) {
    coverRow.classList.remove('is-warning');
    coverRow.querySelector('i').textContent = '✓';
    coverRow.querySelector('small').textContent = '视频封面已写入音频文件';
    $('#cover-status').textContent = '封面已嵌入';
  } else {
    coverRow.classList.add('is-warning');
    coverRow.querySelector('i').textContent = '!';
    coverRow.querySelector('small').textContent = '封面未能写入，音频仍可正常使用';
    $('#cover-status').textContent = '无嵌入封面';
  }

  const importRow = $('#import-result-row');
  importRow.classList.remove('is-warning');
  if (!result.autoImportRequested) {
    importRow.querySelector('i').textContent = '—';
    importRow.querySelector('small').textContent = '本次未开启';
  } else if (result.imported) {
    importRow.querySelector('i').textContent = '✓';
    importRow.querySelector('small').textContent = `已复制到 ${result.importedPath}`;
  } else {
    importRow.classList.add('is-warning');
    importRow.querySelector('i').textContent = '!';
    importRow.querySelector('small').textContent = '自动导入失败，可重新选择目录';
  }

  const warningList = $('#warning-list');
  if (result.warnings?.length) {
    warningList.innerHTML = result.warnings.map((warning) => `<div>⚠ ${escapeHtml(warning)}</div>`).join('');
    warningList.hidden = false;
  } else {
    warningList.hidden = true;
  }
  $('#reimport-actions').hidden = !(result.autoImportRequested && !result.imported);
  $('#result-toast').hidden = true;
  showView('result');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function handleTaskEvent(event) {
  if (!state.taskId && state.pendingStart) state.taskId = event.taskId;
  if (event.taskId !== state.taskId) return;
  state.pendingStart = false;
  if (event.type === 'stage') {
    setProgressState(event.stage, event.message);
    updateProgress(event.progress);
  } else if (event.type === 'progress') {
    setProgressState(event.stage, event.message);
    updateProgress(event.progress);
    if (event.downloadProgress != null) {
      $('#download-detail').textContent = `${Number(event.downloadProgress).toFixed(1)}%`;
    }
  } else if (event.type === 'metadata') {
    populateMetadata(event);
  } else if (event.type === 'complete') {
    updateProgress(100);
    renderResult(event.result, event.stage);
  } else if (event.type === 'error') {
    showTaskError(event.error.message, event.error.suggestion);
  } else if (event.type === 'cancelled') {
    $('#progress-title').textContent = stageLabels.cancelled;
    $('#progress-subtitle').textContent = event.message;
    $('#progress-badge').textContent = '[CANCELLED]';
    $('#cancel-button').hidden = true;
    $('#back-button').hidden = false;
    appendLog(event.message);
  }
}

async function chooseImportDirectory() {
  if (!api) return;
  const result = await api.selectDirectory();
  if (result.canceled) return;
  if (!result.valid) {
    $('#directory-error').textContent = result.message || '该目录无法写入。';
    return;
  }
  state.importDirectory = result.directory;
  $('#import-directory').textContent = result.directory;
  $('#import-directory').title = result.directory;
  $('#directory-error').textContent = '';
}

function resetForNextTask() {
  state.taskId = null;
  state.result = null;
  state.metadata = {};
  state.logs = [];
  $('#video-url').value = '';
  $('#song-title').value = '';
  $('#song-artist').value = '';
  $('#song-album').value = '';
  $('#cover-image').src = '';
  $('#cover-image').hidden = true;
  $('#cover-placeholder').hidden = false;
  $('#url-error').textContent = '';
  setFormError();
  showView('input');
  $('#video-url').focus();
}

async function init() {
  $('#extract-form').addEventListener('submit', (event) => {
    event.preventDefault();
    beginTask();
  });
  $('#video-url').addEventListener('input', () => {
    $('#url-error').textContent = '';
    setFormError();
  });
  $('#clear-url').addEventListener('click', () => {
    $('#video-url').value = '';
    $('#url-error').textContent = '';
    $('#video-url').focus();
  });
  $('#metadata-toggle').addEventListener('click', () => {
    const expanded = $('#metadata-toggle').getAttribute('aria-expanded') === 'true';
    $('#metadata-toggle').setAttribute('aria-expanded', String(!expanded));
    $('#metadata-fields').hidden = expanded;
    $('#metadata-toggle i').textContent = expanded ? '＋' : '−';
  });
  $$('input[name="format"]').forEach((input) => input.addEventListener('change', () => {
    state.format = input.value;
    setFormError();
  }));
  $('#auto-import').addEventListener('change', async () => {
    state.autoImport = $('#auto-import').checked;
    $('#directory-row').hidden = !state.autoImport;
    $('#directory-error').textContent = '';
    if (api) await api.updateSettings({ autoImport: state.autoImport });
  });
  $('#choose-directory').addEventListener('click', chooseImportDirectory);
  $('#clear-directory').addEventListener('click', async () => {
    state.importDirectory = '';
    $('#import-directory').textContent = '尚未选择目录';
    $('#import-directory').title = '';
    if (api) await api.updateSettings({ importDirectory: '' });
  });
  $('#cancel-button').addEventListener('click', async () => {
    if (!state.taskId || !api) return;
    $('#cancel-button').disabled = true;
    appendLog('正在取消任务…');
    await api.cancelTask(state.taskId);
  });
  $('#back-button').addEventListener('click', () => showView('input'));
  $('#retry-button').addEventListener('click', beginTask);
  $('#new-task-button').addEventListener('click', resetForNextTask);
  $('#save-button').addEventListener('click', async () => {
    if (!state.taskId || !api) return;
    $('#save-button').disabled = true;
    try {
      const saved = await api.saveResult(state.taskId);
      if (!saved.canceled) {
        $('#result-toast').textContent = `文件已保存：${saved.filePath}`;
        $('#result-toast').hidden = false;
      }
    } catch (error) {
      $('#result-toast').className = 'notice error';
      $('#result-toast').textContent = `保存失败：${error.message}`;
      $('#result-toast').hidden = false;
    } finally {
      $('#save-button').disabled = false;
    }
  });
  $('#reselect-import-directory').addEventListener('click', async () => {
    await chooseImportDirectory();
    if (!state.importDirectory || !state.taskId) return;
    try {
      const imported = await api.importAgain(state.taskId, state.importDirectory);
      $('#result-toast').className = 'notice success';
      $('#result-toast').textContent = `已重新导入：${imported.fileName}`;
      $('#result-toast').hidden = false;
      $('#reimport-actions').hidden = true;
      $('#import-result-row').classList.remove('is-warning');
      $('#import-result-row i').textContent = '✓';
      $('#import-result-row small').textContent = `已复制到 ${imported.directory}`;
    } catch (error) {
      $('#result-toast').className = 'notice error';
      $('#result-toast').textContent = `自动导入失败：${error.message}`;
      $('#result-toast').hidden = false;
    }
  });

  if (!api) {
    setFormError('当前是静态预览，提取功能需要在桌面应用中运行。');
    return;
  }
  api.onTaskEvent(handleTaskEvent);
  const [appInfo, settings] = await Promise.all([api.getAppInfo(), api.getSettings()]);
  $('#app-version').textContent = `VERSION ${appInfo.version}`;
  state.format = settings.format;
  state.autoImport = settings.autoImport;
  state.importDirectory = settings.importDirectory || '';
  const formatInput = $(`input[name="format"][value="${settings.format}"]`);
  if (formatInput) formatInput.checked = true;
  $('#auto-import').checked = settings.autoImport;
  $('#directory-row').hidden = !settings.autoImport;
  if (settings.importDirectory) {
    $('#import-directory').textContent = settings.importDirectory;
    $('#import-directory').title = settings.importDirectory;
    const validation = await api.validateDirectory(settings.importDirectory);
    if (!validation.valid) {
      $('#directory-error').textContent = '上次选择的目录已失效，请重新选择。';
      state.importDirectory = '';
      await api.updateSettings({ importDirectory: '' });
    }
  }
}

window.addEventListener('DOMContentLoaded', init);
