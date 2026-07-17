const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

if (duplicates.length) {
  throw new Error(`HTML 存在重复 id：${[...new Set(duplicates)].join(', ')}`);
}

const selectorIds = [...script.matchAll(/\$\('#([A-Za-z][\w-]*)'\)/g)].map((match) => match[1]);
const missing = [...new Set(selectorIds)].filter((id) => !ids.includes(id));
if (missing.length) {
  throw new Error(`app.js 引用了不存在的元素：${missing.join(', ')}`);
}

const requiredViews = ['input-view', 'progress-view', 'result-view'];
for (const id of requiredViews) {
  if (!ids.includes(id)) throw new Error(`缺少必要视图：${id}`);
}

process.stdout.write(`UI contract OK (${ids.length} ids)\n`);

