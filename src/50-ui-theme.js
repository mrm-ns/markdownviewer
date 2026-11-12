  // ---------- 主题生成 ----------
  function themeCss(theme) {
    const colors = theme.colors;
    const vars = COLOR_DEFS.map(function (def) {
      return '--md-' + def[0] + ': ' + colors[def[0]] + ';';
    }).join('\n');

    return [
      ':root {',
      vars,
      '}',
      '',
      '.markdown-body pre, .markdown-body pre code.hljs {',
      '  background-color: var(--md-codeBackground);',
      '  color: var(--md-codeText);',
      '}',
      '',
      '.markdown-body :not(pre) > code {',
      '  background-color: var(--md-inlineCodeBackground);',
      '  color: var(--md-codeText);',
      '}',
      '',
      '.markdown-body .hljs-comment, .markdown-body .hljs-quote { color: var(--md-comment); font-style: italic; }',
      '.markdown-body .hljs-keyword, .markdown-body .hljs-doctag { color: var(--md-keyword); }',
      '.markdown-body .hljs-selector-tag { color: var(--md-selectorTag); }',
      '.markdown-body .hljs-literal { color: var(--md-literal); }',
      '.markdown-body .hljs-string, .markdown-body .hljs-regexp, .markdown-body .hljs-addition { color: var(--md-string); }',
      '.markdown-body .hljs-number { color: var(--md-number); }',
        '.markdown-body .hljs-symbol { color: var(--md-symbol); }',
        '.markdown-body .hljs-bullet { color: var(--md-bullet); }',
        '.markdown-body .hljs-bashPrompt { color: var(--md-bashPrompt); font-weight: bold; }',
        '.markdown-body .hljs-bashOption { color: var(--md-bashOption); }',
      '.markdown-body .hljs-title { color: var(--md-title); }',
      '.markdown-body .hljs-title.function_, .markdown-body .hljs-title.class_ { color: var(--md-function); }',
      '.markdown-body .hljs-function { color: var(--md-function); }',
      '.markdown-body .hljs-variable, .markdown-body .hljs-template-variable { color: var(--md-variable); }',
      '.markdown-body .hljs-attribute { color: var(--md-attribute); }',
      '.markdown-body .hljs-built_in { color: var(--md-built_in); }',
      '.markdown-body .hljs-type { color: var(--md-type); }',
      '.markdown-body .hljs-meta { color: var(--md-meta); }',
      '.markdown-body .hljs-tag { color: var(--md-tag); }',
      '.markdown-body .hljs-name { color: var(--md-name); }',
      '.markdown-body .hljs-selector-id { color: var(--md-selectorId); }',
      '.markdown-body .hljs-selector-class { color: var(--md-selectorClass); }',
      '.markdown-body .hljs-link { color: var(--md-link); text-decoration: underline; }',
      '.markdown-body .hljs-deletion { color: var(--md-deletion); background-color: rgba(255, 0, 0, 0.08); }',
      '.markdown-body .hljs-emphasis { color: var(--md-emphasis); font-style: italic; }',
      '.markdown-body .hljs-strong { color: var(--md-strong); font-weight: bold; }',
      '.markdown-body .hljs-formula { color: var(--md-formula); }',
      '.markdown-body .hljs-section { color: var(--md-section); font-weight: bold; }',
      '.markdown-body .hljs-params { color: var(--md-params); }',
      '.markdown-body .hljs-operator { color: var(--md-operator); }',
      '.markdown-body .hljs-punctuation { color: var(--md-punctuation); }',
      '.markdown-body .hljs-meta .hljs-string { color: var(--md-metaString); }',
      '.markdown-body .hljs-meta .hljs-keyword { color: var(--md-metaKeyword); }',
      '.markdown-body .hljs-subst { color: var(--md-subst); }',
      '.markdown-body .hljs-comment .hljs-title { color: var(--md-commentTitle); }',
      '',
      '/* ===== 用户自定义高级 CSS ===== */',
      theme.customCSS || ''
    ].join('\n');
  }

  function applyTheme() {
    const theme = state.theme;
    let style = document.getElementById('dynamic-theme-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dynamic-theme-style';
      document.head.appendChild(style);
    }
    style.textContent = themeCss(theme);

    document.documentElement.setAttribute('data-app-theme', theme.isDark ? 'dark' : 'light');
    
    
  }

  function saveThemeToStorage() {
    const data = themeExportData();
    try {
      localStorage.setItem('markdown-viewer-theme', JSON.stringify(data));
    } catch (e) {
      // 某些隐私模式下 localStorage 不可用，忽略即可
    }
    saveThemeToIndexedDB(data);
  }

  function themeExportData() {
    return {
      name: state.theme.name,
      isDark: state.theme.isDark,
      colors: state.theme.colors,
      customCSS: state.theme.customCSS || '',
      pdfColors: state.pdfColors,
      pdfLayout: state.pdfLayout
    };
  }

  // ---------- 导出 PDF 主题存储（配色 + 版式） ----------
  function loadPdfColors() {
    try {
      const saved = localStorage.getItem('markdown-viewer-pdf-colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(PDF_BASE_COLORS).forEach(function (k) {
          if (parsed[k] && /^#[0-9a-fA-F]{6}$/.test(parsed[k])) state.pdfColors[k] = parsed[k];
        });
      }
    } catch (e) {
      // ignore
    }
  }

  function savePdfColors() {
    try {
      localStorage.setItem('markdown-viewer-pdf-colors', JSON.stringify(state.pdfColors));
    } catch (e) {
      // ignore
    }
  }

  // ---------- 导出 PDF 版式存储 ----------
  // 单独一个 key：颜色那份（markdown-viewer-pdf-colors）已存在用户机器上，
  // 沿用旧 key、不改结构，老数据零迁移。
  function loadPdfLayout() {
    try {
      const saved = localStorage.getItem('markdown-viewer-pdf-layout');
      if (saved) state.pdfLayout = normalizePdfLayout(JSON.parse(saved));
    } catch (e) {
      // ignore
    }
  }

  function savePdfLayout() {
    try {
      localStorage.setItem('markdown-viewer-pdf-layout', JSON.stringify(state.pdfLayout));
    } catch (e) {
      // ignore
    }
  }

  function loadThemeMode() {
    try {
      const m = localStorage.getItem('markdown-viewer-theme-mode');
      if (m === 'pdf' || m === 'code') state.themeMode = m;
    } catch (e) {
      // ignore
    }
  }

  // ---------- 用户导入主题管理 ----------
  function loadUserThemes() {
    try {
      const saved = localStorage.getItem('markdown-viewer-user-themes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          state.userThemes = parsed.map(function (t) {
            const theme = completeTheme(t);
            theme.label = t.label || theme.name;
            return theme;
          });
        }
      }
    } catch (e) {
      // ignore
    }
  }

  function saveUserThemes() {
    try {
      localStorage.setItem('markdown-viewer-user-themes', JSON.stringify(state.userThemes));
    } catch (e) {
      // ignore
    }
  }

  function renderThemePresets() {
    const select = document.getElementById('theme-preset');
    if (!select) return;
    const builtinNames = ['github-light', 'github-dark', 'atom-one-dark', 'dracula', 'solarized-light', 'keepalived', 'custom'];
    let html = '';
    builtinNames.forEach(function (key) {
      const t = THEMES[key];
      if (t) html += '<option value="' + key + '">' + escapeHtml(t.label) + '</option>';
    });
    state.userThemes.forEach(function (t) {
      html += '<option value="' + escapeHtml(t.name) + '">' + escapeHtml(t.label || t.name) + '</option>';
    });
    select.innerHTML = html;
  }


  // ---------- 阅读设置（字号等） ----------
  function loadSettings() {
    try {
      const saved = localStorage.getItem('markdown-viewer-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        state.settings = {
          textSize: Number(parsed.textSize) || 16,
          codeSize: Number(parsed.codeSize) || 13.5,
            inlineCodeSize: Number(parsed.inlineCodeSize) || 12,
          // 图片背景：默认开启白底。
          // 只在显式存过 false 时才关闭（用 !== false 而不是 Boolean()，
          // 这样老版本设置里没有这个字段时，升级后按默认「开启」处理）
          imageBackground: parsed.imageBackground !== false,
          imageBackgroundColor: normalizeCssColor(parsed.imageBackgroundColor) || '#ffffff'
        };
      }
    } catch (e) {
      // ignore
    }
  }

  // 校验颜色值，只接受 CSS 颜色字面量（#rgb / #rrggbb / #rrggbbaa / 具名色 / rgb() 等），
  // 避免把任意字符串写进 CSS 变量造成样式注入或无效值
  function normalizeCssColor(value) {
    if (typeof value !== 'string') return '';
    const v = value.trim();
    if (!v || v.length > 32) return '';
    if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
    if (/^[a-z]+$/i.test(v)) return v;
    if (/^rgba?\(\s*[\d.%,\s/]+\)$/i.test(v)) return v;
    if (/^hsla?\(\s*[\d.%,\s/deg]+\)$/i.test(v)) return v;
    return '';
  }

  function saveSettings() {
    try {
      localStorage.setItem('markdown-viewer-settings', JSON.stringify(state.settings));
    } catch (e) {
      // ignore
    }
  }

  function applySettings() {
    const root = document.documentElement;
    root.style.setProperty('--md-text-size', state.settings.textSize + 'px');
    root.style.setProperty('--md-code-size', state.settings.codeSize + 'px');
    root.style.setProperty('--md-inline-code-size', state.settings.inlineCodeSize + 'px');
    // 图片背景：用 CSS 变量驱动，样式表里统一用它给正文图片铺底
    root.style.setProperty('--md-image-bg', state.settings.imageBackground
      ? state.settings.imageBackgroundColor
      : 'transparent');
    // 背景必须与图片**完全贴合**：留内边距会像「相框把图片包起来」，
    // 所以这里恒为 0（保留变量是为了样式表里有一处可覆盖的入口）。
    root.style.setProperty('--md-image-padding', '0px');
  }

  function renderSettingsEditor() {
    const textInput = document.getElementById('text-size');
    const codeInput = document.getElementById('code-size');
    const inlineCodeInput = document.getElementById('inline-code-size');
    if (textInput) textInput.value = state.settings.textSize;
    if (codeInput) codeInput.value = state.settings.codeSize;
    if (inlineCodeInput) inlineCodeInput.value = state.settings.inlineCodeSize;
    const imageBgToggle = document.getElementById('image-background-toggle');
    const imageBgColor = document.getElementById('image-background-color');
    if (imageBgToggle) imageBgToggle.checked = !!state.settings.imageBackground;
    if (imageBgColor) imageBgColor.value = state.settings.imageBackgroundColor || '#ffffff';
  }


  function setTheme(name) {
    const userTheme = state.userThemes.find(function (t) { return t.name === name; });
    if (userTheme) {
      state.theme = completeTheme(userTheme);
      state.theme.name = userTheme.name;
      applyTheme();
      renderThemeEditor();
      saveThemeToStorage();
      return;
    }

    const preset = THEMES[name] || THEMES['github-light'];
    state.theme = completeTheme({ name: name, isDark: preset.isDark, colors: preset.colors });
    applyTheme();
    renderThemeEditor();
    saveThemeToStorage();
  }

  function saveCurrentTheme() {
    const theme = state.theme;
    theme.colors = readColorEditor('color-editor');
    theme.isDark = document.getElementById('theme-dark-toggle').checked;
    const customCssEl = document.getElementById('custom-css');
    theme.customCSS = customCssEl ? customCssEl.value : '';

    const userThemeIndex = state.userThemes.findIndex(function (t) { return t.name === theme.name; });
    if (userThemeIndex >= 0) {
      const userTheme = state.userThemes[userThemeIndex];
      userTheme.colors = theme.colors;
      userTheme.isDark = theme.isDark;
      userTheme.customCSS = theme.customCSS;
      saveUserThemes();
      renderThemePresets();
      document.getElementById('theme-preset').value = theme.name;
    } else {
      theme.name = 'custom';
      document.getElementById('theme-preset').value = 'custom';
    }
    applyTheme();
    saveThemeToStorage();
  }

  // ---------- 主题编辑器 ----------
  function renderColorEditor(defs, colors, container) {
    container.innerHTML = defs.map(function (def) {
      if (def[0] === '__sep__') {
        return '<div class="color-section">' + escapeHtml(def[1]) + '</div>';
      }
      const key = def[0];
      const value = colors[key] || '';
      return '' +
        '<div class="color-row">' +
          '<span class="color-name" title="' + escapeHtml(key) + '">' + escapeHtml(def[1]) + '</span>' +
          '<input type="color" name="md-color-' + escapeHtml(key) + '" aria-label="' + escapeHtml(def[1]) + ' 颜色" data-color-key="' + escapeHtml(key) + '" value="' + escapeHtml(toHex(value)) + '">' +
          '<input type="text" name="md-text-' + escapeHtml(key) + '" aria-label="' + escapeHtml(def[1]) + ' 色值" data-text-key="' + escapeHtml(key) + '" value="' + escapeHtml(value) + '" spellcheck="false" autocomplete="off">' +
        '</div>';
    }).join('');
  }

  function renderThemeEditor() {
    const theme = state.theme;
    document.getElementById('theme-preset').value = theme.name;
    document.getElementById('theme-dark-toggle').checked = theme.isDark;
    const customCssEl = document.getElementById('custom-css');
    if (customCssEl) customCssEl.value = theme.customCSS || '';
    renderColorEditor(COLOR_DEFS, theme.colors, document.getElementById('color-editor'));
  }

  function renderPdfThemeEditor() {
    const container = document.getElementById('pdf-color-editor');
    if (container) renderColorEditor(PDF_COLOR_DEFS, state.pdfColors, container);
    renderPdfLayoutEditor();
  }

  // 版式编辑器：按 PDF_LAYOUT_DEFS 生成数字框 / 下拉框（与颜色编辑器同一套声明式风格）
  function renderPdfLayoutEditor() {
    const container = document.getElementById('pdf-layout-editor');
    if (!container) return;
    container.innerHTML = PDF_LAYOUT_DEFS.map(function (def) {
      const key = def[0];
      const label = def[1];
      const kind = def[2];
      const value = state.pdfLayout[key];
      const labelHtml = '<span class="layout-name" title="' + escapeHtml(key) + '">' + escapeHtml(label) + '</span>';
      if (kind === 'enum') {
        const options = def[3].map(function (o) {
          return '<option value="' + escapeHtml(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' +
            escapeHtml(o[1]) + '</option>';
        }).join('');
        return '<div class="layout-row">' + labelHtml +
          '<select name="md-layout-' + escapeHtml(key) + '" data-layout-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(label) + '">' +
          options + '</select></div>';
      }
      return '<div class="layout-row">' + labelHtml +
        '<input type="number" name="md-layout-' + escapeHtml(key) + '" data-layout-key="' + escapeHtml(key) + '" aria-label="' + escapeHtml(label) + '"' +
        ' min="' + def[3] + '" max="' + def[4] + '" step="' + def[5] + '" value="' + escapeHtml(String(value)) + '">' +
        '</div>';
    }).join('');
  }

  // 读回版式编辑器 → 校验夹取 → 回显（UI 不能显示一个并未生效的值）→ 保存 → 刷新预览
  function applyPdfLayoutEditor() {
    const container = document.getElementById('pdf-layout-editor');
    if (!container) return;
    const raw = {};
    container.querySelectorAll('[data-layout-key]').forEach(function (input) {
      raw[input.getAttribute('data-layout-key')] = input.value;
    });
    state.pdfLayout = normalizePdfLayout(Object.assign({}, state.pdfLayout, raw));
    container.querySelectorAll('[data-layout-key]').forEach(function (input) {
      const key = input.getAttribute('data-layout-key');
      const shown = String(state.pdfLayout[key]);
      if (input.value !== shown) input.value = shown;
    });
    savePdfLayout();
    refreshPdfPreview();
  }

  // ---------- 导出 PDF 预览（两套，共用 buildPdfDocumentHtml） ----------
  // 1) 即时样式预览：主题抽屉里随改随见、离线可用。按真实 px 满宽渲染，
  //    不做纸张/分页模拟——抽屉内容区只有约 384px，缩放会让字号失去参考意义，
  //    页边距与真实分页交给 2)。
  // 2) 真实 PDF 预览：调 serve.py + prince 生成真 PDF，用 iframe 内嵌，含真实分页与页边距。
  // 两套都用 buildPdfDocumentHtml()，所以「预览看到的样式」与「导出的样式」同源，不会走偏。
  const PDF_PREVIEW_SAMPLE = [
    '<h1>示例文档</h1>',
    '<p>这一段用来观察正文<strong>字号</strong>、<strong>行高</strong>与<strong>字体</strong>的实际效果：' +
      '包含<a href="#">链接</a>、行内代码 <code>inline_code()</code>，以及中文标点，。、；：（）「」。</p>',
    '<h2>二级标题</h2>',
    '<h3>三级标题</h3>',
    '<blockquote><p>引用块：观察次要文字颜色与左侧边框。</p></blockquote>',
    '<ul><li>无序列表第一项</li><li>第二项，含 <code>code</code></li></ul>',
    '<ol><li>有序列表第一项</li><li>第二项</li></ol>',
    '<h3>表格</h3>',
    '<table><thead><tr><th>列 A</th><th>列 B</th></tr></thead>' +
      '<tbody><tr><td>单元格</td><td>123</td></tr><tr><td>第二行</td><td>456</td></tr></tbody></table>',
    '<h3>代码块</h3>',
    '<pre><code class="hljs language-bash"><span class="hljs-comment"># 注释颜色</span>\n' +
      '<span class="hljs-built_in">echo</span> <span class="hljs-string">"字符串"</span>\n' +
      '<span class="hljs-keyword">if</span> [ -f <span class="hljs-string">"/etc/hosts"</span> ]; <span class="hljs-keyword">then</span>\n' +
      '  <span class="hljs-built_in">echo</span> ok\n' +
      '<span class="hljs-keyword">fi</span></code></pre>',
    '<hr>',
    '<p>—— 示例结束（打开一篇文档后，这里显示的是该文档的正文）</p>'
  ].join('\n');

  // 预览用的正文 HTML：有打开文档就用文档（图片先内联，与导出一致），否则用内置示例。
  // 结果缓存在 state.pdfPreviewBody：改字号/配色只需要重建 CSS 包装，不必重跑图片内联。
  function buildPdfPreviewBody(callback) {
    if (state.pdfPreviewBody != null) {
      callback(state.pdfPreviewBody);
      return;
    }
    const container = document.getElementById('markdown-body');
    if (!container || !container.innerHTML.trim()) {
      state.pdfPreviewBody = PDF_PREVIEW_SAMPLE;
      callback(state.pdfPreviewBody);
      return;
    }
    inlineImagesForExport(container, function (bodyHtml) {
      state.pdfPreviewBody = bodyHtml;
      callback(bodyHtml);
    });
  }

  function refreshPdfPreview() {
    const frame = document.getElementById('pdf-preview-frame');
    if (!frame) return;
    // 面板没显示时不渲染（saved 工时省开销）
    const panel = document.getElementById('pdf-theme-panel');
    if (panel && panel.hidden) return;
    buildPdfPreviewBody(function (bodyHtml) {
      frame.srcdoc = buildPdfDocumentHtml(bodyHtml, 'PDF 预览', state.pdfLayout, state.pdfColors);
    });
  }
  const refreshPdfPreviewDebounced = debounce(refreshPdfPreview, 200);

  // ---------- 真实 PDF 预览（弹层 + iframe 内嵌 prince 结果） ----------
  let pdfPreviewObjectUrl = null;

  // 打开弹层并立刻生成一次（按钮点不动的那次事故就是漏了这个函数：
  // bindEvents 里把未定义的标识符当回调传给 addEventListener 会抛 ReferenceError，
  // 后续所有按钮的绑定都会中断——node --check 查不出这种错）
  function openPdfPreviewModal() {
    const modal = document.getElementById('pdf-preview-modal');
    if (modal) modal.hidden = false;
    generatePdfPreview();
  }

  function closePdfPreviewModal() {
    const modal = document.getElementById('pdf-preview-modal');
    if (modal) modal.hidden = true;
    const frame = document.getElementById('pdf-preview-frame-lg');
    if (frame) frame.removeAttribute('src');
    // blob URL 必须显式回收，否则反复预览会一直占着内存
    if (pdfPreviewObjectUrl) {
      URL.revokeObjectURL(pdfPreviewObjectUrl);
      pdfPreviewObjectUrl = null;
    }
  }

  // === IMAGE_LIGHTBOX_BEGIN ===
  // 图片放大预览：在当前页面弹层里查看，不再 window.open 新标签页。
  // 为什么必须改成页面内：浏览器只禁止「顶层导航」到 file:// 本地文件，不禁止页面内 <img> 加载本地图片，
  // 所以 file:// 模式下新标签页打不开图片，页面内反而能正常预览。
  function openImageLightbox(src) {
    if (!src) return;
    const box = document.getElementById('image-lightbox');
    const img = document.getElementById('image-lightbox-img');
    if (!box || !img) return;
    img.setAttribute('src', src);
    box.hidden = false;
    document.body.classList.add('lightbox-open');
  }

  // 幂等：Esc、点遮罩、点 ✕ 三条路径都可能调用它，重复调用必须无副作用
  function closeImageLightbox() {
    const box = document.getElementById('image-lightbox');
    if (!box || box.hidden) return;
    box.hidden = true;
    const img = document.getElementById('image-lightbox-img');
    // 断开引用，避免关层后仍把大图挂在 DOM 上
    if (img) img.removeAttribute('src');
    document.body.classList.remove('lightbox-open');
  }
  // === IMAGE_LIGHTBOX_END ===

  function generatePdfPreview() {
    if (window.location.protocol === 'file:') {
      toast('PDF 预览需要本地服务器支持，请使用 python serve.py 启动后访问 http://localhost:8000');
      return;
    }
    const container = document.getElementById('markdown-body');
    if (!container || !container.innerHTML.trim()) {
      toast('当前没有可预览的内容');
      return;
    }
    const status = document.getElementById('pdf-preview-status');
    const frame = document.getElementById('pdf-preview-frame-lg');
    buildPdfPreviewBody(function (bodyHtml) {
      const html = buildPdfDocumentHtml(bodyHtml, 'PDF 预览', state.pdfLayout, state.pdfColors);
      if (status) status.textContent = '正在生成…（prince 渲染通常需要 1–3 秒）';
      fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
        body: html
      }).then(function (resp) {
        if (!resp.ok) {
          return resp.json().then(function (data) {
            throw new Error(data.error || 'PDF 生成失败');
          }).catch(function (e) {
            if (e.message) throw e;
            throw new Error('PDF 生成失败 (HTTP ' + resp.status + ')');
          });
        }
        return resp.blob();
      }).then(function (blob) {
        if (pdfPreviewObjectUrl) URL.revokeObjectURL(pdfPreviewObjectUrl);
        pdfPreviewObjectUrl = URL.createObjectURL(blob);
        if (frame) frame.src = pdfPreviewObjectUrl;
        if (status) status.textContent = '预览已生成（下方即为真实 PDF，含真实分页与页边距）';
      }).catch(function (err) {
        console.error('[Markdown Viewer] PDF 预览失败', err);
        if (status) status.textContent = '生成失败：' + err.message;
        toast('PDF 预览失败：' + err.message);
      });
    });
  }

  function readColorEditor(containerId) {
    const colors = {};
    const container = document.getElementById(containerId);
    if (!container) return colors;
    container.querySelectorAll('[data-color-key]').forEach(function (input) {
      const key = input.getAttribute('data-color-key');
      const textInput = container.querySelector('[data-text-key="' + key + '"]');
      colors[key] = textInput ? textInput.value.trim() : input.value;
    });
    return colors;
  }

  function setThemeMode(mode) {
    state.themeMode = mode === 'pdf' ? 'pdf' : 'code';
    try {
      localStorage.setItem('markdown-viewer-theme-mode', state.themeMode);
    } catch (e) {
      // ignore
    }
    const codePanel = document.getElementById('code-theme-panel');
    const pdfPanel = document.getElementById('pdf-theme-panel');
    if (codePanel) codePanel.hidden = state.themeMode !== 'code';
    if (pdfPanel) pdfPanel.hidden = state.themeMode !== 'pdf';
    const codeBtn = document.getElementById('theme-mode-code');
    const pdfBtn = document.getElementById('theme-mode-pdf');
    if (codeBtn) codeBtn.classList.toggle('active', state.themeMode === 'code');
    if (pdfBtn) pdfBtn.classList.toggle('active', state.themeMode === 'pdf');
    // 切到 PDF 面板时渲染一次样式预览（面板隐藏时 refreshPdfPreview 会直接跳过）
    if (state.themeMode === 'pdf') refreshPdfPreview();
  }

  function toHex(value) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    // 简单转换为灰色，避免 color input 报错
    return '#cccccc';
  }

  function openDrawer() {
    document.getElementById('theme-drawer').classList.add('open');
    document.getElementById('theme-drawer').setAttribute('aria-hidden', 'false');
    setThemeMode(state.themeMode);
    renderThemeEditor();
    renderPdfThemeEditor();
    renderSettingsEditor();
  }

  function closeDrawer() {
    document.getElementById('theme-drawer').classList.remove('open');
    document.getElementById('theme-drawer').setAttribute('aria-hidden', 'true');
  }
