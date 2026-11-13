/* ============================================================
 * Markdown Viewer
 * GitHub 风格 Markdown 文档浏览器 + 可高度自定义代码块配色
 * ============================================================ */

(function () {
  'use strict';

  // ---------- 工具函数 ----------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Markdown 文档：按 Markdown 语法排版渲染
  function isMarkdownFile(name) {
    return /\.(md|markdown|mdown|mkd)$/i.test(name);
  }

  // 扩展名 → 代码块语言：这类文件按对应语言的代码块规则高亮显示（不做 Markdown 解析）
  const EXT_LANG_MAP = {
    txt: 'text',
    bash: 'bash', sh: 'bash', zsh: 'bash', ksh: 'bash',
    py: 'python',
    js: 'javascript',
    json: 'json',
    yaml: 'yaml', yml: 'yaml',
    ini: 'ini',
    conf: 'conf',
    sql: 'sql',
    promql: 'promql',
    // XML 家族。注意**不要**加 svg：isSupportedFile() 先于 isImageFile() 判断，
    // 加了会让 Markdown 里引用的 .svg 图片被当成代码文件打开，图片就不显示了。
    xml: 'xml', xsl: 'xml', xslt: 'xml', xsd: 'xml'
  };

  // 按文件名（无扩展名）识别的文件
  const FILENAME_LANG_MAP = {
    dockerfile: 'dockerfile',
    containerfile: 'dockerfile'
  };

  // 取文件名（去掉目录部分）
  function baseName(nameOrPath) {
    return String(nameOrPath || '').replace(/^.*[\\/]/, '');
  }

  // 返回该文件应使用的代码块语言；Markdown 或未识别的类型返回 ''
  function getFileLang(nameOrPath) {
    const base = baseName(nameOrPath).toLowerCase();
    if (!base) return '';
    if (FILENAME_LANG_MAP[base]) return FILENAME_LANG_MAP[base];
    const dot = base.lastIndexOf('.');
    if (dot < 0 || dot === base.length - 1) return '';
    const ext = base.slice(dot + 1);
    return EXT_LANG_MAP[ext] || '';
  }

  // 是否为「按代码块显示的代码/配置文件」
  function isCodeFile(nameOrPath) {
    return !!getFileLang(nameOrPath);
  }

  // 是否可加入文档列表：Markdown 文档 或 代码/配置文件
  function isSupportedFile(name) {
    return isMarkdownFile(name) || isCodeFile(name);
  }

  function isImageFile(name) {
    return /\.(png|jpe?g|gif|svg|webp|bmp|ico)$/i.test(name);
  }

  function readFileText(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsText(file, 'utf-8');
    });
  }

  function debounce(fn, wait) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, wait);
    };
  }

  function toast(message) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }

  // ---------- 主题定义 ----------
  const COLOR_DEFS = [
    ['codeBackground', '代码块背景'],
    ['codeText', '代码文本'],
    ['inlineCodeBackground', '行内代码背景'],
    ['inlineCodeText', '行内代码文字'],
    ['keyword', '关键字'],
    ['string', '字符串'],
    ['comment', '注释'],
    ['number', '数字'],
    ['title', '函数/类名'],
    ['function', '函数名'],
    ['variable', '变量'],
    ['attribute', '属性名'],
    ['built_in', '内置函数/类型'],
    ['literal', '字面量'],
    ['type', '类型'],
    ['meta', '元信息'],
    ['tag', '标签'],
    ['name', '名称'],
    ['selectorTag', '标签选择器'],
    ['selectorId', 'ID 选择器'],
    ['selectorClass', '类选择器'],
    ['regexp', '正则'],
    ['symbol', '符号'],
    ['bullet', '列表符号'],
    ['link', '链接'],
    ['deletion', '删除文本'],
    ['addition', '新增文本'],
    ['emphasis', '斜体'],
    ['strong', '加粗'],
    ['emph', '强调'],
    ['formula', '公式'],
    ['section', '章节'],
    ['params', '参数'],
    ['operator', '运算符'],
    ['punctuation', '标点'],
    ['metaString', '元字符串'],
    ['metaKeyword', '元关键字'],
    ['subst', '替换文本'],
    ['templateVariable', '模板变量'],
    ['doctag', '文档标签'],
    ['commentTitle', '注释标题'],
    ['bashOption', 'Bash 选项'],
    ['bashPrompt', 'Bash 提示符']
  ];

  // 导出 PDF 配色（文档级颜色 + 代码块语法配色）
  const PDF_COLOR_DEFS = [
    ['pdfPageBg', '页面背景'],
    ['pdfText', '正文文字'],
    ['pdfHeading', '标题'],
    ['pdfLink', '链接'],
    ['pdfMuted', '次要文字'],
    ['pdfBorder', '边框/分隔线'],
    ['pdfStrong', '加粗文字'],
    ['pdfInlineBg', '行内代码背景'],
    ['pdfInlineText', '行内代码文字'],
    ['pdfCodeBg', '代码块背景'],
    ['pdfCodeText', '代码块文字'],
    ['__sep__', '代码块语法配色'],
    ['keyword', '关键字'],
    ['string', '字符串'],
    ['comment', '注释'],
    ['number', '数字'],
    ['title', '函数/类名'],
    ['function', '函数名'],
    ['variable', '变量'],
    ['attribute', '属性名'],
    ['built_in', '内置函数/类型'],
    ['literal', '字面量'],
    ['type', '类型'],
    ['meta', '元信息'],
    ['tag', '标签'],
    ['name', '名称'],
    ['selectorTag', '标签选择器'],
    ['selectorId', 'ID 选择器'],
    ['selectorClass', '类选择器'],
    ['regexp', '正则'],
    ['symbol', '符号'],
    ['bullet', '列表符号'],
    ['link', '链接'],
    ['deletion', '删除文本'],
    ['addition', '新增文本'],
    ['emphasis', '斜体'],
    ['strong', '加粗'],
    ['emph', '强调'],
    ['formula', '公式'],
    ['section', '章节'],
    ['params', '参数'],
    ['operator', '运算符'],
    ['punctuation', '标点'],
    ['metaString', '元字符串'],
    ['metaKeyword', '元关键字'],
    ['subst', '替换文本'],
    ['templateVariable', '模板变量'],
    ['doctag', '文档标签'],
    ['commentTitle', '注释标题'],
    ['bashOption', 'Bash 选项'],
    ['bashPrompt', 'Bash 提示符']
  ];

  const BASE_COLORS = {
    codeBackground: '#f6f8fa',
    codeText: '#1f2328',
    inlineCodeBackground: '#eff1f3',
    inlineCodeText: '#1f2328',
    keyword: '#cf222e',
    string: '#0a3069',
    comment: '#6e7781',
    number: '#0550ae',
    title: '#8250df',
    function: '#8250df',
    variable: '#953800',
    attribute: '#116329',
    built_in: '#953800',
    literal: '#0550ae',
    type: '#953800',
    meta: '#1f2328',
    tag: '#116329',
    name: '#0550ae',
    selectorTag: '#116329',
    selectorId: '#0a3069',
    selectorClass: '#0550ae',
    regexp: '#0a3069',
    symbol: '#0550ae',
    bullet: '#0550ae',
    link: '#0969da',
    deletion: '#82071e',
    addition: '#116329',
    emphasis: '#1f2328',
    strong: '#cf222e',
    emph: '#8250df',
    formula: '#1f2328',
    section: '#8250df',
    params: '#1f2328',
    operator: '#cf222e',
    punctuation: '#1f2328',
    metaString: '#0a3069',
    metaKeyword: '#cf222e',
    subst: '#1f2328',
    templateVariable: '#953800',
    doctag: '#cf222e',
    commentTitle: '#6e7781',
    bashOption: '#0550ae',
    bashPrompt: '#6e7781'
  };

  // 导出 PDF 配色默认值：文档级颜色 + 代码语法色（语法色继承 BASE_COLORS 默认值）
  // 精致浅色方案（pdf-light）：专业文档风，深蓝标题 + 清爽灰调 + 高对比正文
  const PDF_BASE_COLORS = Object.assign({}, BASE_COLORS, {
    pdfPageBg: '#ffffff',
    pdfText: '#24292f',
    pdfHeading: '#1f4e79',
    pdfLink: '#0969da',
    pdfMuted: '#57606a',
    pdfBorder: '#d0d7de',
    pdfStrong: '#b91c1c',
    pdfInlineBg: '#eef1f4',
    pdfInlineText: '#24292f',
    pdfCodeBg: '#f6f8fa',
    pdfCodeText: '#24292f'
  });

  // ---------- 导出 PDF 版式（字号 / 字体 / 行高 / 纸张 / 标题缩放） ----------
  // 与阅读器字号 state.settings 完全分开：PDF 是另一个产物，排版需求不同，
  // 调 PDF 不该牵动阅读器，反之亦然。
  //
  // 默认值刻意等于历史硬编码值（正文 16 / 代码 13.5 / 行内 12 / 行高 1.6 / 代码行高 1.45 /
  // A4 / 页边距 20mm·18mm / 标题缩放 1），因此「什么都不改」时导出的关键声明与以前完全一致。
  const PDF_PAGE_SIZES = [['A4', 'A4'], ['Letter', 'Letter'], ['A5', 'A5']];

  // 字体族只给预设 key，不开放自定义字符串：这些值会被拼进导出 HTML 的 <style>，
  // 原始字符串可以闭合样式块逃逸出去（注入）。白名单是硬约束，见 AGENTS.md §5.1。
  const PDF_FONT_PRESETS = {
    body: {
      system: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      yahei: '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", sans-serif',
      songti: 'SimSun, "Songti SC", "Noto Serif CJK SC", Georgia, serif'
    },
    code: {
      mono: 'monospace',
      consolas: 'Consolas, "Courier New", monospace',
      cascadia: '"Cascadia Mono", "JetBrains Mono", Consolas, monospace'
    }
  };

  // 版式字段表：渲染输入框与校验共用一份定义（与 PDF_COLOR_DEFS 同一种声明式风格）
  // 'number' → [key, 标签, 'number', min, max, step]；'enum' → [key, 标签, 'enum', [[值, 标签], ...]]
  const PDF_LAYOUT_DEFS = [
    ['textSize', '正文字号（px）', 'number', 8, 32, 0.5],
    ['codeSize', '代码块字号（px）', 'number', 8, 32, 0.5],
    ['inlineCodeSize', '行内代码字号（px）', 'number', 8, 32, 0.5],
    ['lineHeight', '正文行高', 'number', 1, 2.5, 0.05],
    ['codeLineHeight', '代码行高', 'number', 1, 2.5, 0.05],
    ['headingScale', '标题缩放比例', 'number', 0.6, 1.6, 0.05],
    ['pageSize', '纸张', 'enum', PDF_PAGE_SIZES],
    ['marginV', '页边距 上下（mm）', 'number', 0, 40, 1],
    ['marginH', '页边距 左右（mm）', 'number', 0, 40, 1],
    ['bodyFont', '正文字体', 'enum', [['system', '系统默认'], ['yahei', '微软雅黑 / 黑体'], ['songti', '宋体（serif）']]],
    ['codeFont', '代码字体', 'enum', [['mono', '等宽（默认）'], ['consolas', 'Consolas'], ['cascadia', 'Cascadia Mono']]]
  ];

  const PDF_LAYOUT_DEFAULTS = {
    textSize: 16,
    codeSize: 13.5,
    inlineCodeSize: 12,
    lineHeight: 1.6,
    codeLineHeight: 1.45,
    headingScale: 1,
    pageSize: 'A4',
    marginV: 20,
    marginH: 18,
    bodyFont: 'system',
    codeFont: 'mono'
  };

  // 版式校验 + 夹取：任何来源（localStorage / 导入的 JSON / 手输）都必须过这一关。
  // 纯函数、只依赖入参，便于脱离浏览器直接验证（见 AGENTS.md §7）。
  // 注意：不能直接用 Number('')——它是 0，会把「清空输入框」夹成最小值，
  // 所以空串要显式回落默认值。
  function normalizePdfLayout(raw) {
    const out = Object.assign({}, PDF_LAYOUT_DEFAULTS);
    if (!raw || typeof raw !== 'object') return out;
    PDF_LAYOUT_DEFS.forEach(function (def) {
      const key = def[0];
      const kind = def[2];
      if (!Object.prototype.hasOwnProperty.call(raw, key)) return;
      const value = raw[key];
      if (kind === 'number') {
        const min = def[3];
        const max = def[4];
        let n;
        if (typeof value === 'number') {
          n = value;
        } else {
          const s = String(value == null ? '' : value).trim();
          if (s === '') return;            // 清空 → 回落默认，而不是夹成最小值
          n = Number(s);
        }
        if (!isFinite(n)) return;
        out[key] = Math.min(max, Math.max(min, n));
      } else if (kind === 'enum') {
        const allowed = def[3].map(function (o) { return o[0]; });
        if (typeof value === 'string' && allowed.indexOf(value) >= 0) out[key] = value;
      }
    });
    return out;
  }

  const THEMES = {
    'github-light': {
      name: 'github-light',
      label: 'GitHub Light',
      isDark: false,
      colors: Object.assign({}, BASE_COLORS)
    },
    'github-dark': {
      name: 'github-dark',
      label: 'GitHub Dark',
      isDark: true,
      colors: {
        codeBackground: '#161b22',
        codeText: '#e6edf3',
        inlineCodeBackground: '#2d333b',
        keyword: '#ff7b72',
        string: '#a5d6ff',
        comment: '#8b949e',
        number: '#79c0ff',
        title: '#d2a8ff',
        function: '#d2a8ff',
        variable: '#ffa657',
        attribute: '#7ee787',
        built_in: '#ffa657',
        literal: '#79c0ff',
        type: '#ffa657',
        meta: '#e6edf3',
        tag: '#7ee787',
        name: '#79c0ff',
        selectorTag: '#7ee787',
        selectorId: '#a5d6ff',
        selectorClass: '#79c0ff',
        regexp: '#a5d6ff',
        symbol: '#79c0ff',
        bullet: '#79c0ff',
        link: '#79c0ff',
        deletion: '#ffdcd7',
        addition: '#aff5b4',
        emphasis: '#e6edf3',
        strong: '#ff7b72',
        formula: '#e6edf3',
        section: '#d2a8ff',
        params: '#e6edf3',
        operator: '#ff7b72',
        punctuation: '#e6edf3',
        metaString: '#a5d6ff',
        metaKeyword: '#ff7b72',
        subst: '#e6edf3',
        templateVariable: '#ffa657',
        doctag: '#ff7b72',
        commentTitle: '#8b949e'
      }
    },
    'atom-one-dark': {
      name: 'atom-one-dark',
      label: 'Atom One Dark',
      isDark: true,
      colors: {
        codeBackground: '#282c34',
        codeText: '#abb2bf',
        inlineCodeBackground: '#3b4048',
        keyword: '#c678dd',
        string: '#98c379',
        comment: '#7f848e',
        number: '#d19a66',
        title: '#61afef',
        function: '#61afef',
        variable: '#e06c75',
        attribute: '#d19a66',
        built_in: '#e5c07b',
        literal: '#56b6c2',
        type: '#e5c07b',
        meta: '#abb2bf',
        tag: '#e06c75',
        name: '#e06c75',
        selectorTag: '#e06c75',
        selectorId: '#61afef',
        selectorClass: '#e5c07b',
        regexp: '#98c379',
        symbol: '#56b6c2',
        bullet: '#56b6c2',
        link: '#61afef',
        deletion: '#e06c75',
        addition: '#98c379',
        emphasis: '#abb2bf',
        strong: '#e06c75',
        formula: '#abb2bf',
        section: '#e5c07b',
        params: '#abb2bf',
        operator: '#56b6c2',
        punctuation: '#abb2bf',
        metaString: '#98c379',
        metaKeyword: '#c678dd',
        subst: '#abb2bf',
        templateVariable: '#e06c75',
        doctag: '#c678dd',
        commentTitle: '#7f848e'
      }
    },
    dracula: {
      name: 'dracula',
      label: 'Dracula',
      isDark: true,
      colors: {
        codeBackground: '#282a36',
        codeText: '#f8f8f2',
        inlineCodeBackground: '#44475a',
        keyword: '#ff79c6',
        string: '#f1fa8c',
        comment: '#6272a4',
        number: '#bd93f9',
        title: '#50fa7b',
        function: '#50fa7b',
        variable: '#f8f8f2',
        attribute: '#50fa7b',
        built_in: '#8be9fd',
        literal: '#bd93f9',
        type: '#8be9fd',
        meta: '#f8f8f2',
        tag: '#ff79c6',
        name: '#f8f8f2',
        selectorTag: '#ff79c6',
        selectorId: '#bd93f9',
        selectorClass: '#50fa7b',
        regexp: '#f1fa8c',
        symbol: '#ffb86c',
        bullet: '#ffb86c',
        link: '#8be9fd',
        deletion: '#ff5555',
        addition: '#50fa7b',
        emphasis: '#f8f8f2',
        strong: '#ff5555',
        formula: '#f8f8f2',
        section: '#ffb86c',
        params: '#f8f8f2',
        operator: '#ff79c6',
        punctuation: '#f8f8f2',
        metaString: '#f1fa8c',
        metaKeyword: '#ff79c6',
        subst: '#f8f8f2',
        templateVariable: '#ffb86c',
        doctag: '#ff79c6',
        commentTitle: '#6272a4'
      }
    },
    'solarized-light': {
      name: 'solarized-light',
      label: 'Solarized Light',
      isDark: false,
      colors: {
        codeBackground: '#fdf6e3',
        codeText: '#586e75',
        inlineCodeBackground: '#eee8d5',
        keyword: '#859900',
        string: '#2aa198',
        comment: '#93a1a1',
        number: '#d33682',
        title: '#268bd2',
        function: '#268bd2',
        variable: '#b58900',
        attribute: '#b58900',
        built_in: '#cb4b16',
        literal: '#2aa198',
        type: '#b58900',
        meta: '#586e75',
        tag: '#268bd2',
        name: '#268bd2',
        selectorTag: '#859900',
        selectorId: '#268bd2',
        selectorClass: '#b58900',
        regexp: '#dc322f',
        symbol: '#d33682',
        bullet: '#d33682',
        link: '#268bd2',
        deletion: '#dc322f',
        addition: '#859900',
        emphasis: '#586e75',
        strong: '#dc322f',
        formula: '#586e75',
        section: '#268bd2',
        params: '#586e75',
        operator: '#859900',
        punctuation: '#586e75',
        metaString: '#2aa198',
        metaKeyword: '#859900',
        subst: '#586e75',
        templateVariable: '#b58900',
        doctag: '#859900',
        commentTitle: '#93a1a1'
      }
    },
    keepalived: {
      name: 'keepalived',
      label: 'Keepalived Config',
      isDark: true,
      colors: {
        codeBackground: '#0d1117',
        codeText: '#c9d1d9',
        inlineCodeBackground: '#2d333b',
        keyword: '#ff7b72',
        string: '#a5d6ff',
        comment: '#8b949e',
        number: '#f2cc60',
        title: '#d2a8ff',
        function: '#d2a8ff',
        variable: '#ffa657',
        attribute: '#79c0ff',
        built_in: '#79c0ff',
        literal: '#7ee787',
        type: '#ffa657',
        meta: '#c9d1d9',
        tag: '#7ee787',
        name: '#7ee787',
        selectorTag: '#ff7b72',
        selectorId: '#a5d6ff',
        selectorClass: '#79c0ff',
        regexp: '#a5d6ff',
        symbol: '#f2cc60',
        bullet: '#f2cc60',
        link: '#79c0ff',
        deletion: '#ffdcd7',
        addition: '#aff5b4',
        emphasis: '#c9d1d9',
        strong: '#ff7b72',
        formula: '#c9d1d9',
        section: '#d2a8ff',
        params: '#c9d1d9',
        operator: '#ff7b72',
        punctuation: '#c9d1d9',
        metaString: '#a5d6ff',
        metaKeyword: '#ff7b72',
        subst: '#c9d1d9',
        templateVariable: '#ffa657',
        doctag: '#ff7b72',
        commentTitle: '#8b949e'
      }
    },

    custom: {
      name: 'custom',
      label: '自定义',
      isDark: false,
      colors: Object.assign({}, BASE_COLORS)
    }
  };

  function completeTheme(theme) {
    const colors = Object.assign({}, BASE_COLORS);
    if (theme && theme.colors) {
      Object.keys(theme.colors).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(BASE_COLORS, k)) {
          colors[k] = theme.colors[k];
        }
      });
      if (!Object.prototype.hasOwnProperty.call(theme.colors, 'inlineCodeText')) {
        colors.inlineCodeText = colors.codeText;
      }
      if (!Object.prototype.hasOwnProperty.call(theme.colors, 'bashOption')) {
        colors.bashOption = colors.attribute;
      }
      if (!Object.prototype.hasOwnProperty.call(theme.colors, 'bashPrompt')) {
        colors.bashPrompt = colors.meta;
      }
    }
    return {
      name: (theme && theme.name) || 'custom',
      isDark: !!(theme && theme.isDark),
      colors: colors,
      customCSS: String((theme && theme.customCSS) || '')
    };
  }

  // ---------- 全局状态 ----------
  const state = {
    files: [],          // [{ path, name, file }]
    currentPath: null,
    currentText: null,
    undoStack: [],
    undoStacks: {},
    theme: completeTheme({ name: 'github-light', isDark: false, colors: {} }),
    search: '',
    searchMode: 'name',
    contentSearchResults: null, // 全文搜索行级结果：[{ path, name, lineIndex, lineNumber, text, isHeading, headingLevel, breadcrumbs, heading }]
    contentSearchTruncated: false, // 全文搜索结果是否因达到上限被截断
    searchReqSeq: 0,            // 全文搜索竞态序号
    searchTextCache: {},        // path -> { lastModified, size, text }，全文搜索文本缓存
    searchExpandedFiles: new Set(), // 全文搜索里已展开的文件路径（结果按文件分组折叠，默认全部收起）
    settings: {
      textSize: 16,
      codeSize: 13.5,
      inlineCodeSize: 12,
      // 图片背景：透明 PNG / SVG（截图、流程图、公式图）在暗色主题下没有底板会看不清，
      // 默认给所有正文图片铺一层白底；用户可在「主题 → 阅读设置」里改色或关闭
      imageBackground: true,
      imageBackgroundColor: '#ffffff'
    },
    imageMap: {},       // path -> objectURL，用于相对路径图片
    dirHandle: null,    // File System Access API 的当前目录句柄
    dirReadOnly: false, // 当前目录是否为只读模式（Apache/HTTP 快照模式时为 true）
    snapshotData: null, // 默认目录浏览器缓存快照（File System Access API 不可用时 fallback）
    pendingSnapshot: null, // 正在异步构建的内存快照 Promise（打开兼容目录时记录）
    isDefaultSession: false, // 当前会话是否属于默认目录（为 true 时编辑写回才会持久化到默认缓存槽）
    pendingCompatibleNote: false, // 系统目录受限回退后，是否提示兼容模式说明
    userThemes: [],     // 用户导入的主题，会出现在预设下拉框中
    sidebarTab: 'files',
    sidebarCollapsed: false,
    toolbarCollapsed: false,
    expandedFolders: new Set(), // 文件树中已展开的目录路径（默认收起）
    pdfColors: Object.assign({}, PDF_BASE_COLORS), // 导出 PDF 配色
    pdfLayout: Object.assign({}, PDF_LAYOUT_DEFAULTS), // 导出 PDF 版式（字号/行高/纸张/字体），与阅读器 state.settings 无关
    pdfPreviewBody: null, // PDF 预览缓存的正文 HTML（图片已内联）；正文重渲染时置空
    themeMode: 'code', // 主题编辑器模式：'code' | 'pdf'
    lastInsertLang: '' // 上次插入代码块时填写的语言（下次插入默认沿用）
  };

  // ---------- 自定义语言支持 ----------
  function registerCustomLanguages() {
    if (!window.hljs) return;

    if (!window.hljs.getLanguage('keepalived')) {
      window.hljs.registerLanguage('keepalived', function (hljs) {
        return {
          case_insensitive: true,
          keywords: {
            keyword: 'global_defs vrrp_instance virtual_server real_server authentication',
            literal: 'MASTER BACKUP NAT DR PASS TCP LVS_MASTER LVS_SLAVE',
            built_in: 'router_id state interface virtual_router_id priority advert_int auth_type auth_pass virtual_ipaddress delay_loop lb_algo lb_kind persistence_timeout protocol weight connect_timeout retry delay_before_retry'
          },
          contains: [
            hljs.HASH_COMMENT_MODE,
            { className: 'number', begin: /\b\d{1,3}(?:\.\d{1,3}){3}\b/ },
            { className: 'number', begin: /\b\d+(?:\.\d+)?\b/ },
            { className: 'string', begin: /"/, end: /"/ }
          ]
        };
      });
    }
  }

  // ---------- 内置 Markdown 渲染（离线可用） ----------
  function highlightWithRules(code, rules) {
    // 无规则时直接转义，避免空正则 '()' 造成零长度匹配死循环
    if (!rules || !rules.length) return escapeHtml(code);
    const combined = '(' + rules.map(function (r) { return r.pattern.source; }).join(')|(') + ')';
    const regex = new RegExp(combined, 'gim');
    let result = '';
    let last = 0;
    let m;
    while ((m = regex.exec(code)) !== null) {
      // 零长度匹配（如规则形如 \b）不推进 lastIndex，手动跳过防止死循环
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
        continue;
      }
      result += escapeHtml(code.slice(last, m.index));
      for (let i = 0; i < rules.length; i++) {
        if (m[i + 1] !== undefined) {
          result += '<span class="hljs-' + rules[i].className + '">' + escapeHtml(m[i + 1]) + '</span>';
          break;
        }
      }
      last = regex.lastIndex;
    }
    result += escapeHtml(code.slice(last));
    return result;
  }

  const KEEPALIVED_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+\b/ },
    { className: 'literal', pattern: /\b(?:MASTER|BACKUP|NAT|DR|PASS|TCP|LVS_MASTER|LVS_SLAVE)\b/ },
    { className: 'keyword', pattern: /\b(?:global_defs|vrrp_instance|virtual_server|real_server|authentication)\b/ },
    { className: 'built_in', pattern: /\b(?:router_id|state|interface|virtual_router_id|priority|advert_int|auth_type|auth_pass|virtual_ipaddress|delay_loop|lb_algo|lb_kind|persistence_timeout|protocol|weight|connect_timeout|retry|delay_before_retry)\b/ }
  ];

  const PYTHON_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:def|return|if|elif|else|for|while|import|from|class|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|assert|raise|in|not|and|or|is|None|True|False)\b/ },
    { className: 'built_in', pattern: /\b(?:print|len|range|type|str|int|float|list|dict|set|tuple|enumerate|zip|map|filter|open|sum|min|max|sorted|reversed|isinstance|super|self)\b/ }
  ];

  const JS_RULES = [
    { className: 'comment', pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { className: 'string', pattern: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|import|export|from|try|catch|finally|throw|async|await|typeof|instanceof|in|of|this|null|undefined|true|false)\b/ },
    { className: 'built_in', pattern: /\b(?:console|document|window|Math|JSON|Object|Array|String|Number|Boolean|Promise|setTimeout|setInterval|require|module|process)\b/ }
  ];

  const JSON_RULES = [
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'literal', pattern: /\b(?:true|false|null)\b/ }
  ];

  const BASH_RULES = [
    // 与 js/bash.js 保持一致：见该文件说明，# 仅在行首或左侧全为空白时才是注释
    { className: 'comment', pattern: /(?<!\S)#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'bashPrompt', pattern: /^\s*\$[ \t]/ },
    { className: 'bashOption', pattern: /(?:^|\s)(?:-[a-zA-Z][a-zA-Z0-9_-]*|--[a-zA-Z0-9][a-zA-Z0-9_-]*)/ },
    { className: 'symbol', pattern: /[><+*()@!~=|&;{}\[\]:?]/ },
    { className: 'keyword', pattern: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|local|read|cd|source|sudo|dnf|yum|apt|apt-get|dpkg|rpm|pacman|zypper|vim|vi|nano|emacs|grep|egrep|fgrep|sed|awk|cat|less|more|tail|head|ip|ifconfig|netstat|ping|traceroute|curl|wget|nmap|tcpdump|ss|route|arp|hostname|dig|nslookup|ssh|scp|rsync|cobbler|cobblerd|ipvsadm|keepalived|openssl|systemctl|journalctl|systemd-analyze|systemd-cat|pvcreate|pvdisplay|pvs|pvscan|pvremove|pvchange|pvresize|vgcreate|vgdisplay|vgs|vgscan|vgremove|vgchange|vgextend|vgreduce|vgconvert|lvcreate|lvdisplay|lvs|lvscan|lvremove|lvchange|lvextend|lvreduce|lvresize|lvconvert|lvm|mkfs|mount|umount|blkid|lsblk|fdisk|parted|ls|pwd|cp|mv|rm|mkdir|rmdir|touch|chmod|chown|ln|tar|unzip|zip|gzip|gunzip|xz|ps|kill|pkill|jobs|bg|fg|nohup|service|chkconfig|useradd|usermod|userdel|groupadd|passwd|su|history|clear|alias|unalias|test)\b/ }
  ];


  const INI_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'section', pattern: /^\[[^\]]+\]/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*(?=\s*=)/ },
    { className: 'string', pattern: /(?<==)\s*[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];

  const CONF_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*/ },
    { className: 'string', pattern: /(?<=\S)\s+[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];

  function detectLanguage(code) {
    const s = code || '';
    if (/vrrp_instance|global_defs|virtual_server|real_server/.test(s)) return 'keepalived';
    // XML：只认显式声明，不能靠「有尖括号」判断——那样会把 HTML 片段、C++ 模板
    // 甚至 Markdown 里的 <br> 都判成 XML，反而把颜色搞乱
    if (/^\s*<\?xml\b/i.test(s) || /^\s*<[A-Za-z_][\w.:-]*(?:\s[^>]*)?>\s*\n[\s\S]*<\/[A-Za-z_][\w.:-]*>\s*$/i.test(s)) return 'xml';
    // Dockerfile：行首为 FROM 且存在其他 Dockerfile 指令
    if (/^[ \t]*FROM\s+\S+/im.test(s) && /^[ \t]*(?:RUN|CMD|COPY|ADD|ENV|LABEL|WORKDIR|ENTRYPOINT|EXPOSE|ARG|VOLUME|USER)\s/im.test(s)) return 'dockerfile';
    if (/^\s*\{[\s\S]*"\s*:\s*/.test(s) || (/^\s*\[/.test(s) && /"\s*:/.test(s))) return 'json';
    if (/^\s*[A-Za-z_][A-Za-z0-9_.-]*:\s+\S+/m.test(s) && !/\bdef\s+\w+\s*\(/.test(s)) return 'yaml';
    if (/\bdef\s+\w+\s*\(/.test(s) || (/\bimport\s+\w+/.test(s) && /:\s*$/.test(s))) return 'python';
    if (/\bfunction\s+\w+\s*\(|=>|\bconst\s+\w+\s*=/.test(s)) return 'javascript';
    if (/^\s*#!\/bin\/bash|\becho\s+|\bsudo\s+/.test(s)) return 'bash';
    if (/^\s*(server\s*\{|location\s+)/m.test(s)) return 'nginx';
    return '';
  }

  // 归一化代码围栏语言名：兼容带空格/大小写/别名写法
  // 例如「Plain Text」「plain text」「PlainText」「text/plain」→ text
  function normalizeFenceLang(rawLang) {
    const raw = String(rawLang || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    // 取第一个词作为主标识（Markdown 允许 ```lang 后面跟额外信息）
    const first = lower.split(/\s+/)[0];
    // 纯文本类写法统一归为 text
    if (/^(plain|plaintext|text|txt)$/.test(first)) return 'text';
    if (/^text\/(plain|txt)$/.test(lower)) return 'text';
    // 其余语言按首个词返回，并把常见别名归一
    if (first === 'py') return 'python';
    if (first === 'js' || first === 'node' || first === 'nodejs') return 'javascript';
    if (first === 'sh' || first === 'shell' || first === 'zsh' || first === 'ksh' || first === 'console' || first === 'terminal') return 'bash';
    if (first === 'yml') return 'yaml';
    if (first === 'config' || first === 'cfg') return 'conf';
    if (first === 'pql') return 'promql';
    if (first === 'docker' || first === 'containerfile') return 'dockerfile';
    if (first === 'mysql' || first === 'mariadb' || first === 'postgresql' || first === 'postgres' || first === 'sqlite' || first === 'plsql' || first === 'tsql') return 'sql';
    return first;
  }


  function getSyntaxRules(name) {
    if (window.MD_SYNTAX_RULES && window.MD_SYNTAX_RULES[name]) {
      return window.MD_SYNTAX_RULES[name];
    }
    var fallback = {
      keepalived: KEEPALIVED_RULES,
      python: PYTHON_RULES,
      javascript: JS_RULES,
      json: JSON_RULES,
      bash: BASH_RULES,
      ini: INI_RULES,
      conf: CONF_RULES,
      yaml: [],
      text: [],
      apache: [],
      nginx: [],
      promql: [],
      sql: [],
      xml: [],
      dockerfile: []
    };
    return fallback[name] || [];
  }

  // text 代码块：在规则高亮之外支持 **强调**（加粗 + 颜色）。
  // 先把 **...** 提取为令牌，避免被 symbol 规则把 * 当符号高亮，
  // 规则处理完后再还原为 <span class="hljs-strong">。
  function highlightTextCode(code) {
    const emph = [];
    const tokenized = String(code || '').replace(/\*\*([^*]+)\*\*/g, function (m, inner) {
      const token = '%%%MD_EMPH_' + emph.length + '%%%';
      emph.push('<span class="hljs-strong">**' + escapeHtml(inner) + '**</span>');
      return token;
    });
    let html = highlightWithRules(tokenized, getSyntaxRules('text'));
    emph.forEach(function (repl, i) {
      html = html.split('%%%MD_EMPH_' + i + '%%%').join(repl);
    });
    return html;
  }

  function highlightCode(code, lang) {
    const l = normalizeFenceLang(lang || detectLanguage(code) || '');
    if (l === 'keepalived' || l === 'lvs' || l.indexOf('keepalived') === 0) return highlightWithRules(code, getSyntaxRules('keepalived'));
    if (l === 'python' || l === 'py' || l.indexOf('python') === 0) return highlightWithRules(code, getSyntaxRules('python'));
    if (l === 'javascript' || l === 'js' || l === 'node' || l === 'nodejs' || l.indexOf('javascript') === 0) return highlightWithRules(code, getSyntaxRules('javascript'));
    if (l === 'json' || l.indexOf('json') === 0) return highlightWithRules(code, getSyntaxRules('json'));
    if (l === 'bash' || l === 'shell' || l === 'sh' || l === 'zsh' || l === 'ksh' || l === 'console' || l === 'terminal') return highlightWithRules(code, getSyntaxRules('bash'));
    if (l === 'ini') return highlightWithRules(code, getSyntaxRules('ini'));
    if (l === 'nginx' || l === 'conf' || l === 'config' || l === 'cfg') return highlightWithRules(code, getSyntaxRules('conf'));
    if (l === 'yaml' || l === 'yml') return highlightWithRules(code, getSyntaxRules('yaml'));
    if (l === 'text' || l === 'txt') return highlightTextCode(code);
    if (l === 'apache') return highlightWithRules(code, getSyntaxRules('apache'));
    if (l === 'sql' || l === 'mysql' || l === 'mariadb' || l === 'postgresql' || l === 'postgres' || l === 'sqlite' || l === 'plsql' || l === 'tsql') return highlightWithRules(code, getSyntaxRules('sql'));
    if (l === 'promql' || l === 'pql') return highlightWithRules(code, getSyntaxRules('promql'));
    if (l === 'dockerfile') return highlightWithRules(code, getSyntaxRules('dockerfile'));
    // XML 家族：这些围栏名写的都是 XML 文档，共用同一套规则；
    // 不收录 html —— HTML 的语法更松（属性可无引号、有自闭合空元素），套 XML 规则会串色
    if (l === 'xml' || l === 'xhtml' || l === 'xsl' || l === 'xslt' || l === 'xsd' ||
        l === 'svg' || l === 'plist' || l === 'rss' || l === 'atom' || l === 'csproj' || l === 'xaml' ||
        l === 'pom' || l === 'wsdl' || l === 'dtd') return highlightWithRules(code, getSyntaxRules('xml'));
    return escapeHtml(code);
  }

  // ---------- 工作区内部跳转（顶层定义，避免被错误嵌套） ----------
  function slugify(text) {
    // 先去掉标题中允许的 HTML 标签（<font>/<br>），避免标签文本污染锚点 id
    const clean = String(text || '').replace(ALLOWED_HTML_TAG_RE, '');
    return clean.toLowerCase().trim()
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


  function builtinInline(text) {
    let s = text;
    s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s;
  }

  // ---------- 内联 HTML 标签支持（<font color> / <br>） ----------
  // 渲染管线默认对所有正文做 HTML 转义，这里在转义前把允许的标签
  // 提取成令牌、渲染后再还原，从而支持 <font color='red'> 与 <br>。
  // 仅放行 <font>（只保留 color / size / face 属性）和 <br>，其余标签照旧转义。
  const ALLOWED_HTML_TAG_RE = /<\/?font\b[^>]*>|<br\s*\/?>/gi;

  function sanitizeAllowedTag(raw) {
    if (/^<\/font\s*>/i.test(raw)) return '</font>';
    if (/^<br\s*\/?>/i.test(raw)) return '<br>';
    // <font ...>：仅保留 color / size / face 属性，其余（含事件属性）全部丢弃
    const attrRe = /\b(color|size|face)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
    const attrs = [];
    let m;
    while ((m = attrRe.exec(raw))) {
      attrs.push(m[1].toLowerCase() + '=' + m[2]);
    }
    return attrs.length ? '<font ' + attrs.join(' ') + '>' : '<font>';
  }

  function extractAllowedHtmlTags(text) {
    const tags = [];
    const replaced = String(text || '').replace(ALLOWED_HTML_TAG_RE, function (match) {
      const token = '%%%MD_HTML_TAG_' + tags.length + '%%%';
      tags.push({ token: token, html: sanitizeAllowedTag(match) });
      return token;
    });
    return { text: replaced, tags: tags };
  }

  function restoreAllowedHtmlTags(text, tags) {
    tags.forEach(function (t) {
      text = text.split(t.token).join(t.html);
    });
    return text;
  }

  // 行内渲染：转义前提取 <font>/<br>，转义 + markdown 行内解析后还原
  function inlineRender(raw) {
    const extracted = extractAllowedHtmlTags(raw);
    const out = builtinInline(escapeHtml(extracted.text));
    return restoreAllowedHtmlTags(out, extracted.tags);
  }

  function builtinTableRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
  }

  function builtinParseList(lines, start, baseOffset) {
    const offset = baseOffset || 0;
    const ordered = /^\s*\d+\.\s+/.test(lines[start]);
    const items = [];
    let i = start;
    const markerRe = ordered ? /^(\s*)(\d+)\.\s+(.*)$/ : /^(\s*)([-*+])\s+(.*)$/;
    while (i < lines.length) {
      const m = lines[i].match(markerRe);
      if (!m) break;
      const itemLine = i;
      const indent = m[1].length;
      const content = m[3];
      const contentIndent = indent + m[2].length + 1;
      const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
      let inner;
      if (task) {
        const checked = task[1] !== ' ' ? ' checked' : '';
        inner = '<input type="checkbox" disabled' + checked + '> ' + inlineRender(task[2]);
      } else {
        inner = inlineRender(content);
      }
      i++;

      // 收集当前列表项下缩进的内容（嵌套引用、代码块、图片、嵌套列表等）
        const nestedStart = i;

      const nestedLines = [];
      while (i < lines.length) {
        const line = lines[i];
        const lineIndent = (line.match(/^\s*/) || [''])[0].length;
        const trimmed = line.trim();

        if (trimmed === '') {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length) {
            const nextIndent = (lines[j].match(/^\s*/) || [''])[0].length;
            if (nextIndent > indent) {
              nestedLines.push('');
              i++;
              continue;
            }
          }
          break;
        }

        // 同一层级的下一个列表项，结束当前项
        if (/^\s*([-*+]|\d+\.)\s+/.test(line) && lineIndent <= indent) break;

        if (lineIndent > indent) {
          nestedLines.push(line.slice(Math.min(contentIndent, line.length)));
          i++;
        } else {
          break;
        }
      }

      let nestedHtml = '';
      if (nestedLines.length) {
        nestedHtml = builtinMarkdown(nestedLines.join('\n'), nestedStart + offset);
      }
      // data-source-end 指向本项整棵子树的末行（循环退出时 i 已是下一项的首行）。
      // 必须写在 li 上：仅靠 data-source-line 推不出末行，computeBlockEndLine 的通用分支
      // 遇到嵌套子列表会提前收尾（"- a / - a1 / - a11" 会算成只占 1 行），
      // 缩进功能要按整棵子树一起平移，少算一行就会把子项拆成同级。
      items.push('<li data-source-line="' + (itemLine + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + inner + nestedHtml + '</li>');
    }
    const tag = ordered ? 'ol' : 'ul';
    return { html: '<' + tag + ' data-source-line="' + (start + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + items.join('') + '</' + tag + '>', next: i };
  }

  function builtinMarkdown(text, baseOffset) {
    const offset = baseOffset || 0;
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      // 围栏语言名允许包含空格（如 ```Plain Text），与标准 Markdown 一致
      const fence = line.match(/^\s*```(.*)$/);
      if (fence) {
        const fenceStart = i;
          const lang = normalizeFenceLang((fence[1] || '').trim());
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        // i 此时指向结束围栏（未闭合时越界），记录块末尾行号供插入定位使用
        const fenceEnd = Math.min(i, lines.length - 1);
        if (i < lines.length) i++;
        html += '<pre data-source-line="' + (fenceStart + offset) + '" data-source-end="' + (fenceEnd + offset) + '"><code class="hljs language-' + escapeHtml(lang) + '">' + highlightCode(buf.join('\n'), lang) + '</code></pre>';
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const headingId = slugify(heading[2]);
          html += '<h' + level + ' id="' + escapeHtml(headingId) + '" data-source-line="' + (i + offset) + '" data-source-end="' + (i + offset) + '">' + inlineRender(heading[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += '<hr data-source-line="' + (i + offset) + '" data-source-end="' + (i + offset) + '">';
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
          const blockquoteStart = i;

        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote data-source-line="' + (blockquoteStart + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + builtinMarkdown(buf.join('\n'), blockquoteStart + offset) + '</blockquote>';
        continue;
      }

      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:\-|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const header = builtinTableRow(line);
        const headerLine = i; // 表头行号（i 随后会被递增，需先记录）
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          rows.push({ line: i, cells: builtinTableRow(lines[i]) });
          i++;
        }
        html += '<table data-source-line="' + (headerLine + offset) + '" data-source-end="' + (i - 1 + offset) + '"><thead><tr>' + header.map(function (c, ci) {
          return '<th data-source-line="' + (headerLine + offset) + '" data-col="' + ci + '">' + inlineRender(c.trim()) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        html += rows.map(function (r) {
          return '<tr>' + r.cells.map(function (c, ci) {
            return '<td data-source-line="' + (r.line + offset) + '" data-col="' + ci + '">' + inlineRender(c.trim()) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        html += '</tbody></table>';
        continue;
      }

      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const parsed = builtinParseList(lines, i, offset);
        html += parsed.html;
        i = parsed.next;
        continue;
      }

      const startLine = i;
        const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' &&
             !/^(#{1,6})\s/.test(lines[i]) &&
             !/^\s*```/.test(lines[i]) &&
             !/^\s*>\s?/.test(lines[i]) &&
             !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      html += '<p data-source-line="' + (startLine + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + buf.map(function (l) {
        return inlineRender(l);
      }).join('<br>') + '</p>';
    }
    return html;
  }

  // ---------- Markdown 解析 ----------
  let md = null;

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


  // ---------- PDF 水印 logo ----------
  // 第一页右上角印项目 logo。
  //
  // 为什么在导出前把 logo 读成 data URL：
  //   导出时 PDF 的 HTML 会写到临时文件、以 file:// 打开，相对路径 `hutao.jpg`
  //   在那种上下文里取不到；内联后文档完全自包含（与正文图片 inlineImagesForExport 同理）。
  //
  // 为什么用预生成的小图 hutao-logo-300.jpg 而不是原图 hutao.jpg：
  //   水印只显示 14mm 宽，原图却是 1022x1022 / 127KB，base64 后 169KB。
  //   每次导出都要读它、再在浏览器里用 canvas 缩放，纯属浪费。
  //   hutao-logo-300.jpg 是预先缩好的 300x300 / 26KB（base64 约 34KB），
  //   体积只有原图的 1/5，且 300px 覆盖 14mm@300dpi（约 165px）还留了余量。
  //   有了它，运行时只需一次 FileReader，不再需要 canvas 缩放那一步。
  //
  // 为什么还保留 canvas 缩放分支：
  //   万一小图缺失（用户误删），回退到原图时仍然需要缩放，
  //   所以 downscaleLogoBlob 保留下来作为回退路径，而不是直接删掉。
  var _pdfLogoDataUrl = null;   // 成功读到后缓存，避免每次导出都重新读一遍
  var PDF_LOGO_SRC = 'hutao-logo-300.jpg';   // 预生成的小图（首选）
  var PDF_LOGO_SRC_FULL = 'hutao.jpg';       // 原图（小图读不到时的回退）
  var PDF_LOGO_MAX_PX = 300;                 // 回退缩放时的最长边上限

  function loadPdfLogo(callback) {
    if (_pdfLogoDataUrl) { callback(_pdfLogoDataUrl); return; }
    // file:// 下 fetch 本地文件会被浏览器拦截，此时优雅降级为「不印水印」，
    // 而不是让整个导出失败（导出 PDF 本来就需要走本地服务器）
    function fetchAsBlob(url) {
      return fetch(url).then(function (resp) { return resp.ok ? resp.blob() : null; });
    }
    fetchAsBlob(PDF_LOGO_SRC)
      .then(function (blob) {
        if (blob) {
          // 小图已经够小，只需转成 data URL，不必再缩放
          return new Promise(function (resolve) { blobToDataUrl(blob, resolve); });
        }
        // 小图不在（例如用了旧版本留下的文件），回退到原图 + canvas 缩放
        return fetchAsBlob(PDF_LOGO_SRC_FULL).then(function (fullBlob) {
          if (!fullBlob) return null;
          return new Promise(function (resolve) {
            downscaleLogoBlob(fullBlob, resolve);
          });
        });
      })
      .then(function (dataUrl) {
        if (dataUrl && /^data:image\//.test(dataUrl)) _pdfLogoDataUrl = dataUrl;
        callback(dataUrl || null);
      })
      .catch(function () { callback(null); });
  }

  // Blob → data URL。任何失败都回调 null（调用方会降级为「不印水印」）。
  function blobToDataUrl(blob, callback) {
    try {
      var reader = new FileReader();
      reader.onload = function () { callback(reader.result); };
      reader.onerror = function () { callback(null); };
      reader.readAsDataURL(blob);
    } catch (e) {
      callback(null);
    }
  }

  // 把 logo 等比缩到最长边 PDF_LOGO_MAX_PX 并转成 data URL。
  // 任何一步失败都回退到「原图 data URL」；再失败则回调 null（不印水印），绝不阻断导出。
  function downscaleLogoBlob(blob, callback) {
    function toDataUrl(b, cb) {
      var reader = new FileReader();
      reader.onload = function () { cb(reader.result); };
      reader.onerror = function () { cb(null); };
      reader.readAsDataURL(b);
    }
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, PDF_LOGO_MAX_PX / Math.max(w, h));
        var tw = Math.max(1, Math.round(w * scale));
        var th = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        var ctx = canvas.getContext && canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, tw, th);
          // JPEG 有损但 logo 是插画类图片，q=0.9 肉眼无损；不支持 toDataURL 的极老环境会抛错
          var out = canvas.toDataURL('image/jpeg', 0.9);
          URL.revokeObjectURL(url);
          if (out && /^data:image\//.test(out)) { callback(out); return; }
        }
      } catch (e) {
        // 落到下面的原图回退
      }
      URL.revokeObjectURL(url);
      toDataUrl(blob, callback);   // 回退：用未经缩放的原图
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      callback(null);
    };
    img.src = url;
  }

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
      '.markdown-body img { max-width: 100%; height: auto; background-color: ' + (state.settings.imageBackground ? state.settings.imageBackgroundColor : 'transparent') + '; box-sizing: content-box; }',
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
      // body 的 padding 取与 @page 相同的页边距，并在下面用 padding-box 定位 logo：
      // 这样 body 的「外边缘」正好落在纸张的页边距分界线上，
      // logo 用 top/right 正偏移就能稳稳落在留白区里（见 .pdf-logo 与 AGENTS.md §6.16）。
      'body { margin: 0; padding: ' + L.marginV + 'mm ' + L.marginH + 'mm; background: ' + C.pdfPageBg + '; color: ' + C.pdfText + '; position: relative; box-sizing: border-box; }',
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
      /* 标题避免跨页 */
      'h1, h2, h3, h4, h5, h6 { page-break-after: avoid; }',
      /* 第一页右上角的 logo 水印（见 buildPdfDocumentHtml）：
         用 position:absolute 而**不是** fixed —— fixed 会在每一页重复，
         绝对定位元素相对「首页内容框」定位，所以天然只出现在第一页。

         定位基准是 body 的 padding-box 边缘（body 有 position:relative，
         且 padding 与 @page 页边距相同），所以 right:0 时 logo 的右边缘
         正好落在正文区右边界上、整块都在右侧留白里，不压正文。

         **不要**改用负值去「往外推」：实测（Chromium --print-to-pdf）
         负偏移会把 logo 整块推到纸张之外、完全看不见（详见 AGENTS.md §6.16）。
         top 用 2mm 是为了避开打印机通常存在的不可打印边缘。 */
      '.pdf-logo { position: absolute; top: 2mm; right: 0; }',
      '.pdf-logo img { width: 14mm; height: auto; display: block; }'
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

  // 完整独立 HTML 文档（导出 PDF 的、以及预览 iframe 里用的，是同一份构建结果）
  // logoDataUrl 为 null 时不加水印（例如 file:// 下读不到 logo 文件）
  function buildPdfDocumentHtml(bodyHtml, title, layout, colors, logoDataUrl) {
    const logoHtml = logoDataUrl
      ? '<div class="pdf-logo"><img src="' + logoDataUrl + '" alt=""></div>\n'
      : '';
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<title>' + escapeHtml(title) + '</title>\n' +
      '<style>\n' + buildPdfCss(layout, colors) + '\n</style>\n' +
      '</head>\n<body>\n' +
      logoHtml +
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
      // logo 也要先读成 data URL 才能随文档一起走（见 loadPdfLogo）
      loadPdfLogo(function (logoDataUrl) {
        // 版式取自 PDF 主题（state.pdfLayout），与阅读器字号 state.settings 无关
        var html = buildPdfDocumentHtml(bodyHtml, title, state.pdfLayout, state.pdfColors, logoDataUrl);

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
      // 抽屉内的即时预览同样带上水印 logo，保证「预览 = 导出」外观一致
      loadPdfLogo(function (logoDataUrl) {
        frame.srcdoc = buildPdfDocumentHtml(bodyHtml, 'PDF 预览', state.pdfLayout, state.pdfColors, logoDataUrl);
      });
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
      loadPdfLogo(function (logoDataUrl) {
      const html = buildPdfDocumentHtml(bodyHtml, 'PDF 预览', state.pdfLayout, state.pdfColors, logoDataUrl);
      if (status) status.textContent = '正在生成…（浏览器渲染通常需要 1–3 秒）';
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
