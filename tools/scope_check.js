/* ============================================================
 * 作用域检查：防止「拆分把辅助函数埋进子函数」导致 ReferenceError
 *
 * 为什么需要这个检查（踩过的坑）：
 *   拆分前 bindEvents 是单个 1400+ 行的大函数，里面的嵌套辅助函数
 *   （如 closeExportMenu）对**所有**调用点都天然可见。
 *   拆成 7 个子函数后，如果某个辅助函数被留在某一个子函数内部，
 *   其它子函数再调用它就是 ReferenceError。
 *
 *   实际发生过：closeExportMenu 被留在 bindContentMenuEvents 里，
 *   而 bindFileOpenEvents 也调用它 → 点「打开默认目录」时：
 *     Uncaught ReferenceError: closeExportMenu is not defined
 *   这个错误**静态语法检查（node --check）查不出来**（语法完全合法），
 *   只有在运行时点到那个按钮才会暴露 —— 所以必须有专门检查。
 *
 * 判定规则：
 *   对每个「嵌套函数」（缩进 >= 4）：
 *     - 若同名函数有多个定义（各函数自己带一份局部辅助函数，如 4 个 finish），跳过；
 *     - 否则若它被【外层函数以外的】任何顶层函数调用 → 报错。
 *   注意排除方法调用（`foo.close(`）—— 那是对象方法，不是本文件的函数。
 *
 * 用法：node tools/scope_check.js
 * ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'js', 'app.js');

const lines = fs.readFileSync(APP, 'utf8').split('\n').map(function (l) { return l.replace(/\r$/, ''); });

// 扫描所有函数定义及其闭合区间
function scanFns() {
  const fns = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)(?:async\s+)?function ([A-Za-z_$][\w$]*)\s*\(/);
    if (!m) continue;
    const indent = m[1].length;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === ' '.repeat(indent) + '}') {
        fns.push({ name: m[2], start: i, end: j, indent: indent, line: i + 1 });
        break;
      }
    }
  }
  return fns;
}

// 该行是否「裸调用」了某个标识符（排除 obj.name( 形式的方法调用）
function callsBare(text, name) {
  const re = new RegExp('(^|[^.\\w$])' + name.replace(/\$/g, '\\$') + '\\s*\\(', 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    // 前面若紧跟 `.` 则是方法调用，已在正则里排除；再确认一次
    const before = text.slice(0, m.index + m[1].length);
    if (!/\.\s*$/.test(before)) return true;
  }
  return false;
}

const fns = scanFns();
const tops = fns.filter(function (f) { return f.indent === 2; });
const nested = fns.filter(function (f) { return f.indent >= 4; });

// 同名定义计数：>1 说明每个函数各带一份局部副本，属正常
const nameCount = {};
fns.forEach(function (f) { nameCount[f.name] = (nameCount[f.name] || 0) + 1; });

const problems = [];
nested.forEach(function (nf) {
  if (nameCount[nf.name] > 1) return;                      // 各函数自带一份，不是共享辅助函数
  const owner = tops.filter(function (t) { return t.start < nf.start && t.end > nf.end; })[0];
  const outsiders = tops.filter(function (t) {
    if (owner && t === owner) return false;
    for (let k = t.start; k <= t.end; k++) {
      if (k >= nf.start && k <= nf.end) continue;          // 跳过它自己的函数体
      if (callsBare(lines[k], nf.name)) return true;
    }
    return false;
  });
  if (outsiders.length) {
    problems.push({
      name: nf.name,
      line: nf.line,
      owner: owner ? owner.name : '(none)',
      callers: outsiders.map(function (o) { return o.name; })
    });
  }
});

console.log('=== 作用域检查（拆分安全网）===');
console.log('  顶层函数: ' + tops.length + '，嵌套函数: ' + nested.length);
if (problems.length === 0) {
  console.log('  ✓ 无跨作用域引用：所有共享辅助函数都在 IIFE 顶层，任何子函数都能访问');
  process.exit(0);
}
console.log('  ✗ 发现 ' + problems.length + ' 处跨作用域引用（运行时会 ReferenceError）：');
problems.forEach(function (p) {
  console.log('    ' + p.name + ' (L' + p.line + ') 嵌套在 ' + p.owner +
    ' 内，却被 [' + p.callers.join(', ') + '] 调用');
});
console.log('');
console.log('  修法：把该辅助函数提到 IIFE 顶层（缩进 2），或用 document.getElementById');
console.log('        在函数内部现查元素，避免依赖子函数作用域里的变量。');
process.exitCode = 1;
