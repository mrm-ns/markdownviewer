  // ---------- 正文编辑与撤销 ----------
  async function writeCurrentTextToDisk(text) {
    if (!state.currentPath) return false;
    const item = state.files.find(function (f) { return f.path === state.currentPath; });

    // 1) 单文件句柄（showOpenFilePicker 打开）：直接写回原文件
    if (item && item.fileHandle) {
      try {
        const writable = await item.fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        item.file = new File([text], item.name, { type: 'text/markdown' });
        return 'disk';
      } catch (e) {
        console.warn('写回单个文件失败', e);
        return false;
      }
    }

    // 2) 目录句柄（showDirectoryPicker / 拖入文件夹）：写回磁盘
    if (state.dirHandle) {
      try {
        const item2 = state.files.find(function (f) { return f.path === state.currentPath; });
        if (!item2) return false;
        const dir = state.currentPath.indexOf('/') >= 0 ? state.currentPath.replace(/[^/]*$/, '') : '';
        const parentHandle = await getDirectoryHandleByPath(state.dirHandle, dir);
        const fileHandle = await parentHandle.getFileHandle(item2.name);
        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        item2.file = new File([text], item2.name, { type: 'text/markdown' });
        return 'disk';
      } catch (e) {
        console.warn('写回磁盘失败', e);
        return false;
      }
    }

    // 3) 快照模式（Apache/HTTP 等只读环境）：无法写回磁盘，只能写回浏览器缓存
    if (state.dirReadOnly && state.snapshotData) {
      try {
        const entry = state.snapshotData.files.find(function (f) { return f.path === state.currentPath; });
        if (entry) {
          entry.content = text;
          state.snapshotData.savedAt = Date.now();
          const snapItem = state.files.find(function (f) { return f.path === state.currentPath; });
          if (snapItem) {
            snapItem.file = new File([text], snapItem.name, { type: 'text/markdown' });
          }
          // 仅当当前是默认目录会话时才持久化到默认缓存槽；普通浏览目录只更新内存
          if (state.isDefaultSession) {
            await saveSnapshotToDb(state.snapshotData);
            return 'cache';
          }
          return false; // 未设为默认目录：修改仅保留在内存
        }
      } catch (e) {
        console.warn('更新默认目录缓存失败', e);
      }
      return false;
    }

    return false;
  }

  function applySourceChange(newText) {
    if (state.currentText == null) return;
    state.undoStack.push(state.currentText);
    if (state.undoStack.length > 20) state.undoStack.shift();
    state.currentText = newText;

    // 渲染失败（任何内容）不应阻断保存：无论如何都要尝试写回磁盘
    try {
      renderMarkdown(newText);
    } catch (e) {
      console.error('[Markdown Viewer] 渲染失败，但仍尝试保存修改', e);
    }

    // 写入结果按实际去向提示：'disk'（已写回磁盘）/ 'cache'（已写入浏览器缓存）/ false（仅内存）
    writeCurrentTextToDisk(newText).then(function (result) {
      if (result === 'disk') {
        toast('已保存修改（已写回磁盘）');
      } else if (result === 'cache') {
        toast('已保存到浏览器缓存（当前环境无法直接写回磁盘）');
      } else {
        toast('无法写回磁盘（当前环境只读），修改仅保留在内存中');
      }
    });
  }

  // ---------- 选中文字着色（<font color>，代码块除外） ----------
  // 把渲染后 DOM 中的文字选区映射回源文件位置，插入 <font color='...'> 标签。
  // 原理：渲染元素带 data-source-line（表格单元格额外带 data-col），
  // 用「宽松正则」（允许 markdown 标记穿插在字符间；不含 HTML 标签，
  // 避免把已有 <font> 标签吞进匹配导致新颜色被内层旧颜色覆盖）定位选中文字。
  function buildLooseSourceRegex(text) {
    const inter = '(?:[*_~`]|\\*\\*|~~)*';
    const body = String(text).split('').map(function (ch) {
      return ch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    }).join(inter);
    return new RegExp(inter + body + inter, 'gi');
  }

  // 在 scope 中查找选中文字，恰好命中一处才返回（多处视为无法确定，避免包错位置）
  function findUniqueSourceMatch(scope, selText) {
    if (!scope || !selText) return null;
    const re = buildLooseSourceRegex(selText);
    const matches = [];
    let m;
    while ((m = re.exec(scope)) !== null) {
      matches.push({ start: m.index, len: m[0].length, raw: m[0] });
      if (matches.length > 1) break;
      if (m.index === re.lastIndex) re.lastIndex++; // 防御零长度匹配死循环
    }
    if (matches.length === 1 && matches[0].len > 0) return matches[0];
    return null;
  }

  function captureSelectionRange() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!range || range.collapsed) return null;
    return range;
  }

  // 把正文中的文字选区定位到源码，返回 { norm, start, len, trimmed }；
  // 失败时已 toast 原因并返回 null。
  function locateSelectionInSource(range) {
    if (!state.currentText) {
      toast('请先打开文档');
      return null;
    }
    if (!range || range.collapsed) {
      toast('请先在正文中选中文字');
      return null;
    }
    const selText = (range.toString() || '').trim();
    if (!selText) {
      toast('选中的文字为空');
      return null;
    }

    const container = range.commonAncestorContainer;
    const el = container && container.nodeType === 1 ? container : (container ? container.parentElement : null);
    if (!el || !el.closest || !el.closest('#markdown-body')) {
      toast('请先在正文中选中文字');
      return null;
    }
    // 代码块除外：检查选区两端是否落在 <pre> 内
    const startEl = range.startContainer && range.startContainer.nodeType === 1
      ? range.startContainer : (range.startContainer ? range.startContainer.parentElement : null);
    const endEl = range.endContainer && range.endContainer.nodeType === 1
      ? range.endContainer : (range.endContainer ? range.endContainer.parentElement : null);
    if ((startEl && startEl.closest && startEl.closest('pre')) ||
        (endEl && endEl.closest && endEl.closest('pre')) ||
        (el.closest && el.closest('pre'))) {
      toast('不能处理代码块内的文字');
      return null;
    }

    // 统一行尾，与现有编辑流程一致
    const norm = state.currentText.replace(/\r\n/g, '\n');
    const lines = norm.split('\n');

    let match = null;
    let scopeBase = 0; // 匹配范围起点在全文（norm）中的偏移
    const block = el.closest ? el.closest('[data-source-line]') : null;
    if (block && block.tagName !== 'PRE') {
      const lineIndex = parseInt(block.getAttribute('data-source-line'), 10);
      if (!isNaN(lineIndex) && lineIndex >= 0 && lineIndex < lines.length) {
        let lineBase = 0;
        for (let k = 0; k < lineIndex; k++) lineBase += lines[k].length + 1; // 该行在全文中的起点
        let scope = lines[lineIndex];
        scopeBase = lineBase;
        const col = block.getAttribute('data-col');
        if (col != null) {
          const segs = scope.split('|');
          if (segs[col] !== undefined) {
            let cellBase = 0;
            for (let k = 0; k < col; k++) cellBase += segs[k].length + 1; // 单元格在该行内的起点
            scope = segs[col];
            scopeBase = lineBase + cellBase;
          }
        }
        match = findUniqueSourceMatch(scope, selText);
        // 表格单元格内匹配失败时，放宽到整行再试
        if (!match && col != null) {
          scopeBase = lineBase;
          match = findUniqueSourceMatch(lines[lineIndex], selText);
        }
      }
    }

    // 元素定位失败：在整个文档中唯一匹配
    if (!match) {
      scopeBase = 0;
      match = findUniqueSourceMatch(lines.join('\n'), selText);
    }

    if (!match) {
      toast('无法在源码中唯一确定选中的文字，请调整选择范围');
      return null;
    }

    // 修剪匹配串首尾空白，避免把多余空格包进标签
    const raw = match.raw;
    const trimmed = raw.trim();
    if (!trimmed) {
      toast('无法确定选中的文字位置');
      return null;
    }
    let start = scopeBase + match.start;
    let len = raw.length;
    if (trimmed !== raw) {
      const lead = raw.indexOf(trimmed);
      start += lead;
      len = trimmed.length;
    }
    return { norm: norm, start: start, len: len, trimmed: trimmed };
  }

  // 若选中文字恰好被一层或多层嵌套 <font> 包裹（标签紧邻、无其他内容），
  // 返回整段嵌套区间 [s, e)；否则返回 null。
  function findBalancedFontWrap(norm, start, len) {
    let s = start;
    let e = start + len;
    let openCount = 0;
    let b = norm.substring(0, s);
    let a = norm.substring(e);
    while (true) {
      const m = b.match(/<font\b[^>]*>$/i);
      if (!m) break;
      b = b.slice(0, -m[0].length);
      s -= m[0].length;
      openCount++;
    }
    let closeCount = 0;
    while (true) {
      const m = a.match(/^<\/font>/i);
      if (!m) break;
      a = a.slice(m[0].length);
      e += m[0].length;
      closeCount++;
    }
    if (openCount > 0 && openCount === closeCount) {
      return { s: s, e: e };
    }
    return null;
  }

  // 找出包含 [start, end) 的最外层 <font>...</font> 区间（跨嵌套全部层），找不到返回 null
  function findOutermostFontSpan(text, start, end) {
    const tagRe = /<font\b[^>]*>|<\/font>/gi;
    const tags = [];
    let m;
    while ((m = tagRe.exec(text))) {
      tags.push({ pos: m.index, open: m[0][1] !== '/', raw: m[0] });
    }
    const st = [];
    const pairs = [];
    tags.forEach(function (t) {
      if (t.open) {
        st.push(t);
      } else {
        const op = st.pop();
        if (op) pairs.push({ s: op.pos, e: t.pos + t.raw.length });
      }
    });
    let best = null;
    pairs.forEach(function (p) {
      if (p.s <= start && p.e >= end) {
        if (!best || p.s < best.s) best = p; // 取最外层（open 位置最早）
      }
    });
    return best;
  }

  // 返回 true 表示成功着色（已调用 applySourceChange）
  function applyColorToSelection(range, colorHex) {
    // 代码/配置文件不支持着色：插入 <font color> 会破坏源码
    if (isCodeFile(state.currentPath)) {
      toast('代码文件不支持文字着色（会破坏源码），请在 Markdown 文档中使用');
      return false;
    }
    const loc = locateSelectionInSource(range);
    if (!loc) return false;
    const norm = loc.norm;
    const start = loc.start;
    const len = loc.len;
    const trimmed = loc.trimmed;

    // 已着色的文字再次着色：若选中文本恰好被一层或多层 <font> 完整包裹，
    // 直接用新颜色替换整段（避免反复上色导致 <font> 无限嵌套叠加）
    const wrap = findBalancedFontWrap(norm, start, len);
    if (wrap) {
      const newText = norm.substring(0, wrap.s) +
        '<font color="' + colorHex + '">' + trimmed + '</font>' +
        norm.substring(wrap.e);
      applySourceChange(newText);
      return true;
    }

    const newText = norm.substring(0, start) +
      '<font color="' + colorHex + '">' + trimmed + '</font>' +
      norm.substring(start + len);
    applySourceChange(newText);
    return true;
  }

  // 取消文本颜色：移除选中文字周围（含嵌套全部层）的 <font> 标签，恢复为普通正文
  function removeColorFromSelection(range) {
    if (isCodeFile(state.currentPath)) {
      toast('代码文件不支持文字着色，无需取消颜色');
      return false;
    }
    const loc = locateSelectionInSource(range);
    if (!loc) return false;
    const norm = loc.norm;
    const start = loc.start;
    const len = loc.len;

    const span = findOutermostFontSpan(norm, start, start + len);
    if (!span) {
      toast('选中的文字没有可取消的颜色');
      return false;
    }
    const inner = norm.substring(span.s, span.e).replace(/<\/?font\b[^>]*>/gi, '');
    const newText = norm.substring(0, span.s) + inner + norm.substring(span.e);
    applySourceChange(newText);
    return true;
  }



  function resolveSourceLine(el, fallbackLine) {
    const text = (el.textContent || '').trim();
    const lines = state.currentText ? state.currentText.split('\n') : [];

    if (fallbackLine >= 0 && fallbackLine < lines.length) {
      const src = lines[fallbackLine];
      if (src.includes(text) || text.includes(src.trim())) {
        return fallbackLine;
      }
      // 部分着色文本会被 <font>/<br> 标签打断连续性，导致上面的包含判断失败；
      // 这里先剥掉允许的标签并归一化空白再比对，从而信任渲染时写入的真实行号，
      // 避免落入下方模糊扫描（可能命中空行/其他行，导致编辑框内容为空或错误）。
      const srcStripped = src.replace(ALLOWED_HTML_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
      const textNorm = text.replace(/\s+/g, ' ').trim();
      if (srcStripped && textNorm &&
          (srcStripped.includes(textNorm) || textNorm.includes(srcStripped))) {
        return fallbackLine;
      }
    }

    if (el.tagName === 'PRE') {
      const code = ((el.querySelector('code') || el).textContent || '').replace(/\n$/, '').trim();
      for (let i = 0; i < lines.length; i++) {
        const open = matchFenceLine(lines[i]);
        if (!open) continue;
        // 结束围栏必须与本围栏同属一个引用块，否则块边界会算到引用块外
        const close = findFenceClose(lines, i, open.prefix);
        if (close < 0) continue;
        const buf = [];
        for (let j = i + 1; j < close; j++) {
          buf.push(stripFencePrefix(lines[j], open.prefix));
        }
        const blockCode = buf.join('\n').replace(/\n$/, '').trim();
        // 空块必须显式判等：blockCode 为空时 includes('') 恒为真，任意围栏行（含结束围栏）
        // 都会通过，于是「更改类型」会定位到毫不相干的代码块上
        if (!blockCode || !code) {
          if (blockCode === code) return i;
          continue;
        }
        if (blockCode === code || blockCode.includes(code) || code.includes(blockCode)) return i;
      }
      } else if (el.tagName === 'BLOCKQUOTE') {
        for (let i = 0; i < lines.length; i++) {
          if (/^\s*>/.test(lines[i])) {
            const buf = [];
            let j = i;
            while (j < lines.length && /^\s*>/.test(lines[j])) {
              buf.push(lines[j].replace(/^\s*>\s?/, ''));
              j++;
            }
            const joined = buf.join(' ').replace(/\s+/g, ' ').trim();
              const normalizedText = text.replace(/\s+/g, ' ').trim();
            if (joined === normalizedText) return i;
          }
        }

    } else if (/^H[1-6]$/.test(el.tagName)) {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('^\\s*#{1,6}\\s+' + escaped + '\\s*$');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) return i;
      }
    } else if (el.tagName === 'LI') {
      const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp('^\\s*(?:[-*+]|\\d+\\.)\\s+' + escaped + '\\s*$');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) return i;
      }
    } else {
      const textNorm = text.replace(/\s+/g, ' ').trim();
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) continue; // 跳过空行，避免 text.includes('') 误命中空行
        if (t === text) return i;
        if (t.includes(text)) return i;
        const tStripped = t.replace(ALLOWED_HTML_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
        if (tStripped && (tStripped.includes(textNorm) || textNorm.includes(tStripped))) return i;
      }
    }

    return fallbackLine;
  }

  // ---------- 编辑器聚焦：避免进入编辑时视图跳动 ----------
  // 直接 textarea.focus() 有两个副作用：
  //   1) 浏览器会把聚焦的编辑框「滚动进可视区」；
  //   2) 光标默认落在文本末尾，于是把「高编辑框 + 末尾光标」一起滚进视野。
  // 长文档里右键编辑正文/代码块就会突然跳到最下方，因此这里改为：
  // 聚焦但不滚动 + 光标置开头 + 编辑框内部滚回顶部。
  function focusEditorAtStart(editor) {
    try {
      editor.focus({ preventScroll: true });
    } catch (e) {
      editor.focus(); // 老浏览器不支持 preventScroll 选项
    }
    try {
      editor.setSelectionRange(0, 0);
    } catch (e) {
      // 某些类型不支持 setSelectionRange，忽略
    }
    editor.scrollTop = 0;
  }

  // 记录正文滚动位置（.content 为滚动容器）；替换 DOM 前后各调用一次
  function captureContentScroll() {
    const contentEl = document.querySelector('.content');
    return {
      content: contentEl ? contentEl.scrollTop : 0,
      win: window.scrollY || window.pageYOffset || 0
    };
  }

  function restoreContentScroll(saved) {
    if (!saved) return;
    const contentEl = document.querySelector('.content');
    if (contentEl) contentEl.scrollTop = saved.content;
    window.scrollTo(0, saved.win);
  }

  function startEditTextElement(el) {
    const fallbackLine = parseInt(el.getAttribute('data-source-line'), 10);
    const sourceLine = resolveSourceLine(el, isNaN(fallbackLine) ? -1 : fallbackLine);
    if (sourceLine < 0) {
      toast('无法定位到源码行');
      return;
    }

    const allLines = state.currentText ? state.currentText.split('\n') : [];
    let endLine = sourceLine;
    if (el.tagName === 'BLOCKQUOTE') {
      while (endLine + 1 < allLines.length && /^\s*>/.test(allLines[endLine + 1])) endLine++;
    } else if (el.tagName === 'LI' || /^H[1-6]$/.test(el.tagName)) {
      endLine = sourceLine;
    } else {
      while (endLine + 1 < allLines.length &&
             allLines[endLine + 1].trim() !== '' &&
             !/^(#{1,6})\s/.test(allLines[endLine + 1]) &&
             !/^\s*```/.test(allLines[endLine + 1]) &&
             !/^\s*>\s?/.test(allLines[endLine + 1]) &&
             !/^\s*([-*+]|\d+\.)\s+/.test(allLines[endLine + 1])) {
        endLine++;
      }
    }

    // 引用块：编辑框里隐藏 "> " 前缀（与代码块编辑框隐藏 ``` 同理），保存时再原样加回。
    // 缩进保留在内容里（matchQuotePrefix 只吃一个可选空格），因此逐字节还原。
    const quotePrefix = el.tagName === 'BLOCKQUOTE'
      ? (matchQuotePrefix(allLines[sourceLine]) || '> ')
      : '';
    const rawBlock = allLines.slice(sourceLine, endLine + 1).join('\n').replace(/\r/g, '').replace(/\n$/, '');
    const oldRaw = quotePrefix
      ? rawBlock.split('\n').map(function (l) { return stripQuotePrefix(l, quotePrefix); }).join('\n')
      : rawBlock;
    const savedScroll = captureContentScroll();
    const textarea = document.createElement('textarea');
    textarea.className = 'inline-editor';
    textarea.name = 'inline-editor';
    textarea.autocomplete = 'off';
    textarea.value = oldRaw;
    textarea.style.width = '100%';
    
    el.innerHTML = '';
    el.appendChild(textarea);

    // 高度跟随内容：单行内容就是一行高，输入换行即增高、删回即缩回。
    // 不加 preHeight 下限——那会让单行段落的编辑框仍撑到原块高度。
    function autoResizeInlineEditor() {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
    textarea.addEventListener('input', autoResizeInlineEditor);

    autoResizeInlineEditor();

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
      let newLines = newValue.split('\n');
      if (quotePrefix) {
        // 把隐藏掉的引用前缀加回每一行。空行只写前缀本身（去掉行尾空白），
        // 否则空行会把引用块截断，其后的行会掉出引用块（与代码块编辑同理）。
        const blankPrefix = quotePrefix.replace(/[ \t]+$/, '');
        newLines = newLines.map(function (l) {
          return l.trim() === '' ? blankPrefix : quotePrefix + l;
        });
      }
      // 内容被清空（整块只剩空白）→ 整行一起删除，而不是写回一个空行。
      // 写回空行会把列表从中间截断：渲染器里同级列表项之间的空行会终止列表
      // （`- a` / 空行 / `- c` 渲染成 2 个 <ul>），用户看到的就是「列表不再连续」。
      // 引用块除外：它的 "> " 前缀在编辑框里是隐藏的，空行靠前缀维持引用结构，
      // 整块删掉会连引用一起没了，所以仍按上面的原逻辑写回前缀行。
      if (!quotePrefix && newLines.every(function (l) { return l.trim() === ''; })) {
        const gone = deleteSourceLines(lines, sourceLine, endLine);
        const absorbed = gone.from < sourceLine || gone.to > endLine;
        applySourceChange(lines.join('\n'));
        toast('已删除该行' + (absorbed ? '（连同列表项之间的空行）' : ''));
        return;
      }
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
