  function initMarkdown() {
    // 统一使用内置 Markdown 渲染器，避免旧缓存中的 CDN 脚本干扰
    md = { render: builtinMarkdown };
  }

  function miniMarkdown(text) {
    // 极简回退：CDN 加载失败时也能看纯文本结构
    const escaped = escapeHtml(text);
    return '<pre>' + escaped + '</pre>';
  }

  // ---------- 原生 HTML 图片支持 ----------
  function extractHtmlImages(text) {
    const images = [];
    const replaced = String(text || '').replace(/<img\b[^>]*>/gi, function (match) {
      const token = '%%%MD_IMAGE_' + images.length + '%%%';
      images.push(match);
      return token;
    });
    return { text: replaced, images: images };
  }

  function resolveImageSrc(src) {
    if (!src) return src;
    if (/^(https?:|data:|blob:|\/)/i.test(src)) return src;
    let srcPath = src;
    try {
      srcPath = decodeURIComponent(src);
    } catch (e) {
      // 原样使用
    }
    const currentPath = state.currentPath || '';
    const baseDir = currentPath.indexOf('/') >= 0 ? currentPath.replace(/[^/]*$/, '') : '';
    const combined = baseDir + srcPath;
    const parts = combined.split('/');
    const stack = [];
    parts.forEach(function (part) {
      if (part === '' || part === '.') return;
      if (part === '..') {
        if (stack.length) stack.pop();
      } else {
        stack.push(part);
      }
    });
    const normalized = stack.join('/');
    if (state.imageMap[normalized]) return state.imageMap[normalized];
    return src;
  }

  function restoreHtmlImages_broken(container, images) {
    images.forEach(function (imgHtml, idx) {
      const token = '%%%MD_IMAGE_' + idx + '%%%';
      const srcMatch = imgHtml.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      let finalHtml = imgHtml;
      if (srcMatch) {
        const resolved = resolveImageSrc(srcMatch[1]);
        {


  // ---------- 工作区内部跳转 ----------
  
    return String(text || '').toLowerCase().trim()
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  function resolveWorkspacePath(href) {
    let decoded = href;
    try {
      decoded = decodeURIComponent(href);
    } catch (e) {
      // 原样使用
    }
    const currentPath = state.currentPath || '';
    const baseDir = currentPath.indexOf('/') >= 0 ? currentPath.replace(/[^/]*$/, '') : '';
    const combined = baseDir + decoded;
    const parts = combined.split('/');
    const stack = [];
    parts.forEach(function (part) {
      if (part === '' || part === '.') return;
      if (part === '..') {
        if (stack.length) stack.pop();
      } else {
        stack.push(part);
      }
    });
    return stack.join('/');
  }

  function scrollToAnchor(anchor) {
    if (!anchor) return;
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

        finalHtml = imgHtml.replace(srcMatch[0], 'src="' + resolved.replace(/"/g, '&quot;') + '"');
      }
      container.innerHTML = container.innerHTML.split(token).join(finalHtml);
    });
  }

  function restoreHtmlImages(container, images) {
    images.forEach(function (imgHtml, idx) {
      const token = '%%%MD_IMAGE_' + idx + '%%%';
      const srcMatch = imgHtml.match(/\bsrc\s*=\s*["']([^"']*)["']/i);
      let finalHtml = imgHtml;
      if (srcMatch) {
        const resolved = resolveImageSrc(srcMatch[1]);
        finalHtml = imgHtml.replace(srcMatch[0], 'src="' + resolved.replace(/"/g, '&quot;') + '"');
      }
      container.innerHTML = container.innerHTML.split(token).join(finalHtml);
    });
  }



  // 统一对正文中的代码块做高亮（Markdown 围栏与代码文件共用）
  function highlightPreBlocks(container) {
    container.querySelectorAll('pre code').forEach(function (block) {
      const langMatch = block.className.match(/language-([\w-]+)/);
      const lang = langMatch ? langMatch[1] : '';
      block.classList.add('hljs');
      block.innerHTML = highlightCode(block.textContent, lang);
    });
  }

  // 代码/配置文件：整份内容作为一个代码块显示，按语言规则高亮。
  // 不走 Markdown 管线（否则代码里的 <img>/<font>/<br> 字面量会被当作 HTML 处理而损坏）。
  function renderCodeContent(container, text, lang) {
    container.innerHTML = '<pre data-source-line="0" data-code-file="1">' +
      '<code class="language-' + escapeHtml(lang) + '">' + escapeHtml(text) + '</code>' +
    '</pre>';
  }

  function renderMarkdown(text) {
    const container = document.getElementById('markdown-body');
    const welcome = document.getElementById('welcome');
    // 正文变了，PDF 预览缓存的正文 HTML 必须作废（图片内联结果也随之重算）
    state.pdfPreviewBody = null;
    if (text == null) {
      container.innerHTML = '';
      welcome.style.display = '';
      return;
    }
    welcome.style.display = 'none';

    // 代码/配置文件：按对应语言的代码块显示（不解析 Markdown）
    const codeLang = getFileLang(state.currentPath);
    if (codeLang) {
      renderCodeContent(container, text, codeLang);
      highlightPreBlocks(container);
      renderOutline();
      return;
    }

    const extracted = extractHtmlImages(text);
    const rendered = md ? md.render(extracted.text) : builtinMarkdown(extracted.text);
    container.innerHTML = rendered;
    restoreHtmlImages(container, extracted.images);

    // 统一解析所有 <img> 的相对路径（同时覆盖 Markdown 图片语法和原生 HTML 图片）
    container.querySelectorAll('img').forEach(function (img) {
      const src = img.getAttribute('src');
      if (src) {
        const resolved = resolveImageSrc(src);
        if (resolved !== src) img.setAttribute('src', resolved);
      }
      // 图片加载失败（文件不存在 / 路径无效）：加标记便于样式提示，避免显示裂图
      const markError = function () {
        if (!img.classList.contains('image-load-error')) {
          img.classList.add('image-load-error');
          img.setAttribute('title', '图片无法加载：' + (img.getAttribute('src') || ''));
        }
      };
      img.addEventListener('error', markError);
      if (img.complete && img.naturalWidth === 0) markError();
    });

    // 用内置高亮器统一高亮代码块
    highlightPreBlocks(container);

    renderOutline();
  }


  // 导出前把 blob:/相对路径 图片内联为 data URL，保证导出的 HTML/PDF 在任何位置都能显示图片
  function inlineImagesForExport(container, callback) {
    const clone = container.cloneNode(true);
    const imgs = clone.querySelectorAll('img');
    const pending = [];
    imgs.forEach(function (img) {
      const src = img.getAttribute('src') || '';
      // data:/https: 图片可直接使用；其余（blob: 或未解析相对路径）尝试读取为 data URL
      if (/^(data:|https?:)/i.test(src)) return;
      pending.push(
        fetch(src).then(function (resp) { return resp.blob(); }).then(function (blob) {
          return new Promise(function (resolve) {
            const reader = new FileReader();
            reader.onload = function () { img.setAttribute('src', reader.result); resolve(); };
            reader.onerror = function () { resolve(); };
            reader.readAsDataURL(blob);
          });
        }).catch(function () {
          // 读取失败保留原样（如 file:// 下无法 fetch 相对路径）
        })
      );
    });
    Promise.all(pending).then(function () {
      callback(clone.innerHTML);
    });
  }

  // ---------- 导出 HTML ----------
  function exportCurrentHtml() {
    var container = document.getElementById('markdown-body');
    if (!container || !container.innerHTML.trim()) {
      toast('当前没有可导出的内容');
      return;
    }

    var title = state.currentPath
      ? state.currentPath.replace(/^.*[\\/]/, '').replace(/\.md$/i, '')
      : 'markdown-export';

    // 收集当前主题 CSS
    var theme = state.theme;
    var cssVars = themeCss(theme);

    // 收集 markdown-body 相关样式（从 style.css 中提取关键规则）
    var bodyStyles = [
      'body { margin: 0; padding: 0; background: ' + (theme.isDark ? '#0d1117' : '#ffffff') + '; }',
      '.markdown-body { max-width: 900px; margin: 0 auto; padding: 32px 24px 64px; color: var(--app-fg); font-size: ' + state.settings.textSize + 'px; line-height: 1.6; word-wrap: break-word; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }',
      '.markdown-body h1, .markdown-body h2 { padding-bottom: 0.3em; border-bottom: 1px solid var(--toolbar-border); }',
      '.markdown-body h1 { font-size: 2em; margin: 0.67em 0; }',
      '.markdown-body h2 { font-size: 1.5em; margin: 0.83em 0; }',
      '.markdown-body h3 { font-size: 1.25em; margin: 1em 0; }',
      '.markdown-body h4 { font-size: 1em; margin: 1.33em 0; }',
      '.markdown-body h5 { font-size: 0.875em; margin: 1.67em 0; }',
      '.markdown-body h6 { font-size: 0.85em; margin: 2.33em 0; color: var(--muted); }',
      '.markdown-body p { margin-top: 0; margin-bottom: 16px; }',
      '.markdown-body a { color: var(--md-link); text-decoration: none; }',
      '.markdown-body a:hover { text-decoration: underline; }',
      '.markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 16px; }',
      '.markdown-body li + li { margin-top: 4px; }',
      '.markdown-body li > input[type="checkbox"] { margin-right: 6px; }',
      '.markdown-body strong, .markdown-body b { font-weight: bold; color: var(--md-strong); }',
      '.markdown-body blockquote { margin: 0 0 16px; padding: 0 1em; color: var(--muted); border-left: 4px solid var(--toolbar-border); }',
      '.markdown-body table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }',
      '.markdown-body table th, .markdown-body table td { border: 1px solid var(--toolbar-border); padding: 6px 13px; }',
      '.markdown-body table th { font-weight: 600; background: var(--inline-code-bg); }',
      '.markdown-body table tr:nth-child(2n) { background: var(--inline-code-bg); }',
      '.markdown-body hr { height: 2px; margin: 24px 0; background: var(--toolbar-border); border: none; }',
      '.markdown-body img { max-width: 100%; height: auto; border-radius: 4px; background-color: ' + (state.settings.imageBackground ? state.settings.imageBackgroundColor : 'transparent') + '; padding: ' + (state.settings.imageBackground ? '6px' : '0px') + '; box-sizing: content-box; }',
      '.markdown-body :not(pre) > code { background: var(--md-inlineCodeBackground); color: var(--md-codeText); padding: 2px 6px; border-radius: 4px; font-size: ' + state.settings.inlineCodeSize + 'px; }',
      '.markdown-body pre { background: var(--md-codeBackground); color: var(--md-codeText); padding: 16px; border-radius: 6px; overflow-x: auto; margin-bottom: 16px; font-size: ' + state.settings.codeSize + 'px; line-height: 1.45; }',
      '.markdown-body pre code { background: transparent; padding: 0; font-size: inherit; color: inherit; }'
    ].join('\n');

    // 补充应用级 CSS 变量
    var appVars = ':root {\n' +
      '--app-fg: ' + (theme.isDark ? '#e6edf3' : '#1f2328') + ';\n' +
      '--muted: ' + (theme.isDark ? '#8b949e' : '#6e7781') + ';\n' +
      '--toolbar-border: ' + (theme.isDark ? '#30363d' : '#d0d7de') + ';\n' +
      '--inline-code-bg: ' + (theme.isDark ? '#2d333b' : '#eff1f3') + ';\n' +
      '--md-link: ' + (theme.colors.link || '#0969da') + ';\n' +
      '--md-strong: ' + (theme.colors.strong || (theme.isDark ? '#e6edf3' : '#1f2328')) + ';\n' +
      '}';

    var fullCss = appVars + '\n' + cssVars + '\n' + bodyStyles;

    // 先内联图片（blob/相对路径 → data URL），再生成完整 HTML 下载
    inlineImagesForExport(container, function (bodyHtml) {
      var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
        '<meta charset="UTF-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
        '<title>' + escapeHtml(title) + '</title>\n' +
        '<style>\n' + fullCss + '\n</style>\n' +
        '</head>\n<body>\n' +
        '<div class="markdown-body">\n' + bodyHtml + '\n</div>\n' +
        '</body>\n</html>';

      download(title + '.html', html, 'text/html;charset=utf-8');
      toast('已导出：' + title + '.html');
    });
  }

  // ---------- 导出 PDF 的 CSS / HTML 构建（预览与导出共用） ----------
  // 为什么要单独抽出来：即时样式预览必须与真实导出**看起来完全一样**，
  // 样式只在这里生成一次，导出流程与两套预览都调它，从结构上杜绝两边走偏。
  // 纯函数、只依赖入参（见 AGENTS.md §5.1 / §7）。
  function buildPdfCss(layout, colors) {
    const L = normalizePdfLayout(layout);
    const C = colors || PDF_BASE_COLORS;
    // 代码块语法配色来自 PDF 配色（state.pdfColors 已含完整语法色），可单独配置
    const cssVars = themeCss({ colors: C, isDark: false, customCSS: '' });
    const bodyFont = PDF_FONT_PRESETS.body[L.bodyFont] || PDF_FONT_PRESETS.body.system;
    const codeFont = PDF_FONT_PRESETS.code[L.codeFont] || PDF_FONT_PRESETS.code.mono;
    // 标题档位在 JS 里算好再写 em，不用 calc()（prince 对 calc 的支持不可依赖）
    const scaled = function (base) {
      return (Math.round(base * L.headingScale * 1000) / 1000) + 'em';
    };

    const bodyStyles = [
      '@page { size: ' + L.pageSize + '; margin: ' + L.marginV + 'mm ' + L.marginH + 'mm; }',
      'body { margin: 0; padding: 0; background: ' + C.pdfPageBg + '; color: ' + C.pdfText + '; }',
      '.markdown-body { max-width: 100%; margin: 0 auto; padding: 0; color: ' + C.pdfText + '; font-size: ' + L.textSize + 'px; line-height: ' + L.lineHeight + '; word-wrap: break-word; font-family: ' + bodyFont + '; }',
      '.markdown-body h1, .markdown-body h2 { padding-bottom: 0.3em; border-bottom: 1px solid ' + C.pdfBorder + '; }',
      '.markdown-body h1 { font-size: ' + scaled(2) + '; margin: 0.67em 0; color: ' + C.pdfHeading + '; }',
      '.markdown-body h2 { font-size: ' + scaled(1.5) + '; margin: 0.83em 0; color: ' + C.pdfHeading + '; }',
      '.markdown-body h3 { font-size: ' + scaled(1.25) + '; margin: 1em 0; color: ' + C.pdfHeading + '; }',
      '.markdown-body h4 { font-size: ' + scaled(1) + '; margin: 1.33em 0; }',
      '.markdown-body h5 { font-size: ' + scaled(0.875) + '; margin: 1.67em 0; }',
      '.markdown-body h6 { font-size: ' + scaled(0.85) + '; margin: 2.33em 0; color: ' + C.pdfMuted + '; }',
      '.markdown-body p { margin-top: 0; margin-bottom: 16px; }',
      '.markdown-body a { color: ' + C.pdfLink + '; text-decoration: none; }',
      '.markdown-body ul, .markdown-body ol { padding-left: 2em; margin-bottom: 16px; }',
      '.markdown-body li + li { margin-top: 4px; }',
      '.markdown-body li > input[type="checkbox"] { margin-right: 6px; }',
      '.markdown-body strong, .markdown-body b { font-weight: bold; color: ' + C.pdfStrong + '; }',
      '.markdown-body blockquote { margin: 0 0 16px; padding: 0 1em; color: ' + C.pdfMuted + '; border-left: 4px solid ' + C.pdfBorder + '; }',
      '.markdown-body table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }',
      '.markdown-body table th, .markdown-body table td { border: 1px solid ' + C.pdfBorder + '; padding: 6px 13px; }',
      '.markdown-body table th { font-weight: 600; background: ' + C.pdfInlineBg + '; }',
      '.markdown-body table tr:nth-child(2n) { background: ' + C.pdfInlineBg + '; }',
      '.markdown-body hr { height: 2px; margin: 24px 0; background: ' + C.pdfBorder + '; border: none; }',
      '.markdown-body img { max-width: 100%; height: auto; border-radius: 4px; }',
      '.markdown-body :not(pre) > code { background: ' + C.pdfInlineBg + '; color: ' + C.pdfInlineText + '; padding: 2px 6px; border-radius: 4px; font-size: ' + L.inlineCodeSize + 'px; }',
      '.markdown-body pre { background: ' + C.pdfCodeBg + '; color: ' + C.pdfCodeText + '; padding: 16px; border-radius: 6px; overflow-x: visible; margin-bottom: 16px; font-size: ' + L.codeSize + 'px; line-height: ' + L.codeLineHeight + '; font-family: ' + codeFont + '; white-space: pre-wrap; word-break: break-word; }',
      '.markdown-body pre code { background: transparent; padding: 0; font-size: inherit; color: inherit; }',
      /* prince 专用：标题避免跨页 */
      'h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }'
    ].join('\n');

    const appVars = ':root {\n' +
      '--app-fg: ' + C.pdfText + ';\n' +
      '--muted: ' + C.pdfMuted + ';\n' +
      '--toolbar-border: ' + C.pdfBorder + ';\n' +
      '--inline-code-bg: ' + C.pdfInlineBg + ';\n' +
      '--md-link: ' + C.pdfLink + ';\n' +
      '--md-strong: ' + C.pdfStrong + ';\n' +
      '}';

    return appVars + '\n' + cssVars + '\n' + bodyStyles;
  }

  // 完整独立 HTML 文档（导出给 prince 的、以及预览 iframe 里用的，是同一份构建结果）
  function buildPdfDocumentHtml(bodyHtml, title, layout, colors) {
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      '<style>\n' + buildPdfCss(layout, colors) + '\n</style>\n' +
      '</head>\n<body>\n' +
      '<div class="markdown-body">\n' + bodyHtml + '\n</div>\n' +
      '</body>\n</html>';
  }

  // ---------- 导出 PDF（通过 serve.py + prince） ----------
  function exportCurrentPdf() {
    var container = document.getElementById('markdown-body');
    if (!container || !container.innerHTML.trim()) {
      toast('当前没有可导出的内容');
      return;
    }

    var title = state.currentPath
      ? state.currentPath.replace(/^.*[\\/]/, '').replace(/\.md$/i, '')
      : 'markdown-export';

    // 先内联图片（blob/相对路径 → data URL），再构建完整 HTML 发送给 serve.py 转 PDF
    inlineImagesForExport(container, function (bodyHtml) {
      // 版式取自 PDF 主题（state.pdfLayout），与阅读器字号 state.settings 无关
      var html = buildPdfDocumentHtml(bodyHtml, title, state.pdfLayout, state.pdfColors);

      toast('正在生成 PDF...');

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
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = title + '.pdf';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
        toast('已导出：' + title + '.pdf');
      }).catch(function (err) {
        console.error('[Markdown Viewer] PDF 导出失败', err);
        toast('PDF 导出失败：' + err.message);
      });
    });
  }

  function resetImageMap() {
    Object.keys(state.imageMap).forEach(function (k) {
      try {
        URL.revokeObjectURL(state.imageMap[k]);
      } catch (e) {
        // ignore
      }
    });
    state.imageMap = {};
  }
