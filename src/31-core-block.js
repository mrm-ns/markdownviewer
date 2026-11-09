  // ---------- 围栏行解析（支持缩进与引用前缀） ----------
  // 源码里的围栏行不一定是顶格的 "```bash"：引用块内的围栏写作 "> ```bash"，
  // 列表 / 嵌套列表里还会再带缩进（例如 "     > ```bash"）。
  // 渲染器是把引用标记剥掉之后再解析围栏的，所以只认 "^\s*```" 会漏掉这些代码块，
  // 导致右键「更改类型 / 编辑」定位失败。这里统一做一次围栏行解析。
  //
  // 返回 { prefix, ticks, lang }：prefix 是反引号之前必须原样保留的内容（缩进 + 引用标记），
  // 改写语言时必须带上它，否则会把引用块内的围栏写出引用块、破坏文档结构；
  // 不是围栏行时返回 null。
  function matchFenceLine(line) {
    const text = String(line == null ? '' : line).replace(/\r$/, '');
    const m = text.match(/^([ \t]*(?:>[ \t]*)*)(`{3,})(.*)$/);
    if (!m) return null;
    return { prefix: m[1], ticks: m[2], lang: m[3] };
  }

  // === QUOTE_PREFIX_BEGIN ===
  // 引用行前缀解析：与代码块编辑框隐藏 ``` 同理，编辑引用块时要在编辑框里隐藏 "> "，
  // 保存时再原样加回，否则用户面对的一堆 "> " 会干扰改写，且容易把引用结构写坏。
  //
  // 关键点：只吃一个可选空格（[ \t]?），把 "> " 之后的缩进留给内容。
  // 若写成 ">[ \t]*"，">   缩进文本" 的缩进会被吞掉，加回前缀后内容就少了缩进。
  function matchQuotePrefix(line) {
    const text = String(line == null ? '' : line).replace(/\r$/, '');
    const m = text.match(/^([ \t]*>[ \t]?)/);
    return m ? m[1] : null;
  }

  // 去掉引用前缀；lines 不是引用行时原样返回（嵌套 "> > inner" 只剥一层，
  // 内层 ">" 作为内容保留 —— 与渲染器 replace(/^\s*>\s?/, '') 后递归解析的行为一致）
  function stripQuotePrefix(line, prefix) {
    const text = String(line == null ? '' : line);
    if (!prefix || text.indexOf(prefix) !== 0) return text;
    return text.slice(prefix.length);
  }
  // === QUOTE_PREFIX_END ===

  // 结束围栏：只有反引号、没有语言标记（与渲染器的 /^\s*```\s*$/ 判定一致）
  function isFenceClose(line) {
    const info = matchFenceLine(line);
    return !!info && info.lang.trim() === '';
  }

  // 去掉内容行与围栏行共有的前缀（缩进 / 引用标记），还原出代码块正文
  function stripFencePrefix(line, prefix) {
    const text = String(line == null ? '' : line).replace(/\r$/, '');
    if (!prefix) return text; // 顶格围栏：正文原样保留（与渲染器一致）
    if (text.slice(0, prefix.length) === prefix) return text.slice(prefix.length);
    // 内容行没写全前缀（如引用块里的懒续行）时，退化为剥掉行首缩进与引用标记
    return text.replace(/^[ \t]*(?:>[ \t]*)*/, '');
  }

  function normalizeBlockCode(text) {
    return String(text == null ? '' : text).replace(/\r/g, '').replace(/\n$/, '').trim();
  }

  // 围栏是否位于引用块内（前缀里含 '>'）
  function isQuoteFencePrefix(prefix) {
    return String(prefix || '').indexOf('>') !== -1;
  }

  // 从 start 之后找本块的结束围栏；找不到返回 -1。
  // 引用块内的围栏不能跨出引用块去找结束标记：渲染器解析引用块时只看到引用块内部的行，
  // 引用块外的 "```" 并不属于这个代码块（否则会把块边界算错，进而改错位置）。
  function findFenceClose(allLines, start, prefix) {
    const inQuote = isQuoteFencePrefix(prefix);
    for (let j = start + 1; j < allLines.length; j++) {
      if (inQuote && !/^[ \t]*>[ \t]*/.test(allLines[j])) return -1;
      if (isFenceClose(allLines[j])) return j;
    }
    return -1;
  }

  // 读取 allLines[start] 处的围栏块正文；没有结束围栏时返回 null（不是完整代码块）
  function readFenceBlock(allLines, start) {
    const open = matchFenceLine(allLines[start]);
    if (!open) return null;
    const close = findFenceClose(allLines, start, open.prefix);
    if (close < 0) return null;
    const buf = [];
    for (let j = start + 1; j < close; j++) {
      buf.push(stripFencePrefix(allLines[j], open.prefix));
    }
    return { start: start, end: close, prefix: open.prefix, code: normalizeBlockCode(buf.join('\n')) };
  }

  // 兜底定位的校验：该行必须是围栏块，且正文与点击的代码块相符。
  // 空块必须显式判等——否则 code.includes('') 恒为真，任意围栏行（含结束围栏）都会通过，
  // 这正是「有时提示无法定位、有时又悄悄改到别处」的根因。
  function fenceBlockMatches(allLines, start, oldCode) {
    const block = readFenceBlock(allLines, start);
    if (!block) return false;
    const target = normalizeBlockCode(oldCode);
    if (!block.code || !target) return block.code === target;
    return block.code === target || block.code.includes(target) || target.includes(block.code);
  }

  function findCodeBlockForOldCode(oldCode) {
    const lines = state.currentText ? state.currentText.split('\n') : [];
    const normalizedOld = normalizeBlockCode(oldCode);
    for (let i = 0; i < lines.length; i++) {
      const block = readFenceBlock(lines, i);
      if (!block) continue;
      if (block.code === normalizedOld) {
        return { start: block.start, end: block.end };
      }
    }
    return null;
  }

  // 定位代码块围栏起始行号；找不到返回 -1
  function resolveCodeFenceLine(pre) {
    const fallbackLine = parseInt(pre.getAttribute('data-source-line'), 10);
    const allLines = state.currentText ? state.currentText.split('\n') : [];
    const code = pre.querySelector('code');
    const oldCode = code ? code.textContent.replace(/\n$/, '') : '';

    // 1) 渲染时写入的行号直接来自源码行号，最可信：只要该行是围栏行就采用。
    //    （data-source-line 对引用块内的围栏也是准确的，例如 "  > ```bash"）
    if (fallbackLine >= 0 && fallbackLine < allLines.length && matchFenceLine(allLines[fallbackLine])) {
      return fallbackLine;
    }

    // 2) 行号缺失或漂移时，用渲染出的代码内容反查围栏块
    const foundBlock = findCodeBlockForOldCode(oldCode);
    if (foundBlock) return foundBlock.start;

    // 3) 最后才用模糊定位，且必须通过「完整闭合 + 正文相符」校验；
    //    宁可报错，也不要把改动写到别的代码块、甚至结束围栏上
    const guessed = resolveSourceLine(pre, isNaN(fallbackLine) ? -1 : fallbackLine);
    if (guessed >= 0 && guessed < allLines.length && fenceBlockMatches(allLines, guessed, oldCode)) {
      return guessed;
    }
    return -1;
  }

  // 常见代码块语言候选（可自定义输入）
  const CODE_LANG_SUGGESTIONS = ['text', 'bash', 'sh', 'shell', 'zsh', 'ksh', 'python', 'py', 'javascript', 'js', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf', 'nginx', 'apache', 'sql', 'promql', 'keepalived', 'dockerfile', 'docker', 'txt'];

  // 浮层：输入/选择语言后回调 onDone(lang)；取消回调 onDone(null)
  function showCodeLangPicker(current, onDone) {
    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:var(--drawer-bg);border:1px solid var(--drawer-border);border-radius:10px;padding:16px 18px;min-width:280px;box-shadow:0 8px 30px rgba(0,0,0,.25);';
    const label = document.createElement('div');
    label.textContent = '代码块类型（留空 = 不带语言标记）';
    label.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:10px;color:var(--app-fg);';
    const input = document.createElement('input');
    input.type = 'text';
    input.value = current || '';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:6px 8px;font-size:13px;border:1px solid var(--input-border);border-radius:6px;color:var(--app-fg);background:var(--input-bg);outline:none;';
    const dl = document.createElement('datalist');
    dl.id = 'code-lang-datalist';
    CODE_LANG_SUGGESTIONS.forEach(function (l) {
      const o = document.createElement('option');
      o.value = l;
      dl.appendChild(o);
    });
    input.setAttribute('list', dl.id);
    const hint = document.createElement('div');
    hint.textContent = '可直接输入任意语言标识。';
    hint.style.cssText = 'font-size:11px;color:var(--muted);margin-top:6px;';
    const btns = document.createElement('div');
    btns.style.cssText = 'margin-top:14px;text-align:right;';
    const ok = document.createElement('button');
    ok.textContent = '确定';
    ok.className = 'btn btn-primary';
    ok.style.cssText = 'margin-left:8px;';
    const cancel = document.createElement('button');
    cancel.textContent = '取消';
    cancel.className = 'btn';

    let done = false;
    function close(value) {
      if (done) return;
      done = true;
      mask.remove();
      onDone(value);
    }
    ok.addEventListener('click', function () { close((input.value || '').trim()); });
    cancel.addEventListener('click', function () { close(null); });
    mask.addEventListener('click', function (e) { if (e.target === mask) close(null); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') close((input.value || '').trim());
      if (e.key === 'Escape') close(null);
    });

    btns.appendChild(cancel);
    btns.appendChild(ok);
    panel.appendChild(label);
    panel.appendChild(input);
    panel.appendChild(dl);
    panel.appendChild(hint);
    panel.appendChild(btns);
    mask.appendChild(panel);
    document.body.appendChild(mask);
    try {
      input.focus({ preventScroll: true }); // 固定浮层，聚焦时不滚动页面
    } catch (e) {
      input.focus();
    }
    input.select();
  }

  // 更改代码块类型（右键 -> 更改类型）：改写围栏行的语言标记
  function changeCodeBlockType(pre) {
    const lineIdx = resolveCodeFenceLine(pre);
    if (lineIdx < 0) {
      toast('无法定位到代码块');
      return;
    }
    const allLines = state.currentText ? state.currentText.split('\n') : [];
    const fence = allLines[lineIdx];
    const info = matchFenceLine(fence);
    if (!info) {
      toast('无法定位到代码块');
      return;
    }
    // prefix 含缩进与引用标记（如 "  > "），改写时必须原样保留
    const prefix = info.prefix;
    // 语言名可能含空格（如 ```Plain Text），读取完整语言串
    const current = (info.lang || '').trim();
    const eol = /\r$/.test(fence) ? '\r' : ''; // Windows 文件保留 CRLF 行尾

    showCodeLangPicker(current, function (newLang) {
      if (newLang == null) return; // 取消
      if (newLang === current) {
        toast('类型未变化');
        return;
      }
      const lines = state.currentText.split('\n');
      lines[lineIdx] = prefix + info.ticks + newLang + eol;
      applySourceChange(lines.join('\n'));
      toast(newLang ? '代码块类型已改为 ' + newLang : '已移除代码块语言标记');
    });
  }


  function startEditCodeBlock(pre) {
    // 与「更改类型」共用同一套定位逻辑（支持引用块内 / 列表内的围栏）
    const sourceLine = resolveCodeFenceLine(pre);
    if (sourceLine < 0) {
      toast('无法定位到代码块');
      return;
    }
    const code = pre.querySelector('code');
    const oldCode = code ? code.textContent.replace(/\n$/, '') : '';
    // 记录被编辑块的原始高度与实际字号，让编辑框与被编辑块大小一致
    const preHeight = pre.offsetHeight;
    const savedScroll = captureContentScroll();
    const codeElForFont = pre.querySelector('code');
    const codeFontSize = window.getComputedStyle(codeElForFont || pre).fontSize;

    const textarea = document.createElement('textarea');
    textarea.className = 'code-editor';
    textarea.name = 'code-editor';
    textarea.autocomplete = 'off';
    textarea.value = oldCode;
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'monospace';
    // 字号跟随被编辑代码块的实际字号（用户可调代码块字号，这里同步）
    textarea.style.fontSize = codeFontSize;

    // 动态调整编辑框高度：与被编辑块同高，编辑内容增减时自动伸缩
    function autoResizeCodeEditor() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(preHeight, textarea.scrollHeight) + 'px';
    }

    pre.replaceWith(textarea);
    textarea.addEventListener('input', autoResizeCodeEditor);
    autoResizeCodeEditor();
    focusEditorAtStart(textarea);
    restoreContentScroll(savedScroll);

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      const newCode = textarea.value.replace(/\n$/, '');
        if (newCode === oldCode) {
            renderMarkdown(state.currentText);
            return;
          }
      const lines = state.currentText.split('\n');
      const fenceInfo = matchFenceLine(lines[sourceLine]);
      if (!fenceInfo) {
        toast('未找到代码块开始标记');
        return;
      }
      const prefix = fenceInfo.prefix;
      // 结束围栏必须与该围栏同属一个引用块（引用块内的围栏写作 "  > ```"）
      const closeIndex = findFenceClose(lines, sourceLine, prefix);

      if (closeIndex > sourceLine) {
        // 新内容沿用原前缀（缩进 + 引用标记）写回；空行只保留去掉行尾空白的前缀，
        // 否则空行会把引用块截断，其后的代码行会掉出引用块
        const blankPrefix = prefix.replace(/[ \t]+$/, '');
        const newLines = newCode.split('\n').map(function (line) {
          if (line.trim() === '') return blankPrefix;
          return prefix + line;
        });
        lines.splice(sourceLine + 1, closeIndex - sourceLine - 1, ...newLines);
        applySourceChange(lines.join('\n'));
      } else {
        toast('未找到代码块结束标记');
      }
    }
    textarea.addEventListener('blur', finish);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        textarea.blur();
      }
    });
  }

  // 编辑代码/配置文件：编辑框内容就是整份文件（无围栏），保存时整文件替换
  function startEditCodeFile() {
    if (state.currentText == null) {
      toast('当前没有打开文件');
      return;
    }
    const pre = document.querySelector('#markdown-body pre[data-code-file]');
    const oldText = state.currentText.replace(/\r\n/g, '\n');
    const preHeight = pre ? pre.offsetHeight : 0;
    const savedScroll = captureContentScroll();
    const codeEl = pre ? pre.querySelector('code') : null;
    const codeFontSize = codeEl ? window.getComputedStyle(codeEl).fontSize : '';

    const textarea = document.createElement('textarea');
    textarea.className = 'code-editor';
    textarea.name = 'code-editor';
    textarea.autocomplete = 'off';
    textarea.spellcheck = false;
    textarea.value = oldText;
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'monospace';
    if (codeFontSize) textarea.style.fontSize = codeFontSize;

    function autoResize() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(preHeight, textarea.scrollHeight) + 'px';
    }

    if (pre) pre.replaceWith(textarea);
    textarea.addEventListener('input', autoResize);
    autoResize();
    focusEditorAtStart(textarea);
    restoreContentScroll(savedScroll);

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      const newText = textarea.value.replace(/\r\n/g, '\n');
      if (newText === oldText) {
        renderMarkdown(state.currentText);
        return;
      }
      applySourceChange(newText); // 整个文件内容替换
    }
    textarea.addEventListener('blur', finish);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        textarea.blur();
      }
    });
  }

  // 编辑整个表格的 Markdown 源码（右键表格 -> 编辑）
  function startEditTable(table) {
    // 表格源码从表头行（data-source-line）开始，到连续表格行结束
    const firstCell = table.querySelector('th, td');
    if (!firstCell) {
      toast('无法定位到表格源码');
      return;
    }
    const sourceLine = parseInt(firstCell.getAttribute('data-source-line'), 10);
    const allLines = state.currentText ? state.currentText.split('\n') : [];
    if (isNaN(sourceLine) || sourceLine < 0 || sourceLine >= allLines.length) {
      toast('无法定位到表格源码');
      return;
    }
    let endLine = sourceLine;
    // 与渲染逻辑一致：表头、分隔行、表体行都是"非空且含 |"的连续行
    while (endLine + 1 < allLines.length &&
           allLines[endLine + 1].trim() !== '' &&
           allLines[endLine + 1].includes('|')) {
      endLine++;
    }
    const oldRaw = allLines.slice(sourceLine, endLine + 1).join('\n').replace(/\r/g, '').replace(/\n$/, '');

    const savedScroll = captureContentScroll();
    const textarea = document.createElement('textarea');
    textarea.className = 'code-editor'; // 复用等宽编辑样式，并纳入失焦保存机制
    textarea.name = 'code-editor';
    textarea.autocomplete = 'off';
    textarea.value = oldRaw;
    textarea.style.width = '100%';
    textarea.style.fontFamily = 'monospace';
    textarea.style.fontSize = '13px';

    function autoResize() {
      textarea.style.height = 'auto';
      textarea.style.height = Math.max(80, textarea.scrollHeight) + 'px';
    }
    table.replaceWith(textarea);
    textarea.addEventListener('input', autoResize);
    autoResize();
    focusEditorAtStart(textarea);
    restoreContentScroll(savedScroll);

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      const newValue = textarea.value.replace(/\n$/, '');
      if (newValue === oldRaw) {
        renderMarkdown(state.currentText);
        return;
      }
      const lines = state.currentText.split('\n');
      const newLines = newValue.split('\n');
      lines.splice(sourceLine, endLine - sourceLine + 1, ...newLines);
      applySourceChange(lines.join('\n'));
    }
    textarea.addEventListener('blur', finish);
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        textarea.blur();
      }
    });
  }

  // ---------- 插入文本块 / 代码块 ----------
  // 方案一：右键正文空白处 → 在「当前处」插入；右键正文块 → 在该块上方 / 下方插入。
  // 插入位置用渲染时写入的 data-source-line（块首行）/ data-source-end（块末行）
  // 精确换算成源码行号，再走 applySourceChange 写回，因此磁盘写入与撤销行为与现有编辑完全一致。
  //
  // 编辑框从「一行」起步：textarea 高度由内容 scrollHeight 决定，
  // 输入到第二行时自动增高，删回一行时自动缩回（与「右键编辑」不同，这里没有既有内容可参照）。
  let activeInsertEditor = null; // { wrap, commit, cancel }：同一时刻只允许一个插入编辑框

  // 点击元素所在的顶层块（#markdown-body 的直接子元素）；不在正文块内时返回 null
  function getTopLevelBlock(el) {
    const body = document.getElementById('markdown-body');
    if (!body || !el || el === body || !body.contains(el)) return null;
    let cur = el;
    while (cur.parentNode && cur.parentNode !== body) cur = cur.parentNode;
    return cur.parentNode === body ? cur : null;
  }

  // 块末行兜底推算（正常情况下 data-source-end 已写入，这里只作为属性缺失时的保险）
  function computeBlockEndLine(lines, start, tagName) {
    let end = start;
    if (tagName === 'PRE') {
      const open = matchFenceLine(lines[start]);
      if (open) {
        const close = findFenceClose(lines, start, open.prefix);
        if (close > start) end = close;
      }
    } else if (tagName === 'BLOCKQUOTE') {
      while (end + 1 < lines.length && /^\s*>/.test(lines[end + 1])) end++;
    } else if (tagName === 'TABLE') {
      while (end + 1 < lines.length && lines[end + 1].trim() !== '' && lines[end + 1].includes('|')) end++;
    } else if (tagName === 'HR' || /^H[1-6]$/.test(tagName)) {
      end = start;
    } else {
      while (end + 1 < lines.length &&
             lines[end + 1].trim() !== '' &&
             !/^(#{1,6})\s/.test(lines[end + 1]) &&
             !/^\s*```/.test(lines[end + 1]) &&
             !/^\s*>\s?/.test(lines[end + 1]) &&
             !/^\s*([-*+]|\d+\.)\s+/.test(lines[end + 1])) {
        end++;
      }
    }
    return end;
  }

  // 顶层块在源码中的行范围 { start, end }（含首尾）；定位失败返回 null
  function getBlockRange(el) {
    if (!el) return null;
    const lines = state.currentText ? state.currentText.replace(/\r\n/g, '\n').split('\n') : [];
    if (!lines.length) return null;
    const start = parseInt(el.getAttribute('data-source-line'), 10);
    if (isNaN(start) || start < 0 || start >= lines.length) return null;
    let end = parseInt(el.getAttribute('data-source-end'), 10);
    if (isNaN(end) || end < start || end >= lines.length) {
      end = computeBlockEndLine(lines, start, el.tagName);
    }
    return { start: start, end: end };
  }

  // === FENCE_AT_LINE_BEGIN ===
  // 该行若落在某个围栏代码块的范围内（含起止围栏行本身），返回它的行范围 { start, end }，否则 null。
  // 为什么单列一个函数：围栏内部插入任何内容都会变成「代码的一部分」，
  // 插入的又是一个围栏代码块时，新围栏会被当成外层代码块的结束围栏，
  // 把原代码块从中间截断 → 必须靠它把插入点吸附到代码块的上下边界。
  // 配对方式与渲染器一致（从文件头顺序扫描：开围栏后遇到的第一个「裸围栏」即结束围栏），
  // 因此代码内容里字面出现的 ``` 不会被误判成新围栏；未闭合的围栏视为延续到文末。
  function fenceBlockAtLine(lines, line) {
    if (!lines || !lines.length) return null;
    if (line == null || !isFinite(line) || line < 0 || line >= lines.length) return null;
    for (let i = 0; i < lines.length; i++) {
      const open = matchFenceLine(lines[i]);
      if (!open) continue;
      const close = findFenceClose(lines, i, open.prefix);
      const end = close > i ? close : lines.length - 1;
      if (line >= i && line <= end) return { start: i, end: end };
      i = end; // 跳过整块，避免把代码内容里的 ``` 当成新围栏
    }
    return null;
  }
  // === FENCE_AT_LINE_END ===

  // 组装一个插入上下文：line = 新内容要写入的源码行下标；anchorEl/side 仅用于预览线定位
  function makeInsertContext(blockEl, side) {
    const lines = state.currentText ? state.currentText.replace(/\r\n/g, '\n').split('\n') : [];
    if (blockEl) {
      const range = getBlockRange(blockEl);
      if (!range) return null;
      return {
        line: side === 'above' ? range.start : range.end + 1,
        anchorEl: blockEl,
        side: side === 'above' ? 'above' : 'below',
        insideBlock: false   // 按块边界定位：插入点在块外，仍按旧规则补空行
      };
    }
    // 无锚点：追加到全文末尾（跳过结尾空行，避免插入后与文末空行之间多出空段）
    let at = lines.length;
    while (at > 0 && lines[at - 1].trim() === '') at--;
    const body = document.getElementById('markdown-body');
    return { line: at, anchorEl: body ? body.lastElementChild : null, side: 'below', insideBlock: false };
  }

  // === CLAMP_LINE_OFFSET_BEGIN ===
  // 把「块内行偏移」夹到该块自身的行范围内。
  // 为什么必须夹：段落里的 <br> 既可能是源码换行，也可能来自允许的内联标签 <br>；
  // 数 <br> 得到的光标偏移因此可能偏大。越界时退化成贴块边界（即旧的按块插入行为），
  // 绝不能让它落到相邻块上——那会把内容插进别的段落里。
  function clampLineOffset(offset, range) {
    if (!range || !isFinite(offset)) return 0;
    const max = Math.max(0, range.end - range.start);
    return Math.max(0, Math.min(Math.floor(offset), max));
  }
  // === CLAMP_LINE_OFFSET_END ===

  // === LINE_AT_POINT_BEGIN ===
  // 落点 → 该点所在「源码行」的宿主元素。返回 { host, node, offset } 或 null。
  // 向上找最近的带 data-source-line 的祖先，取到的是最精确的一层：
  // 引用块内的段落会命中内层 <p>（内置渲染器递归写的是绝对行号），
  // 而不是整个 <blockquote>，否则引用块里只有「整块上下」可选。
  function findLineHost(node, body) {
    let cur = node;
    while (cur && cur !== body) {
      if (cur.nodeType === 1 && cur.hasAttribute && cur.hasAttribute('data-source-line')) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return null;
  }

  // 段落内部的行偏移：渲染器用 join('<br>') 拼多行段落，故「光标之前有几个 <br>」＝在第几行。
  // 只数宿主下的「顶层」<br>：嵌套结构（如列表里的段落）内的 <br> 不属于这一行序列。
  function countLineBreaksBefore(host, node, offset) {
    let count = 0;
    for (let i = 0; i < host.childNodes.length; i++) {
      const child = host.childNodes[i];
      if (child === node) {
        // 光标落在文本节点内：则该节点自身的 <br> 都在其后，无需额外计数
        break;
      }
      if (child.nodeType === 1 && child.tagName === 'BR') {
        count++;
        continue;
      }
      // 光标落在某个元素内部（如 <strong> 里）：该元素里的 <br> 仍算在它之前
      if (child.nodeType === 1 && child.contains && child.contains(node)) {
        const brs = child.querySelectorAll('br');
        count += brs.length;
        break;
      }
    }
    return count;
  }

  // 解析落点所在的源码行，并给出该行整行的可视矩形（供预览线使用）。
  // 返回 { line, rect } ；无法解析时返回 null，调用方退回旧的按块边界逻辑。
  function resolveLineAtPoint(clientX, clientY) {
    const body = document.getElementById('markdown-body');
    if (!body) return null;

    // 标准 API：Chrome/Edge 用 caretRangeFromPoint，Firefox 用 caretPositionFromPoint
    let node = null;
    let offset = 0;
    if (document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(clientX, clientY);
      if (r && r.startContainer) {
        node = r.startContainer;
        offset = r.startOffset;
      }
    } else if (document.caretPositionFromPoint) {
      const p = document.caretPositionFromPoint(clientX, clientY);
      if (p && p.offsetNode) {
        node = p.offsetNode;
        offset = p.offset;
      }
    }
    if (!node || !body.contains(node)) return null;

    const host = findLineHost(node, body);
    if (!host) return null;
    // 顶层块（用于取块范围做夹取；引用块 / 列表内取的是最外层块）
    const block = getTopLevelBlock(host) || host;
    const range = getBlockRange(block);
    if (!range) return null;

    const start = parseInt(host.getAttribute('data-source-line'), 10);
    if (isNaN(start)) return null;

    let lineOffset = 0;
    let rect = null;

    if (host.tagName === 'P') {
      lineOffset = clampLineOffset(countLineBreaksBefore(host, node, offset), range);
      // 该源码行可能因折行占多个可视行：用 Range 覆盖整行后取上下沿，
      // 预览线才不会画在折行中间。Range 越界（node 已不在 host 内）时忽略。
      try {
        const r = document.createRange();
        r.setStart(host, 0);
        r.setEnd(node, offset);
        const rects = r.getClientRects ? r.getClientRects() : null;
        if (rects && rects.length) {
          const last = rects[rects.length - 1];
          rect = { top: last.top, bottom: last.bottom };
          // 行内换行时 cursor 在行首，此时最后一段就是目标行本身
          if (rect.bottom - rect.top <= 0 && host.getBoundingClientRect) {
            const hr = host.getBoundingClientRect();
            rect = { top: hr.top, bottom: hr.bottom };
          }
        }
      } catch (e) {
        rect = null;
      }
    } else if (host.tagName === 'PRE') {
      // Markdown 围栏代码块：代码正文从围栏行的下一行开始。
      // 按文本节点顺序累加「光标之前的换行数」，即得代码内部的行偏移。
      const codeEl = host.querySelector('code') || host;
      let count = 0;
      let found = false;
      (function scan(n) {
        if (found) return;
        if (n === node) {
          if (n.nodeType === 3) {
            const end = Math.min(offset, n.nodeValue.length);
            for (let k = 0; k < end; k++) {
              if (n.nodeValue.charAt(k) === '\n') count++;
            }
          }
          found = true;
          return;
        }
        if (n.nodeType === 3) {
          for (let k = 0; k < n.nodeValue.length; k++) {
            if (n.nodeValue.charAt(k) === '\n') count++;
          }
          return;
        }
        for (let k = 0; k < n.childNodes.length; k++) scan(n.childNodes[k]);
      })(codeEl);
      lineOffset = clampLineOffset(1 + count, range);
      try {
        const r = document.createRange();
        r.setStart(node, offset);
        r.collapse(true);
        const cr = r.getClientRects ? r.getClientRects() : null;
        if (cr && cr.length) rect = { top: cr[0].top, bottom: cr[0].bottom };
      } catch (e) {
        rect = null;
      }
    } else {
      // 标题 / hr / li / td / th / table / blockquote 自身即单行宿主
      lineOffset = 0;
      if (host.getBoundingClientRect) {
        const hr = host.getBoundingClientRect();
        rect = { top: hr.top, bottom: hr.bottom };
      }
    }

    return { line: start + lineOffset, rect: rect };
  }
  // === LINE_AT_POINT_END ===

  // === INSERT_PAD_BEGIN ===
  // 插入时是否需要在前后补空行。
  // 为什么：Markdown 靠空行分隔块，两个「普通正文行」相邻时会被并进同一个 <p>（中间只有 <br>）。
  // 但插在段落「内部」时补空行会把该段拆成三段，所以块内部不补——
  // 想让它独立成块时，用户在编辑框里自己留一个空行即可。
  //
  // 关键：补空行只解决「粘成同一段」这一种情形。标题 / 围栏 / 引用 / 列表项 / 分隔线都自成一块，
  // 紧贴它们插入本来就不会粘连；反之，如果这里无脑补空行，插入列表项会把一个列表拆成
  // 三个独立的 <ul>（"- 旧项\n\n- 新项\n\n- 旧项2"），插入的项既接不上原列表，也无法再缩进成子级。
  function isParagraphLine(line) {
    if (line == null) return false;
    const t = String(line).trim();
    if (t === '') return false;
    if (/^#{1,6}\s/.test(t)) return false;                 // 标题
    if (/^```/.test(t)) return false;                      // 围栏
    if (/^>/.test(t)) return false;                        // 引用块
    if (/^([-*+]|\d+\.)\s/.test(t)) return false;          // 列表项
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) return false;    // 分隔线
    return true;
  }

  // 插入内容的首 / 末个非空行：只有它们会与相邻行直接接触
  function firstNonEmptyLine(list) {
    if (!list || !list.length) return null;
    for (let i = 0; i < list.length; i++) {
      if (String(list[i]).trim() !== '') return list[i];
    }
    return null;
  }

  function lastNonEmptyLine(list) {
    if (!list || !list.length) return null;
    for (let i = list.length - 1; i >= 0; i--) {
      if (String(list[i]).trim() !== '') return list[i];
    }
    return null;
  }

  function computeInsertPadding(insideBlock, at, lines, newLines) {
    if (!lines || !lines.length) return { lead: false, trail: false };
    if (insideBlock) return { lead: false, trail: false };
    return {
      lead: isParagraphLine(at > 0 ? lines[at - 1] : null) && isParagraphLine(firstNonEmptyLine(newLines)),
      trail: isParagraphLine(at < lines.length ? lines[at] : null) && isParagraphLine(lastNonEmptyLine(newLines))
    };
  }
  // === INSERT_PAD_END ===

  // === BLOCK_INDENT_BEGIN ===
  // 正文右键「缩进」：一次移动一个层级 = 2 个空格。
  // 下面每条规则都来自对真实 builtinMarkdown 的实测，不是猜的：
  //   · 任何比上一项更靠右的缩进都会被列表项的「嵌套收集」吸收成子级，所以一层固定 2 空格即可；
  //   · 只缩进列表项那一行，它下面的子项会掉出来变成同级 → 必须按整棵子树一起平移；
  //   · 标题 (^(#{1,6})) 与分隔线 (^(-{3,})) 的正则锚定行首，加缩进会把它们变成普通段落，故不提供；
  //   · 引用块里的列表要把空格加在 "> " 之后，而引用块自己要把空格加在 ">" 之前，否则都静默无效
  //     （引用块只吃一个可选空格，剩下的缩进会留在内容里）。
  const INDENT_UNIT = 2;

  // 取「前一个块级兄弟」，跳过插入编辑框。
  // .insert-wrapper 会被临时插进 #markdown-body 顶在锚点块旁边，
  // 直接看 previousElementSibling 会把「前面是列表」误判成「前面不是列表」，导致右移被错误置灰。
  function previousBlockSibling(el) {
    let p = el ? el.previousElementSibling : null;
    while (p && p.classList && p.classList.contains('insert-wrapper')) p = p.previousElementSibling;
    return p;
  }

  // 该右键目标实际要缩进哪个块。定位失败返回 null。
  // 列表项优先：li 里点到的可能是嵌套的段落 / 引用，但「移动一个层级」指的是整个列表项。
  function resolveIndentElement(target) {
    if (!target || !target.tagName) return null;
    const li = target.closest ? target.closest('li') : null;
    if (li) return li;
    if (/^H[1-6]$/.test(target.tagName)) return null;      // 标题缩进会被摧毁
    if (/^(TD|TH)$/.test(target.tagName)) return target.closest('table');
    return target;                                          // P / PRE / BLOCKQUOTE / TABLE
  }

  // 祖先引用块层数（不含 el 自己）。每层祖先对应源码行首的一个 ">"。
  function countQuoteAncestors(el) {
    let n = 0;
    let p = el ? el.parentElement : null;
    while (p) {
      if (p.tagName === 'BLOCKQUOTE') n++;
      p = p.parentElement;
    }
    return n;
  }

  // 必须原样保留的「祖先引用块前缀」。
  // 按层数精确剥离，而不是一路剥到没有 ">"：列表项内部自带的 "  > " 属于内容本身，
  // 它要跟着一起缩进；一路剥掉会把缩进加到引用块内部去（实测为静默无效）。
  function ancestorQuotePrefix(line, depth) {
    const text = String(line == null ? '' : line);
    let rest = text;
    let cut = 0;
    for (let k = 0; k < depth; k++) {
      const p = matchQuotePrefix(rest);
      if (!p || rest.indexOf(p) !== 0) break;
      rest = stripQuotePrefix(rest, p);
      cut += p.length;
    }
    return text.slice(0, cut);
  }

  // 对 [start, end] 行区间整体加减缩进，返回新的行数组（不改动 state，便于直接测试）。
  // 空行跳过：给空行补空格只会产生行尾空白，渲染上没有任何作用。
  function buildIndentedLines(lines, start, end, delta, quoteDepth) {
    const out = lines.slice();
    const from = Math.max(0, start);
    const to = Math.min(end, lines.length - 1);
    if (from > to) return out;
    const prefix = ancestorQuotePrefix(lines[from], quoteDepth || 0);
    for (let i = from; i <= to; i++) {
      const line = out[i];
      if (String(line).replace(/[\s\r]/g, '') === '') continue;
      let head = '';
      let body = String(line);
      if (prefix && body.indexOf(prefix) === 0) {
        head = prefix;
        body = body.slice(prefix.length);
      }
      if (delta > 0) {
        out[i] = head + ' '.repeat(delta) + body;
      } else {
        // 只减最多 2 个空格：文档若用 4 空格缩进，需要再点一次才能真的升一级
        out[i] = head + body.replace(/^ {1,2}/, '');
      }
    }
    return out;
  }

  // 「左移 / 右移」是否真的会产生效果。菜单据此置灰，点击时再校验一次。
  // 右移必须看「上一级能不能接住它」：置顶列表的首项、前面不是列表的段落，
  // 缩进后源码变了而渲染毫无变化（实测），点下去只会让人以为功能坏了。
  function computeIndentAvailability(el, lines) {
    const none = { canIndent: false, canOutdent: false };
    if (!el) return none;
    const range = getBlockRange(el);
    if (!range) return none;
    const src = (lines && lines.length) ? lines : (state.currentText || '').split('\n');
    if (range.start >= src.length) return none;

    // 左移：首行去掉祖先引用前缀后至少有一个前导空格 —— 已在最左就没得减
    const head = ancestorQuotePrefix(src[range.start], countQuoteAncestors(el));
    const canOutdent = /^ /.test(String(src[range.start]).slice(head.length));

    // 右移：列表项要有同级上一项；其它块要紧跟在列表后面
    const prev = previousBlockSibling(el);
    const canIndent = el.tagName === 'LI'
      ? !!(prev && prev.tagName === 'LI')
      : !!(prev && /^(UL|OL)$/.test(prev.tagName));

    return { canIndent: canIndent, canOutdent: canOutdent };
  }

  // 某个源码行是否落在列表项里（li 的行范围含整棵子树）—— 返回该 li 或 null。
  // 用途：插入内容时判断「缩进一级」能不能真的产生子级。
  // 缩进的本质是被列表项的嵌套收集逻辑吸收，所以上方的行必须是列表项：
  //   · 上方是普通段落 → 缩进是惰性的，渲染完全没变化；
  //   · 上方是围栏代码块 → 2 个空格会落进代码内容里，等于改坏源码。
  function listItemContainingLine(lineIdx) {
    if (lineIdx == null || lineIdx < 0) return null;
    const body = document.getElementById('markdown-body');
    if (!body || !body.querySelectorAll) return null;
    const items = body.querySelectorAll('li');
    for (let i = 0; i < items.length; i++) {
      const r = getBlockRange(items[i]);
      if (r && lineIdx >= r.start && lineIdx <= r.end) return items[i];
    }
    return null;
  }

  // 执行一次缩进。delta > 0 右移、< 0 左移。
  function applyIndentBlock(el, delta) {
    if (!el || !delta) return false;
    const lines = (state.currentText || '').split('\n');
    const range = getBlockRange(el);
    if (!range) {
      toast('无法定位到源码行');
      return false;
    }
    const avail = computeIndentAvailability(el, lines);
    if (delta > 0 && !avail.canIndent) {
      toast('上方没有可挂靠的列表项，右移不会产生子级');
      return false;
    }
    if (delta < 0 && !avail.canOutdent) {
      toast('已经在最左，没有缩进可减');
      return false;
    }
    const next = buildIndentedLines(lines, range.start, range.end, delta, countQuoteAncestors(el));
    if (next.join('\n') === lines.join('\n')) {
      toast('缩进没有变化');
      return false;
    }
    const startLine = range.start;
    applySourceChange(next.join('\n'));
    toast(delta > 0 ? '已右移一级（+2 空格）' : '已左移一级（-2 空格）');
    // 重渲染后 el 已被替换，只能用行号回定位，保持刚才那一项在视野内
    setTimeout(function () { scrollToSourceLine(startLine); }, 0);
    return true;
  }
  // === BLOCK_INDENT_END ===

  // === BLOCK_DELETE_BEGIN ===
  // 列表项行判定：与渲染器 builtinParseList 的标记正则一致（无序 / 有序都算）。
  // 只用来判断「空行另一侧是否仍是列表项」，不参与渲染。
  function isListItemLine(line) {
    return /^\s*(?:[-*+]|\d+\.)\s+/.test(String(line == null ? '' : line));
  }

  // 删除一段行范围，并按安全规则连带删除「夹在同一列表两项之间的空行」。
  //
  // 为什么必须连带删：渲染器里**同级列表项之间的空行会终止列表**
  // （实测 `- a` / 空行 / `- c` 渲染成 2 个 <ul>），只删内容行会把一个列表切成两段；
  // 而「编辑框里把一行清空」写回的正是一个空行——这就是「列表不再连续」的根因。
  //
  // 为什么不能无脑吃相邻空行：段落之间的空行被删掉会让两段粘成同一段
  // （实测 `AAA` / 空行 / `BBB` 删掉空行 → 一个 <p>）。所以只在「空行另一侧仍是列表项」时才吃。
  function deleteSourceLines(lines, from, to) {
    let start = from;
    let end = to;
    const prevBlank = start - 1 >= 0 && lines[start - 1].trim() === '';
    const nextBlank = end + 1 < lines.length && lines[end + 1].trim() === '';
    if (prevBlank) {
      const before = start - 2 >= 0 ? lines[start - 2] : null;
      if (before !== null && isListItemLine(before) && isListItemLine(lines[start])) start = start - 1;
    }
    if (nextBlank) {
      const after = end + 2 < lines.length ? lines[end + 2] : null;
      if (after !== null && isListItemLine(lines[end]) && isListItemLine(after)) end = end + 1;
    }
    const removed = lines.slice(start, end + 1);
    lines.splice(start, end - start + 1);
    return { from: start, to: end, removed: removed };
  }

  // 右键「删除」：按块在源码里的完整行范围整行删除（嵌套列表项连整棵子树一起删，
  // 因为 builtinParseList 写入的 data-source-end 已覆盖子项范围）。
  function deleteBlock(el) {
    if (!el || state.currentText == null) {
      toast('无法定位到源码行');
      return false;
    }
    const lines = state.currentText.replace(/\r\n/g, '\n').split('\n');
    const range = getBlockRange(el);
    if (!range) {
      toast('无法定位到源码行');
      return false;
    }
    const result = deleteSourceLines(lines, range.start, range.end);
    // 删到文档为空时 join 得到 ''，仍是字符串：下游处处按 split('\n') 处理，类型不能变
    const nextText = lines.join('\n');
    const total = nextText.split('\n').length;
    const startLine = Math.max(0, Math.min(result.from, total - 1));
    const absorbed = result.from < range.start || result.to > range.end;
    applySourceChange(nextText);
    toast('已删除该块' + (absorbed ? '（连同列表项之间的空行）' : ''));
    // 重渲染后 el 已被替换，只能用行号回定位，保持删除位置在视野内
    setTimeout(function () { scrollToSourceLine(startLine); }, 0);
    return true;
  }
  // === BLOCK_DELETE_END ===

  // 正文空白处右键：按点击的 Y 坐标决定插入点（落在某块上方→插到它前面；低于所有块→插到文末）
  function resolveBlankInsertContext(clientY) {
    const body = document.getElementById('markdown-body');
    if (!body) return null;
    const blocks = Array.prototype.filter.call(body.children, function (el) {
      return el.nodeType === 1 && !(el.classList && el.classList.contains('insert-wrapper'));
    });
    if (!blocks.length) return makeInsertContext(null, 'below');
    for (let i = 0; i < blocks.length; i++) {
      const r = blocks[i].getBoundingClientRect();
      const side = clientY < r.top + r.height / 2 ? 'above' : 'below';
      if (clientY < r.top) return makeInsertContext(blocks[i], 'above');
      if (clientY <= r.bottom) return makeInsertContext(blocks[i], side);
    }
    return makeInsertContext(null, 'below');
  }

  // 插入位置预览线：hover 菜单项时显示，直观标出内容将落在哪一行
  function showInsertPreview(ctx) {
    if (!ctx) return;
    let marker = document.getElementById('insert-preview-line');
    if (!marker) {
      marker = document.createElement('div');
      marker.id = 'insert-preview-line';
      marker.className = 'insert-preview-line';
      // 带文字标签：只画一条蓝线时，块间距小的情况下看不出它会插到哪一段
      const label = document.createElement('span');
      label.className = 'insert-preview-label';
      label.textContent = '将在此处插入';
      marker.appendChild(label);
      document.body.appendChild(marker);
    }
    const body = document.getElementById('markdown-body');
    const contentEl = document.querySelector('.content');
    const br = body ? body.getBoundingClientRect() : null;
    const cr = contentEl ? contentEl.getBoundingClientRect() : null;
    const box = br || cr;
    if (!box) return;

    let y;
    if (ctx.rect) {
      // 按行插入：右键落在段落内部的某一行时，预览线画在「那一行」的上下沿。
      // 长行折行时 rect 覆盖整行、不落在折行中间，所以优先于按块的锚点定位。
      y = ctx.side === 'above' ? ctx.rect.top : ctx.rect.bottom;
    } else if (ctx.anchorEl && ctx.anchorEl.isConnected) {
      const r = ctx.anchorEl.getBoundingClientRect();
      y = ctx.side === 'above' ? r.top : r.bottom;
    } else if (body) {
      const lastEl = body.lastElementChild;
      y = lastEl ? lastEl.getBoundingClientRect().bottom : body.getBoundingClientRect().top;
    } else {
      y = box.top;
    }

    marker.style.left = Math.round(box.left) + 'px';
    marker.style.width = Math.round(box.width) + 'px';
    marker.style.top = Math.round(y) + 'px';
    marker.style.display = 'block';
  }

  function hideInsertPreview() {
    const marker = document.getElementById('insert-preview-line');
    if (marker) marker.style.display = 'none';
  }

  function getInsertLangDatalist() {
    let dl = document.getElementById('insert-lang-datalist');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'insert-lang-datalist';
      CODE_LANG_SUGGESTIONS.forEach(function (l) {
        const o = document.createElement('option');
        o.value = l;
        dl.appendChild(o);
      });
      document.body.appendChild(dl);
    }
    return dl;
  }

  // 在当前处插入文本块 / 代码块；ctx 由 makeInsertContext / resolveBlankInsertContext 提供
  function startInsertEditor(ctx, kind) {
    if (!ctx) {
      toast('无法确定插入位置');
      return;
    }
    if (state.currentText == null) {
      toast('请先打开文档');
      return;
    }
    if (isCodeFile(state.currentPath)) {
      toast('代码 / 配置文件不支持插入文本块');
      return;
    }
    // 已有插入框时先确认它再让用户重新选位置：直接覆盖会丢掉已输入的内容（静默数据丢失），
    // 而先落盘再继续则会重渲染 DOM，使本次的锚点元素失效、插入点算错
    if (activeInsertEditor) {
      activeInsertEditor.commit();
      toast('已确认上一处插入，请重新右键选择插入位置');
      return;
    }
    const body = document.getElementById('markdown-body');
    if (!body) return;

    hideInsertPreview();

    const wrap = document.createElement('div');
    wrap.className = 'insert-wrapper';

    const label = document.createElement('div');
    label.className = 'insert-label';
    label.textContent = kind === 'code' ? '插入代码块' : '插入文本块（按 Markdown 渲染）';
    wrap.appendChild(label);

    let langInput = null;
    let indentCheck = null;
    if (kind === 'code') {
      const langRow = document.createElement('div');
      langRow.className = 'insert-lang-row';
      const langLabel = document.createElement('span');
      langLabel.className = 'insert-lang-label';
      langLabel.textContent = '语言';
      langInput = document.createElement('input');
      langInput.type = 'text';
      langInput.className = 'insert-lang-input';
      langInput.placeholder = '留空 = 不带语言标记';
      langInput.value = state.lastInsertLang || '';
      langInput.setAttribute('list', getInsertLangDatalist().id);
      langRow.appendChild(langLabel);
      langRow.appendChild(langInput);
      wrap.appendChild(langRow);
    }

    const textarea = document.createElement('textarea');
    textarea.className = 'insert-editor' + (kind === 'code' ? ' insert-code' : '');
    textarea.name = 'insert-editor';
    textarea.rows = 1;
    textarea.autocomplete = 'off';
    textarea.spellcheck = false;
    textarea.placeholder = kind === 'code'
      ? '输入代码…（Ctrl + Enter 确认，Esc 取消）'
      : '输入文本…（Ctrl + Enter 确认，Esc 取消）';
    wrap.appendChild(textarea);

    // 「缩进一级」选项：插入时就决定这份内容是与上文平级、还是成为上一项的子内容。
    // 只有「插入点上方那一行是列表项」时才可用 —— 缩进的本质是被列表项的嵌套收集逻辑吸收：
    //   · 上方是普通段落 → 缩进是惰性的，渲染完全没变化；
    //   · 上方是围栏代码块 → 2 个空格会落进代码内容里，等于把源码改坏。
    // 不可用时置灰并写明原因，而不是让用户勾了却看不到任何效果。
    const indentRow = document.createElement('label');
    indentRow.className = 'insert-indent-row';
    indentCheck = document.createElement('input');
    indentCheck.type = 'checkbox';
    indentCheck.className = 'insert-indent-check';
    const indentText = document.createElement('span');
    indentText.className = 'insert-indent-label';
    if (listItemContainingLine(ctx.line - 1)) {
      indentCheck.title = '在这份内容前加 2 个空格，使它成为上一项的子内容';
      indentText.textContent = '⇧ 缩进一级（成为上一项的子内容）';
    } else {
      indentCheck.disabled = true;
      indentRow.classList.add('is-disabled');
      indentCheck.title = '插入点上方不是列表项，缩进不会产生子级；请改用列表项下方的「下方插入」';
      indentText.textContent = '⇧ 缩进一级（上方不是列表项，不可用）';
    }
    indentRow.appendChild(indentCheck);
    indentRow.appendChild(indentText);
    wrap.appendChild(indentRow);

    const footer = document.createElement('div');
    footer.className = 'insert-footer';
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'btn btn-primary insert-ok';
    okBtn.textContent = '✓ 插入';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn insert-cancel';
    cancelBtn.textContent = '✕ 取消';
    footer.appendChild(cancelBtn);
    footer.appendChild(okBtn);
    wrap.appendChild(footer);

    // 一行起步：高度只由内容决定，输入换行即增高，删除即缩回
    function autoGrow() {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
    textarea.addEventListener('input', autoGrow);

    // 挂到 DOM 的插入位置（插到锚点前 / 后），使编辑框视觉上就落在插入点
    if (ctx.anchorEl && ctx.anchorEl.isConnected && ctx.anchorEl.parentNode) {
      if (ctx.side === 'above') ctx.anchorEl.parentNode.insertBefore(wrap, ctx.anchorEl);
      else ctx.anchorEl.parentNode.insertBefore(wrap, ctx.anchorEl.nextSibling);
    } else {
      body.appendChild(wrap);
    }

    // 提前滚动，避免聚焦时视图跳动（与现有编辑器一致）
    wrap.scrollIntoView({ block: 'nearest' });
    const savedScroll = captureContentScroll();
    try {
      textarea.focus({ preventScroll: true });
    } catch (e) {
      textarea.focus();
    }
    textarea.setSelectionRange(0, 0);
    restoreContentScroll(savedScroll);
    autoGrow();

    let finished = false;
    function cancel() {
      if (finished) return;
      finished = true;
      activeInsertEditor = null;
      // 源码尚未改动，只需摘掉编辑框；不要重渲染，否则会丢掉当前滚动位置
      if (wrap.parentNode) wrap.remove();
    }

    function commit() {
      if (finished) return;
      finished = true;
      activeInsertEditor = null;

      const raw = textarea.value.replace(/\r\n/g, '\n').replace(/\n+$/, '');
      if (!raw.trim()) {
        if (wrap.parentNode) wrap.remove();
        toast('已取消：没有输入内容');
        return;
      }

      const newLines = [];
      if (kind === 'code') {
        const rawLang = (langInput ? langInput.value : '').trim();
        state.lastInsertLang = rawLang;
        newLines.push('```' + normalizeFenceLang(rawLang));
        raw.split('\n').forEach(function (l) { newLines.push(l); });
        newLines.push('```');
      } else {
        raw.split('\n').forEach(function (l) { newLines.push(l); });
      }

      // 与原文件行尾保持一致（CRLF 文件里插入的行同样带 \r）
      const eol = /\r\n/.test(state.currentText) ? '\r' : '';
      const lines = state.currentText.split('\n');
      const at = Math.max(0, Math.min(ctx.line, lines.length));

      // 前后补空行：只在「插入内容与相邻行会粘成同一个 <p>」时才补（见 computeInsertPadding）。
      // 插入列表项 / 围栏 / 引用块时两侧都不补，这样新项能接进原列表并继续缩进成子级。
      // 注意：补空行按「未缩进」的内容判断，空行本身不参与缩进。
      const pad = computeInsertPadding(!!ctx.insideBlock, at, lines, newLines);
      const leadBlank = pad.lead;
      const trailBlank = pad.trail;

      const indentOne = !!(indentCheck && indentCheck.checked && !indentCheck.disabled);
      const insertLines = [];
      if (leadBlank) insertLines.push(eol);
      newLines.forEach(function (l) {
        // 一个层级 = 2 个空格；空行不加，避免留下行尾空白
        const body = indentOne && String(l).trim() !== '' ? '  ' + l : l;
        insertLines.push(body + eol);
      });
      if (trailBlank) insertLines.push(eol);

      lines.splice(at, 0, ...insertLines);
      // 补了前导空行时，真正的内容落在 at + 1，闪烁定位要用它
      const firstContentLine = at + (leadBlank ? 1 : 0);

      if (wrap.parentNode) wrap.remove();
      applySourceChange(lines.join('\n'));
      // 渲染完成后定位并闪烁提示新插入的块
      setTimeout(function () { scrollToSourceLine(firstContentLine); }, 0);
      toast((kind === 'code' ? '已插入代码块' : '已插入文本块') + (indentOne ? '（已缩进一级）' : ''));
    }

    okBtn.addEventListener('click', function (e) {
      e.preventDefault();
      commit();
    });
    cancelBtn.addEventListener('click', function (e) {
      e.preventDefault();
      cancel();
    });
    textarea.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        commit();
      }
    });

    activeInsertEditor = { wrap: wrap, commit: commit, cancel: cancel };
  }

  // 点击插入编辑框外部即确认（框内点击：语言输入框 / 按钮 / 文本区都不提交）
  // 只认左键：右键是「打开插入菜单」，若在此提交会把刚输入的内容意外落盘
  document.addEventListener('mousedown', function (e) {
    if (!activeInsertEditor || e.button !== 0) return;
    if (e.target.closest && e.target.closest('.insert-wrapper')) return;
    activeInsertEditor.commit();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && activeInsertEditor) activeInsertEditor.cancel();
  });

  function undoLastEdit() {
    if (!state.undoStack.length) {
      toast('没有可撤销的改动');
      return;
    }
    const previous = state.undoStack.pop();
    state.currentText = previous;
    writeCurrentTextToDisk(previous).then(function (result) {
      renderMarkdown(previous);
      if (result === 'disk') toast('已撤销上一条改动（已写回磁盘）');
      else if (result === 'cache') toast('已撤销上一条改动（已更新浏览器缓存）');
      else toast('已撤销（仅内存）');
    });
  }

  function copyTextToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制');
      }).catch(function () {
        toast('复制失败');
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        toast('已复制');
      } catch (e) {
        toast('复制失败');
      }
      document.body.removeChild(ta);
    }
  }
