  // ---------- 文件夹拖拽 ----------
  function readEntry(entry) {
    return new Promise(function (resolve) {
      if (entry.isFile) {
        entry.file(function (file) {
          const path = (entry.fullPath || entry.name).replace(/^\/+/, '');
          resolve([{ path: path, name: file.name, file: file }]);
        }, function () { resolve([]); });
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const allEntries = [];
        const readBatch = function () {
          reader.readEntries(function (batch) {
            if (batch.length === 0) {
              Promise.all(allEntries.map(readEntry)).then(function (parts) {
                resolve(parts.flat());
              });
              return;
            }
            allEntries.push.apply(allEntries, batch);
            readBatch();
          }, function () { resolve([]); });
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  }

  // ---------- 默认目录（File System Access API） ----------
  const DB_NAME = 'markdown-viewer';
  const DB_VERSION = 1;

  function openIndexedDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function saveDefaultDirectoryHandle(handle) {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(handle, 'defaultDirectory');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getDefaultDirectoryHandle() {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('defaultDirectory');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  // ---------- 默认目录浏览器缓存快照（Apache / HTTP 环境 fallback） ----------
  // File System Access API 只在 HTTPS / localhost 可用；在 Apache(HTTP) 上，
  // 通过 <input webkitdirectory> 打开文件夹后把目录内容缓存到 IndexedDB，
  // 「默认目录」按钮即可从缓存恢复上次打开的目录。
  const SNAPSHOT_MAX_FILES = 5000;                   // 最多缓存文件数
  const SNAPSHOT_MAX_TOTAL_BYTES = 60 * 1024 * 1024; // 快照总量上限（约 60MB）
  const SNAPSHOT_MAX_IMAGE_BYTES = 512 * 1024;       // 单张图片缓存上限（512KB）

  function readFileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  }

  function folderItemsFromFileList(fileList) {
    const items = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      items.push({ path: file.webkitRelativePath || file.name, name: file.name, file: file });
    }
    return items;
  }

  async function buildFolderSnapshot(items) {
    const snapshot = { files: [], images: [], savedAt: Date.now() };
    let total = 0;
    for (let i = 0; i < items.length &&
         snapshot.files.length + snapshot.images.length < SNAPSHOT_MAX_FILES; i++) {
      if (total >= SNAPSHOT_MAX_TOTAL_BYTES) break;
      const item = items[i];
      try {
        if (isSupportedFile(item.name)) {
          const text = await readFileText(item.file);
          const bytes = text.length * 2; // UTF-16 粗略估算
          if (bytes > SNAPSHOT_MAX_TOTAL_BYTES - total) continue;
          total += bytes;
          snapshot.files.push({ path: item.path, name: item.name, content: text });
        } else if (isImageFile(item.name) && item.file.size <= SNAPSHOT_MAX_IMAGE_BYTES) {
          const dataUrl = await readFileAsDataUrl(item.file);
          if (dataUrl.length > SNAPSHOT_MAX_TOTAL_BYTES - total) continue;
          total += dataUrl.length;
          snapshot.images.push({ path: item.path, name: item.name, dataUrl: dataUrl });
        }
      } catch (e) {
        // 单个文件读取失败不影响整体快照
      }
    }
    return snapshot;
  }

  function saveSnapshotToDb(snapshot) {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(snapshot, 'defaultDirectorySnapshot');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getSnapshotFromDb() {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('defaultDirectorySnapshot');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () { return null; });
  }

  function saveDefaultDirectorySnapshot(items) {
    buildFolderSnapshot(items).then(function (snapshot) {
      state.snapshotData = snapshot;
      return saveSnapshotToDb(snapshot);
    }).then(function () {
      console.log('[Markdown Viewer] 默认目录已缓存到浏览器');
    }).catch(function (e) {
      console.warn('[Markdown Viewer] 保存默认目录缓存失败', e);
    });
  }

  function restoreFromSnapshot(snapshot) {
    state.dirHandle = null;
    state.dirReadOnly = true;
    state.snapshotData = snapshot;
    state.isDefaultSession = true; // 从默认缓存恢复 = 默认目录会话

    const files = [];
    const imageMap = {};
    (snapshot.files || []).forEach(function (s) {
      if (!isSupportedFile(s.name)) return;
      try {
        const file = new File([s.content], s.name, { type: 'text/markdown' });
        files.push({ path: s.path, name: s.name, file: file });
      } catch (e) {
        // ignore
      }
    });
    (snapshot.images || []).forEach(function (s) {
      try {
        imageMap[s.path] = s.dataUrl; // data URL 可直接作为 img src
      } catch (e) {
        // ignore
      }
    });
    files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    state.files = files;
    state.imageMap = imageMap;
    renderTree();
    if (files.length > 0) {
      resetToWelcome(); // 不自动打开第一篇，回到欢迎界面由用户点击
      toast('已从浏览器缓存打开默认目录（共 ' + files.length + ' 个文档），点击左侧文件打开');
    } else {
      toast('默认目录缓存中没有 Markdown 文档');
    }
  }

  function saveThemeToIndexedDB(themeData) {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(themeData, 'lastTheme');
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    }).catch(function (e) {
      console.warn('主题保存到 IndexedDB 失败', e);
    });
  }

  function loadThemeFromIndexedDB() {
    return openIndexedDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        const tx = db.transaction('settings', 'readonly');
        const req = tx.objectStore('settings').get('lastTheme');
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    }).catch(function () {
      return null;
    });
  }


  async function listFilesFromDirectoryHandle(dirHandle, basePath) {
    const out = [];
    const iterator = dirHandle.entries();
    let item = await iterator.next();
    while (!item.done) {
      const name = item.value[0];
      const handle = item.value[1];
      const path = basePath ? basePath + '/' + name : name;
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        out.push({ path: path, name: name, file: file });
      } else if (handle.kind === 'directory') {
        const children = await listFilesFromDirectoryHandle(handle, path);
        out.push.apply(out, children);
      }
      item = await iterator.next();
    }
    return out;
  }

  async function openDirectoryPicker() {
    // file:// 协议下也先尝试 showDirectoryPicker（Chromium 的 file:// 属于安全上下文，
    // 存储的目录句柄可正常读写）；只有浏览器不支持或选择系统目录（下载/文档等）
    // 被拒绝时，才由调用方 fallback 到 <input webkitdirectory> 兼容模式。
    if (!window.showDirectoryPicker) return false;

    var handle = null;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (e) {
      if (e && e.name === 'AbortError') return 'aborted'; // 用户取消，不再弹出第二个对话框
      // Chromium 安全限制：拒绝打开「下载 / 文档」等系统目录（提示包含系统文件）
      console.error('[Markdown Viewer] showDirectoryPicker 失败（可能为系统目录受限）', e);
      return 'special'; // 让调用方回退到兼容模式
    }

    state.dirHandle = handle;
    state.dirReadOnly = false;

    let wrapped = null;
    try {
      wrapped = await listFilesFromDirectoryHandle(handle, '');
    } catch (e) {
      // 个别目录句柄可获取但无法读取条目（如系统目录），同样回退
      console.error('[Markdown Viewer] 读取目录失败（可能为系统目录受限）', e);
      state.dirHandle = null;
      state.dirReadOnly = false;
      return 'special';
    }

    // 仅打开目录浏览，不再自动设为默认目录（由「设定默认目录」显式保存）
    state.isDefaultSession = false;
    indexWrappedFiles(wrapped, false);
    toast('已打开文件夹（可编辑写回磁盘），点击左侧文件打开');
    return true;
  }

  // 把当前打开的目录设定为默认目录（句柄 + 快照一起持久化）
  async function setCurrentDirectoryAsDefault() {
    // FS Access 目录：保存目录句柄 + 快照
    if (state.dirHandle && !state.dirReadOnly) {
      try {
        await saveDefaultDirectoryHandle(state.dirHandle);
      } catch (e) {
        console.warn('保存默认目录句柄失败', e);
        toast('保存默认目录句柄失败');
        return;
      }
      let wrapped = [];
      try {
        wrapped = await listFilesFromDirectoryHandle(state.dirHandle, '');
      } catch (e) {
        console.warn('重新读取目录失败', e);
      }
      if (wrapped.length) saveDefaultDirectorySnapshot(wrapped);
      state.isDefaultSession = true;
      toast('已将当前文件夹设为默认目录（可编辑写回磁盘）');
      return;
    }

    // 兼容 / 快照模式（无句柄）：把当前打开目录的内存快照持久化为默认缓存
    if (state.pendingSnapshot) {
      try { await state.pendingSnapshot; } catch (e) { /* ignore */ }
    }
    if (state.snapshotData && state.snapshotData.files && state.snapshotData.files.length) {
      try {
        await saveSnapshotToDb(state.snapshotData);
        state.isDefaultSession = true;
        toast('已将当前文件夹设为默认目录（浏览器缓存模式）');
      } catch (e) {
        console.warn('保存默认目录缓存失败', e);
        toast('保存默认目录缓存失败');
      }
      return;
    }

    toast('请先打开一个文件夹，再设定为默认目录');
  }

  async function restoreDefaultDirectory() {
    let hadHandle = false;   // 是否存过目录句柄（用于决定要不要提示「需重新授权」）
    try {
      const handle = await getDefaultDirectoryHandle();
      if (handle) {
        hadHandle = true;
        state.dirHandle = handle;
        state.dirReadOnly = false;

        var permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          // 启动时尝试重新授权（无用户手势时浏览器会拒绝，属正常）；成功则可自动打开
          try {
            permission = await handle.requestPermission({ mode: 'readwrite' });
          } catch (e) {
            // ignore
          }
        }
        if (permission === 'granted') {
          const wrapped = await listFilesFromDirectoryHandle(handle, '');
          if (wrapped.length) {
            state.isDefaultSession = true; // 打开的就是默认目录
            indexWrappedFiles(wrapped, false);
            // 刷新快照，保持缓存与真实目录一致
            saveDefaultDirectorySnapshot(wrapped);
            toast('已自动打开默认目录，点击左侧文件打开');
            return;
          }
          // 授权成功但目录是空的：不能用这个句柄顶掉缓存，继续往下走快照回退
        }
        // 句柄不可用（未授权 / 目录为空）：不要在这里 return，继续往下尝试缓存快照。
        // file:// 下权限不跨会话持久化，每次启动都拿不到授权是常态；
        // 若直接 return，用户每次都只能看到一个提示，而缓存里其实有可浏览的内容。
        state.dirHandle = null;
        state.dirReadOnly = false;
      }
    } catch (e) {
      console.warn('恢复默认目录句柄失败', e);
      state.dirHandle = null;
      state.dirReadOnly = false;
    }

    // 句柄不可用时一律回退到浏览器缓存快照（只读，但可正常浏览）。
    try {
      const snapshot = await getSnapshotFromDb();
      if (snapshot && snapshot.files && snapshot.files.length) {
        restoreFromSnapshot(snapshot);
        return;
      }
    } catch (e) {
      console.warn('恢复默认目录缓存失败', e);
    }
    // 到这里说明既没有可用句柄、也没有缓存：只有当「确实存过句柄但没拿到授权」时
    // 才提示重新授权，否则会打扰从未设置过默认目录的用户。
    if (hadHandle) {
      toast('默认目录需要重新授权，请点击「默认目录」按钮');
    }
  }

  async function openDefaultDirectoryManually() {
    try {
      const handle = await getDefaultDirectoryHandle();
      if (handle) {
        state.dirHandle = handle;
        state.dirReadOnly = false;

        var permission = await handle.queryPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          try {
            permission = await handle.requestPermission({ mode: 'readwrite' });
          } catch (e) {
            // ignore：无用户手势 / 浏览器不支持时会抛，继续往下走快照回退
          }
        }
        if (permission === 'granted') {
          const wrapped = await listFilesFromDirectoryHandle(handle, '');
          state.isDefaultSession = true; // 打开的就是默认目录
          indexWrappedFiles(wrapped, false);
          // 授权成功：刷新快照，下次启动无需重新授权即可从缓存打开
          saveDefaultDirectorySnapshot(wrapped);
          toast('已打开默认目录，点击左侧文件打开');
          return;
        }
        // 有句柄但没拿到授权（file:// 下权限不跨会话持久化，且无用户手势时
        // requestPermission 常被拒绝）。
        // 关键：**不要在这里直接 return**，要继续往下尝试缓存快照 ——
        // 否则用户点「打开默认目录」只会看到「未获得访问权限」，功能等同失效，
        // 而缓存里其实存着上次打开的目录内容（只读模式也能正常浏览）。
        // 注意：不动 state.dirHandle，以免后续写盘时误用未授权的句柄。
        state.dirHandle = null;
      }
    } catch (e) {
      console.warn('打开默认目录句柄失败', e);
    }

    // 句柄不可用（从未保存 / 未授权 / 读取失败）时，一律回退到浏览器缓存快照。
    // 快照是只读的，但能正常浏览目录内容，比「什么都不打开」有用得多。
    try {
      const snapshot = await getSnapshotFromDb();
      if (snapshot && snapshot.files && snapshot.files.length) {
        restoreFromSnapshot(snapshot);
        return;
      }
    } catch (e) {
      console.warn('读取默认目录缓存失败', e);
    }
    toast('还没有设置默认目录');
  }

  // 重载当前目录：重新读取磁盘上的目录内容，刷新左侧文件列表。
  // 与「打开文件夹」的区别：不改变当前选中的目录来源，只刷新内容；
  // 且尽量保留用户正在看的文档与滚动位置（不跳回欢迎页）。
  //
  // 三种模式的处理：
  //   1. 有目录句柄（File System Access，安全上下文）→ 真正重读磁盘，可拿到外部改动
  //   2. 缓存快照模式（file:// 或 Apache/HTTP 下的 <input webkitdirectory>）
  //      → 浏览器安全限制导致无法重读真实目录，明确提示并引导重新打开文件夹
  //   3. 什么都没打开 → 提示先打开文件夹
  async function reloadCurrentDirectory() {
    // 模式 3：还没打开任何目录
    if (!state.dirHandle && !state.dirReadOnly && (!state.files || !state.files.length)) {
      toast('还没有打开目录，请先点「打开文件夹」');
      return;
    }

    // 模式 2：只读快照模式（无句柄）——浏览器不允许脚本重读用户选过的目录
    if (!state.dirHandle) {
      toast('缓存模式下无法重载真实目录（浏览器安全限制）：请点「打开文件夹」重新选择目录');
      return;
    }

    // 模式 1：有句柄 → 重读磁盘
    // 先确认权限：file:// 下权限不跨会话持久化，需要时就地重新申请
    try {
      var permission = await state.dirHandle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        try {
          permission = await state.dirHandle.requestPermission({ mode: 'readwrite' });
        } catch (e) {
          // ignore：拿不到就按只读继续（读目录通常仍可用）
        }
      }
      // 重读目录内容（此时用户已有点击手势，授权成功率最高）
      const wrapped = await listFilesFromDirectoryHandle(state.dirHandle, '');
      await applyDirectoryReload(wrapped, permission === 'granted');
    } catch (e) {
      console.error('[Markdown Viewer] 重载目录失败', e);
      toast('重载目录失败：' + (e && e.message ? e.message : '未知错误'));
    }
  }

  // 把重读到的目录内容应用到界面：刷新列表，并尽量保留当前文档与滚动位置。
  // 抽成独立函数，便于在无浏览器环境下直接验证「保留当前文件」的行为。
  async function applyDirectoryReload(wrapped, writable) {
    // 记住重载前的状态：当前打开的文档 + 滚动位置 + 展开的目录
    const prevPath = state.currentPath;
    const prevScrollY = window.scrollY;
    const contentEl = document.querySelector('.content');
    const prevContentScroll = contentEl ? contentEl.scrollTop : 0;

    // 刷新文件索引（这里不能让 indexWrappedFiles 去决定是否跳欢迎页，
    // 因为它会 resetToWelcome；所以先用它建索引，再自己恢复当前文档）
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
    state.dirReadOnly = !writable;
    renderTree();

    // 刷新快照，保持缓存与真实目录一致（下次启动可直接从缓存打开）
    if (writable) saveDefaultDirectorySnapshot(wrapped);

    // 恢复当前文档：文件还在就重新读取其内容并保留滚动位置
    const stillThere = prevPath ? files.filter(function (f) { return f.path === prevPath; })[0] : null;
    if (stillThere) {
      await openFile(stillThere, true);   // keepScroll = true：保留滚动位置
      if (contentEl) contentEl.scrollTop = prevContentScroll;
      window.scrollTo(0, prevScrollY);
      toast('已重载目录：' + files.length + ' 个文档（已保留当前打开的文档）');
    } else if (prevPath) {
      // 当前文档已被删除或改名：回到欢迎界面，并说明原因（而不是静默跳走）
      resetToWelcome();
      toast('已重载目录：' + files.length + ' 个文档；原文档「' + baseName(prevPath) + '」已不存在，已回到欢迎界面');
    } else {
      // 重载前就没打开任何文档：只刷新列表，不必（也不该）动正文
      toast('已重载目录：' + files.length + ' 个文档');
    }
  }
