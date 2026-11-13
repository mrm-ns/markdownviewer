  // ---------- 初始化 ----------
  // 打开单个文件：优先用 showOpenFilePicker（拿到可写句柄，编辑可写回原文件），
  // 不支持时（非安全上下文 / 老浏览器）回退到传统 <input type="file">
  async function openSingleFile() {
    if (window.showOpenFilePicker) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: 'Markdown 文档',
              accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'] }
            },
            {
              // 代码 / 配置文件：统一用 text/plain 分组（实际过滤依据是扩展名列表）
              description: '文本 / 代码 / 配置文件',
              accept: {
                'text/plain': ['.txt', '.py', '.sh', '.bash', '.zsh', '.ksh', '.js',
                               '.json', '.yaml', '.yml', '.ini', '.conf', '.sql', '.promql']
              }
            }
          ]
        });
        if (!handles || !handles.length) return;
        const handle = handles[0];
        const file = await handle.getFile();
        appendFileItem({ path: file.name, name: file.name, file: file, fileHandle: handle });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return; // 用户取消选择
        console.warn('[Markdown Viewer] showOpenFilePicker 失败，回退到文件输入框', e);
      }
    }
    const fileInput = document.getElementById('file-input');
    fileInput.value = '';
    fileInput.click();
  }

  // === BIND_EVENTS_BEGIN ===
  // 事件绑定按「功能域」拆成若干命名子函数。
  // 为什么拆：原来这里是单个 1400+ 行、最深 9 层嵌套的函数，改任何一处都要在
  // 深层缩进里定位，极易改错。拆开后每个功能域一个函数，改侧边栏就只看 bindSidebarEvents。
  // 子函数之间没有调用关系，顺序无关；由 bindEvents 统一调度。
  //
  // ⚠ 跨功能域共用的辅助函数必须放在这里（IIFE 顶层），不能塞进某个子函数里：
  //   拆分前它们都是 bindEvents 内部的嵌套函数，所有调用点都在同一个函数里，天然可见；
  //   拆开后若把它们留在某个子函数内，其它子函数调用就会 ReferenceError（踩过）：
  //   closeExportMenu 曾被留在 bindContentMenuEvents 里，
  //   而 bindFileOpenEvents 也调用它 → 点「打开默认目录」直接抛
  //   "closeExportMenu is not defined"。
  //   以后新增子函数时，先确认它调用的辅助函数是不是定义在别的子函数里。

  // 关闭「导出 ▾」下拉（被 bindContentMenuEvents 与 bindFileOpenEvents 共用）
  // 每次现查元素而不是缓存引用：本函数在 bind* 之前就可能被调用，
  // 且 element 引用留在子函数里会重新引入上面说的作用域问题。
  function closeExportMenu() {
    var menu = document.getElementById('export-dropdown-menu');
    if (menu) menu.hidden = true;
  }

  // 切换「导出 ▾」下拉的展开 / 收起
  function toggleExportMenu() {
    var menu = document.getElementById('export-dropdown-menu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
  }

  function bindEvents() {
    bindFileOpenEvents();
    bindThemeDrawerEvents();
    bindSidebarEvents();
    bindSidebarMenuEvents();
    bindContentMenuEvents();
    bindContentJumpEvents();
    bindGlobalEvents();
  }

  // 打开文件 / 打开文件夹 / 默认目录下拉
  function bindFileOpenEvents() {
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const themeInput = document.getElementById('theme-input');

    document.getElementById('btn-open-file').addEventListener('click', openSingleFile);

      document.getElementById('btn-reload-file').addEventListener('click', function () {
        if (!state.currentPath) {
          toast('当前没有打开文件');
          return;
        }
        const item = state.files.find(function (f) { return f.path === state.currentPath; });
        if (!item) {
          toast('找不到当前文件');
          return;
        }
        // 刷新当前文件：保留当前滚动位置，不跳回顶部
        openFile(item, true).then(function () {
          toast('文件已刷新');
        });
      });


    document.getElementById('btn-open-folder').addEventListener('click', async function () {
      let result = false;
      try {
        result = await openDirectoryPicker();
      } catch (e) {
        console.error('[Markdown Viewer] 打开目录失败', e);
      }
      if (result === 'aborted') return; // 用户取消，不再弹出第二个对话框
      if (result === 'special') state.pendingCompatibleNote = true;
      if (result !== true) {
        folderInput.value = '';
        folderInput.click();
      }
    });

      // 「默认目录 ▾」下拉：打开默认目录 / 设定默认目录
      var defaultDirMenuBtn = document.getElementById('btn-default-dir-menu');
      var defaultDirMenu = document.getElementById('default-dir-menu');
      function toggleDefaultDirMenu() {
        if (defaultDirMenu) defaultDirMenu.hidden = !defaultDirMenu.hidden;
      }
      function closeDefaultDirMenu() {
        if (defaultDirMenu) defaultDirMenu.hidden = true;
      }
      if (defaultDirMenuBtn) {
        defaultDirMenuBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleDefaultDirMenu();
        });
      }
      if (defaultDirMenu) {
        defaultDirMenu.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }
      const openDefaultDirBtn = document.getElementById('btn-open-default-dir');
      if (openDefaultDirBtn) {
        openDefaultDirBtn.addEventListener('click', function () {
          closeDefaultDirMenu();
          closeExportMenu();
          openDefaultDirectoryManually();
        });
      }
      const setDefaultDirBtn = document.getElementById('btn-set-default-dir');
      if (setDefaultDirBtn) {
        setDefaultDirBtn.addEventListener('click', function () {
          closeDefaultDirMenu();
          closeExportMenu();
          setCurrentDirectoryAsDefault();
        });
      }
      // 点页面其他位置关闭默认目录下拉
      document.addEventListener('click', function () {
        closeDefaultDirMenu();
      });


  }

  // 主题抽屉 / 配色编辑器 / PDF 预览 / 主题导入导出
  function bindThemeDrawerEvents() {
    // 这三个 input 的 change 监听属于本功能域（导入主题文件 / 快速打开文件与文件夹）。
    // 拆分前它们声明在 bindEvents 顶部被全函数共享；拆成子函数后必须在本函数内重新获取，
    // 否则会出现「声明在别的子函数里、这里却引用」的未定义错误（拆分时踩过）。
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const themeInput = document.getElementById('theme-input');
    document.getElementById('btn-theme').addEventListener('click', openDrawer);
    document.getElementById('btn-close-theme').addEventListener('click', closeDrawer);
    document.getElementById('drawer-mask').addEventListener('click', closeDrawer);

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) appendFiles(fileInput.files);
    });

    folderInput.addEventListener('change', function () {
      if (folderInput.files.length) {
        // 打开文件夹：不自动打开第一篇，回到欢迎界面由用户点击
        indexFiles(folderInput.files, false);
        if (state.pendingCompatibleNote) {
          state.pendingCompatibleNote = false;
          toast('该目录受浏览器安全限制，已用兼容模式打开：只能浏览，编辑保存在浏览器缓存');
        }
      }
    });

    themeInput.addEventListener('change', function () {
      const file = themeInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const imported = JSON.parse(reader.result);
          if (!imported || typeof imported !== 'object') throw new Error('格式不正确');
          const base = completeTheme(imported);
            const userTheme = {
              name: 'user-theme-' + Date.now(),
              label: (file.name || '导入主题').replace(/\.json$/i, ''),
              isDark: base.isDark,
              colors: base.colors,
              customCSS: base.customCSS || ''
            };
            state.userThemes.push(userTheme);
            saveUserThemes();
            renderThemePresets();
            state.theme = completeTheme(userTheme);
            state.theme.name = userTheme.name;
          // state.theme.name = 'custom';
          applyTheme();
          renderThemeEditor();
          saveThemeToStorage();
          // 如果导入的主题包含 PDF 配色，一并恢复
          if (imported.pdfColors && typeof imported.pdfColors === 'object') {
            Object.keys(PDF_BASE_COLORS).forEach(function (k) {
              if (imported.pdfColors[k] && /^#[0-9a-fA-F]{6}$/.test(imported.pdfColors[k])) {
                state.pdfColors[k] = imported.pdfColors[k];
              }
            });
            savePdfColors();
            renderPdfThemeEditor();
          }
          toast('主题导入成功，已添加到预设主题');
        } catch (err) {
          toast('导入失败：' + err.message);
        }
      };
      reader.readAsText(file, 'utf-8');
      themeInput.value = '';
    });

      document.getElementById('btn-save-theme').addEventListener('click', function () {
        const currentName = state.theme.name;
        const existing = state.userThemes.find(function (t) { return t.name === currentName; });
        const defaultLabel = existing
          ? existing.label
          : (currentName && currentName.indexOf('user-theme-') !== 0 ? currentName : '我的主题');
        const inputName = window.prompt('请输入主题名称：', defaultLabel);
        if (!inputName) return;
        const themeName = inputName.trim();
        if (!themeName) return;
        const data = themeExportData();

        if (existing) {
          existing.label = themeName;
          existing.colors = data.colors;
          existing.isDark = data.isDark;
          existing.customCSS = data.customCSS || '';
          state.theme.name = existing.name;
          
        } else {
          const userTheme = {
            name: 'user-theme-' + Date.now(),
            label: themeName,
            isDark: data.isDark,
            colors: data.colors,
            customCSS: data.customCSS || ''
          };
          state.userThemes.push(userTheme);
          state.theme.name = userTheme.name;
          
        }

        saveUserThemes();
        renderThemePresets();
          document.getElementById('theme-preset').value = state.theme.name;

        saveThemeToStorage();
        toast('主题已保存到预设主题');
      });


    document.getElementById('btn-export').addEventListener('click', function () {
      const data = JSON.stringify(themeExportData(), null, 2);
      download('markdown-theme.json', data, 'application/json');
      toast('主题已导出');
    });

    document.getElementById('btn-import').addEventListener('click', function () {
      themeInput.value = '';
      themeInput.click();
    });

    document.getElementById('btn-reset-theme').addEventListener('click', function () {
      const name = document.getElementById('theme-preset').value;
      setTheme(name);
      toast('已恢复预设：' + (THEMES[name] ? THEMES[name].label : name));
    });

    document.getElementById('btn-copy-theme').addEventListener('click', function () {
      const data = JSON.stringify(themeExportData(), null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(data).then(function () {
          toast('主题 JSON 已复制');
        }).catch(function () {
          toast('复制失败，请手动复制');
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = data;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          toast('主题 JSON 已复制');
        } catch (e) {
          toast('复制失败，请手动复制');
        }
        document.body.removeChild(ta);
      }
    });

    document.getElementById('btn-download-theme').addEventListener('click', function () {
      const data = JSON.stringify(themeExportData(), null, 2);
      download('markdown-theme.json', data, 'application/json');
      toast('主题 JSON 已下载');
    });

    document.getElementById('theme-preset').addEventListener('change', function () {
      setTheme(this.value);
    });

    document.getElementById('theme-dark-toggle').addEventListener('change', function () {
      saveCurrentTheme();
    });

    document.getElementById('custom-css').addEventListener('input', function () {
        saveCurrentTheme();
      });

      document.getElementById('color-editor').addEventListener('input', function (event) {
        const target = event.target;
        const container = document.getElementById('color-editor');
        if (!container) return;
        if (target.matches('[data-color-key]')) {
          const key = target.getAttribute('data-color-key');
          const textInput = container.querySelector('[data-text-key="' + key + '"]');
          if (textInput) textInput.value = target.value;
        } else if (target.matches('[data-text-key]')) {
          const key = target.getAttribute('data-text-key');
          const colorInput = container.querySelector('[data-color-key="' + key + '"]');
          if (colorInput && /^#[0-9a-fA-F]{6}$/.test(target.value)) {
            colorInput.value = target.value;
          }
        }
        saveCurrentTheme();
      });

      // PDF 配色编辑器：同步色块与输入框，自动保存
      var pdfColorEditor = document.getElementById('pdf-color-editor');
      if (pdfColorEditor) {
        pdfColorEditor.addEventListener('input', function (event) {
          const target = event.target;
          const container = pdfColorEditor;
          if (target.matches('[data-color-key]')) {
            const key = target.getAttribute('data-color-key');
            const textInput = container.querySelector('[data-text-key="' + key + '"]');
            if (textInput) textInput.value = target.value;
          } else if (target.matches('[data-text-key]')) {
            const key = target.getAttribute('data-text-key');
            const colorInput = container.querySelector('[data-color-key="' + key + '"]');
            if (colorInput && /^#[0-9a-fA-F]{6}$/.test(target.value)) {
              colorInput.value = target.value;
            }
          }
          state.pdfColors = readColorEditor('pdf-color-editor');
          savePdfColors();
          refreshPdfPreviewDebounced();
        });

        // PDF 版式编辑器：改完就夹取回显、保存、刷新预览
        var pdfLayoutEditor = document.getElementById('pdf-layout-editor');
        if (pdfLayoutEditor) {
          pdfLayoutEditor.addEventListener('input', function (event) {
            if (event.target.matches('[data-layout-key]')) applyPdfLayoutEditor();
          });
          pdfLayoutEditor.addEventListener('change', function (event) {
            if (event.target.matches('[data-layout-key]')) applyPdfLayoutEditor();
          });
        }
      }

      // 即时样式预览 / 真实 PDF 预览
      var pdfPreviewOpenBtn = document.getElementById('btn-pdf-preview-real');
      if (pdfPreviewOpenBtn) {
        pdfPreviewOpenBtn.addEventListener('click', openPdfPreviewModal);
      }
      var pdfPreviewRegenBtn = document.getElementById('btn-pdf-preview-regen');
      if (pdfPreviewRegenBtn) {
        pdfPreviewRegenBtn.addEventListener('click', generatePdfPreview);
      }
      var pdfPreviewCloseBtn = document.getElementById('btn-pdf-preview-close');
      if (pdfPreviewCloseBtn) {
        pdfPreviewCloseBtn.addEventListener('click', closePdfPreviewModal);
      }
      var pdfPreviewModal = document.getElementById('pdf-preview-modal');
      if (pdfPreviewModal) {
        pdfPreviewModal.addEventListener('click', function (event) {
          if (event.target === pdfPreviewModal) closePdfPreviewModal();
        });
      }
      // 图片放大预览弹层：点遮罩空白处 / 点 ✕ / 按 Esc 都能关
      var imageLightbox = document.getElementById('image-lightbox');
      if (imageLightbox) {
        imageLightbox.addEventListener('click', function (event) {
          // 只有点到遮罩本身才关；点图片不关（✕ 有自己的处理，且关闭函数本身幂等）
          if (event.target === imageLightbox) closeImageLightbox();
        });
      }
      var imageLightboxCloseBtn = document.getElementById('image-lightbox-close');
      if (imageLightboxCloseBtn) {
        imageLightboxCloseBtn.addEventListener('click', closeImageLightbox);
      }
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          var modal = document.getElementById('pdf-preview-modal');
          // 一次 Esc 只关最上面那一层：PDF 弹层优先，其次图片放大层
          if (modal && !modal.hidden) {
            closePdfPreviewModal();
            return;
          }
          var lightbox = document.getElementById('image-lightbox');
          if (lightbox && !lightbox.hidden) closeImageLightbox();
        }
      });

      // 主题编辑器模式切换
      var themeModeCode = document.getElementById('theme-mode-code');
      var themeModePdf = document.getElementById('theme-mode-pdf');
      if (themeModeCode) themeModeCode.addEventListener('click', function () { setThemeMode('code'); });
      if (themeModePdf) themeModePdf.addEventListener('click', function () { setThemeMode('pdf'); });

      // 恢复 PDF 默认主题（配色 + 版式一起）
      var resetPdfBtn = document.getElementById('btn-reset-pdf-colors');
      if (resetPdfBtn) {
        resetPdfBtn.addEventListener('click', function () {
          state.pdfColors = Object.assign({}, PDF_BASE_COLORS);
          state.pdfLayout = Object.assign({}, PDF_LAYOUT_DEFAULTS);
          savePdfColors();
          savePdfLayout();
          renderPdfThemeEditor();
          refreshPdfPreview();
          toast('PDF 主题已恢复默认');
        });
      }

      // 导出 PDF 主题（配色 + 版式）
      var exportPdfColorsBtn = document.getElementById('btn-export-pdf-colors');
      if (exportPdfColorsBtn) {
        exportPdfColorsBtn.addEventListener('click', function () {
          const data = JSON.stringify({ pdfColors: state.pdfColors, pdfLayout: state.pdfLayout }, null, 2);
          download('markdown-pdf-theme.json', data, 'application/json');
          toast('PDF 主题已导出');
        });
      }

      // 导入 PDF 主题：老文件只有 pdfColors，此时版式保持当前值不动
      var importPdfColorsBtn = document.getElementById('btn-import-pdf-colors');
      var pdfColorsInput = document.getElementById('pdf-colors-input');
      if (importPdfColorsBtn && pdfColorsInput) {
        importPdfColorsBtn.addEventListener('click', function () {
          pdfColorsInput.value = '';
          pdfColorsInput.click();
        });
        pdfColorsInput.addEventListener('change', function () {
          const file = pdfColorsInput.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = function () {
            try {
              const imported = JSON.parse(reader.result);
              const src = (imported && imported.pdfColors) || imported;
              if (!src || typeof src !== 'object') throw new Error('格式不正确');
              let count = 0;
              Object.keys(PDF_BASE_COLORS).forEach(function (k) {
                if (src[k] && /^#[0-9a-fA-F]{6}$/.test(src[k])) {
                  state.pdfColors[k] = src[k];
                  count++;
                }
              });
              // 版式：只有在文件里带了才覆盖（只给后者，避免用导入的旧主题悄悄改掉当前版式）
              const layoutSrc = (imported && imported.pdfLayout) || null;
              if (layoutSrc && typeof layoutSrc === 'object') {
                state.pdfLayout = normalizePdfLayout(Object.assign({}, state.pdfLayout, layoutSrc));
                savePdfLayout();
                count++;
              }
              savePdfColors();
              renderPdfThemeEditor();
              refreshPdfPreview();
              toast(count ? 'PDF 主题导入成功' : '导入失败：未找到有效的 PDF 主题');
            } catch (err) {
              toast('导入失败：' + err.message);
            }
          };
          reader.readAsText(file, 'utf-8');
          pdfColorsInput.value = '';
        });
      }

      const textSizeInput = document.getElementById('text-size');
      const codeSizeInput = document.getElementById('code-size');
      if (textSizeInput) {
        textSizeInput.addEventListener('input', function () {
          const val = parseFloat(this.value);
          if (!isNaN(val) && val > 0) {
            state.settings.textSize = val;
            applySettings();
            saveSettings();
          }
        });
      }
      if (codeSizeInput) {
        codeSizeInput.addEventListener('input', function () {
          const val = parseFloat(this.value);
          if (!isNaN(val) && val > 0) {
            state.settings.codeSize = val;
            applySettings();
            saveSettings();
          }
        });
      }
        const inlineCodeSizeInput = document.getElementById('inline-code-size');
        if (inlineCodeSizeInput) {
          inlineCodeSizeInput.addEventListener('input', function () {
            const val = parseFloat(this.value);
            if (!isNaN(val) && val > 0) {
              state.settings.inlineCodeSize = val;
              applySettings();
              saveSettings();
            }
          });
        }

      // 图片背景：开关 + 颜色（暗色主题下透明图片没有背景会看不清，默认开启白底）
      const imageBgToggle = document.getElementById('image-background-toggle');
      if (imageBgToggle) {
        imageBgToggle.addEventListener('change', function () {
          state.settings.imageBackground = this.checked;
          applySettings();
          saveSettings();
        });
      }
      const imageBgColor = document.getElementById('image-background-color');
      if (imageBgColor) {
        // input 事件在拖动取色盘时连续触发，正好用于实时预览
        imageBgColor.addEventListener('input', function () {
          state.settings.imageBackgroundColor = this.value;
          applySettings();
          saveSettings();
        });
      }

  }

  // 搜索框 / 侧边栏切换 / 搜索结果点击
  function bindSidebarEvents() {
    const searchBox = document.getElementById('search-box');
    const searchModeSelect = document.getElementById('search-mode');

    function updateSearchPlaceholder() {
      if (searchBox) {
        // 全文模式现在**包含标题**，占位文案里点明，否则用户会以为只能搜正文
        searchBox.placeholder = state.searchMode === 'content' ? '搜索全文（含标题）...' : '过滤文件...';
      }
    }
    updateSearchPlaceholder();

    if (searchBox) {
      searchBox.addEventListener('input', debounce(function (e) {
        state.search = e.target.value.trim();
        if (state.searchMode === 'content') {
          performContentSearch(state.search);
          return;
        }
        renderTree();
      }, 150));
    }

    if (searchModeSelect) {
      searchModeSelect.addEventListener('change', function () {
        state.searchMode = this.value;
        state.contentSearchResults = null;
        state.contentSearchTruncated = false;
        state.searchExpandedFiles.clear(); // 换了搜索范围，重新搜索时恢复默认折叠
        state.search = searchBox ? searchBox.value.trim() : '';
        updateSearchPlaceholder();
        if (state.searchMode === 'content' && state.search) {
          performContentSearch(state.search);
        } else {
          renderTree();
        }
      });
    }

    // 搜索结果点击：标题行折叠 / 展开，具体结果行跳转到对应文件的对应源码行
    const searchResultsEl = document.getElementById('search-results');
    if (searchResultsEl) {
      searchResultsEl.addEventListener('click', function (e) {
        const header = e.target.closest('.search-group-header');
        if (header) {
          const group = header.closest('.search-group');
          const items = group ? group.querySelector('.search-group-items') : null;
          if (!group || !items) return;
          const nowOpen = items.style.display === 'none';
          items.style.display = nowOpen ? '' : 'none';
          group.classList.toggle('open', nowOpen);
          const arrow = group.querySelector('.search-group-arrow');
          if (arrow) arrow.textContent = nowOpen ? '▾' : '▸';
          // 记录展开状态：搜索每次重渲染都重建 DOM，靠这里恢复
          const groupPath = group.getAttribute('data-path');
          if (groupPath) {
            if (nowOpen) state.searchExpandedFiles.add(groupPath);
            else state.searchExpandedFiles.delete(groupPath);
          }
          return; // 标题行不触发跳转
        }
        const item = e.target.closest('.search-result');
        if (!item) return;
        const path = item.getAttribute('data-path');
        const lineIndex = parseInt(item.getAttribute('data-line'), 10);
        openFileAndJumpToLine(path, isNaN(lineIndex) ? 0 : lineIndex);
      });
    }

    // 文档列表标题栏的「⟳ 重载当前目录」按钮：重读目录并刷新文件列表，
    // 保留当前打开的文档与滚动位置（详见 reloadCurrentDirectory）。
    // 重载期间给按钮加 .spinning 转圈反馈，并禁用重复点击（重读目录是异步的）。
    const reloadDirBtn = document.getElementById('btn-reload-dir');
    if (reloadDirBtn) {
      reloadDirBtn.addEventListener('click', function () {
        if (reloadDirBtn.disabled) return;      // 防连点：重载进行中直接忽略
        reloadDirBtn.disabled = true;
        reloadDirBtn.classList.add('spinning');
        Promise.resolve()
          .then(function () { return reloadCurrentDirectory(); })
          .catch(function (e) {
            console.error('[Markdown Viewer] 重载当前目录失败', e);
            toast('重载目录失败：' + (e && e.message ? e.message : '未知错误'));
          })
          .then(function () {
            reloadDirBtn.disabled = false;
            reloadDirBtn.classList.remove('spinning');
          });
      });
    }
  }

  // 文档列表右键菜单
  function bindSidebarMenuEvents() {
    document.getElementById('file-tree').addEventListener('click', function (e) {
      const folderLabel = e.target.closest('.folder-label');
      if (folderLabel) {
        const children = folderLabel.nextElementSibling;
        if (children) {
          const nowHidden = children.style.display === 'none';
          children.style.display = nowHidden ? '' : 'none';
          // 同步记录展开/收起状态，重渲染（打开文件、搜索等）后保持
          const path = folderLabel.getAttribute('data-folder-path');
          if (path) {
            if (nowHidden) state.expandedFolders.add(path);
            else state.expandedFolders.delete(path);
          }
        }
        return;
      }
      const fileItem = e.target.closest('.file-item');
      if (fileItem) {
        openFileByPath(fileItem.getAttribute('data-path'));
      }
    });

      // 侧边栏：文档 / 大纲切换
      document.querySelectorAll('.sidebar-tab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setSidebarTab(btn.getAttribute('data-sidebar-tab'));
        });
      });

      const outlineTree = document.getElementById('outline-tree');
      if (outlineTree) {
        outlineTree.addEventListener('click', function (e) {
          const item = e.target.closest('.outline-item');
          if (item) {
            const targetId = item.getAttribute('data-target');
            if (targetId) scrollToAnchor(targetId);
          }
        });
      }

      const sidebarToggleHandle = document.getElementById('sidebar-toggle-handle');
      if (sidebarToggleHandle) {
        sidebarToggleHandle.addEventListener('click', toggleSidebar);
      }

        const toolbarCollapseBtn = document.getElementById('toolbar-collapse-btn');
        const toolbarExpandHandle = document.getElementById('toolbar-expand-handle');
        if (toolbarCollapseBtn) {
          toolbarCollapseBtn.addEventListener('click', toggleToolbar);
        }
        if (toolbarExpandHandle) {
          toolbarExpandHandle.addEventListener('click', toggleToolbar);
        }



      // 文档列表右键菜单
      var contextTargetPath = null;

      // 确保菜单挂在 body 上且初始隐藏
      var ctxMenu = document.getElementById('context-menu');
      if (ctxMenu && ctxMenu.parentNode !== document.body) {
        document.body.appendChild(ctxMenu);
      }
      if (ctxMenu) ctxMenu.style.display = 'none';
        if (ctxMenu) ctxMenu.hidden = true;


      function showCtxMenu(x, y) {
        if (!ctxMenu) return;
          ctxMenu.hidden = false;

        ctxMenu.style.cssText = 'display:block;position:fixed;z-index:99999;' +
          'left:' + Math.min(x, window.innerWidth - 180) + 'px;' +
          'top:' + Math.min(y, window.innerHeight - 100) + 'px;' +
          'min-width:160px;padding:4px;background:var(--drawer-bg);' +
          'border:1px solid var(--drawer-border);border-radius:8px;box-shadow:var(--shadow);';
      }

      function hideCtxMenu() {
        if (ctxMenu) ctxMenu.style.display = 'none';
          ctxMenu.hidden = true;

        contextTargetPath = null;
      }

      document.getElementById('file-tree').addEventListener('contextmenu', function (e) {
        var fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        e.preventDefault();
        e.stopPropagation();
        contextTargetPath = fileItem.getAttribute('data-path');
        setTimeout(function () { showCtxMenu(e.clientX, e.clientY); }, 0);
      });

      if (ctxMenu) {
        ctxMenu.addEventListener('click', function (e) {
          var renameBtn = e.target.closest('#ctx-rename');
          var removeBtn = e.target.closest('#ctx-remove');
          if (!renameBtn && !removeBtn) return;

          var targetPath = contextTargetPath;
          hideCtxMenu();
          if (!targetPath) return;

          if (renameBtn) {
            var item = state.files.find(function (f) { return f.path === targetPath; });
            if (!item) return;
            var newName = window.prompt('请输入新的文件名：', item.name);
            if (newName) renameFile(targetPath, newName);
          } else if (removeBtn) {
            var idx = state.files.findIndex(function (f) { return f.path === targetPath; });
            if (idx < 0) return;
            var removed = state.files.splice(idx, 1)[0];
            if (state.currentPath === targetPath) {
              state.currentPath = null;
              document.getElementById('markdown-body').innerHTML = '';
              document.getElementById('welcome').style.display = '';
              document.title = 'Markdown Viewer';
            }
            renderTree();
            toast('已移除：' + removed.name + '（剩余 ' + state.files.length + ' 个文件）');
          }
        });
      }

      // 点击页面任意位置关闭菜单
      document.addEventListener('mousedown', function (e) {
        if (ctxMenu && ctxMenu.style.display !== 'none' && !ctxMenu.contains(e.target)) {
          hideCtxMenu();
        }
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideCtxMenu();
      });

  }

  // 正文右键菜单：复制 / 编辑 / 插入 / 缩进 / 删除
  function bindContentMenuEvents() {
      // 正文右键菜单：复制 / 编辑
      var contentCtxMenu = document.getElementById('content-context-menu');
        if (!contentCtxMenu) {
          contentCtxMenu = document.createElement('div');
          contentCtxMenu.id = 'content-context-menu';
          contentCtxMenu.className = 'context-menu';
          contentCtxMenu.innerHTML = '<button id="ctx-content-copy" class="context-menu-item">📋 复制</button>' +
            '<button id="ctx-content-edit" class="context-menu-item">✏️ 编辑</button>';
          document.body.appendChild(contentCtxMenu);
        }
      var contentContextTarget = null;
        // 右键落点信息：contentInsertBlock = 命中的顶层块（用于上/下插入），
        // contentLineAtPoint = 落点解析出的源码行（精确到段落内部的某一行），
        // contentBlankCtx = 空白处右键时算出的插入上下文（在「当前处」插入）
        var contentInsertBlock = null;
        var contentLineAtPoint = null;
        var contentBlankCtx = null;

        // 菜单项 → 插入上下文：优先按「右键落点所在的那一行」定位；
        // 取不到行（浏览器无 caretRangeFromPoint、落点在怪位置等）时退回按块边界定位。
        // kind 目前对插入行数没有影响（文本块/代码块的行由编辑框内容决定），保留形参以兼容调用处。
        function computeMenuInsertCtx(kind, side) {
          if (contentLineAtPoint && contentInsertBlock) {
            const range = getBlockRange(contentInsertBlock);
            if (range) {
              // 落点在围栏代码块里（含围栏行本身）时，吸附到该代码块的上下边界：
              // 插进代码块内部会把内容变成代码，插入围栏代码块更会把原代码块截断。
              // 这里不传 rect，让预览线改按块边界画，否则线会画在鼠标那一行、与实际插入点不符。
              const fence = fenceBlockAtLine(
                state.currentText ? state.currentText.replace(/\r\n/g, '\n').split('\n') : [],
                contentLineAtPoint.line);
              if (fence) {
                return {
                  line: side === 'above' ? fence.start : fence.end + 1,
                  anchorEl: contentInsertBlock,
                  side: side === 'above' ? 'above' : 'below',
                  insideBlock: false,
                  rect: null
                };
              }
              // above = 该行之上（即该行本身的位置）；below = 该行之下
              let at = side === 'above' ? contentLineAtPoint.line : contentLineAtPoint.line + 1;
              // 夹到该块自身范围，避免偏移算偏时插进相邻块
              at = Math.max(range.start, Math.min(at, range.end + 1));
              // 插入点在块「内部」（不是块首行之上、也不是块末行之下）时不补空行，
              // 否则会把该段拆成三段
              const insideBlock = at > range.start && at <= range.end;
              return {
                line: at,
                anchorEl: contentInsertBlock,
                side: side === 'above' ? 'above' : 'below',
                insideBlock: insideBlock,
                rect: contentLineAtPoint.rect
              };
            }
          }
          if (contentInsertBlock) return makeInsertContext(contentInsertBlock, side);
          // 顶层块识别失败（如块本身即 #markdown-body 的唯一文本）时退回用命中的元素算
          if (contentContextTarget) return makeInsertContext(contentContextTarget, side);
          return contentBlankCtx;
        }

        // === CTX_MENU_BEGIN ===
        // 生成正文右键菜单的 HTML（纯函数：只依赖入参，便于脱离浏览器直接验证结构）
        // opts.insertMode: 'block' 右键正文块（四个插入项收进「插入」二级菜单）
        //                  'blank' 右键空白处（只有两个插入项且没有「编辑」，保持平铺）
        //                  'none'  代码 / 配置文件，不提供插入
        // opts.indentMode: 'show' 显示「缩进」二级菜单（标题与整份代码文件为 'none'）
        // opts.canIndent / opts.canOutdent: 两个方向的可用性，不可用的按钮置灰 disabled 并带 title 说明原因
        // 菜单顺序：复制 / 更改类型 / 编辑 / 缩进（二级菜单） → 分隔线 → 插入（二级菜单），
        // 即「缩进」与「编辑」同组（都是改现有块），「插入」固定排在分隔线下方。
        // opts.hasBlockTarget: 是否有「块」目标（决定「复制 / 更改类型 / 编辑」是否渲染）
        // opts.canDelete:      是否允许删除（与 hasBlockTarget 分开：代码文件有块可编辑，
        //                      但没有「块的行范围」语义，所以不能整体删除）
        function buildContentCtxMenuHtml(opts) {
          const o = opts || {};
          const blockHtml = o.hasBlockTarget
            ? '<button id="ctx-content-copy" class="context-menu-item">📋 复制</button>' +
              (o.isCodeBlock ? '<button id="ctx-content-lang" class="context-menu-item">🏷️ 更改类型</button>' : '') +
              '<button id="ctx-content-edit" class="context-menu-item">✏️ 编辑</button>'
            : '';
          // 删除是不可逆观感的危险操作：单独放到菜单最下方并用分隔线隔开，减少误点。
          // 空白处右键（无块目标）没有块可删，不渲染；整份代码文件也不提供（见 showContentCtxMenu 的传参）。
          const deleteHtml = o.canDelete
            ? '<div class="context-menu-sep"></div>' +
              '<button id="ctx-content-delete" class="context-menu-item ctx-danger">🗑️ 删除</button>'
            : '';
          // 「缩进」二级菜单：只要这个块本身可缩进就显示，方向不可用时置灰并带 title 说明原因
          let indentHtml = '';
          if (o.indentMode === 'show') {
            indentHtml = '<div class="context-submenu-wrap">' +
              '<button type="button" class="context-menu-item ctx-submenu-trigger" aria-haspopup="true" aria-expanded="false">' +
                '<span class="ctx-submenu-label">⇥ 缩进</span>' +
                '<span class="ctx-submenu-arrow">▸</span>' +
              '</button>' +
              '<div class="context-submenu context-menu">' +
                '<button class="context-menu-item ctx-indent" data-indent-delta="-2"' +
                  (o.canOutdent ? '' : ' disabled title="已经在最左：这一行前面没有空格可减"') +
                  '>⬅️ 左移（-2 空格）</button>' +
                '<button class="context-menu-item ctx-indent" data-indent-delta="2"' +
                  (o.canIndent ? '' : ' disabled title="上方不是列表项，缩进后不会变成子级"') +
                  '>➡️ 右移（+2 空格）</button>' +
              '</div>' +
            '</div>';
          }
          let insertHtml = '';
          if (o.insertMode === 'block') {
            insertHtml = '<div class="context-submenu-wrap">' +
              '<button type="button" class="context-menu-item ctx-submenu-trigger" aria-haspopup="true" aria-expanded="false">' +
                '<span class="ctx-submenu-label">➕ 插入</span>' +
                '<span class="ctx-submenu-arrow">▸</span>' +
              '</button>' +
              '<div class="context-submenu context-menu">' +
                '<button class="context-menu-item ctx-insert" data-insert-side="above" data-insert-kind="text">⬆️ 上方插入文本块</button>' +
                '<button class="context-menu-item ctx-insert" data-insert-side="below" data-insert-kind="text">⬇️ 下方插入文本块</button>' +
                '<button class="context-menu-item ctx-insert" data-insert-side="above" data-insert-kind="code">⬆️ 上方插入代码块</button>' +
                '<button class="context-menu-item ctx-insert" data-insert-side="below" data-insert-kind="code">⬇️ 下方插入代码块</button>' +
              '</div>' +
            '</div>';
          } else if (o.insertMode === 'blank') {
            insertHtml = '<button class="context-menu-item ctx-insert-blank" data-insert-kind="text">➕ 在此处插入文本块</button>' +
              '<button class="context-menu-item ctx-insert-blank" data-insert-kind="code">➕ 在此处插入代码块</button>';
          }
          const topHtml = blockHtml + indentHtml;
          return {
            html: topHtml +
              (topHtml && insertHtml ? '<div class="context-menu-sep"></div>' : '') +
              insertHtml +
              deleteHtml,
            hasAny: !!(topHtml || insertHtml || deleteHtml)
          };
        }
        // === CTX_MENU_END ===

        // 把主菜单完整约束在视口内。
        //
        // 为什么必须按「实测高度」而不是写死常数：
        //   菜单高度随内容变化（是否代码块→多一项「更改类型」、是否可缩进、是否有删除项），
        //   最多约 200px。以前写死 `window.innerHeight - 120` 是按早期 3 项菜单估的，
        //   后来加了「缩进」二级菜单和「删除」项，菜单变高，
        //   **在文档靠下的位置右键时，底部的「删除」就会被窗口下沿裁掉**（用户报告的 bug）。
        //   所以这里改为：菜单插入 DOM 后量真实高度，再决定上/下摆放。
        //
        // 摆放规则（与系统右键菜单一致）：
        //   1. 默认在光标下方展开（top = y）；
        //   2. 下方放不下就整体上移，让菜单底边贴住视口底部；
        //   3. 上移后若顶边越过视口（菜单比视口还高），则夹到 0，保证至少能看到顶部；
        //   4. 横向同理：右边放不下就左移，左移到 0 为止。
        function clampMenuIntoViewport(menu, x, y) {
          if (!menu) return;
          const rect = menu.getBoundingClientRect();
          const margin = 8;                       // 与视口边缘留一点缝，避免贴死
          const h = rect.height || 0;
          const w = rect.width || 0;
          const vw = window.innerWidth;
          const vh = window.innerHeight;

          // 纵向：优先在光标下方；放不下就上移贴底；菜单过高时夹到顶部
          let top = y;
          if (h && y + h + margin > vh) top = vh - h - margin;
          if (top < margin) top = margin;

          // 横向：优先在光标右侧；放不下就左移；仍放不下就贴左边
          let left = x;
          if (w && x + w + margin > vw) left = x - w;   // 翻到光标左侧（与系统右键菜单一致）
          if (left + w + margin > vw) left = vw - w - margin;
          if (left < margin) left = margin;

          menu.style.left = left + 'px';
          menu.style.top = top + 'px';
        }

        // 「插入」二级菜单的摆放：默认在主菜单右侧展开；
        // 右侧空间不足则翻到左侧，下方空间不足则改为向上对齐，避免被窗口裁掉。
        // 两个分支都显式写全 left/right、top/bottom，保证可重复调用（窗口缩放后再开也正确），
        // 否则只写「翻转后」的值会残留上一次的内联样式。
        // 调用时子菜单必须已展开（wrap 带 open），否则量到的宽高为 0。
        function positionCtxSubmenu(menu, wrap) {
          const sub = wrap.querySelector('.context-submenu');
          if (!menu || !sub) return;
          const subRect = sub.getBoundingClientRect();
          if (!subRect.width) return; // 仍未展开则不猜位置
          const menuRect = menu.getBoundingClientRect();

          if (window.innerWidth - menuRect.right < subRect.width + 8) {
            sub.style.left = 'auto';
            sub.style.right = '100%';
            sub.style.marginLeft = '0';
            sub.style.marginRight = '2px';
          } else {
            sub.style.left = '100%';
            sub.style.right = 'auto';
            sub.style.marginLeft = '2px';
            sub.style.marginRight = '0';
          }

          const wrapRect = wrap.getBoundingClientRect();
          if (window.innerHeight - (wrapRect.top + subRect.height) < 8) {
            sub.style.top = 'auto';
            sub.style.bottom = '0';
          } else {
            sub.style.top = '-5px';   // 抵消子菜单自身的 border + padding，与触发项对齐
            sub.style.bottom = 'auto';
          }
        }

        // 二级菜单的收起定时器：触发项与子菜单之间有 2px 间距，
        // 指针从触发项移向子菜单时会经过这段"既不在 wrap 内、也不在子菜单内"的空隙，
        // 立刻上报 mouseleave 会把子菜单关掉、鼠标根本追不上。
        // 所以延迟关闭，并在重新进入时取消（重新进入子菜单也会触发 wrap 的 mouseenter）。
        let ctxSubmenuCloseTimer = null;

        function cancelCtxSubmenuClose() {
          if (ctxSubmenuCloseTimer) {
            clearTimeout(ctxSubmenuCloseTimer);
            ctxSubmenuCloseTimer = null;
          }
        }

        function scheduleCtxSubmenuClose(wrap) {
          cancelCtxSubmenuClose();
          ctxSubmenuCloseTimer = setTimeout(function () {
            ctxSubmenuCloseTimer = null;
            closeCtxSubmenu(wrap);
            hideInsertPreview();
          }, 260);
        }

        function openCtxSubmenu(menu, wrap) {
          cancelCtxSubmenuClose();
          wrap.classList.add('open');
          const trig = wrap.querySelector('.ctx-submenu-trigger');
          if (trig) trig.setAttribute('aria-expanded', 'true');
          positionCtxSubmenu(menu, wrap);
        }

        function closeCtxSubmenu(wrap) {
          cancelCtxSubmenuClose();
          if (!wrap) return;
          wrap.classList.remove('open');
          const trig = wrap.querySelector('.ctx-submenu-trigger');
          if (trig) trig.setAttribute('aria-expanded', 'false');
        }
        contentCtxMenu.style.display = 'none';
        contentCtxMenu.hidden = true;


        function showContentCtxMenu(x, y) {
          var old = document.getElementById('content-context-menu');
          if (old && old.parentNode) old.parentNode.removeChild(old);

          var menu = document.createElement('div');
          menu.id = 'content-context-menu';
          menu.className = 'context-menu';
          // 位置：left/top 先按初始估算摆好，等菜单插入 DOM（内容已生成）后再按真实尺寸校正，
          // 见下方的 clampMenuIntoViewport —— 不能在创建时就把 top 定死。
          menu.style.cssText = 'display:block;position:fixed;z-index:99999;' +
            'left:' + Math.min(x, window.innerWidth - 180) + 'px;' +
            'top:' + y + 'px;' +
            'min-width:160px;padding:4px;background:var(--drawer-bg);' +
            'border:1px solid var(--drawer-border);border-radius:8px;box-shadow:var(--shadow);';
          var isCodeFileBlock = contentContextTarget && contentContextTarget.tagName === 'PRE' &&
            contentContextTarget.hasAttribute('data-code-file');
          // 「更改类型」只对 Markdown 围栏代码块有效；代码文件本身没有围栏，写入会破坏源码
          var isCodeBlock = contentContextTarget && contentContextTarget.tagName === 'PRE' && !isCodeFileBlock;

          // 插入项：右键正文块 → 收进「插入」二级菜单（上/下插入文本块或代码块）；
          // 右键空白处 → 只有两个插入项、没有「编辑」，用二级菜单反而多一次点击，仍平铺展示。
          // 代码文件（.py/.js…）整块纯文本渲染，插入 Markdown 围栏会破坏源码，故不提供插入项。
          var insertMode = 'none';
          if (!isCodeFile(state.currentPath)) {
            if (contentInsertBlock) insertMode = 'block';
            else if (contentBlankCtx) insertMode = 'blank';
          }

          // 缩进项：只有「上一级接得住」或「有缩进可减」时才提供，两个方向都不可用就整块不渲染。
          // 标题会被缩进摧毁（正则锚定行首），resolveIndentElement 已把它排除；
          // 整份代码文件（.py/.js…）也不提供——它就是一个 PRE 块，-2 会直接改坏源码缩进。
          var indentEl = (!isCodeFile(state.currentPath) && !isCodeFileBlock)
            ? resolveIndentElement(contentContextTarget)
            : null;
          var indentAvail = indentEl
            ? computeIndentAvailability(indentEl, (state.currentText || '').split('\n'))
            : null;
          // 只要这个块「本身可以缩进」就显示菜单项（标题 / 整份代码文件不显示），
          // 两个方向各自能不能用由按钮置灰体现。
          // 为什么不「两个方向都不可用就整块藏起来」：那样用户在「正文下面插了一个列表项、
          // 再右键它」这种最常见的情形下根本看不到缩进功能，会以为没实现（已踩过这个坑）。
          var indentMode = indentAvail ? 'show' : 'none';

          var hasBlockItems = !!(contentContextTarget);
          // 删除项：整份代码文件（pre[data-code-file]）不提供——它没有「块」的行范围语义，
          // 删掉就等于清空整个文件；与「缩进」的排除口径保持一致。
          var canDeleteBlock = hasBlockItems && !isCodeFileBlock && !isCodeFile(state.currentPath);
          var built = buildContentCtxMenuHtml({
            insertMode: insertMode,
            // 注意：hasBlockTarget 控制的是「复制 / 更改类型 / 编辑」这一组，
            // 与「删除」是两件事，必须分开传参。
            // 曾经这里错传成 canDeleteBlock，导致代码文件（canDeleteBlock=false）连
            // 「复制 / 编辑」一起消失、菜单甚至完全不弹（v1.0.72 引入的回归，已修复）。
            hasBlockTarget: hasBlockItems,
            canDelete: canDeleteBlock,
            isCodeBlock: isCodeBlock,
            indentMode: indentMode,
            canIndent: !!(indentAvail && indentAvail.canIndent),
            canOutdent: !!(indentAvail && indentAvail.canOutdent)
          });
          // 没有任何可选项时（如代码文件的留白区：既无正文块可插，也不允许插 Markdown）不弹空菜单
          if (!built.hasAny) return;
          menu.innerHTML = built.html;

          // 二级菜单（「缩进」「插入」）：hover / 点击都展开，便于鼠标与键盘两种用法。
          // 逐个 wrap 绑定：以前只绑第一个（当时只有「插入」一个），现在必须遍历全部。
          Array.prototype.forEach.call(menu.querySelectorAll('.context-submenu-wrap'), function (subWrap) {
            var subTrig = subWrap.querySelector('.ctx-submenu-trigger');
            if (subTrig) {
              subTrig.addEventListener('mouseenter', function () {
                // 关掉同级其它已展开的二级菜单，保证同一时刻只展开一个
                Array.prototype.forEach.call(menu.querySelectorAll('.context-submenu-wrap.open'), function (w) {
                  if (w !== subWrap) closeCtxSubmenu(w);
                });
                openCtxSubmenu(menu, subWrap);
              });
              subTrig.addEventListener('click', function (e) {
                // 只负责「展开」，不做开关切换：鼠标移到触发项时 mouseenter 已经把子菜单打开了，
                // 若这里再 toggle，用户「划过→点击」会把刚展开的子菜单又关掉（触屏上表现为一闪一收）。
                // 收起交给指针移开（延迟关闭）与 Esc，和系统右键菜单的行为一致。
                e.stopPropagation();
                openCtxSubmenu(menu, subWrap);
              });
            }
            // 指针移出整块（含子菜单）才收起。
            // 注意 wrap 的 mouseleave 在指针移向子菜单时会先触发一次，
            // 所以这里只安排延迟关闭；进入 wrap 或子菜单都会取消它。
            subWrap.addEventListener('mouseleave', function () {
              scheduleCtxSubmenuClose(subWrap);
            });
            subWrap.addEventListener('mouseenter', cancelCtxSubmenuClose);
          });

          // 悬停（仅移到选项上，未点击）即预览插入位置：只画一条指示线，不改动源码与滚动位置
          Array.prototype.forEach.call(menu.querySelectorAll('.ctx-insert, .ctx-insert-blank'), function (item) {
            var kind = item.getAttribute('data-insert-kind');
            var side = item.getAttribute('data-insert-side');
            item.addEventListener('mouseenter', function () {
              showInsertPreview(computeMenuInsertCtx(kind, side));
            });
            item.addEventListener('mouseleave', hideInsertPreview);
          });
          menu.addEventListener('mouseleave', hideInsertPreview);

          menu.addEventListener('click', function (e) {
            var copyBtn = e.target.closest('#ctx-content-copy');
            var editBtn = e.target.closest('#ctx-content-edit');
            var langBtn = e.target.closest('#ctx-content-lang');
            var insertItem = e.target.closest('.ctx-insert, .ctx-insert-blank');
            var indentItem = e.target.closest('.ctx-indent');
            var deleteBtn = e.target.closest('#ctx-content-delete');
            if (!copyBtn && !editBtn && !langBtn && !insertItem && !indentItem && !deleteBtn) return;

            // 缩进走独立分支：要重新解析目标（菜单打开到点击之间 DOM 可能已重渲染），
            // 且置灰项用的是 disabled 属性，浏览器不会派发它的 click，这里不必再判禁用
            if (indentItem) {
              var indentDelta = parseInt(indentItem.getAttribute('data-indent-delta'), 10);
              var indentTarget = resolveIndentElement(contentContextTarget);
              hideContentCtxMenu();
              if (indentTarget && !isNaN(indentDelta)) applyIndentBlock(indentTarget, indentDelta);
              return;
            }

            // 插入走独立分支：target 可能是 null（空白处），不能沿用下面的 target 判空
            if (insertItem) {
              var insKind = insertItem.getAttribute('data-insert-kind');
              var insSide = insertItem.getAttribute('data-insert-side');
              var insCtx = computeMenuInsertCtx(insKind, insSide);
              hideContentCtxMenu();
              startInsertEditor(insCtx, insKind);
              return;
            }

            var target = contentContextTarget;
            hideContentCtxMenu();
            if (!target) return;

            // 删除走独立分支：与缩进同理，菜单打开到点击之间 DOM 可能已重渲染，重新解析目标
            if (deleteBtn) {
              if (/^(TD|TH)$/.test(target.tagName)) {
                var delTbl = target.closest('table');
                deleteBlock(delTbl || target);
              } else {
                deleteBlock(target);
              }
              return;
            }

            if (copyBtn) {
              var selectedText = window.getSelection ? window.getSelection().toString() : '';
              if (selectedText) {
                copyTextToClipboard(selectedText);
                return;
              }
              if (target.tagName === 'PRE') {
                var codeEl = target.querySelector('code');
                copyTextToClipboard(codeEl ? codeEl.textContent : target.textContent);
              } else {
                copyTextToClipboard(target.textContent || '');
              }
            } else if (langBtn) {
              if (target.tagName === 'PRE') changeCodeBlockType(target);
            } else if (editBtn) {
              if (target.tagName === 'PRE') {
                if (target.hasAttribute('data-code-file')) startEditCodeFile();
                else startEditCodeBlock(target);
              } else if (target.tagName === 'TABLE' || target.tagName === 'TD' || target.tagName === 'TH') {
                const tbl = target.tagName === 'TABLE' ? target : target.closest('table');
                if (tbl) startEditTable(tbl); else startEditTextElement(target);
              } else {
                startEditTextElement(target);
              }
            }
          });

          document.body.appendChild(menu);
          // 必须先插入 DOM 才能量到真实尺寸（未挂载时 getBoundingClientRect 全为 0），
          // 所以位置校正放在这里，而不是创建菜单的时候。
          clampMenuIntoViewport(menu, x, y);
          contentCtxMenu = menu;
        }

      function showContentCtxMenu_old(x, y) {
        if (!contentCtxMenu) return;
        contentCtxMenu.hidden = false;
          contentCtxMenu.removeAttribute('hidden');

        contentCtxMenu.style.cssText = 'display:block;position:fixed;z-index:99999;' +
          'left:' + Math.min(x, window.innerWidth - 180) + 'px;' +
          'top:' + Math.min(y, window.innerHeight - 100) + 'px;' +
          'min-width:160px;padding:4px;background:var(--drawer-bg);' +
          'border:1px solid var(--drawer-border);border-radius:8px;box-shadow:var(--shadow);';
      }

      function hideContentCtxMenu() {
        // 菜单整体隐藏时清掉二级菜单的延迟关闭定时器：
        // 否则它会在菜单已删/已隐藏后再跑一次 closeCtxSubmenu，访问已脱离文档的节点
        cancelCtxSubmenuClose();
        if (contentCtxMenu) {
          contentCtxMenu.hidden = true;
          contentCtxMenu.style.display = 'none';
        }
        contentContextTarget = null;
        contentInsertBlock = null;
        contentLineAtPoint = null;
        contentBlankCtx = null;
        hideInsertPreview();
      }

      // 空白处右键的判定：落点在 #markdown-body 内但不在任何正文块上，
      // 或落在 .content 的留白区（正文容器 max-width:900px，两侧留白不属于 #markdown-body）。
      // 未打开文档（state.currentText 为 null）时不提供插入，避免预览线画在欢迎页上。
      function resolveContextMenuTarget(e) {
        var t = e.target;
        // 右键落在正在编辑的插入框 / 内联编辑器上时不弹菜单，否则会把编辑框当成「空白处」
        if (t.closest && (t.closest('.insert-wrapper') || t.closest('.inline-editor') || t.closest('.code-editor'))) return false;
        var pre = t.closest ? t.closest('pre') : null;
        var blockquote = t.closest ? t.closest('blockquote') : null;
        var textEl = t.closest ? t.closest('h1,h2,h3,h4,h5,h6,p,li,td,th,table') : null;
        if (blockquote) textEl = blockquote;

        if (pre || textEl) {
          contentContextTarget = pre || textEl;
          // 上/下插入要相对「顶层块」计算行号：li/td 等嵌套元素的 data-source-line
          // 指向自身所在行，直接用它算「下方」会漏掉整个列表/表格的其余行
          contentInsertBlock = getTopLevelBlock(pre || textEl);
          // 精确到「落点所在的那一行」：多行段落里也能插到中间的某一行之后。
          // 解析失败会返回 null，插入随即退回按块边界（旧行为），不会插错位置。
          contentLineAtPoint = resolveLineAtPoint(e.clientX, e.clientY);
          contentBlankCtx = null;
          return true;
        }
        if (typeof state.currentText !== 'string') return false;
        // 代码 / 配置文件不提供插入，空白处右键就没有任何可选项：
        // 此时返回 false，让浏览器弹出原生右键菜单，而不是把它拦掉却什么都不显示
        if (isCodeFile(state.currentPath)) return false;
        contentContextTarget = null;
        contentInsertBlock = null;
        contentLineAtPoint = null;
        contentBlankCtx = resolveBlankInsertContext(e.clientY);
        return true;
      }

      var markdownBodyForMenu = document.getElementById('markdown-body');
      if (markdownBodyForMenu) {
        markdownBodyForMenu.addEventListener('contextmenu', function (e) {
          if (!resolveContextMenuTarget(e)) return;
          e.preventDefault();
          e.stopPropagation();
          setTimeout(function () { showContentCtxMenu(e.clientX, e.clientY); }, 0);
        });
      }

      // 兜底：如果 markdown-body 上的右键监听未生效，用 document 级监听
      document.addEventListener('contextmenu', function (e) {
        if (e.defaultPrevented) return;
        var t = e.target;
        if (!t || !t.closest) return;
        // .content 覆盖正文留白区；#markdown-body 覆盖块与块之间的空隙
        if (!t.closest('.content') && !t.closest('#markdown-body')) return;
        if (!resolveContextMenuTarget(e)) return;
        e.preventDefault();
        setTimeout(function () { showContentCtxMenu(e.clientX, e.clientY); }, 0);
      });


      if (contentCtxMenu) {
        contentCtxMenu.addEventListener('click', function (e) {
          var copyBtn = e.target.closest('#ctx-content-copy');
          var editBtn = e.target.closest('#ctx-content-edit');
          if (!copyBtn && !editBtn) return;
          var target = contentContextTarget;
          hideContentCtxMenu();
          if (!target) return;

          if (copyBtn) {
              var selectedText = window.getSelection ? window.getSelection().toString() : '';
              if (selectedText) {
                copyTextToClipboard(selectedText);
                return;
              }

            if (target.tagName === 'PRE') {
              var codeEl = target.querySelector('code');
              copyTextToClipboard(codeEl ? codeEl.textContent : target.textContent);
            } else {
              copyTextToClipboard(target.textContent || '');
            }
          } else if (editBtn) {
            if (target.tagName === 'PRE') {
              if (target.hasAttribute('data-code-file')) startEditCodeFile();
              else startEditCodeBlock(target);
            } else if (target.tagName === 'TABLE' || target.tagName === 'TD' || target.tagName === 'TH') {
              const tbl = target.tagName === 'TABLE' ? target : target.closest('table');
              if (tbl) startEditTable(tbl); else startEditTextElement(target);
            } else {
              startEditTextElement(target);
            }
          }
        });
      }

      document.addEventListener('mousedown', function (e) {
        if (contentCtxMenu && contentCtxMenu.style.display !== 'none' && !contentCtxMenu.contains(e.target)) {
          hideContentCtxMenu();
        }
      });

      // 点击菜单里非「插入」区域：收起可能已展开的「插入」二级菜单，
      // 避免主菜单还开着、子菜单却悬在半空（子菜单在 wrap 内，contains 判定仍算「菜单内」）
      document.addEventListener('mousedown', function (e) {
        if (!contentCtxMenu || contentCtxMenu.style.display === 'none') return;
        var wrap = e.target.closest ? e.target.closest('.context-submenu-wrap') : null;
        Array.prototype.forEach.call(contentCtxMenu.querySelectorAll('.context-submenu-wrap.open'), function (w) {
          if (w !== wrap) closeCtxSubmenu(w);
        });
      });

      // 点击编辑器外部时，强制让编辑器失焦，从而触发保存
      document.addEventListener('mousedown', function (e) {
        if (e.target.closest && (e.target.closest('.code-editor') || e.target.closest('.inline-editor'))) return;
        var active = document.activeElement;
        if (active && (active.classList.contains('code-editor') || active.classList.contains('inline-editor'))) {
          active.blur();
        }
      });


      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideContentCtxMenu();
      });

      // 撤销改动按钮
      var undoBtn = document.getElementById('btn-undo-edit');
      if (undoBtn) {
        undoBtn.addEventListener('click', undoLastEdit);
      }

      // 导出下拉菜单
      var exportMenuBtn = document.getElementById('btn-export-menu');
      var exportDropdownMenu = document.getElementById('export-dropdown-menu');
      var exportDropdown = document.getElementById('export-dropdown');

      if (exportMenuBtn) {
        exportMenuBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          toggleExportMenu();
        });
      }

      if (exportDropdownMenu) {
        exportDropdownMenu.addEventListener('click', function (e) {
          e.stopPropagation();
        });
      }

      // 点击页面其他区域关闭下拉菜单
      document.addEventListener('click', function () {
        closeExportMenu();
      });

      var exportHtmlBtn = document.getElementById('btn-export-html');
      if (exportHtmlBtn) {
        exportHtmlBtn.addEventListener('click', function () {
          closeExportMenu();
          exportCurrentHtml();
        });
      }

      var exportPdfBtn = document.getElementById('btn-export-pdf');
      if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function () {
          closeExportMenu();
          if (window.location.protocol === 'file:') {
            toast('PDF 导出需要本地服务器支持，请使用 python serve.py 启动后访问 http://localhost:8000');
            return;
          }
          exportCurrentPdf();
        });
      }

      // 文本上色：按钮内嵌色块只设定当前颜色；点按钮（色块以外的区域）应用当前颜色到选中文字
      let pendingColorRange = null;
      const textColorPicker = document.getElementById('text-color-picker');
      const applyTextColorBtn = document.getElementById('btn-apply-text-color');
      if (textColorPicker) {
        // 恢复上次使用的文字颜色
        try {
          const savedColor = localStorage.getItem('markdown-viewer-text-color');
          if (savedColor && /^#[0-9a-fA-F]{6}$/.test(savedColor)) textColorPicker.value = savedColor;
        } catch (e) {
          // ignore
        }
        textColorPicker.addEventListener('click', function (e) {
          e.stopPropagation(); // 点击色块只打开色盘改颜色，不触发按钮的应用逻辑
        });
        textColorPicker.addEventListener('change', function () {
          try {
            localStorage.setItem('markdown-viewer-text-color', textColorPicker.value);
          } catch (e) {
            // ignore
          }
          pendingColorRange = null; // 改了颜色，清除旧选区捕获
        });
      }
      if (applyTextColorBtn) {
        applyTextColorBtn.addEventListener('mousedown', function () {
          pendingColorRange = captureSelectionRange(); // 点击按钮前捕获正文选区
        });
        applyTextColorBtn.addEventListener('click', function (e) {
          if (e.target === textColorPicker) return; // 保险：色块点击不应用
          const color = textColorPicker ? textColorPicker.value : '#e02a2a';
          const ok = applyColorToSelection(pendingColorRange || captureSelectionRange(), color);
          if (ok) toast('已着色：' + color);
          pendingColorRange = null;
        });
      }
      const clearTextColorBtn = document.getElementById('btn-clear-text-color');
      if (clearTextColorBtn) {
        clearTextColorBtn.addEventListener('mousedown', function () {
          pendingColorRange = captureSelectionRange();
        });
        clearTextColorBtn.addEventListener('click', function () {
          const ok = removeColorFromSelection(pendingColorRange || captureSelectionRange());
          if (ok) toast('已取消文字颜色');
          pendingColorRange = null;
        });
      }



  }

  // 工作区跳转 / 图片放大预览
  function bindContentJumpEvents() {
      // 工作区内部 Markdown 跳转
      const markdownBody = document.getElementById('markdown-body');
      if (markdownBody) {
        markdownBody.addEventListener('click', function (e) {
          const a = e.target.closest('a');
          if (!a) return;
          const href = a.getAttribute('href') || '';
          const hashIndex = href.indexOf('#');
          const pathPart = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
          const anchor = hashIndex >= 0 ? href.slice(hashIndex + 1) : '';
          if (!pathPart || /^(https?:|mailto:|tel:|data:|blob:)/i.test(pathPart)) return;

          const targetPath = resolveWorkspacePath(pathPart);
          const target = state.files.find(function (f) {
            return f.path === targetPath;
          });

          if (target) {
            e.preventDefault();
            let decodedAnchor = anchor;
            try {
              decodedAnchor = decodeURIComponent(anchor);
            } catch (err) {
              // 原样使用
            }
            if (target.path === state.currentPath) {
              scrollToAnchor(decodedAnchor);
            } else {
              openFile(target).then(function () {
                scrollToAnchor(decodedAnchor);
              });
            }
          } else if (/\.(md|markdown|mdown|mkd|txt)(#|$)/i.test(pathPart)) {
            e.preventDefault();
            toast('当前工作区找不到目标文档：' + pathPart);
          } else if (window.location.protocol === 'file:' && !/^(https?:|mailto:|tel:|data:|blob:|#)/i.test(href)) {
            // file:// 下浏览器禁止跳转到本地文件（会报 Unsafe attempt 错误），拦截并提示
            e.preventDefault();
            toast('file:// 模式下无法打开本地链接：' + pathPart);
          }
        });
      }

      // 单击图片：在当前页面弹层里放大查看（链接内的图片仍交给链接处理）
      const mdBodyForImage = document.getElementById('markdown-body');
      if (mdBodyForImage) {
        mdBodyForImage.addEventListener('click', function (e) {
          if (!e.target || !e.target.closest) return;
          const img = e.target.closest('img');
          if (!img) return;
          if (img.closest('a')) return; // 已包裹在链接中的图片遵循链接行为
          const src = img.getAttribute('src');
          if (!src) return;
          e.preventDefault();
          e.stopPropagation();
          // src 已由 renderMarkdown 统一走 resolveImageSrc 解析过（相对路径 / blob: / data: / http(s):）
          openImageLightbox(src);
        });
      }


  }

  // 拖拽打开 / 快捷键
  function bindGlobalEvents() {
    // 拖拽打开
    window.addEventListener('dragover', function (e) {
      e.preventDefault();
    });
    window.addEventListener('drop', async function (e) {
      e.preventDefault();
      const items = e.dataTransfer && e.dataTransfer.items;
      if (items && items.length) {
        const entries = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
        if (entries.length) {
          const wrappedLists = await Promise.all(entries.map(readEntry));
          const wrapped = wrappedLists.flat();
          const isFolderDrop = entries.length === 1 && entries[0].isDirectory;

          // 优先尝试获取真实可写目录句柄（Chrome/Edge 122+ 的 getAsFileSystemHandle），
          // 让拖入的文件夹也能直接写回磁盘；不支持或失败时退回只读快照模式
          let realDirHandle = null;
          if (isFolderDrop && items[0] && typeof items[0].getAsFileSystemHandle === 'function') {
            try {
              const h = await items[0].getAsFileSystemHandle();
              if (h && h.kind === 'directory') realDirHandle = h;
            } catch (err) {
              console.warn('[Markdown Viewer] 获取拖入目录句柄失败，使用兼容模式', err);
            }
          }

          if (realDirHandle) {
            state.dirHandle = realDirHandle;
            state.dirReadOnly = false;
            // 拖入的是文件夹：不自动打开第一篇
            indexWrappedFiles(wrapped, false);
            // 拖入的目录：仅打开浏览，不自动设为默认目录（由「设定默认目录」显式保存）
            state.isDefaultSession = false;
            toast('已打开文件夹（可编辑写回磁盘），点击左侧文件打开');
            return;
          }

            state.dirHandle = null;
            state.dirReadOnly = isFolderDrop;
            state.isDefaultSession = false;

            // 文件夹拖入不自动打开；单个/散文件拖入仍自动打开第一篇
            indexWrappedFiles(wrapped, !isFolderDrop);
            if (isFolderDrop) {
              // 只读兼容目录：构建内存快照供编辑写缓存，不写入默认目录槽
              buildSnapshotInMemory(wrapped);
            }
            return;
        }
      }
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) indexFiles(files, true); // 拖入文件/无目录结构的列表：自动打开第一篇
    });

    // 快捷键
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        openSingleFile();
      }
    });
  }
  // === BIND_EVENTS_END ===

  function restoreTheme() {
    try {
      const saved = localStorage.getItem('markdown-viewer-theme');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.theme = completeTheme(parsed);
        applyTheme();
        return;
      }
    } catch (e) {
      // ignore
    }

    // 如果 localStorage 没有，尝试从 IndexedDB 恢复上次导入/保存的主题
    loadThemeFromIndexedDB().then(function (indexedTheme) {
      if (indexedTheme) {
        state.theme = completeTheme(indexedTheme);
        applyTheme();
      } else {
        setTheme('github-light');
      }
    }).catch(function () {
      setTheme('github-light');
    });
  }

  function init() {
    console.log('[Markdown Viewer] 离线渲染器已启用 (v1.1.06)');
    registerCustomLanguages();
    initMarkdown();
    loadSettings();
    applySettings();
    // 把已保存的设置回填到抽屉里的输入框。
    // 原先只在 openDrawer() 里调用 renderSettingsEditor()，导致首次打开页面的
    // 那一刻控件显示的是 HTML 里的默认值而不是用户存过的值（打开抽屉时才纠正）。
    // 这里在绑定事件前先同步一次，保证控件与真实设置一致。
    renderSettingsEditor();
    loadUserThemes();
    renderThemePresets();
    loadPdfColors();
    loadPdfLayout();
    loadThemeMode();
    restoreTheme();
    loadSidebarState();
    loadToolbarState();
    setSidebarTab(state.sidebarTab);
    bindEvents();
    renderTree();
    restoreDefaultDirectory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
