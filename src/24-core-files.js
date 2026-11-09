  // ---------- 文件索引与树 ----------
  // 目录类加载后回到欢迎界面（不自动打开第一篇），由用户点击左侧文件打开
  function resetToWelcome() {
    state.currentPath = null;
    state.currentText = null;
    document.title = 'Markdown Viewer';
    renderMarkdown(null); // 显示欢迎界面
    renderTree();
  }

  function indexFiles(fileList, autoOpen) {
    resetImageMap();
    // webkitdirectory 文件夹选择：File System Access API 不可用的环境（如 Apache/HTTP）
    const isFolderInput = fileList.length > 0 && !!fileList[0].webkitRelativePath;
    state.dirHandle = null;
    state.dirReadOnly = isFolderInput;

    const files = [];
    const imageMap = {};
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = file.webkitRelativePath || file.name;
      if (isSupportedFile(file.name)) {
        files.push({ path: path, name: file.name, file: file });
      } else if (isImageFile(file.name)) {
        try {
          imageMap[path] = URL.createObjectURL(file);
        } catch (e) {
          // ignore
        }
      }
    }
    files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    state.files = files;
    state.imageMap = imageMap;
    renderTree();
    if (files.length > 0) {
      if (autoOpen) {
        openFile(files[0]);
      } else {
        resetToWelcome();
      }
      toast(isFolderInput
        ? '已加载 ' + files.length + ' 个文档（兼容模式：无法直接写回磁盘；点「默认目录 ▾ → 设定默认目录」后编辑可保存到浏览器缓存），点击左侧文件打开'
        : '已加载 ' + files.length + ' 个文档，点击左侧文件打开');
    } else {
      resetToWelcome();
      toast('没有找到 Markdown 文件');
    }

    // Apache / HTTP 等无法使用 File System Access API 的环境：
    // 把目录内容缓存到浏览器（IndexedDB），但「打开目录」不再自动成为默认目录；
    // 只有显式「设定默认目录」时才持久化为默认缓存
    if (isFolderInput) {
      state.isDefaultSession = false;
      buildSnapshotInMemory(folderItemsFromFileList(fileList));
    }
  }

  // 仅构建内存快照（供 dirReadOnly 编辑写缓存使用），不写入默认目录槽
  function buildSnapshotInMemory(items) {
    state.pendingSnapshot = buildFolderSnapshot(items).then(function (snapshot) {
      state.snapshotData = snapshot;
      return snapshot;
    }).catch(function (e) {
      console.warn('[Markdown Viewer] 构建目录缓存失败', e);
      return null;
    });
    return state.pendingSnapshot;
  }

  // 追加单个文件到现有列表（去重），不替换已有文件
  function appendFiles(fileList) {
    var added = 0;
    for (var i = 0; i < fileList.length; i++) {
      var file = fileList[i];
      if (!isSupportedFile(file.name)) continue;
      var path = file.webkitRelativePath || file.name;
      // 去重：同名文件已存在则跳过
      var exists = false;
      for (var j = 0; j < state.files.length; j++) {
        if (state.files[j].name === file.name) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        state.files.push({ path: path, name: file.name, file: file });
        added++;
      }
    }
    if (added > 0) {
      state.files.sort(function (a, b) {
        return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
      });
      renderTree();
      // 打开最新添加的第一个文件
      var firstNew = null;
      for (var k = 0; k < fileList.length; k++) {
        if (isSupportedFile(fileList[k].name)) {
          var n = fileList[k].name;
          for (var m = 0; m < state.files.length; m++) {
            if (state.files[m].name === n) {
              firstNew = state.files[m];
              break;
            }
          }
          if (firstNew) break;
        }
      }
      if (firstNew) openFile(firstNew);
      toast('已添加 ' + added + ' 个文档，共 ' + state.files.length + ' 个');
    } else {
      toast('文件已在列表中或类型不受支持');
    }
  }

  // 追加单个文件（可带 FileSystemFileHandle 可写句柄），去重并打开
  function appendFileItem(item) {
    const existing = state.files.find(function (f) { return f.name === item.name; });
    if (existing) {
      existing.file = item.file;
      if (item.fileHandle) existing.fileHandle = item.fileHandle;
      openFile(existing);
      toast('已打开：' + item.name);
      return;
    }
    state.files.push(item);
    state.files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    renderTree();
    openFile(item);
    toast('已打开：' + item.name);
  }

  function buildTree(files) {
    const root = { name: '', children: new Map(), files: [] };
    files.forEach(function (item) {
      const parts = item.path.split(/[\\/]/);
      const fileName = parts.pop();
      let node = root;
      parts.forEach(function (part) {
        if (!node.children.has(part)) {
          node.children.set(part, { name: part, children: new Map(), files: [] });
        }
        node = node.children.get(part);
      });
      node.files.push({
        path: item.path,
        name: fileName,
        file: item.file
      });
    });
    return root;
  }

  function indexWrappedFiles(wrapped, autoOpen) {
    resetImageMap();

    const files = [];
    const imageMap = {};
    wrapped.forEach(function (item) {
      if (isSupportedFile(item.name)) {
        files.push({ path: item.path, name: item.name, file: item.file });
      } else if (isImageFile(item.name)) {
        try {
          imageMap[item.path] = URL.createObjectURL(item.file);
        } catch (e) {
          // ignore
        }
      }
    });
    files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    state.files = files;
    state.imageMap = imageMap;
    renderTree();
    if (files.length > 0) {
      if (autoOpen) {
        openFile(files[0]);
      } else {
        resetToWelcome();
      }
      toast('已加载 ' + files.length + ' 个文档，点击左侧文件打开');
    } else {
      resetToWelcome();
      toast('没有找到 Markdown 文件');
    }
  }

  async function getDirectoryHandleByPath(rootHandle, dirPath) {
    let handle = rootHandle;
    if (!dirPath) return handle;
    const parts = dirPath.split('/').filter(Boolean);
    for (const part of parts) {
      handle = await handle.getDirectoryHandle(part);
    }
    return handle;
  }

  async function renameFile(path, newName) {
    const item = state.files.find(function (f) { return f.path === path; });
    if (!item) return false;
    const cleanName = String(newName || '').trim();
    if (!cleanName || cleanName === item.name) return false;
    if (cleanName.indexOf('/') >= 0 || cleanName.indexOf('\\') >= 0) {
      toast('文件名不能包含路径分隔符');
      return false;
    }
    const oldPath = item.path;
    const dir = oldPath.indexOf('/') >= 0 ? oldPath.replace(/[^/]*$/, '') : '';
    const newPath = dir + cleanName;
    if (state.files.some(function (f) { return f.path === newPath && f !== item; })) {
      toast('同名文件已存在');
      return false;
    }

    let renamedOnDisk = false;
    if (state.dirReadOnly) {
      toast('当前目录为只读模式，无法在磁盘上重命名');
    } else if (state.dirHandle) {
      try {
        const parentHandle = await getDirectoryHandleByPath(state.dirHandle, dir);
        const fileHandle = await parentHandle.getFileHandle(item.name);
        if (fileHandle && typeof fileHandle.move === 'function') {
          await fileHandle.move(cleanName);
          renamedOnDisk = true;
        }
      } catch (e) {
        console.warn('磁盘重命名失败，改为仅修改列表', e);
      }
    }

    item.name = cleanName;
    item.path = newPath;
    if (state.currentPath === oldPath) {
      state.currentPath = newPath;
      document.title = cleanName + ' - Markdown Viewer';
    }
    // 快照模式：同步更新浏览器缓存中的路径（仅默认目录会话写入默认缓存槽）
    if (state.dirReadOnly && state.snapshotData) {
      const entry = state.snapshotData.files.find(function (f) { return f.path === oldPath; });
      if (entry) { entry.path = newPath; entry.name = cleanName; }
      const imgEntry = state.snapshotData.images.find(function (f) { return f.path === oldPath; });
      if (imgEntry) { imgEntry.path = newPath; imgEntry.name = cleanName; }
      if (state.isDefaultSession) {
        saveSnapshotToDb(state.snapshotData).catch(function (e) {
          console.warn('更新默认目录缓存失败', e);
        });
      }
    }
    state.files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    renderTree();
    toast(renamedOnDisk ? '已重命名（磁盘+列表）' : '已重命名（仅当前列表）');
    return true;
  }


  function renderTree() {
    const container = document.getElementById('file-tree');
    const searchResultsEl = document.getElementById('search-results');
    const emptyTip = document.getElementById('empty-tip');
    const countEl = document.getElementById('file-count');

    // 全文搜索：有（可能为空）行级结果时渲染搜索结果面板
    const inContentResults = state.searchMode === 'content' && state.contentSearchResults !== null;
    if (inContentResults) {
      container.hidden = true;
      emptyTip.style.display = 'none';
      searchResultsEl.hidden = false;
      renderSearchResults(state.contentSearchResults || []);
      const n = state.contentSearchResults.length;
      // 额外标出其中的标题命中数，让「标题也参与搜索」一眼可见
      const headingCount = state.contentSearchResults.filter(function (r) { return r.isHeading; }).length;
      const headingTip = headingCount ? '（含 ' + headingCount + ' 条标题）' : '';
      countEl.textContent = n
        ? (state.contentSearchTruncated ? n + '+ 条结果' : n + ' 条结果') + headingTip
        : '';
      return;
    }

    container.hidden = false;
    searchResultsEl.hidden = true;

    const filtered = state.search
      ? state.files.filter(function (f) {
          return f.path.toLowerCase().includes(state.search.toLowerCase());
        })
      : state.files;

    countEl.textContent = filtered.length ? filtered.length + ' 个文件' : '';
    if (filtered.length === 0) {
      container.innerHTML = '';
      emptyTip.style.display = '';
      return;
    }
    emptyTip.style.display = 'none';
    expandAncestors(state.currentPath);
    container.innerHTML = renderNode(buildTree(filtered), '');
  }

  // 行片段高亮：从原始行文本切窗口（约 80 字符），再按位置分别转义并包裹 <mark>
  function buildSearchSnippet(text, keyword) {
    const lower = text.toLowerCase();
    const kwLower = keyword.toLowerCase();
    if (!kwLower || !lower.includes(kwLower)) {
      const short = text.length > 120 ? text.slice(0, 120) + '…' : text;
      return escapeHtml(short);
    }
    const firstIdx = lower.indexOf(kwLower);
    let start = Math.max(0, firstIdx - 28);
    let end = Math.min(text.length, firstIdx + kwLower.length + 52);
    if (start > 0) end = Math.max(end, start + 80);
    let html = '';
    if (start > 0) html += '…';
    let pos = start;
    let idx = lower.indexOf(kwLower, pos);
    while (idx >= 0 && idx < end) {
      html += escapeHtml(text.slice(pos, idx));
      html += '<mark class="search-hit">' + escapeHtml(text.slice(idx, idx + kwLower.length)) + '</mark>';
      pos = idx + kwLower.length;
      idx = lower.indexOf(kwLower, pos);
    }
    html += escapeHtml(text.slice(pos, end));
    if (end < text.length) html += '…';
    return html;
  }

  // 渲染全文搜索行级结果：按文件分组，文件名作组标题，默认折叠
  // 注意：搜索结果每次（继续输入、跳转、打开文件等）都会整块重建 innerHTML，
  // 所以展开状态存放在 state.searchExpandedFiles 里，渲染时按它决定是否展开。
  function renderSearchResults(results) {
    const el = document.getElementById('search-results');
    if (!el) return;
    if (!results || results.length === 0) {
      el.innerHTML = '<div class="search-empty">未找到匹配内容</div>';
      return;
    }
    const keyword = (state.search || '').toLowerCase();

    // 按文件分组：key 用完整 path，避免不同目录下的同名文件被并成一组；保持结果原有顺序
    const groups = [];
    const groupIndex = {};
    results.forEach(function (r) {
      let g = groupIndex[r.path];
      if (!g) {
        g = { path: r.path, name: r.name, items: [] };
        groupIndex[r.path] = g;
        groups.push(g);
      }
      g.items.push(r);
    });

    let html = '';
    groups.forEach(function (g) {
      const open = state.searchExpandedFiles.has(g.path);
      // 文件路径去掉文件名后的目录前缀，用于在同名文件之间区分
      const folder = g.path.replace(/[^/]*$/, '');
      let itemsHtml = '';
      g.items.forEach(function (r) {
        const crumb = r.breadcrumbs && r.breadcrumbs.length
          ? r.breadcrumbs.join(' / ')
          : '（无标题）';
        // 标题命中：给个「标题」小标签 + 缩进层级，便于和正文命中区分开
        // （同一个关键词常常标题和正文各命中一次，只靠行号分不出来）
        const hitBadge = r.isHeading
          ? '<span class="search-result-kind">标题 H' + (r.headingLevel || 1) + '</span>'
          : '';
        itemsHtml += '<div class="search-result' + (r.isHeading ? ' is-heading' : '') +
          '" data-path="' + escapeHtml(r.path) + '" data-line="' + r.lineIndex + '">' +
          '<div class="search-result-head">' +
            '<span class="search-result-heading">' + (r.isHeading ? '🏷️' : '📑') + ' ' + escapeHtml(crumb) + '</span>' +
            hitBadge +
            '<span class="search-result-line">L' + r.lineNumber + '</span>' +
          '</div>' +
          '<div class="search-result-snippet">' + buildSearchSnippet(r.text, keyword) + '</div>' +
        '</div>';
      });
      html += '<div class="search-group' + (open ? ' open' : '') + '" data-path="' + escapeHtml(g.path) + '">' +
        '<div class="search-group-header" title="点击展开 / 收起此文件的匹配行">' +
          '<span class="search-group-name">📄 ' + escapeHtml(g.name || g.path) + '</span>' +
          '<span class="search-group-arrow">' + (open ? '▾' : '▸') + '</span>' +
          (folder ? '<span class="search-group-folder">' + escapeHtml(folder) + '</span>' : '') +
          '<span class="search-group-count">' + g.items.length + '</span>' +
        '</div>' +
        '<div class="search-group-items"' + (open ? '' : ' style="display:none"') + '>' + itemsHtml + '</div>' +
      '</div>';
    });
    el.innerHTML = html;
  }

  const CONTENT_SEARCH_MAX_RESULTS = 1000; // 全文搜索结果上限

  // 读取文件文本（优先命中缓存；缓存按 lastModified/size 校验）
  async function readSearchFileText(item) {
    if (item.path === state.currentPath && state.currentText != null) {
      return { text: state.currentText, isFresh: true };
    }
    const cache = state.searchTextCache[item.path];
    const file = await getFreshFile(item);
    if (file && cache &&
        file.lastModified === cache.lastModified &&
        file.size === cache.size) {
      return { text: cache.text, isFresh: false };
    }
    const text = await readFileText(file);
    if (file) {
      state.searchTextCache[item.path] = { lastModified: file.lastModified, size: file.size, text: text };
    }
    return { text: text, isFresh: false };
  }

  // ---------- 全文搜索：单文件行扫描 ----------
  // 抽成纯函数（只依赖入参 lines / keyword，不碰文件系统与 DOM），便于脱离浏览器直接测试。
  // lines 必须是已把行尾归一化为 \n 之后的行数组。
  // limit 用于限制本次最多收集多少条（配合全局结果上限做提前退出），0 / 不传表示不限。
  // === SEARCH_SCAN_BEGIN ===
  function collectLineMatches(lines, keyword, limit) {
    const results = [];
    const headingStack = [];   // { level, text }，用于给出「所属标题」面包屑
    let inFence = false;       // 是否在代码围栏内
    for (let li = 0; li < lines.length; li++) {
      if (limit && results.length >= limit) break;
      const trimmed = String(lines[li] == null ? '' : lines[li]).trim();
      // 跟踪代码围栏：围栏内的 # 只是代码里的井号，不能当标题。
      // 用 matchFenceLine 而不是 startsWith('```')：先 trim 虽然能兼容缩进围栏，
      // 但**引用块内的围栏**（"> ```bash"）trim 后仍以 > 开头，会被漏掉，
      // 于是这类围栏里的 "# 注释" 会被当成标题、污染面包屑
      if (matchFenceLine(trimmed)) {
        inFence = !inFence;
        continue;
      }
      let isHeading = false;
      let headingLevel = 0;
      if (!inFence) {
        const hm = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (hm) {
          const level = hm[1].length;
          while (headingStack.length && headingStack[headingStack.length - 1].level >= level) {
            headingStack.pop();
          }
          headingStack.push({ level: level, text: hm[2].trim() });
          isHeading = true;
          headingLevel = level;
          // 这里**不能** continue：标题行自身也是搜索目标。
          // 早先命中标题后直接 continue，标题永远走不到下面的关键词匹配，
          // 于是搜索只能命中正文，看起来像「不支持搜标题」。
          // 标题的 breadcrumbs 用「含自身」的栈是正确的——跳转到该行后，
          // 这个标题就是它所在的章节。
        }
      }
      if (!trimmed.toLowerCase().includes(keyword)) continue;
      results.push({
        lineIndex: li,
        lineNumber: li + 1,
        text: trimmed,
        isHeading: isHeading,
        headingLevel: headingLevel,
        heading: headingStack.length ? headingStack[headingStack.length - 1].text : '',
        breadcrumbs: headingStack.map(function (h) { return h.text; })
      });
    }
    return results;
  }
  // === SEARCH_SCAN_END ===

  async function performContentSearch(query) {
    const keyword = (query || '').toLowerCase();
    const seq = ++state.searchReqSeq;
    if (!keyword) {
      state.contentSearchResults = null;
      renderTree();
      return;
    }
    const results = [];
    let truncated = false;

    for (const item of state.files) {
      if (results.length >= CONTENT_SEARCH_MAX_RESULTS) { truncated = true; break; }
      let text;
      try {
        const r = await readSearchFileText(item);
        text = (r.text || '').replace(/\r\n/g, '\n');
      } catch (e) {
        // 忽略无法读取的文件
        continue;
      }
      if (seq !== state.searchReqSeq) return; // 已有更新的搜索请求

      // 把行扫描交给纯函数；limit 传剩余额度，命中上限时不再白扫剩下的行
      const hits = collectLineMatches(text.split('\n'), keyword, CONTENT_SEARCH_MAX_RESULTS - results.length);
      for (let k = 0; k < hits.length; k++) {
        const h = hits[k];
        results.push({
          path: item.path,
          name: item.name,
          lineIndex: h.lineIndex,
          lineNumber: h.lineNumber,
          text: h.text,
          isHeading: h.isHeading,
          headingLevel: h.headingLevel,
          heading: h.heading,
          breadcrumbs: h.breadcrumbs
        });
      }
      // 读满上限即标记截断（与原逐条 push 后判定的行为一致）
      if (results.length >= CONTENT_SEARCH_MAX_RESULTS) truncated = true;
      if (seq !== state.searchReqSeq) return;
    }
    if (seq !== state.searchReqSeq) return;

    state.contentSearchResults = results;
    state.contentSearchTruncated = truncated;
    if (state.sidebarTab !== 'files') setSidebarTab('files');
    renderTree();
  }


  // 把当前文件的所有祖先目录标记为展开，保证打开文件后其在树中可见
  function expandAncestors(path) {
    if (!path) return;
    const parts = path.split('/');
    parts.pop(); // 去掉文件名
    let p = '';
    parts.forEach(function (part) {
      p = p ? p + '/' + part : part;
      if (p) state.expandedFolders.add(p);
    });
  }

  function renderNode(node, prefix) {
    let html = '<ul class="tree">';
    node.children.forEach(function (child) {
      const childPath = prefix ? prefix + '/' + child.name : child.name;
      const childHtml = renderNode(child, childPath);
      // 子目录默认收起，仅当用户展开过（或在 state.expandedFolders 中）才展开
      const collapsed = !state.expandedFolders.has(childPath);
      html += '<li>' +
        '<div class="folder-label" data-folder-path="' + escapeHtml(childPath) + '" title="点击折叠/展开">📁 ' + escapeHtml(child.name) + '</div>' +
        '<div class="folder-children"' + (collapsed ? ' style="display:none"' : '') + '>' + childHtml + '</div>' +
      '</li>';
    });
    node.files.forEach(function (f) {
      const active = f.path === state.currentPath ? ' active' : '';
      html += '<li>' +
        '<div class="file-item' + active + '" data-path="' + escapeHtml(f.path) + '">' +
          '<span class="file-icon">📄</span>' +
          '<span class="file-name">' + escapeHtml(f.name) + '</span>' +
        '</div>' +
      '</li>';
    });
    html += '</ul>';
    return html;
  }

  // ---------- 侧边栏：文档列表 + 当前大纲 ----------
  function renderOutline() {
    const container = document.getElementById('outline-tree');
    if (!container) return;
    const headings = document.querySelectorAll('#markdown-body h1, #markdown-body h2, #markdown-body h3, #markdown-body h4, #markdown-body h5, #markdown-body h6');
    let html = '';
    headings.forEach(function (h) {
      const level = parseInt(h.tagName.charAt(1), 10);
      const id = h.id;
      const text = h.textContent || '';
      html += '<div class="outline-item" data-target="' + escapeHtml(id) + '" style="padding-left:' + (level * 12) + 'px">' + escapeHtml(text) + '</div>';
    });
    container.innerHTML = html || '<div class="empty-tip">当前文档没有标题</div>';
  }

  function setSidebarTab(tab) {
    state.sidebarTab = tab;
    const filesPanel = document.getElementById('files-panel');
    const outlinePanel = document.getElementById('outline-panel');
    const title = document.getElementById('sidebar-title');
    document.querySelectorAll('.sidebar-tab').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-sidebar-tab') === tab);
    });
    if (filesPanel) filesPanel.hidden = tab !== 'files';
    if (outlinePanel) outlinePanel.hidden = tab !== 'outline';
    if (title) title.textContent = tab === 'files' ? '文档列表' : '当前大纲';
    if (tab === 'outline') renderOutline();
  }

  function updateSidebarHandle() {
    const handle = document.getElementById('sidebar-toggle-handle');
    if (handle) handle.textContent = state.sidebarCollapsed ? '▶' : '◀';
  }

  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
    updateSidebarHandle();
    try {
      localStorage.setItem('markdown-viewer-sidebar-collapsed', state.sidebarCollapsed ? '1' : '0');
    } catch (e) {
      // ignore
    }
  }

  function loadSidebarState() {
    try {
      state.sidebarCollapsed = localStorage.getItem('markdown-viewer-sidebar-collapsed') === '1';
    } catch (e) {
      // ignore
    }
    document.body.classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
    updateSidebarHandle();
  }

  function updateToolbarHandle() {
    const handle = document.getElementById('toolbar-expand-handle');
    if (handle) handle.hidden = !state.toolbarCollapsed;
  }

  function toggleToolbar() {
    state.toolbarCollapsed = !state.toolbarCollapsed;
    document.body.classList.toggle('toolbar-collapsed', state.toolbarCollapsed);
    updateToolbarHandle();
    try {
      localStorage.setItem('markdown-viewer-toolbar-collapsed', state.toolbarCollapsed ? '1' : '0');
    } catch (e) {
      // ignore
    }
  }

  function loadToolbarState() {
    try {
      state.toolbarCollapsed = localStorage.getItem('markdown-viewer-toolbar-collapsed') === '1';
    } catch (e) {
      // ignore
    }
    document.body.classList.toggle('toolbar-collapsed', state.toolbarCollapsed);
    updateToolbarHandle();
  }



  async function getFreshFile(item) {
    // 单个文件（showOpenFilePicker 打开）：用可写句柄读取最新内容
    if (item && item.fileHandle) {
      try {
        const freshFile = await item.fileHandle.getFile();
        item.file = freshFile;
        return freshFile;
      } catch (e) {
        console.warn('获取最新文件失败，使用缓存文件', e);
        return item.file;
      }
    }
    if (!state.dirHandle || !item) return item.file;
    try {
      const dir = item.path.indexOf('/') >= 0 ? item.path.replace(/[^/]*$/, '') : '';
      const parentHandle = await getDirectoryHandleByPath(state.dirHandle, dir);
      const fileHandle = await parentHandle.getFileHandle(item.name);
      const freshFile = await fileHandle.getFile();
      item.file = freshFile;
      return freshFile;
    } catch (e) {
      console.warn('获取最新文件失败，使用缓存文件', e);
      return item.file;
    }
  }


  async function openFile(item, keepScroll) {
    if (!item || !item.file) return;
    try {
      const file = await getFreshFile(item);
      const text = await readFileText(file);
      state.currentPath = item.path;
        state.currentText = text;
        if (!state.undoStacks[item.path]) {
            state.undoStacks[item.path] = [];
          }
          state.undoStack = state.undoStacks[item.path];

      renderMarkdown(text);
      // 切换文件时滚动到顶部；keepScroll（如刷新当前文件）时保留原滚动位置
      if (!keepScroll) {
        const contentEl = document.querySelector('.content');
        if (contentEl) contentEl.scrollTop = 0;
        window.scrollTo(0, 0);
      }

      document.title = item.name + ' - Markdown Viewer';
      renderTree();
    } catch (err) {
      console.error(err);
      toast('读取文件失败：' + err.message);
    }
  }

  function openFileByPath(path) {
    const item = state.files.find(function (f) { return f.path === path; });
    if (item) openFile(item);
  }

  // ---------- 搜索结果跳转 ----------
  // 在渲染后的正文中滚动到源码行：取 data-source-line ≤ lineIndex 的最大元素
  function scrollToSourceLine(lineIndex) {
    const body = document.getElementById('markdown-body');
    let target = null;
    let best = -1;
    if (body) {
      body.querySelectorAll('[data-source-line]').forEach(function (el) {
        const n = parseInt(el.getAttribute('data-source-line'), 10);
        if (!isNaN(n) && n <= lineIndex && n > best) {
          best = n;
          target = el;
        }
      });
    }
    const contentEl = document.querySelector('.content');
    if (!target) {
      if (contentEl) contentEl.scrollTop = 0;
      window.scrollTo(0, 0);
      return;
    }

    // 代码文件整份内容在一个 <pre> 里（只有 data-source-line="0"）：
    // 按行号比例估算位置，避免总是停在文件顶部（pre-wrap 折行时为近似值）
    const isCodeFileBlock = target.tagName === 'PRE' && target.hasAttribute('data-code-file');
    if (isCodeFileBlock && lineIndex > 0 && state.currentText != null) {
      const totalLines = state.currentText.split('\n').length;
      if (totalLines > 1) {
        const ratio = Math.max(0, Math.min(1, lineIndex / (totalLines - 1)));
        const scrollParent = contentEl || document.scrollingElement;
        if (scrollParent) {
          const targetTop = target.offsetTop + ratio * target.offsetHeight;
          scrollParent.scrollTo({ top: Math.max(0, targetTop - 24), behavior: 'smooth' });
        }
        // 闪烁提示整个代码块区域，表明已定位到文件内的位置
        target.classList.remove('jump-flash');
        void target.offsetWidth;
        target.classList.add('jump-flash');
        setTimeout(function () {
          target.classList.remove('jump-flash');
        }, 1800);
        return;
      }
    }

    // 闪烁提示：重放动画需要先移除再强制重排
    target.classList.remove('jump-flash');
    void target.offsetWidth;
    target.classList.add('jump-flash');
    setTimeout(function () {
      target.classList.remove('jump-flash');
    }, 1800);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 打开文件并跳转到源码行；目标即当前文件时不重载直接滚动
  async function openFileAndJumpToLine(path, lineIndex) {
    const item = state.files.find(function (f) { return f.path === path; });
    if (!item) {
      toast('找不到文件：' + (path || ''));
      return;
    }
    if (path === state.currentPath) {
      scrollToSourceLine(lineIndex);
      return;
    }
    try {
      await openFile(item); // 渲染同步完成后再滚动
      scrollToSourceLine(lineIndex);
    } catch (e) {
      toast('打开文件失败：' + (e && e.message ? e.message : e));
    }
  }
