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

  function isMarkdownFile(name) {
    return /\.(md|markdown|mdown|mkd|txt)$/i.test(name);
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
    strong: '#1f2328',
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
        strong: '#e6edf3',
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
        strong: '#abb2bf',
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
        strong: '#f8f8f2',
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
        strong: '#586e75',
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
        strong: '#c9d1d9',
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
    theme: completeTheme({ name: 'github-light', isDark: false, colors: {} }),
    search: '',
    settings: { textSize: 16, codeSize: 13.5, inlineCodeSize: 12 },
    imageMap: {},       // path -> objectURL，用于相对路径图片
    dirHandle: null,    // File System Access API 的当前目录句柄
    userThemes: []      // 用户导入的主题，会出现在预设下拉框中
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
    const combined = '(' + rules.map(function (r) { return r.pattern.source; }).join(')|(') + ')';
    const regex = new RegExp(combined, 'gim');
    let result = '';
    let last = 0;
    let m;
    while ((m = regex.exec(code)) !== null) {
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
    { className: 'comment', pattern: /#[^\n]*/ },
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
    if (/^\s*\{[\s\S]*"\s*:\s*/.test(s) || (/^\s*\[/.test(s) && /"\s*:/.test(s))) return 'json';
    if (/^\s*[A-Za-z_][A-Za-z0-9_.-]*:\s+\S+/m.test(s) && !/\bdef\s+\w+\s*\(/.test(s)) return 'yaml';
    if (/\bdef\s+\w+\s*\(/.test(s) || (/\bimport\s+\w+/.test(s) && /:\s*$/.test(s))) return 'python';
    if (/\bfunction\s+\w+\s*\(|=>|\bconst\s+\w+\s*=/.test(s)) return 'javascript';
    if (/^\s*#!\/bin\/bash|\becho\s+|\bsudo\s+/.test(s)) return 'bash';
    if (/^\s*(server\s*\{|location\s+)/m.test(s)) return 'nginx';
    return '';
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
        yaml: []
    };
    return fallback[name] || [];
  }

  function highlightCode(code, lang) {
    const l = (lang || detectLanguage(code) || '').toLowerCase();
    if (l === 'keepalived' || l === 'lvs' || l.indexOf('keepalived') === 0) return highlightWithRules(code, getSyntaxRules('keepalived'));
    if (l === 'python' || l === 'py' || l.indexOf('python') === 0) return highlightWithRules(code, getSyntaxRules('python'));
    if (l === 'javascript' || l === 'js' || l === 'node' || l === 'nodejs' || l.indexOf('javascript') === 0) return highlightWithRules(code, getSyntaxRules('javascript'));
    if (l === 'json' || l.indexOf('json') === 0) return highlightWithRules(code, getSyntaxRules('json'));
    if (l === 'bash' || l === 'shell' || l === 'sh' || l === 'zsh' || l === 'ksh' || l === 'console' || l === 'terminal') return highlightWithRules(code, getSyntaxRules('bash'));
    if (l === 'ini') return highlightWithRules(code, getSyntaxRules('ini'));
    if (l === 'nginx' || l === 'conf' || l === 'config' || l === 'cfg') return highlightWithRules(code, getSyntaxRules('conf'));
    if (l === 'yaml' || l === 'yml') return highlightWithRules(code, getSyntaxRules('yaml'));
    return escapeHtml(code);
  }

  // ---------- 工作区内部跳转（顶层定义，避免被错误嵌套） ----------
  function slugify(text) {
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


  function builtinInline(text) {
    let s = text;
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<img src="$2" alt="$1">');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g, '<a href="$2">$1</a>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    return s;
  }

  function builtinTableRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
  }

  function builtinParseList(lines, start) {
    const ordered = /^\s*\d+\.\s+/.test(lines[start]);
    const items = [];
    let i = start;
    const markerRe = ordered ? /^(\s*)\d+\.\s+(.*)$/ : /^(\s*)[-*+]\s+(.*)$/;
    while (i < lines.length) {
      const m = lines[i].match(markerRe);
      if (!m) break;
      const content = m[2];
      const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
      let inner;
      if (task) {
        const checked = task[1] !== ' ' ? ' checked' : '';
        inner = '<input type="checkbox" disabled' + checked + '> ' + builtinInline(escapeHtml(task[2]));
      } else {
        inner = builtinInline(escapeHtml(content));
      }
      items.push('<li>' + inner + '</li>');
      i++;
    }
    const tag = ordered ? 'ol' : 'ul';
    return { html: '<' + tag + '>' + items.join('') + '</' + tag + '>', next: i };
  }

  function builtinMarkdown(text) {
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      const fence = line.match(/^\s*```([^\s]*)?\s*$/);
      if (fence) {
        const lang = (fence[1] || '').trim();
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        html += '<pre><code class="hljs language-' + escapeHtml(lang) + '">' + highlightCode(buf.join('\n'), lang) + '</code></pre>';
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const headingId = slugify(heading[2]);
          html += '<h' + level + ' id="' + escapeHtml(headingId) + '">' + builtinInline(escapeHtml(heading[2])) + '</h' + level + '>';
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += '<hr>';
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + builtinMarkdown(buf.join('\n')) + '</blockquote>';
        continue;
      }

      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:\-|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const header = builtinTableRow(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          rows.push(builtinTableRow(lines[i]));
          i++;
        }
        html += '<table><thead><tr>' + header.map(function (c) {
          return '<th>' + builtinInline(escapeHtml(c.trim())) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        html += rows.map(function (r) {
          return '<tr>' + r.map(function (c) {
            return '<td>' + builtinInline(escapeHtml(c.trim())) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        html += '</tbody></table>';
        continue;
      }

      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const parsed = builtinParseList(lines, i);
        html += parsed.html;
        i = parsed.next;
        continue;
      }

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
      html += '<p>' + buf.map(function (l) {
        return builtinInline(escapeHtml(l));
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



  function renderMarkdown(text) {
    const container = document.getElementById('markdown-body');
    const welcome = document.getElementById('welcome');
    if (text == null) {
      container.innerHTML = '';
      welcome.style.display = '';
      return;
    }
    welcome.style.display = 'none';
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
    });

    // 若 markdown-it 的 highlight 没生效（例如语言为空），再统一做一次高亮
    if (false) {
      container.querySelectorAll('pre code').forEach(function (block) {
        if (!block.dataset.highlighted) {
          try {
            window.hljs.highlightElement(block);
          } catch (e) {
            // ignore
          }
        }
      });
    }

    // 没有 highlight.js 时，用内置高亮器兜底
    if (true) {
      container.querySelectorAll('pre code').forEach(function (block) {
        const langMatch = block.className.match(/language-([\w-]+)/);
        const lang = langMatch ? langMatch[1] : '';
        block.classList.add('hljs');
        block.innerHTML = highlightCode(block.textContent, lang);
      });
    }

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
  function indexFiles(fileList) {
    resetImageMap();
    state.dirHandle = null;

    const files = [];
    const imageMap = {};
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const path = file.webkitRelativePath || file.name;
      if (isMarkdownFile(file.name)) {
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
      openFile(files[0]);
      toast('已加载 ' + files.length + ' 个文档');
    } else {
      toast('没有找到 Markdown 文件');
    }
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

  function indexWrappedFiles(wrapped) {
    resetImageMap();

    const files = [];
    const imageMap = {};
    wrapped.forEach(function (item) {
      if (isMarkdownFile(item.name)) {
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
      openFile(files[0]);
      toast('已加载 ' + files.length + ' 个文档');
    } else {
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
    if (state.dirHandle) {
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
    state.files.sort(function (a, b) {
      return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
    });
    renderTree();
    toast(renamedOnDisk ? '已重命名（磁盘+列表）' : '已重命名（仅当前列表）');
    return true;
  }


  function renderTree() {
    const container = document.getElementById('file-tree');
    const emptyTip = document.getElementById('empty-tip');
    const countEl = document.getElementById('file-count');
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
    container.innerHTML = renderNode(buildTree(filtered));
  }

  function renderNode(node) {
    let html = '<ul class="tree">';
    node.children.forEach(function (child) {
      const childHtml = renderNode(child);
      html += '<li>' +
        '<div class="folder-label" title="点击折叠/展开">📁 ' + escapeHtml(child.name) + '</div>' +
        '<div class="folder-children">' + childHtml + '</div>' +
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

  async function openFile(item) {
    if (!item || !item.file) return;
    try {
      const text = await readFileText(item.file);
      state.currentPath = item.path;
      renderMarkdown(text);
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
    if (!window.showDirectoryPicker) return false;
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
        state.dirHandle = handle;

      try {
        await saveDefaultDirectoryHandle(handle);
      } catch (e) {
        console.warn('保存默认目录失败', e);
      }
      const wrapped = await listFilesFromDirectoryHandle(handle, '');
      indexWrappedFiles(wrapped);
      toast('已打开并保存为默认目录');
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return true;
      console.error(e);
      return false;
    }
  }

  async function restoreDefaultDirectory() {
    try {
      const handle = await getDefaultDirectoryHandle();
      if (!handle) return;
        state.dirHandle = handle;

      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') return;
      const wrapped = await listFilesFromDirectoryHandle(handle, '');
      if (wrapped.length) {
        indexWrappedFiles(wrapped);
        toast('已自动打开默认目录');
      }
    } catch (e) {
      console.warn('恢复默认目录失败', e);
    }
  }

  async function openDefaultDirectoryManually() {
    try {
      const handle = await getDefaultDirectoryHandle();
      if (!handle) {
        toast('还没有设置默认目录');
        return;
      }
        state.dirHandle = handle;

      let permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        permission = await handle.requestPermission({ mode: 'readwrite' });
      }
      if (permission !== 'granted') {
        toast('未获得默认目录访问权限');
        return;
      }
      const wrapped = await listFilesFromDirectoryHandle(handle, '');
      indexWrappedFiles(wrapped);
      toast('已打开默认目录');
    } catch (e) {
      console.error(e);
      toast('打开默认目录失败');
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
      customCSS: state.theme.customCSS || ''
    };
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
            inlineCodeSize: Number(parsed.inlineCodeSize) || 12
        };
      }
    } catch (e) {
      // ignore
    }
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
  }

  function renderSettingsEditor() {
    const textInput = document.getElementById('text-size');
    const codeInput = document.getElementById('code-size');
    const inlineCodeInput = document.getElementById('inline-code-size');
    if (textInput) textInput.value = state.settings.textSize;
    if (codeInput) codeInput.value = state.settings.codeSize;
    if (inlineCodeInput) inlineCodeInput.value = state.settings.inlineCodeSize;
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
    theme.colors = readColorEditor();
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
  function renderThemeEditor() {
    const container = document.getElementById('color-editor');
    const theme = state.theme;
    document.getElementById('theme-preset').value = theme.name;
    document.getElementById('theme-dark-toggle').checked = theme.isDark;
    const customCssEl = document.getElementById('custom-css');
    if (customCssEl) customCssEl.value = theme.customCSS || '';

    container.innerHTML = COLOR_DEFS.map(function (def) {
      const key = def[0];
      const value = theme.colors[key] || BASE_COLORS[key];
      return '' +
        '<div class="color-row">' +
          '<span class="color-name" title="' + escapeHtml(key) + '">' + escapeHtml(def[1]) + '</span>' +
          '<input type="color" data-color-key="' + escapeHtml(key) + '" value="' + escapeHtml(toHex(value)) + '">' +
          '<input type="text" data-text-key="' + escapeHtml(key) + '" value="' + escapeHtml(value) + '" spellcheck="false">' +
        '</div>';
    }).join('');
  }

  function readColorEditor() {
    const colors = {};
    document.querySelectorAll('[data-color-key]').forEach(function (input) {
      const key = input.getAttribute('data-color-key');
      const textInput = document.querySelector('[data-text-key="' + key + '"]');
      colors[key] = textInput ? textInput.value.trim() : input.value;
    });
    return colors;
  }

  function toHex(value) {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
    // 简单转换为灰色，避免 color input 报错
    return '#cccccc';
  }

  function openDrawer() {
    document.getElementById('theme-drawer').classList.add('open');
    document.getElementById('theme-drawer').setAttribute('aria-hidden', 'false');
    renderThemeEditor();
    renderSettingsEditor();
  }

  function closeDrawer() {
    document.getElementById('theme-drawer').classList.remove('open');
    document.getElementById('theme-drawer').setAttribute('aria-hidden', 'true');
  }

  // ---------- 初始化 ----------
  function bindEvents() {
    const fileInput = document.getElementById('file-input');
    const folderInput = document.getElementById('folder-input');
    const themeInput = document.getElementById('theme-input');

    document.getElementById('btn-open-file').addEventListener('click', function () {
      fileInput.value = '';
      fileInput.click();
    });

    document.getElementById('btn-open-folder').addEventListener('click', async function () {
      const handled = await openDirectoryPicker();
        if (!handled) {
          folderInput.value = '';
      folderInput.click();
        }
    });

      const restoreDefaultBtn = document.getElementById('btn-restore-default');
      if (restoreDefaultBtn) {
        restoreDefaultBtn.addEventListener('click', openDefaultDirectoryManually);
      }


    document.getElementById('btn-theme').addEventListener('click', openDrawer);
    document.getElementById('btn-close-theme').addEventListener('click', closeDrawer);
    document.getElementById('drawer-mask').addEventListener('click', closeDrawer);

    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) indexFiles(fileInput.files);
    });

    folderInput.addEventListener('change', function () {
      if (folderInput.files.length) indexFiles(folderInput.files);
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
      if (target.matches('[data-color-key]')) {
        const key = target.getAttribute('data-color-key');
        const textInput = document.querySelector('[data-text-key="' + key + '"]');
        if (textInput) textInput.value = target.value;
      } else if (target.matches('[data-text-key]')) {
        const key = target.getAttribute('data-text-key');
        const colorInput = document.querySelector('[data-color-key="' + key + '"]');
        if (colorInput && /^#[0-9a-fA-F]{6}$/.test(target.value)) {
          colorInput.value = target.value;
        }
      }
      saveCurrentTheme();
    });

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



    document.getElementById('search-box').addEventListener('input', debounce(function (e) {
      state.search = e.target.value.trim();
      renderTree();
    }, 150));

    document.getElementById('file-tree').addEventListener('click', function (e) {
      const folderLabel = e.target.closest('.folder-label');
      if (folderLabel) {
        const children = folderLabel.nextElementSibling;
        if (children) {
          children.style.display = children.style.display === 'none' ? '' : 'none';
        }
        return;
      }
      const fileItem = e.target.closest('.file-item');
      if (fileItem) {
        openFileByPath(fileItem.getAttribute('data-path'));
      }
    });

      // 文档列表右键菜单
      const contextMenu = document.getElementById('context-menu');
      let contextTargetPath = null;

      function showContextMenu(x, y) {
        if (!contextMenu) return;
        contextMenu.hidden = false;
        contextMenu.style.left = Math.min(x, window.innerWidth - 160) + 'px';
        contextMenu.style.top = Math.min(y, window.innerHeight - 60) + 'px';
      }

      function hideContextMenu() {
        if (contextMenu) contextMenu.hidden = true;
        contextTargetPath = null;
      }

      document.getElementById('file-tree').addEventListener('contextmenu', function (e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        e.preventDefault();
        contextTargetPath = fileItem.getAttribute('data-path');
        showContextMenu(e.clientX, e.clientY);
      });

      if (contextMenu) {
        contextMenu.addEventListener('click', function (e) {
          const btn = e.target.closest('#ctx-rename');
          if (!btn) return;
          const targetPath = contextTargetPath;
          hideContextMenu();
          if (!targetPath) return;
          const item = state.files.find(function (f) { return f.path === targetPath; });
          if (!item) return;
          const newName = window.prompt('请输入新的文件名：', item.name);
          if (newName) renameFile(targetPath, newName);
        });
      }

      window.addEventListener('click', function () {
        hideContextMenu();
      });
      window.addEventListener('blur', function () {
        hideContextMenu();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') hideContextMenu();
      });


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
          }
        });
      }


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
            state.dirHandle = null;

            indexWrappedFiles(wrapped);
            return;

          const mdWrapped = wrapped.filter(function (w) { return isMarkdownFile(w.name); });
          if (mdWrapped.length) {
            state.files = mdWrapped.sort(function (a, b) {
              return a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' });
            });
            renderTree();
            openFile(state.files[0]);
            toast('已加载 ' + state.files.length + ' 个文档');
          } else {
            toast('没有找到 Markdown 文件');
          }
          return;
        }
      }
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) indexFiles(files);
    });

    // 快捷键
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        fileInput.click();
      }
    });
  }

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
    console.log('[Markdown Viewer] 离线渲染器已启用 (v6.8)');
    registerCustomLanguages();
    initMarkdown();
    loadSettings();
    applySettings();
    loadUserThemes();
    renderThemePresets();
    restoreTheme();
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
