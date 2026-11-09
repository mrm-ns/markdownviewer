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
