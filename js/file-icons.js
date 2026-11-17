/* ============================================================
 * 文件类型图标子配置
 *
 * 为不同类型的文件生成内联 SVG 图标：
 *   - 文档形状（圆角矩形 + 右上角卷边）
 *   - 中央显示语言缩写
 *   - 右下角显示文件后缀标签
 *
 * 设计参考：生成Python文件图标.png（蓝黄配色的 PY 文档图标）
 *
 * 通过 window.MD_FILE_ICON_HTML(name) 暴露给 js/app.js 使用。
 * 图标内联在 HTML 中，无需外部图片资源，离线可用。
 * ============================================================ */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  // ---------- 文件后缀 → 图标定义 ----------
  // abbr: 中央大字缩写
  // label: 右下角后缀标签（不含点）
  // c1: 主色（描边 + 缩写 + 标签）
  // c2: 点缀色（缩写渐变/装饰）
  var ICON_DEFS = {
    // Markdown 家族
    md:       { abbr: 'MD',  label: 'md',   c1: '#2D73CC', c2: '#4A9EFF' },
    markdown: { abbr: 'MD',  label: 'md',   c1: '#2D73CC', c2: '#4A9EFF' },
    mdown:    { abbr: 'MD',  label: 'md',   c1: '#2D73CC', c2: '#4A9EFF' },
    mkd:      { abbr: 'MD',  label: 'md',   c1: '#2D73CC', c2: '#4A9EFF' },
    txt:      { abbr: 'TXT', label: 'txt',  c1: '#6E7781', c2: '#98A1AB' },

    // Python
    py:       { abbr: 'PY',  label: 'py',   c1: '#2D73CC', c2: '#FFD100' },

    // Web
    js:       { abbr: 'JS',  label: 'js',   c1: '#B8860B', c2: '#F7DF1E' },
    javascript: { abbr: 'JS', label: 'js',  c1: '#B8860B', c2: '#F7DF1E' },
    ts:       { abbr: 'TS',  label: 'ts',   c1: '#1E5AA8', c2: '#3178C6' },
    jsx:      { abbr: 'JSX', label: 'jsx',  c1: '#1E5AA8', c2: '#61DAFB' },
    tsx:      { abbr: 'TSX', label: 'tsx',  c1: '#1E5AA8', c2: '#61DAFB' },
    html:     { abbr: 'HTML', label: 'html', c1: '#C1440E', c2: '#E34F26' },
    htm:      { abbr: 'HTML', label: 'htm', c1: '#C1440E', c2: '#E34F26' },
    css:      { abbr: 'CSS', label: 'css',  c1: '#1E5AA8', c2: '#2965F1' },
    scss:     { abbr: 'SCSS', label: 'scss', c1: '#B02A6B', c2: '#CF649A' },
    vue:      { abbr: 'VUE', label: 'vue',  c1: '#2E7D52', c2: '#42B883' },

    // 数据 / 配置
    json:     { abbr: 'JSON', label: 'json', c1: '#6B6B00', c2: '#CBCB41' },
    yaml:     { abbr: 'YML', label: 'yaml', c1: '#8B1A1A', c2: '#CB171E' },
    yml:      { abbr: 'YML', label: 'yml',  c1: '#8B1A1A', c2: '#CB171E' },
    toml:     { abbr: 'TOML', label: 'toml', c1: '#7A4B00', c2: '#9C6ADE' },
    ini:      { abbr: 'INI', label: 'ini',  c1: '#4A5568', c2: '#718096' },
    conf:     { abbr: 'CONF', label: 'conf', c1: '#4A5568', c2: '#718096' },
    cfg:      { abbr: 'CONF', label: 'cfg', c1: '#4A5568', c2: '#718096' },
    xml:      { abbr: 'XML', label: 'xml',  c1: '#2E6B2E', c2: '#4CAF50' },

    // 数据库
    sql:      { abbr: 'SQL', label: 'sql',  c1: '#1A5C8A', c2: '#00758F' },
    db:       { abbr: 'DB',  label: 'db',   c1: '#1A5C8A', c2: '#00758F' },

    // Shell / 脚本
    sh:       { abbr: 'SH',  label: 'sh',   c1: '#2E6B2E', c2: '#4EAA25' },
    bash:     { abbr: 'SH',  label: 'bash', c1: '#2E6B2E', c2: '#4EAA25' },
    zsh:      { abbr: 'SH',  label: 'zsh',  c1: '#2E6B2E', c2: '#4EAA25' },
    ps1:      { abbr: 'PS1', label: 'ps1',  c1: '#1E5AA8', c2: '#5391FE' },
    bat:      { abbr: 'BAT', label: 'bat',  c1: '#4A5568', c2: '#718096' },
    cmd:      { abbr: 'CMD', label: 'cmd',  c1: '#4A5568', c2: '#718096' },

    // 编译型语言
    java:     { abbr: 'JAVA', label: 'java', c1: '#B07219', c2: '#E76F00' },
    c:        { abbr: 'C',   label: 'c',    c1: '#1E5AA8', c2: '#5C6BC0' },
    h:        { abbr: 'H',   label: 'h',    c1: '#1E5AA8', c2: '#5C6BC0' },
    cpp:      { abbr: 'C++', label: 'cpp',  c1: '#1E5AA8', c2: '#00599C' },
    cc:       { abbr: 'C++', label: 'cc',   c1: '#1E5AA8', c2: '#00599C' },
    hpp:      { abbr: 'C++', label: 'hpp',  c1: '#1E5AA8', c2: '#00599C' },
    cs:       { abbr: 'C#',  label: 'cs',   c1: '#4B2E83', c2: '#68217A' },
    go:       { abbr: 'GO',  label: 'go',   c1: '#0E7490', c2: '#00ADD8' },
    rs:       { abbr: 'RS',  label: 'rs',   c1: '#8B4513', c2: '#DEA584' },
    php:      { abbr: 'PHP', label: 'php',  c1: '#4B4B8B', c2: '#777BB4' },
    rb:       { abbr: 'RB',  label: 'rb',   c1: '#8B1A1A', c2: '#CC342D' },
    swift:    { abbr: 'SWIFT', label: 'swift', c1: '#C1440E', c2: '#F05138' },
    kt:       { abbr: 'KT',  label: 'kt',   c1: '#5B2E8B', c2: '#7F52FF' },
    scala:    { abbr: 'SCALA', label: 'scala', c1: '#8B1A1A', c2: '#DC322F' },
    lua:      { abbr: 'LUA', label: 'lua',  c1: '#1A3A8A', c2: '#000080' },
    pl:       { abbr: 'PL',  label: 'pl',   c1: '#1A4A8A', c2: '#39457E' },

    // 运维 / 配置类
    nginx:    { abbr: 'NGX', label: 'conf', c1: '#1E6B3A', c2: '#009639' },
    apache:   { abbr: 'APA', label: 'conf', c1: '#8B1A1A', c2: '#D22128' },
    dockerfile: { abbr: 'DOCK', label: 'docker', c1: '#1A5C8A', c2: '#2496ED' },
    docker:   { abbr: 'DOCK', label: 'docker', c1: '#1A5C8A', c2: '#2496ED' },
    tf:       { abbr: 'TF',  label: 'tf',   c1: '#5B2E8B', c2: '#7B42BC' },
    promql:   { abbr: 'PQL', label: 'promql', c1: '#C1440E', c2: '#E6522C' },

    // 文档 / 其他
    log:      { abbr: 'LOG', label: 'log',  c1: '#6E7781', c2: '#98A1AB' },
    csv:      { abbr: 'CSV', label: 'csv',  c1: '#2E6B2E', c2: '#4CAF50' },
    rtf:      { abbr: 'RTF', label: 'rtf',  c1: '#6E7781', c2: '#98A1AB' },
    pdf:      { abbr: 'PDF', label: 'pdf',  c1: '#B02A2A', c2: '#E53935' },
    zip:      { abbr: 'ZIP', label: 'zip',  c1: '#7A4B00', c2: '#B8860B' }
  };

  // 特殊文件名（无后缀）
  var SPECIAL_NAMES = {
    'dockerfile': ICON_DEFS.dockerfile,
    'makefile':   { abbr: 'MK',  label: 'make', c1: '#4A5568', c2: '#718096' },
    'readme':     ICON_DEFS.md,
    'license':    ICON_DEFS.txt,
    'changelog':  ICON_DEFS.md
  };

  // 默认图标（未知类型）
  var DEFAULT_ICON = { abbr: '', label: '', c1: '#6E7781', c2: '#98A1AB' };

  // ---------- 取文件扩展名 ----------
  function getExt(name) {
    var lower = String(name || '').toLowerCase();
    // 特殊文件名优先
    var base = lower.replace(/^.*[\\/]/, '');
    if (SPECIAL_NAMES[base]) return null;   // 由 getIconDef 处理
    var idx = lower.lastIndexOf('.');
    if (idx < 0 || idx === lower.length - 1) return '';
    return lower.slice(idx + 1);
  }

  // ---------- 查表取得图标定义 ----------
  function getIconDef(name) {
    var lower = String(name || '').toLowerCase();
    var base = lower.replace(/^.*[\\/]/, '');

    // 1. 特殊文件名（Dockerfile / Makefile / README 等）
    if (SPECIAL_NAMES[base]) return SPECIAL_NAMES[base];

    // 2. 复合后缀（例如 .tar.gz、config.json 之类先按主后缀）
    var ext = getExt(name);
    if (ext && ICON_DEFS[ext]) return ICON_DEFS[ext];

    // 3. 无后缀的 Markdown 惯例文件名
    if (!ext) {
      if (/^readme/.test(base) || /^changelog/.test(base)) return ICON_DEFS.md;
      if (/^license/.test(base)) return ICON_DEFS.txt;
    }

    return DEFAULT_ICON;
  }

  // ---------- 生成 SVG 图标 ----------
  // 文档形状：圆角矩形 + 右上角卷边
  // viewBox 18x20，在 16px 显示尺寸下保持清晰
  function buildSvg(def) {
    var c1 = def.c1;
    var c2 = def.c2;
    var abbr = def.abbr || '';
    var label = def.label || '';

    // 缩写字号：按长度自动收缩，避免超出文档宽度
    var abbrSize = abbr.length <= 2 ? 7.4 : (abbr.length === 3 ? 6.0 : 4.8);
    // 缩写基线位置
    var abbrY = abbr.length <= 3 ? 9.6 : 9.2;

    var parts = [];

    parts.push('<svg class="file-icon-svg" viewBox="0 0 18 20" width="16" height="18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">');

    // 文档主体：圆角矩形，右上角留出卷边缺口
    // 路径：从左上开始，顺时针，到右上角前折出翻页效果
    parts.push('<path d="M2.6 1.4 H11.6 L15.4 5.2 V17.4 A1.2 1.2 0 0 1 14.2 18.6 H2.6 A1.2 1.2 0 0 1 1.4 17.4 V2.6 A1.2 1.2 0 0 1 2.6 1.4 Z" ' +
      'fill="#ffffff" stroke="' + c1 + '" stroke-width="1.1" stroke-linejoin="round"/>');

    // 右上角卷边：小三角
    parts.push('<path d="M11.6 1.4 L15.4 5.2 H12.4 A0.8 0.8 0 0 1 11.6 4.4 Z" ' +
      'fill="' + c2 + '" fill-opacity="0.28" stroke="' + c1 + '" stroke-width="1.1" stroke-linejoin="round"/>');

    // 中央缩写文字
    if (abbr) {
      parts.push('<text x="8.3" y="' + abbrY + '" text-anchor="middle" ' +
        'font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="' + abbrSize + '" ' +
        'font-weight="700" fill="' + c1 + '" letter-spacing="-0.2">' + escapeXml(abbr) + '</text>');
    }

    // 右下角后缀标签
    if (label) {
      parts.push('<text x="14.6" y="17.2" text-anchor="end" ' +
        'font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="3.4" ' +
        'font-weight="600" fill="' + c1 + '" fill-opacity="0.85">.' + escapeXml(label) + '</text>');
    }

    parts.push('</svg>');
    return parts.join('');
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---------- 缓存（同一后缀只生成一次） ----------
  var _cache = {};

  function iconHtml(name) {
    var key = String(name || '');
    // 用扩展名做缓存键（同类文件图标相同）
    var ext = getExt(key);
    var base = key.toLowerCase().replace(/^.*[\\/]/, '');
    var cacheKey = SPECIAL_NAMES[base] ? base : (ext || '');
    if (_cache[cacheKey]) return _cache[cacheKey];
    var html = buildSvg(getIconDef(name));
    _cache[cacheKey] = html;
    return html;
  }

  // ---------- 暴露接口 ----------
  window.MD_FILE_ICON_HTML = iconHtml;
  window.MD_FILE_ICON_DEFS = ICON_DEFS;
})();
