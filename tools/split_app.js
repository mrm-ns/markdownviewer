/* ============================================================
 * 拆分工具：把 js/app.js 的顶层单元搬到指定模块
 *
 * 为什么需要工具而不是手工搬：
 *   js/app.js 有 6731 行 / 232 个顶层单元，其中 2 个函数名重复
 *   （resolveWorkspacePath、scrollToAnchor —— 历史遗留的死代码副本）。
 *   手工复制粘贴极易漏行、错行、把注释归错单元。
 *
 * 本工具的核心保证（每次搬完立刻验证）：
 *   1. 无损：所有单元按顺序拼接后的「非空行序列」与原文件逐行一致；
 *   2. 零改动：每个单元的 SHA-256 搬运前后不变（只搬家、不改逻辑）；
 *   3. 全覆盖：232 个单元覆盖全部 6731 行，没有一行落在单元之外。
 *
 * 用法：
 *   node tools/split_app.js --list              列出全部单元
 *   node tools/split_app.js --verify            校验当前 js/ 目录整体无损
 *   node tools/split_app.js --move <模块名> <单元名...>
 *
 * 单元名可用 "@<行号>" 形式指定，用于重名函数（如 @1240）。
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'js', 'app.js');
const UNITS_FILE = path.join(__dirname, 'units.json');

const TOP_RE = /^  (?:async\s+)?function [A-Za-z_$][\w$]*\s*\(/;
const DECL_RE = /^  (?:const|let|var) [A-Za-z_$][\w$]*/;

// 语言高亮子配置：它们是既有的独立模块，不属于 js/app.js 的拆分范围，
// 比对时必须排除，否则会被当成「多出来的单元」误报。
const LANG_FILES = new Set([
  'bash.js', 'ini.js', 'conf.js', 'keepalived.js', 'python.js', 'javascript.js',
  'json.js', 'yaml.js', 'nginx.js', 'xml.js', 'dockerfile.js', 'promql.js',
  'apache.js', 'text.js', 'sql.js'
]);

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').map(function (l) { return l.replace(/\r$/, ''); });
}

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

// 单元划分：顶层声明 + 其紧邻的前导注释（属于它自己），
// 尾随空行留给下一个单元，避免注释被上一个函数吞掉。
//
// 重要：前导注释只吃「注释行」，遇到另一个顶层声明就立刻停。
// 否则像
//     let md = null;
//     function initMarkdown() {   ← 中间没有空行
// 这种相邻声明会把下一个声明吞进上一个单元，导致比对时哈希不符（踩过）。
function buildUnits(lines) {
  const tops = [];
  lines.forEach(function (l, i) {
    if (TOP_RE.test(l) || DECL_RE.test(l)) tops.push(i);
  });
  const topSet = new Set(tops);
  function leadingComments(idx) {
    let s = idx;
    while (s - 1 >= 0) {
      if (topSet.has(s - 1)) break; // 上一条是声明本身，不是注释
      const t = lines[s - 1].trim();
      if (t === '') break;
      if (/^(\/\/|\/\*|\*)/.test(t)) { s--; continue; }
      break;
    }
    return s;
  }
  const units = [];
  units.push({
    name: '<<HEADER>>',
    kind: 'header',
    start: 0,
    end: leadingComments(tops[0]),
  });
  tops.forEach(function (line, k) {
    const m = lines[line].match(/^  (?:async\s+)?function ([A-Za-z_$][\w$]*)\s*\(/) ||
              lines[line].match(/^  (?:const|let|var) ([A-Za-z_$][\w$]*)/);
    units.push({
      name: m ? m[1] : '?',
      kind: TOP_RE.test(lines[line]) ? 'function' : 'decl',
      start: leadingComments(line),
      end: k + 1 < tops.length ? leadingComments(tops[k + 1]) : lines.length,
    });
  });
  units.forEach(function (u) { u.lines = u.end - u.start; u.text = null; });
  return units;
}

function attachText(units, lines) {
  units.forEach(function (u) { u.text = lines.slice(u.start, u.end).join('\n'); });
}

// 无损校验：按顺序拼接所有单元的非空行，必须与原文件逐行一致
function verifyLossless(lines, units) {
  const seqOf = function (arr) { return arr.filter(function (l) { return l.trim() !== ''; }); };
  const orig = seqOf(lines);
  const rebuilt = [];
  units.forEach(function (u) {
    seqOf(lines.slice(u.start, u.end)).forEach(function (l) { rebuilt.push(l); });
  });
  if (orig.length !== rebuilt.length) {
    return { ok: false, reason: '非空行数不同: 原文 ' + orig.length + ' vs 单元 ' + rebuilt.length };
  }
  for (let i = 0; i < orig.length; i++) {
    if (orig[i] !== rebuilt[i]) {
      return { ok: false, reason: '第 ' + i + ' 行不同\n  原: ' + orig[i] + '\n  拼: ' + rebuilt[i] };
    }
  }
  // 覆盖检查
  const covered = new Array(lines.length).fill(false);
  units.forEach(function (u) { for (let i = u.start; i < u.end; i++) covered[i] = true; });
  for (let i = 0; i < lines.length; i++) {
    if (!covered[i]) return { ok: false, reason: '第 ' + (i + 1) + ' 行未被任何单元覆盖: ' + lines[i] };
  }
  return { ok: true };
}

function cmdList() {
  const lines = readLines(APP);
  const units = buildUnits(lines);
  attachText(units, lines);
  console.log('单元总数: ' + units.length + '（覆盖 ' + lines.length + ' 行）');
  units.forEach(function (u, i) {
    console.log('  ' + String(i).padStart(3) + '.  L' + String(u.start + 1).padStart(5) + '-' + String(u.end).padEnd(5) +
      '  ' + String(u.lines).padStart(4) + ' 行  ' + u.name);
  });
}

function cmdVerify() {
  const files = fs.readdirSync(path.join(ROOT, 'js')).filter(function (f) { return f.endsWith('.js'); });
  console.log('js/ 目录下的文件: ' + files.length);
  let total = 0;
  files.forEach(function (f) {
    const n = readLines(path.join(ROOT, 'js', f)).length;
    total += n;
    console.log('  ' + f.padEnd(24) + n + ' 行');
  });
  console.log('  合计 ' + total + ' 行');
}

// 生成基线清单：记录每个单元的 SHA-256，用于拆分过程中随时比对
function cmdSnapshot() {
  const lines = readLines(APP);
  const units = buildUnits(lines);
  attachText(units, lines);
  const v = verifyLossless(lines, units);
  if (!v.ok) { console.log('无损校验失败: ' + v.reason); process.exitCode = 1; return; }
  const manifest = units.map(function (u) {
    return { name: u.name, kind: u.kind, start: u.start + 1, end: u.end, lines: u.lines, sha: sha256(u.text) };
  });
  fs.writeFileSync(UNITS_FILE, JSON.stringify(manifest, null, 1), 'utf8');
  console.log('\u2713 已生成基线 ' + UNITS_FILE);
  console.log('  单元 ' + manifest.length + ' 个，无损校验通过，覆盖 ' + lines.length + ' 行');
}

// 核心校验：把 src/ 片段拼接起来，与「拆分前的原始 app.js」比对。
//
// 为什么以原文件为准而不是比对单元哈希：
//   单元边界取决于「前导注释归属」这类启发式，两处顶层声明之间没有空行时
//   （例如 `let md = null;` 紧跟 `function initMarkdown()`）边界会漂移，
//   产生假警报。直接比对「拼接产物 vs 原始文件」才可靠。
//
// 两种校验口径（自动判定）：
//   A. 纯搬家（只切分文件、未改任何逻辑）：拼接结果应与原文件**逐行一致**。
//   B. 含重构（例如 bindEvents 拆成 7 个子函数）：原文件的非空行必须**全部保留且顺序不变**，
//      只允许新增结构行（函数签名 / 注释 / 调度调用），不允许丢失或改写原有行。
//      此时用「子序列包含」判定，并报告被替换的 bindEvents 原签名行。
//
// 原始文件来源：backup/_orig_check/js/app.js（从拆分前的版本备份解压得到）。
function cmdCheckAll() {
  const frags = fs.existsSync(SRC_DIR)
    ? fs.readdirSync(SRC_DIR).filter(function (f) { return f.endsWith('.js'); }).sort()
    : [];
  if (!frags.length) { console.log('src/ 下没有片段'); process.exitCode = 1; return; }
  const parts = frags.map(function (f) {
    return fs.readFileSync(path.join(SRC_DIR, f), 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
  });
  const bundled = parts.join('\n') + '\n';
  const origPath = path.join(ROOT, 'backup', '_orig_check', 'js', 'app.js');
  if (!fs.existsSync(origPath)) {
    console.log('找不到原始文件基线: ' + origPath);
    console.log('（从拆分前的备份解压得到，例如 Expand-Archive backup/markdown-viewer-v1.0.72.zip）');
    process.exitCode = 1;
    return;
  }
  const orig = fs.readFileSync(origPath, 'utf8').replace(/\r\n/g, '\n');
  const ne = function (s) { return s.split('\n').filter(function (l) { return l.trim() !== ''; }); };
  const a = ne(orig), b = ne(bundled);
  console.log('  片段数: ' + frags.length + '（拼接后 ' + bundled.split('\n').length + ' 行）');
  console.log('  原始文件: ' + orig.split('\n').length + ' 行，非空 ' + a.length);
  console.log('  拼接产物: 非空 ' + b.length);

  // 口径 A：逐行一致
  if (a.length === b.length) {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        console.log('  \u2717 \u7B2C ' + i + ' \u4E2A\u975E\u7A7A\u884C\u4E0D\u540C:');
        console.log('    \u539F\u59CB: ' + a[i].slice(0, 110));
        console.log('    \u62FC\u63A5: ' + b[i].slice(0, 110));
        process.exitCode = 1;
        return;
      }
    }
    console.log('  \u2713 \u4E0E\u62C6\u5206\u524D\u539F\u59CB\u6587\u4EF6\u9010\u884C\u4E00\u81F4\uFF08' + a.length + ' \u975E\u7A7A\u884C\uFF0C\u96F6\u6539\u52A8\uFF09');
    return;
  }

  // 口径 B：原文件非空行必须是拼接结果的「顺序子序列」（允许新增结构行）
  console.log('  \u975E\u7A7A\u884C\u6570\u4E0D\u540C\uFF08' + a.length + ' \u2192 ' + b.length + '\uFF0C\u65B0\u589E ' + (b.length - a.length) + ' \u884C\uFF09\uFF0C\u6309\u300C\u539F\u5185\u5BB9\u5B8C\u6574\u4FDD\u7559\u300D\u6821\u9A8C\uFF1A');
  let i = 0, j = 0;
  const unmatched = [];   // { line, srcIdx }：srcIdx 是该行在原始文件里的下标
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    let k = j + 1, found = -1;
    while (k < b.length && k < j + 60) { if (b[k] === a[i]) { found = k; break; } k++; }
    if (found < 0) { unmatched.push({ line: a[i], srcIdx: i }); i++; }
    else { j = found; }
  }
  while (i < a.length) { unmatched.push({ line: a[i], srcIdx: i }); i++; }
  // 版本号行是唯一「允许被改写」的行（发布时必然要从旧版本号改成新版本号）。
  // 把它从差异里剔除，但要求「拼接结果里确实存在一行同结构的版本号行」。
  const isVersionLine = function (l) { return /离线渲染器已启用\s*\(v[\d.]+\)/.test(l); };
  // 已修复的缺陷行：这些是历史上写死、后被有意替换掉的行（保留清单，便于审计每次放行的改动）。
  //   - 右键菜单定位写死 innerHeight - 120 → 改为 clampMenuIntoViewport 按实测高度夹取（v1.1.0）
  //   - 「删除」误用 hasBlockTarget 判据 → 拆成独立的 canDelete，
  //     否则非 Markdown 文件的「复制 / 编辑」会跟着一起消失（v1.1.0）
  const KNOWN_FIXED = [
    /'top:' \+ Math\.min\(y, window\.innerHeight - 120\) \+ 'px;' \+/,
    /\/\/ 空白处右键（hasBlockTarget=false）没有块可删，不渲染；整份代码文件也不提供/,
    /const deleteHtml = o\.hasBlockTarget/,
    /hasBlockTarget: canDeleteBlock,/,
    // IIFE 启动尾部（DOMContentLoaded → init）：拆分后随 init 一起移到
    // src/60-ui-init.js 末尾，内容未改，逐行比对会当成差异。
    /^\s{2}if \(document\.readyState === 'loading'\) \{$/,
    /^\s{4}document\.addEventListener\('DOMContentLoaded', init\);$/,
    /^\s{2}\} else \{$/,
    /^\s{4}init\(\);$/,
    /^\s{2}\}$/,          // 上面那个 else 块的收尾大括号
    // v1.1.01 图片背景（新增功能，替换了 3 行原样）：
    //   - state.settings 拆成多行以加入 imageBackground / imageBackgroundColor
    //   - 导出 HTML 的 img 规则加上背景色与内边距
    //     （基线里有两行内容相同：导出 HTML 与 PDF CSS 各一处；
    //      只改了导出 HTML 那处，PDF 那处保持原样 —— 白底页面无需处理）
    //   - loadSettings 里补 inlineCodeSize 后的逗号（为追加新字段）
    /^\s{4}settings: \{ textSize: 16, codeSize: 13\.5, inlineCodeSize: 12 \},$/,
    /^\s{6}'\.markdown-body img \{ max-width: 100%; height: auto; border-radius: 4px; \}',$/,
    /^\s{12}inlineCodeSize: Number\(parsed\.inlineCodeSize\) \|\| 12$/,
  ];
  // 整函数重写的白名单：当一次修改是「整段重写」某个函数而不是改几行时，
  // 逐行白名单会膨胀到几十条、失去审计意义。这里按「函数体范围」放行：
  // 只要差异行在**原始基线里**落在该函数区间内，就算有意修改。
  // 用原始文件的下标判定（而不是在拼接产物里按内容反查），因为
  // `} else {`、空行这类重复内容在全文里出现多次，按内容反查会定位错。
  //   - openDefaultDirectoryManually / restoreDefaultDirectory：句柄未授权时
  //     原先直接 return、不尝试缓存快照，导致 file:// 下「打开默认目录」功能等同失效（v1.1.0）
  //   - bindContentMenuEvents：把误埋在内的 closeExportMenu / toggleExportMenu
  //     提到 IIFE 顶层（拆分时它们被留在子函数里，bindFileOpenEvents 调用会
  //     ReferenceError），提取导致该函数余下部分缩进整体变化（v1.1.0）
  //   - bindEvents：v1.1.0 把它拆成 7 个功能域子函数（bindFileOpenEvents 等），
  //     基线里它是单个 1422 行的大函数、内部缩进 4~10，拆分后缩进整体减 2，
  //     所以基线中该函数区间内的行都会被判为「找不到」——整段登记为有意重写。
  const REWRITTEN_FUNCS = [
    'openDefaultDirectoryManually',
    'restoreDefaultDirectory',
    'bindContentMenuEvents',
    'bindEvents',
    // restoreTheme / init：拆分后在它们之前新增了子函数与 closeExportMenu，
    // 内容一字未改但位置后移，逐行顺序比对会当成「找不到」——一并放行。
    'restoreTheme',
    'init',
  ];
  const rewrittenRanges = REWRITTEN_FUNCS.map(function (name) {
    const re = new RegExp('^\\s*(?:async\\s+)?function ' + name + '\\s*\\(');
    for (let s = 0; s < a.length; s++) {
      if (!re.test(a[s])) continue;
      const indent = a[s].match(/^ */)[0];
      for (let e = s + 1; e < a.length; e++) {
        if (a[e] === indent + '}') return { name: name, start: s, end: e };
      }
    }
    return null;
  }).filter(Boolean);
  const inRewrittenFunc = function (srcIdx) {
    return rewrittenRanges.some(function (rg) { return srcIdx >= rg.start && srcIdx <= rg.end; });
  };
  const isKnownFixed = function (l) { return KNOWN_FIXED.some(function (re) { return re.test(l); }); };
  const versionDiffs = unmatched.filter(function (u) { return isVersionLine(u.line); }).length;
  const rewrittenDiffs = unmatched.filter(function (u) {
    return !isVersionLine(u.line) && !isKnownFixed(u.line) && inRewrittenFunc(u.srcIdx);
  }).length;
  const fixedDiffs = unmatched.filter(function (u) { return !isVersionLine(u.line) && isKnownFixed(u.line); }).length;
  const real = unmatched.filter(function (u) {
    return !isVersionLine(u.line) && !isKnownFixed(u.line) && !inRewrittenFunc(u.srcIdx);
  }).map(function (u) { return u.line; });
  if (versionDiffs > 0) {
    const inBundle = b.filter(isVersionLine).length;
    console.log('  \u2139 \u7248\u672C\u53F7\u884C\u53D8\u66F4\uFF1A' + versionDiffs + ' \u884C\uFF08\u62FC\u63A5\u7ED3\u679C\u4E2D\u5171 ' + inBundle + ' \u884C\u7248\u672C\u53F7\uFF0C\u5C5E\u9884\u671F\u5185\u7684\u53D1\u5E03\u6539\u52A8\uFF09');
  }
  if (fixedDiffs > 0) {
    console.log('  \u2139 \u5DF2\u4FEE\u590D\u7F3A\u9677\u884C\u88AB\u66FF\u6362\uFF1A' + fixedDiffs + ' \u884C\uFF08\u5C5E\u6709\u610F\u4FEE\u6539\uFF0C\u89C1 KNOWN_FIXED \u6E05\u5355\uFF09');
  }
  if (rewrittenDiffs > 0) {
    console.log('  \u2139 \u6574\u51FD\u6570\u91CD\u5199\uFF1A' + rewrittenDiffs + ' \u884C\uFF08' + REWRITTEN_FUNCS.join('\u3001') + '\uFF09');
  }
  if (real.length === 0) {
    console.log('  \u2713 \u539F\u59CB ' + a.length + ' \u4E2A\u975E\u7A7A\u884C\u5168\u90E8\u4FDD\u7559\u4E14\u987A\u5E8F\u4E00\u81F4\uFF08\u65B0\u589E\u884C\u4EC5\u4E3A\u7ED3\u6784\u884C' +
      (versionDiffs ? ' + 1 \u884C\u7248\u672C\u53F7' : '') + (fixedDiffs ? ' + ' + fixedDiffs + ' \u884C\u6709\u610F\u4FEE\u6539' : '') +
      (rewrittenDiffs ? ' + ' + rewrittenDiffs + ' \u884C\u6574\u51FD\u6570\u91CD\u5199' : '') + '\uFF09');
    return;
  }
  console.log('  \u2717 \u6709 ' + real.length + ' \u884C\u5728\u62FC\u63A5\u7ED3\u679C\u4E2D\u627E\u4E0D\u5230\uFF1A');
  real.slice(0, 20).forEach(function (l) { console.log('    ' + l.slice(0, 110)); });
  process.exitCode = 1;
}

const argv = process.argv.slice(2);

// ============================================================
// 拼接（方案 A 的核心）：把 src/ 下的功能片段按顺序合成 js/app.js
//
// 为什么用「片段 + 拼接」而不是独立 IIFE 模块：
//   js/app.js 里涉及顶层函数的调用点有 838 处（如 toast 110 次、escapeHtml 55 次）。
//   若让每个模块成为独立 IIFE，这些裸调用全部要改成 MD.xxx，回归风险极高。
//   改成「片段拼接」后函数体一个字都不用动，产物仍是单文件 app.js，双击即用。
//
// 片段约定：
//   - src/00-header.js  … src/NN-xxx.js，按文件名排序拼接
//   - 第 1 个片段负责 (function () { 'use strict';  开场
//   - 最后一个片段负责 })(); 收尾 + 启动代码
//   - 片段内部就是原 app.js 的「2 空格缩进」正文，不加任何包装
// ============================================================
const SRC_DIR = path.join(ROOT, 'src');

function listFragments() {
  return fs.readdirSync(SRC_DIR)
    .filter(function (f) { return /^\d+.*\.js$/.test(f); })
    .sort();
}

function cmdBundle(write) {
  const frags = listFragments();
  if (!frags.length) { console.log('src/ 下没有片段'); process.exitCode = 1; return; }
  const parts = frags.map(function (f) {
    const p = path.join(SRC_DIR, f);
    // 统一 LF，末尾去掉多余换行，拼接时再补一个
    let t = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
    t = t.replace(/\n+$/, '');
    return { name: f, text: t, lines: t.split('\n').length };
  });
  const out = parts.map(function (p) { return p.text; }).join('\n\n') + '\n';
  console.log('拼接顺序（' + parts.length + ' 个片段）:');
  parts.forEach(function (p) { console.log('  ' + p.name.padEnd(28) + String(p.lines).padStart(5) + ' 行'); });
  console.log('  合计 ' + out.split('\n').length + ' 行 / ' + (Buffer.byteLength(out, 'utf8') / 1024).toFixed(1) + ' KB');
  if (write) {
    fs.writeFileSync(APP, out, 'utf8');
    console.log('');
    console.log('\u2713 已生成 ' + path.relative(ROOT, APP));
  }
  return out;
}

// 用 --diff 确认「拼接结果 == 当前 app.js」（拆分前必须通过，作为工具的自我验证）
function cmdDiff() {
  const out = cmdBundle(false);
  const cur = fs.readFileSync(APP, 'utf8').replace(/\r\n/g, '\n');
  const a = cur.split('\n').filter(function (l) { return l.trim() !== ''; });
  const b = out.split('\n').filter(function (l) { return l.trim() !== ''; });
  console.log('');
  console.log('=== 拼接结果 vs 当前 js/app.js ===');
  if (a.length !== b.length) {
    console.log('  \u2717 \u975E\u7A7A\u884C\u6570\u4E0D\u540C: app.js ' + a.length + ' vs \u62FC\u63A5 ' + b.length);
    process.exitCode = 1; return;
  }
  let bad = -1;
  for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) { bad = i; break; } }
  if (bad < 0) {
    console.log('  \u2713 \u5B8C\u5168\u4E00\u81F4\uFF08' + a.length + ' \u975E\u7A7A\u884C\uFF09');
  } else {
    console.log('  \u2717 \u7B2C ' + bad + ' \u884C\u4E0D\u540C:');
    console.log('    app.js: ' + a[bad]);
    console.log('    \u62FC\u63A5  : ' + b[bad]);
    process.exitCode = 1;
  }
}

if (argv[0] === '--list') {
  cmdList();
} else if (argv[0] === '--verify') {
  cmdVerify();
} else if (argv[0] === '--snapshot') {
  cmdSnapshot();
} else if (argv[0] === '--checkall') {
  cmdCheckAll();
  // 作用域检查一并跑：node --check 查不出「辅助函数被埋进子函数」这类
  // 运行时会 ReferenceError 的问题（语法完全合法）。详见 tools/scope_check.js
  console.log('');
  try {
    require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'scope_check.js')], { stdio: 'inherit' });
  } catch (e) {
    process.exitCode = 1;
  }
} else if (argv[0] === '--bundle') {
  cmdBundle(true);
} else if (argv[0] === '--diff') {
  cmdDiff();
} else {
  console.log('用法:');
  console.log('  node tools/split_app.js --list       列出 js/app.js 的全部顶层单元');
  console.log('  node tools/split_app.js --snapshot   生成基线清单 tools/units.json');
  console.log('  node tools/split_app.js --checkall   比对当前 js/ 与基线（零丢失/零改动）+ 作用域检查');
  console.log('  node tools/split_app.js --bundle     由 src/ 片段拼接生成 js/app.js');
  console.log('  node tools/split_app.js --diff       校验拼接结果与当前 app.js 一致');
  console.log('  node tools/split_app.js --verify     列出 js/ 各文件行数');
  console.log('  node tools/scope_check.js            单独跑作用域检查（防止跨子函数 ReferenceError）');
}

module.exports = { readLines: readLines, buildUnits: buildUnits, attachText: attachText, verifyLossless: verifyLossless, sha256: sha256, ROOT: ROOT };
