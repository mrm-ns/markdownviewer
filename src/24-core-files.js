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

  // === SEARCH_DIR_TREE_BEGIN ===
  // 把「按文件分组后的搜索结果」再按**目录**归类成一棵树（v1.1.23）。
  //
  // 为什么要这一步：以前是平铺的文件组，目录只作为文件名右侧的小字标注，
  // 几十个文件时完全看不出结构。现在按 path 的目录前缀建树，逐级嵌套，
  // 与左侧文件树的观感一致。
  //
  // 节点结构：{ name, path, dirs: [], files: [] }
  //   path 是「目录前缀」，统一带结尾斜杠（根目录为 ''），用作展开状态的 key。
  //   dirs 按名称排序（目录稳定可预期）；files 保持结果原有顺序（用户更关心命中先后）。
  //
  // 纯函数（不碰 DOM），可在 Node 里直接断言。
  function buildSearchDirTree(groups) {
    const root = { name: '', path: '', dirs: [], files: [] };
    const dirIndex = { '': root };

    // 按需创建某一级目录节点，返回它的节点
    function ensureDir(segments) {
      let node = root;
      let prefix = '';
      for (let i = 0; i < segments.length; i++) {
        prefix += segments[i] + '/';
        let child = dirIndex[prefix];
        if (!child) {
          child = { name: segments[i], path: prefix, dirs: [], files: [] };
          dirIndex[prefix] = child;
          node.dirs.push(child);
        }
        node = child;
      }
      return node;
    }

    groups.forEach(function (g) {
      // 目录前缀：去掉路径最后一段（文件名）。'a/b/c.md' → ['a','b']
      const slash = g.path.lastIndexOf('/');
      const dirPart = slash >= 0 ? g.path.slice(0, slash) : '';
      const segments = dirPart ? dirPart.split('/') : [];
      ensureDir(segments).files.push(g);
    });

    // 目录按名称排序（同级），保证每次渲染顺序稳定
    (function sortDirs(node) {
      node.dirs.sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-CN'); });
      node.dirs.forEach(sortDirs);
    })(root);

    return root;
  }

  // 统计某个目录节点下的命中总数（递归），显示在目录头上
  function countSearchDirHits(node) {
    let n = 0;
    node.files.forEach(function (f) { n += f.items.length; });
    node.dirs.forEach(function (d) { n += countSearchDirHits(d); });
    return n;
  }
  // === SEARCH_DIR_TREE_END ===

  // 渲染全文搜索行级结果：**按目录归类**（目录 → 文件 → 命中行），文件与命中的折叠状态见 state
  // 注意：搜索结果每次（继续输入、跳转、打开文件等）都会整块重建 innerHTML，
  // 所以展开状态存放在 state.searchCollapsedDirs / state.searchExpandedFiles 里，渲染时按它决定。
  function renderSearchResults(results) {
    const el = document.getElementById('search-results');
    if (!el) return;
    if (!results || results.length === 0) {
      el.innerHTML = '<div class="search-empty">未找到匹配内容</div>';
      return;
    }
    const keyword = (state.search || '').toLowerCase();

    // 第一步：按文件分组（key 用完整 path，避免不同目录下的同名文件被并成一组）
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

    // 第二步：按目录建树，然后递归渲染
    const tree = buildSearchDirTree(groups);

    // 渲染「一个文件」：组标题 + 命中行（与原实现一致，只是不再带目录小字）
    function renderFileGroup(g) {
      const open = state.searchExpandedFiles.has(g.path);
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
      return '<div class="search-group' + (open ? ' open' : '') + '" data-path="' + escapeHtml(g.path) + '">' +
        '<div class="search-group-header" title="点击展开 / 收起此文件的匹配行">' +
          '<span class="search-group-name">📄 ' + escapeHtml(g.name || g.path) + '</span>' +
          '<span class="search-group-arrow">' + (open ? '▾' : '▸') + '</span>' +
          '<span class="search-group-count">' + g.items.length + '</span>' +
        '</div>' +
        '<div class="search-group-items"' + (open ? '' : ' style="display:none"') + '>' + itemsHtml + '</div>' +
      '</div>';
    }

    // 渲染一个目录节点：目录头 + （子树目录 / 直接子文件）
    // 目录默认**展开**，只有 state.searchCollapsedDirs 里登记过的才是收起的。
    function renderDir(node, isRoot) {
      // 根目录本身不画头，直接铺开它的子目录与文件（工作区根下常常有文件）
      if (isRoot) {
        let inner = '';
        node.dirs.forEach(function (d) { inner += renderDir(d, false); });
        node.files.forEach(function (g) { inner += renderFileGroup(g); });
        return inner;
      }
      const collapsed = state.searchCollapsedDirs.has(node.path);
      const hits = countSearchDirHits(node);
      let inner = '';
      node.dirs.forEach(function (d) { inner += renderDir(d, false); });
      node.files.forEach(function (g) { inner += renderFileGroup(g); });
      return '<div class="search-dir' + (collapsed ? ' collapsed' : '') + '" data-dir="' + escapeHtml(node.path) + '">' +
        '<div class="search-dir-header" title="点击展开 / 收起此目录下的搜索结果">' +
          '<span class="search-dir-arrow">' + (collapsed ? '▸' : '▾') + '</span>' +
          '<span class="search-dir-name">📁 ' + escapeHtml(node.name) + '</span>' +
          '<span class="search-dir-count">' + hits + '</span>' +
        '</div>' +
        '<div class="search-dir-items"' + (collapsed ? ' style="display:none"' : '') + '>' + inner + '</div>' +
      '</div>';
    }

    el.innerHTML = renderDir(tree, true);
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
      // 按文件类型显示图标；file-icons.js 未加载时回退为通用文档 emoji
      const icon = (typeof window.MD_FILE_ICON_HTML === 'function')
        ? window.MD_FILE_ICON_HTML(f.name)
        : '📄';
      html += '<li>' +
        '<div class="file-item' + active + '" data-path="' + escapeHtml(f.path) + '">' +
          '<span class="file-icon">' + icon + '</span>' +
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
    // 大纲跟随阅读位置：重建 DOM 后立刻按当前滚动位置高亮一次，并确保滚动监听已挂上
    // （监听只挂一次；切到「当前大纲」页签、正文重渲染都会走到这里）
    bindOutlineSpy();
    scheduleOutlineActiveUpdate();
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

  // ---------- 阅读现场：会话恢复 / 侧栏宽度 / 目录展开态（v1.1.25） ----------
  // 三份数据都放 localStorage：它们只有几百字节，是「设置级」数据，且必须在启动时**同步**可用
  // （IndexedDB 是异步的，会让「恢复上次读到的位置」晚一拍、先闪一下页首）。
  const READING_STATE_KEY = 'markdown-viewer-reading-state';
  const READING_STATE_MAX_FILES = 40;   // 只记最近读过的 40 篇，避免长年累积
  const SIDEBAR_WIDTH_KEY = 'markdown-viewer-sidebar-width';
  const EXPANDED_FOLDERS_KEY = 'markdown-viewer-expanded-folders';
  const EXPANDED_FOLDERS_MAX = 500;     // 超大目录树也不至于把 localStorage 写爆
  const SIDEBAR_WIDTH_MIN = 200;
  const SIDEBAR_WIDTH_MAX = 560;
  const SIDEBAR_WIDTH_DEFAULT = 300;

  // 滚动位置一律夹取后再用：坏数据（负数 / 天文数字 / NaN）会把页面推到看不见的地方
  function sanitizeScrollTop(value) {
    const n = Number(value);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.round(Math.min(n, 10000000));
  }

  function loadReadingState() {
    state.readingState.lastPath = null;
    state.readingState.scrollByPath = {};
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(READING_STATE_KEY) || 'null');
    } catch (e) {
      parsed = null;   // 坏数据直接丢弃：宁可没有阅读现场，也不要因为一段脏 JSON 起不来
    }
    if (!parsed || typeof parsed !== 'object') return;
    if (typeof parsed.lastPath === 'string' && parsed.lastPath) {
      state.readingState.lastPath = parsed.lastPath;
    }
    const scrollByPath = parsed.scrollByPath;
    if (scrollByPath && typeof scrollByPath === 'object') {
      Object.keys(scrollByPath).forEach(function (path) {
        if (typeof path !== 'string' || !path) return;
        state.readingState.scrollByPath[path] = sanitizeScrollTop(scrollByPath[path]);
      });
    }
  }

  function saveReadingState() {
    const snapshot = { lastPath: state.readingState.lastPath || null, scrollByPath: {} };
    // 对象 key 保持插入顺序，超出上限就丢掉最早写进去的那几篇
    const keep = Object.keys(state.readingState.scrollByPath).slice(-READING_STATE_MAX_FILES);
    keep.forEach(function (path) {
      snapshot.scrollByPath[path] = state.readingState.scrollByPath[path];
    });
    state.readingState.scrollByPath = snapshot.scrollByPath;
    try {
      localStorage.setItem(READING_STATE_KEY, JSON.stringify(snapshot));
    } catch (e) {
      // ignore（隐私模式 / 配额满：功能降级，但不影响阅读）
    }
  }

  // 记录「当前文档读到哪里」。正文区 .content 是主滚动容器，window 在个别场景（整页撑高）也会滚，
  // 取两者较大值即可（与 scrollToSourceLine 的口径一致）。
  function rememberCurrentReadingPosition() {
    if (!state.currentPath) return;
    const contentEl = document.querySelector('.content');
    const contentTop = contentEl ? contentEl.scrollTop : 0;
    const winTop = window.scrollY || document.documentElement.scrollTop || 0;
    const top = Math.max(contentTop, winTop);
    if (top > 0) state.readingState.scrollByPath[state.currentPath] = sanitizeScrollTop(top);
    state.readingState.lastPath = state.currentPath;
  }

  function restoreReadingPositionFor(path) {
    const top = path ? state.readingState.scrollByPath[path] : 0;
    if (!top) return;
    const contentEl = document.querySelector('.content');
    if (contentEl) contentEl.scrollTop = top;
    window.scrollTo(0, top);   // 兜底：window 滚动的情形（contentEl 没有可滚内容时它才是滚动的那个）
    scheduleOutlineActiveUpdate();
  }

  // 启动时恢复上次读到的文档。必须在 restoreDefaultDirectory() 之后调用（那时 state.files 才有内容）。
  // ?open= 入口优先：它是「用户明确要看这篇」，不能被上次的阅读现场抢走。
  async function restoreLastSessionDocument() {
    if (typeof readStartupOpenRequest === 'function' && readStartupOpenRequest()) return;
    const path = state.readingState.lastPath;
    if (!path) return;
    if (state.currentPath === path) return;      // 已经打开了，不重复渲染
    const item = state.files.find(function (f) { return f.path === path; });
    if (!item) {
      // 文档被删除 / 改名 / 换了工作区：清掉记忆，否则每次启动都白找一次
      state.readingState.lastPath = null;
      delete state.readingState.scrollByPath[path];
      saveReadingState();
      return;
    }
    await openFile(item);
  }

  // ---------- 侧栏宽度（拖拽条） ----------
  function clampSidebarWidth(width) {
    const n = Number(width);
    if (!isFinite(n) || n <= 0) return SIDEBAR_WIDTH_DEFAULT;
    return Math.round(Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, n)));
  }

  function applySidebarWidth(width) {
    const w = clampSidebarWidth(width);
    state.sidebarWidth = w;
    // 只写一个 CSS 变量：.sidebar 的 width 由它决定，收起态等其它规则都不用改
    document.documentElement.style.setProperty('--sidebar-width', w + 'px');
    return w;
  }

  function loadSidebarWidth() {
    let raw = null;
    try {
      raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    } catch (e) {
      raw = null;
    }
    // 注意 Number(null) 是 0、Number('') 也是 0 —— 必须显式判「没存过」，否则默认值会被夹成下限
    applySidebarWidth(raw == null || raw === '' ? SIDEBAR_WIDTH_DEFAULT : raw);
  }

  function saveSidebarWidth(width) {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(clampSidebarWidth(width)));
    } catch (e) {
      // ignore
    }
  }

  // ---------- 目录展开态持久化 ----------
  // state.expandedFolders 原本只在内存里，刷新页面后整棵树回到全收起（几百个目录要点开一遍）。
  function loadExpandedFolders() {
    let parsed = null;
    try {
      parsed = JSON.parse(localStorage.getItem(EXPANDED_FOLDERS_KEY) || 'null');
    } catch (e) {
      parsed = null;
    }
    if (!Array.isArray(parsed)) return;
    parsed.slice(0, EXPANDED_FOLDERS_MAX).forEach(function (path) {
      if (typeof path === 'string' && path) state.expandedFolders.add(path);
    });
  }

  function saveExpandedFolders() {
    try {
      localStorage.setItem(EXPANDED_FOLDERS_KEY,
        JSON.stringify(Array.from(state.expandedFolders).slice(0, EXPANDED_FOLDERS_MAX)));
    } catch (e) {
      // ignore
    }
  }

  // ---------- 侧栏跟手：把当前文档滚进文档列表视野 ----------
  // renderTree 每次整块重建 DOM，且只给当前文件挂 .active —— 深目录里的文档打开后，
  // 侧栏那条根本不在可见区域，用户以为「没选中」。这里只在确实跑出视野时才滚（避免每点一次都抖一下）。
  function revealActiveFileInTree() {
    if (state.sidebarTab !== 'files') return;
    const tree = document.getElementById('file-tree');
    if (!tree) return;
    const active = tree.querySelector('.file-item.active');
    if (!active) return;
    const treeRect = tree.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    if (rect.top >= treeRect.top && rect.bottom <= treeRect.bottom) return;   // 已经在视野里
    if (typeof active.scrollIntoView === 'function') active.scrollIntoView({ block: 'center' });
  }

  // ---------- 大纲跟随阅读位置 ----------
  // CSS 里早就有 .outline-item.active（css/style.css），但从来没人赋值 ——
  // 「当前大纲」于是只是一份死列表：读到哪里都不会高亮，也看不出当前在哪一节。
  let outlineSpyRaf = 0;
  let outlineSpyBound = false;

  // 判定线：标题顶边进入「内容区顶部往下 96px」即算正在读（约等于阅读视线起点）
  const OUTLINE_ACTIVE_OFFSET = 96;

  function updateOutlineActive() {
    outlineSpyRaf = 0;
    const tree = document.getElementById('outline-tree');
    const body = document.getElementById('markdown-body');
    if (!tree || !body) return;
    const items = tree.querySelectorAll('.outline-item');
    if (!items.length) return;
    const scrollEl = document.querySelector('.content');
    const refRect = (scrollEl || document.documentElement).getBoundingClientRect();
    const lineY = refRect.top + OUTLINE_ACTIVE_OFFSET;
    // renderOutline 按「正文里标题的出现顺序」逐条生成，所以下标天然对齐
    const headings = body.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let activeIndex = -1;
    headings.forEach(function (h, i) {
      if (h.getBoundingClientRect().top <= lineY) activeIndex = i;
    });
    if (activeIndex > items.length - 1) activeIndex = items.length - 1;
    items.forEach(function (item, i) {
      item.classList.toggle('active', i === activeIndex);
    });
    // 高亮项跟着滚进大纲面板的视野（block:'nearest' = 已在视野里就不动）
    if (activeIndex >= 0 && items[activeIndex] && typeof items[activeIndex].scrollIntoView === 'function') {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function scheduleOutlineActiveUpdate() {
    if (!state.currentPath) return;
    if (state.sidebarTab !== 'outline') return;
    if (outlineSpyRaf) return;
    if (typeof requestAnimationFrame !== 'function') {
      updateOutlineActive();
      return;
    }
    outlineSpyRaf = requestAnimationFrame(updateOutlineActive);
  }

  function bindOutlineSpy() {
    if (outlineSpyBound) return;
    outlineSpyBound = true;
    const scrollEl = document.querySelector('.content');
    if (scrollEl) scrollEl.addEventListener('scroll', scheduleOutlineActiveUpdate, { passive: true });
    window.addEventListener('scroll', scheduleOutlineActiveUpdate, { passive: true });
    window.addEventListener('resize', scheduleOutlineActiveUpdate);
  }

  // ---------- 阅读现场落盘（滚动时节流写，离开页面前立刻写） ----------
  let readingSaveTimer = 0;

  function bindReadingStateTracking() {
    const persist = function () {
      rememberCurrentReadingPosition();
      saveReadingState();
    };
    const schedule = function () {
      if (readingSaveTimer) return;
      readingSaveTimer = setTimeout(function () {
        readingSaveTimer = 0;
        persist();
      }, 600);
    };
    const scrollEl = document.querySelector('.content');
    if (scrollEl) scrollEl.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    // beforeunload + visibilitychange 两条都挂：前者覆盖关闭 / 刷新，后者覆盖切标签页 / 手机后台
    window.addEventListener('beforeunload', persist);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') persist();
    });
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
    // 切走之前先记住上一篇读到哪儿（此时 state.currentPath 还是上一篇）
    rememberCurrentReadingPosition();
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
      // 侧栏跟手：让当前文档那条滚进文档列表可见区域
      revealActiveFileInTree();
      // 会话恢复：记下「当前在读哪篇」，并把这篇上次读到的位置滚回来。
      // 注意 keepScroll 分支在上面已把 scrollTop 归零/保留，这里统一覆盖为记忆值：
      // 刷新当前文件时记忆值就等于刚才的位置，行为与历史一致。
      state.readingState.lastPath = item.path;
      saveReadingState();
      restoreReadingPositionFor(item.path);
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
  //
  // opts.keepInView（v1.1.17）：
  //   编辑 / 删除 / 插入 / 缩进后回定位用 true —— **只在目标确实跑出视口时才滚动**，
  //   目标本来就在视野内则**一个像素都不动**。
  //   旧实现一律 scrollIntoView({ block: 'start' })，语义是「把目标顶到视口最上沿」，
  //   于是每次增删块都会把那一块硬拉到页面顶端、滚动条大幅跳动（用户报告的「闪屏」）。
  //   搜索结果跳转仍用默认的 false —— 那种场景用户就是要「跳过去」，顶到顶端是合理的。
  function scrollToSourceLine(lineIndex, opts) {
    const keepInView = !!(opts && opts.keepInView);
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
        // keepInView 时同样只在目标行跑出视口才滚动（代码文件整块占位很高，
        // 一律 scrollTo 会导致每次编辑都把视口拉到该块的中段）
        let needScroll = true;
        if (keepInView && scrollParent) {
          const targetTop = target.offsetTop + ratio * target.offsetHeight;
          const viewTop = scrollParent.scrollTop;
          const viewBottom = viewTop + (scrollParent.clientHeight || window.innerHeight);
          needScroll = targetTop < viewTop + 24 || targetTop > viewBottom - 24;
        }
        if (needScroll && scrollParent) {
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

    if (keepInView) {
      // 编辑 / 删除 / 插入场景：目标还在视野里就什么都不做。
      // 判定用视口矩形而非 scrollTop 计算，这样无论滚动容器是 .content 还是窗口都成立。
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // 上下各留 24px 余量，避免元素边缘贴着视口边、看起来像被切掉
      const margin = 24;
      const fullyVisible = rect.top >= margin && rect.bottom <= vh - margin;
      if (fullyVisible) return;
      // 只有真的看不见才滚动，且用 nearest —— 能少滚就少滚，不做「顶到最上沿」
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }

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
