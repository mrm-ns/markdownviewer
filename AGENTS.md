# AI / 开发者协作开发流程

本文档供其他 AI 模型或开发者快速理解本项目，并安全地进行功能扩展。

## 1. 项目定位

Markdown Viewer 是一个纯前端、离线可用的 Markdown 文档浏览器。

- 不依赖 CDN
- 不依赖 Node.js / npm
- 只需要现代浏览器
- 可选 Python 用于本地服务器、备份、打包

## 2. 项目结构

```text
markdownviewer/
├── index.html              # 页面入口
├── app.js                  # 主入口：图标校验 + 自动加载 js/ 子配置
├── css/style.css           # 所有样式
├── src/                    # 核心逻辑的源片段（v1.1.0 起，改这里！见 §6.8）
│   ├── 00-header.js        # 文件头 + IIFE 开场
│   ├── 10-core-util.js     # 工具函数（escapeHtml / toast / debounce / isCodeFile …）
│   ├── 11-core-theme-def.js # 主题定义 + PDF 版式定义（纯数据，无依赖）
│   ├── 12-core-state.js    # 全局状态 state + 自定义语言注册
│   ├── 20-core-markdown.js # 内置 Markdown 渲染器（含代码高亮引擎）
│   ├── 21-core-anchor.js   # 工作区内部跳转（锚点解析）
│   ├── 22-core-inline-html.js # 内联 HTML 标签支持（<font color> / <br>）
│   ├── 23-core-parse.js    # Markdown 解析 + 原生 HTML 图片 + 导出 HTML/PDF 构建
│   ├── 24-core-files.js    # 文件索引与树 + 全文搜索扫描 + 侧边栏 + 搜索跳转
│   ├── 30-core-fence.js    # 正文编辑与撤销 + 选中着色 + 编辑器聚焦
│   ├── 31-core-block.js    # 围栏行解析 + 插入 / 缩进 / 删除
│   ├── 40-ui-dir.js        # 文件夹拖拽 + 默认目录 + 缓存快照
│   ├── 50-ui-theme.js      # 主题生成/存储 + 阅读设置 + 主题编辑器 + PDF 预览
│   └── 60-ui-init.js       # 初始化 + 事件绑定（bindEvents 及 7 个功能域子函数）
├── tools/
│   ├── split_app.js        # 拼接 / 校验工具（--bundle / --checkall / --diff / --list）
│   └── units.json          # 拆分前基线清单（单元 + SHA-256，用于零改动校验）
├── js/
│   ├── app.js              # ⚠ 拼接产物，不要手改！改 src/ 后运行拼接命令（见 §6.8）
│   ├── bash.js             # Bash/Shell 高亮规则
│   ├── dockerfile.js       # Dockerfile 高亮规则（基于 Bash 扩展 Dockerfile 指令）
│   ├── ini.js              # INI 高亮规则
│   ├── conf.js             # CONF 高亮规则
│   ├── keepalived.js       # Keepalived 高亮规则
│   ├── python.js           # Python 高亮规则
│   ├── javascript.js       # JavaScript 高亮规则
│   ├── json.js             # JSON 高亮规则
│   ├── xml.js              # XML 高亮规则（含 XML 家族围栏名）
│   ├── yaml.js             # YAML 高亮规则
│   ├── text.js             # 自定义 Text 高亮规则
│   ├── apache.js           # Apache 高亮规则
│   ├── nginx.js            # Nginx 高亮规则
│   └── sql.js              # SQL 高亮规则
│   └── ....js              # 其他 高亮规则
├── themes/                 # 主题 JSON 文件
├── backup/                 # 保存备份文件
├── serve.py                # 本地静态服务器
├── add_language.py         # 自动添加新语言高亮配置
├── all_backup.py           # 完全版本备份（zip，保存到 backup/）
├── packup.py               # 环境打包（zip，生成便携版）
├── compute_icon_hash.py    # 计算图标哈希
├── update_version.py       # 自动更新版本号（改片段 → 重新拼接 → 同步 index.html）
├── start.bat / start.sh    # 启动脚本
├── CHANGELOG.md            # 更新日志（每次发布新版本必须更新）
└── README.md / ENVIRONMENT.md
```


## 2.1 主文件功能分区

### `index.html`
- 页面唯一入口
- 负责加载 `app.js`
- 包含所有 UI 结构：
  - 顶部工具栏
  - 侧边栏（文档列表 / 当前大纲）
  - 正文区域
  - 主题编辑器抽屉
  - 右键菜单
  - 上下文菜单

### `app.js`（根目录）
- 应用启动入口
- 负责：
  - 校验 `hutao.ico` 图标
  - 自动加载 `js/` 下的语法子配置
  - 加载核心逻辑 `js/app.js`
- 如果 `fetch` 不可用，会通过 `<img>` 验证图标存在并放行

### `js/app.js`（核心逻辑）
主要功能分区如下：

| 区域 | 函数 / 变量 | 说明 |
|------|------------|------|
| 主题系统 | `THEMES`、`COLOR_DEFS`、`BASE_COLORS`、`applyTheme`、`saveThemeToStorage` | 主题预设、颜色项、导入导出、自动保存 |
| 导出 PDF 主题 | `PDF_LAYOUT_DEFS`、`PDF_LAYOUT_DEFAULTS`、`normalizePdfLayout`、`buildPdfCss`、`buildPdfDocumentHtml`、`exportCurrentPdf`、`renderPdfLayoutEditor`、`refreshPdfPreview`、`generatePdfPreview` | 导出 PDF 的配色 + 版式（字号 / 行高 / 纸张与页边距 / 字体 / 标题缩放）；**版式独立于阅读器字号**；即时样式预览与真实 PDF 预览**与导出共用同一份 CSS**；硬约束见 §5.1 |
| 设置系统 | `loadSettings`、`saveSettings`、`applySettings` | 正文字号、代码字号、行内代码字号 |
| 文件系统 | `indexFiles`、`indexWrappedFiles`、`openFile`、`getFreshFile` | 打开文件/文件夹、读取最新内容 |
| 文件树 | `buildTree`、`renderTree`、`renderNode` | 侧边栏文档列表渲染 |
| 全文搜索 | `performContentSearch`、`renderSearchResults` | 在工作区所有 Markdown 文件中搜索内容；结果按文件分组折叠（文件名作可点击的组标题），展开状态存 `state.searchExpandedFiles`（Set）——搜索结果每次都会整块重建 innerHTML，状态必须放在 state 里 |
| 侧边栏 | `renderOutline`、`setSidebarTab`、`toggleSidebar` | 文档列表 / 当前大纲切换、折叠 |
| 顶部菜单 | `toggleToolbar`、`loadToolbarState` | 顶部工具栏折叠/展开 |
| Markdown 渲染 | `builtinMarkdown`、`builtinInline`、`builtinParseList` | 内置 Markdown 解析器 |
| 代码高亮 | `highlightCode`、`highlightWithRules`、`getSyntaxRules` | 根据语言规则高亮代码 |
| 图片处理 | `extractHtmlImages`、`resolveImageSrc`、`restoreHtmlImages` | 支持 HTML 图片和相对路径图片；`restoreHtmlImages_broken` 是历史死代码，勿参照 |
| 图片放大预览 | `openImageLightbox`、`closeImageLightbox` | 页面内弹层放大（`#image-lightbox`）；**不要改回 `window.open`**，见 §6.6 |
| 内部跳转 | `resolveWorkspacePath`、`scrollToAnchor` | 工作区内 Markdown 文件跳转 |
| 正文编辑 | `startEditTextElement`、`startEditCodeBlock`、`applySourceChange` | 右键编辑行/代码块 |
| 正文插入 | `computeInsertPadding`、`startInsertEditor`、`computeMenuInsertCtx` | 右键「插入」二级菜单（编辑框内可勾选「缩进一级」）；补空行判据见 §6.3 |
| 正文缩进 | `resolveIndentElement`、`computeIndentAvailability`、`buildIndentedLines`、`applyIndentBlock`、`listItemContainingLine` | 右键「缩进」二级菜单：左移/右移一个层级 = 2 个空格；入口可见性见 §6.4 |
| 撤销 | `undoLastEdit`、`state.undoStacks` | 按文件保存撤销记录 |
| 正文删除 | `deleteBlock`、`deleteSourceLines`、`isListItemLine` | 右键「🗑️ 删除」整块删除；编辑框清空一行 = 整行删除。**连带处理列表项之间的空行、但绝不吃段落之间的空行**，见 §6.7 |
| 右键菜单 | 文件树菜单、正文菜单 | 重命名、复制、编辑、插入、缩进、删除。**菜单定位必须按实测高度夹进视口**，见 §6.9 |

### `css/style.css`
- 所有样式
- 包括：
  - 布局样式
  - GitHub 风格 Markdown 样式
  - 代码块 / 行内代码样式
  - 主题抽屉样式
  - 右键菜单样式
  - 编辑框样式
  - 折叠 / 展开样式

### `js/*.js`（语法子配置）
- 每个文件定义一种或多种代码块高亮规则
- 通过 `window.MD_SYNTAX_RULES.xxx` 暴露
- 由根目录 `app.js` 自动加载

### 文件类型识别（`EXT_LANG_MAP` / `FILENAME_LANG_MAP`）
`js/app.js` 顶部维护两张映射表，决定「哪些文件能打开」以及「用哪种代码块规则显示」：

- `EXT_LANG_MAP`：扩展名 → 代码块语言（如 `txt: 'text'`、`py: 'python'`、`sh: 'bash'`）
- `FILENAME_LANG_MAP`：无扩展名的文件名 → 语言（如 `dockerfile: 'dockerfile'`）
- `getFileLang(name)` 返回语言；返回 `''` 表示不是代码文件
- `isMarkdownFile()` 只匹配 Markdown 文档；`isSupportedFile()` = Markdown 或代码文件
  （新增文件列表/快照/追加逻辑时，请用 `isSupportedFile`，不要用 `isMarkdownFile`）
- **代码文件走独立的 `renderCodeContent()` 渲染路径**，不经过 Markdown 管线，
  以免代码中的 `<img>` / `<font>` / `<br>` 字面量被当成 HTML 处理而损坏源码；
  这类代码块带 `data-code-file="1"` 标记，用于区分 Markdown 围栏代码块
- 新增一种可打开的文件类型：只需往 `EXT_LANG_MAP`（或 `FILENAME_LANG_MAP`）加一行；
  若该语言还没有高亮规则，先按 §4 新增 `js/xxx.js`

### `themes/`
- 存放主题 JSON
- 用户可导入 / 导出主题
- 导入后自动加入预设主题下拉框

### Python 脚本
| 脚本 | 功能 |
|------|------|
| `serve.py` | 本地静态服务器（`Cache-Control: no-cache`，改完刷新即生效） |
| `add_language.py` | 自动添加新的代码块高亮语言 |
| `all_backup.py` | 完整备份到 `backup/`，文件名带当前版本号 |
| `packup.py` | 生成便携版 zip，供分发部署 |
| `compute_icon_hash.py` | 计算 `hutao.ico` 的 SHA-256 |
| `update_version.py` | 更新版本号：改 `src/60-ui-init.js` → 自动拼接 → 同步 `index.html` |

### `src/` 与 `tools/`（v1.1.0 起的源码分层）
| 路径 | 功能 |
|------|------|
| `src/*.js` | 核心逻辑的**源片段**（14 个），改核心逻辑改这里。详见 §6.8 |
| `js/app.js` | ⚠ **拼接产物**，由 `src/` 生成，不要手改 |
| `tools/split_app.js` | 拼接与校验工具：`--bundle` / `--diff` / `--checkall` / `--list` |
| `tools/units.json` | 拆分前的基线清单（单元名 + SHA-256），用于零改动校验 |

## 3. 核心启动流程

1. 用户打开 `index.html`
2. 浏览器加载根目录 `app.js`
3. `app.js` 校验 `hutao.ico` 哈希（失败可跳过，见代码注释）
4. `app.js` 依次加载 `js/` 下的语法子配置
5. 最后加载 `js/app.js` 核心逻辑
6. `js/app.js` 初始化 Markdown 渲染器、主题、侧边栏、搜索等

## 4. 如何新增一种代码块语言

### 4.1 创建规则文件

在 `js/` 下新建 `xxx.js`，格式如下：

```js
/* XXX 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.xxx = [
    { className: 'comment', pattern: /#.*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:KEY1|KEY2|KEY3)\b/i }
  ];
})();
```

写规则时有三条硬约束（踩过坑，务必守住）：

1. **不许出现捕获组**。`highlightWithRules` 把各 `pattern.source` 用 `)|(` 拼成一个正则，
   再用 `m[i+1]` 判断命中了第几条规则；多一个捕获组会让其后所有规则**整体错位**，
   颜色会张冠李戴。分组一律写 `(?:...)`。可参考 `js/xml.js` 里统计捕获组的自检写法。
2. **规则顺序即优先级**。整体是「最左优先、同位置先列出者胜出」的扫描。
   例如 XML 里注释 `<!--...-->`、CDATA、`<?xml ?>` 都必须排在标签规则**之前**，
   否则开头的 `<` 会先被标签规则吃掉，后面的内容就串色了。
3. **不要写能匹配空串的规则**（如单独的 `\b`）。零长度匹配会被引擎跳过，达不到预期效果。

**一条规则只能给整段匹配上一种颜色**（`m[i+1]` 命中的是整个匹配），想让「同一处结构的不同部分用不同颜色」
必须拆成多条规则、靠前后位置分工。范例是 `js/bash.js` 里的 `<占位内容>`：

```js
{ className: 'variable', pattern: /(?<=<)[^\s<>]+(?=>)/ },  // 中间内容 = 变量色
{ className: 'symbol',   pattern: /[><+*()@!~=|&;{}\[\]:?]/ } // < > 本身 = 符号色
```

- 分工原理：扫描到 `<` 时，变量规则的 `(?<=<)` 因**前一个字符不是 `<`** 而失败，于是符号规则吃掉 `<`；
  光标走到内容处时 `(?<=<)` 成立 → 内容按变量色；`>` 处 `(?<=<)` 又不成立 → 符号规则吃掉 `>`。
  即**靠 lookbehind 让同一条规则只在「尖括号内部」生效**，无需真的解析配对。
- 内容类必须排除空白：`echo a > x && echo b > y` 这类重定向链上，若允许空白，
  两个 `>` 之间的整段命令会被染成变量色。写成 `[^\s<>]+` 后 `<<EOF`、`2>&1` 自然不匹配。
- 用到的都是 lookbehind/lookahead，属**非捕获**分组，不会破坏 `m[i+1]` 对齐（见约束 1）。

`js/xml.js` 可作为带注释的完整范例（含「为什么这么写」的说明）。

### 4.2 自动添加脚本（推荐）

可以运行：

```bash
python add_language.py xxx
```

或扫描所有新增文件：

```bash
python add_language.py --scan
```

脚本会自动：

1. 创建 `js/xxx.js` 模板（如果不存在）
2. 加入根 `app.js` 的加载列表
3. 加入 `js/app.js` 的 fallback 和识别分支
4. 自动同步到 `all_backup.py` / `packup.py`（如适用）

### 4.2b 手动加入主入口加载列表

如果不想用脚本，也可以手动修改根目录 `app.js`：

```js
var CONFIG_FILES = [
  // ...
  'js/xxx.js'
];
```

### 4.3 在核心逻辑中注册识别

修改 `js/app.js`：

- 在 `getSyntaxRules` 的 fallback 中可加入：

```js
xxx: []
```

- 在 `highlightCode` 中加入：

```js
if (l === 'xxx') return highlightWithRules(code, getSyntaxRules('xxx'));
```


## 5. 如何新增主题

1. 在 `themes/` 下放置 JSON 文件
2. JSON 结构参考 `themes/keepalived.theme.json`
3. 用户可通过「🎨 主题 -> 导入主题」导入
4. 导入后会自动出现在预设主题下拉框中

主题字段包括：

```json
{
  "name": "theme-name",
  "isDark": true,
  "colors": {
    "codeBackground": "#0d1117",
    "codeText": "#c9d1d9",
    "keyword": "#ff7b72",
    "string": "#a5d6ff",
    "comment": "#8b949e"
  },
  "customCSS": ""
}
```

### 5.1 导出 PDF 主题的数据模型与硬约束

PDF 主题 = **配色**（`state.pdfColors`，含语法色）+ **版式**（`state.pdfLayout`，字号/行高/纸张/页边距/字体/标题缩放）。
两者**并列但分开存储**，不要合并成一个对象：

| 部分 | 定义 | 存储 | 导出/导入 JSON |
|---|---|---|---|
| 配色 | `PDF_COLOR_DEFS` / `PDF_BASE_COLORS` | `localStorage['markdown-viewer-pdf-colors']` | `pdfColors` |
| 版式 | `PDF_LAYOUT_DEFS` / `PDF_LAYOUT_DEFAULTS` | `localStorage['markdown-viewer-pdf-layout']` | `pdfLayout` |

为什么分开：配色那份 key 早已存在于用户机器上，沿用旧 key、旧结构就**零迁移**；
旧版导出的 `markdown-pdf-colors.json` 里没有 `pdfLayout`，导入时**只应用颜色、不覆盖版式**。

四条硬约束（都踩过或差点踩）：

1. **PDF 字号必须独立于阅读器**。导出走 `state.pdfLayout.*`，**不要**图省事去读
   `state.settings.textSize/codeSize/inlineCodeSize`——那是阅读器的字号，改 PDF 不该牵动阅读器。
   （`exportCurrentHtml()` 是另一个产物，仍用阅读器字号，属有意为之，别顺手改。）
   版式默认值刻意等于历史硬编码值（16 / 13.5 / 12 / 1.6 / 1.45 / A4 / 20mm·18mm / 缩放 1），
   所以「什么都不改」时导出结果与以前一致。
2. **预览与导出必须共用 `buildPdfCss()` / `buildPdfDocumentHtml()`**。样式只在这两个纯函数里生成一次，
   `exportCurrentPdf()`、抽屉内即时预览、真实 PDF 预览三条路径都调它。
   任何「顺手在预览里再改一点样式」的写法都会让两者慢慢走偏，是这个功能最容易腐化的地方。
3. **字体族只允许白名单 key**（`PDF_FONT_PRESETS`）。这些值最终会被拼进导出 HTML 的 `<style>`，
   若允许用户输入任意字符串，一个 `</style>` 就能逃逸出去（注入）。数值字段同理：
   一律经 `normalizePdfLayout()` 夹取。
4. **标题缩放不要在 CSS 里用 `calc()`**，在 JS 里算好 `em` 乘积再写出去（prince 对 calc 的支持不可依赖）。

### 6.16 PDF 水印 logo：只印第一页，用 absolute 不用 fixed

**需求**：PDF 第一页右上角印项目 logo（`hutao.jpg`）。

**做法**：`buildPdfDocumentHtml()` 在 `<body>` 里、`.markdown-body` **之前**插入
`<div class="pdf-logo"><img src="data:..."></div>`，样式：

```css
.pdf-logo     { position: absolute; top: -20mm; right: -18mm; }  /* 值 = @page 页边距 */
.pdf-logo img { width: 14mm; height: auto; display: block; }
```

**四个关键点（都是踩过或想清楚才定的）**：

1. **必须 `absolute`，绝不能 `fixed`** —— `fixed` 在分页媒体里会在**每一页**重复。
   绝对定位元素相对「首页内容框」定位，天然只落在第一页。
2. **负的 `top` / `right` 用来把 logo 推进 `@page` 页边距区域**，
   这样它落在右上角留白里，**不占正文位置**（绝对定位也脱离文档流）。
   值直接取 `L.marginV` / `L.marginH`，所以用户在 PDF 版式里改页边距时，logo 会跟着对齐。
3. **logo 必须内联成 data URL**：导出时 HTML 会写到临时文件、以 `file://` 打开，
   相对路径 `hutao.jpg` 在那种上下文里取不到。处理方式与正文图片一致
   （正文走 `inlineImagesForExport`，logo 走 `loadPdfLogo`）。
4. **必须优雅降级**：`file://` 下 `fetch` 会被浏览器拦截。
   读不到就**不印水印**（回调 `null`），绝不能抛错或阻断导出 ——
   导出 PDF 本来就需要本地服务器，但降级路径仍然要通。

**为什么要缩放**：原图 1022×1022 / 127KB，base64 后 169KB，
而水印只显示 14mm（96dpi 下约 53px）。用 canvas 在浏览器里实时缩到 200×200
（300dpi 印刷也够），base64 降到约 1/8 —— **不引入构建步骤或依赖**，
双击 `index.html` 仍然可用。这是本项目一贯的取舍：能在运行时算出来的，就不预生成文件。

**三处调用点都要带 logo**：导出 PDF（`exportCurrentPdf`）、
抽屉内即时预览（`refreshPdfPreview`）、弹层真实预览（`generatePdfPreview`），
否则会出现「预览没有、导出才有」的不一致。

**水印只加在 PDF 路径**：导出的 HTML（`exportCurrentHtml`）不含水印，
阅读界面也不显示 —— 它是 PDF 的品牌标记，不是页面内容。

**PDF 引擎：用系统自带的 Edge / Chrome，不要用 Prince（v1.1.03 起）**

`serve.py` 的 PDF 导出走**无头 Chromium**（Edge / Chrome）打印，不再调用 Prince。原因：

- Prince 是商业软件，免费「非商业授权」会在输出 PDF 右上角**强制盖 "Prince" 水印**。
  该水印由二进制自己添加，**没有任何命令行参数或 CSS 能去掉**，只能购买授权消除。
- Edge 在 Windows 10/11 上自带，**零安装**，且输出无水印 —— 同时满足了项目
  「无第三方依赖、无 CDN、无 npm」的约束。

切换实现时踩到的坑（改 `serve.py` 时务必留意）：

| 坑 | 后果 | 处理 |
|---|---|---|
| `--user-data-dir` 必须指向**独立临时目录** | 复用用户默认 profile 时，若用户已开着浏览器，请求会被交给已运行实例，**不产出 PDF** | 用 `tempfile.mkdtemp()`，并在 `finally` 里 `shutil.rmtree` |
| 不能按退出码判成败 | Chromium 常带着无害告警返回非 0，但 PDF 已正常生成 | 改为判**产物**：文件存在且 **size > 0**（0 字节也算失败） |
| 默认会印页眉页脚 | 页面顶部/底部出现文件路径、日期、页码 | 传 `--no-pdf-header-footer` |
| 不再需要 `--css-dpi 96` | — | Chromium 排版本身按 96 CSS px/英寸，与 CSS px 一致 |
| `--javascript` 不再需要 | — | 导出的 HTML 是自包含的（无 `<script>`，图片已内联为 data: URL） |

保留了一个兼容开关：环境变量 **`MD_PDF_ENGINE=prince`** 可切回 Prince
（供已购授权的用户使用，排版的 paged-media 保真度确实更好）；
环境变量 **`MD_PDF_BROWSER`** 可指定浏览器可执行文件路径（绿色版 / 自定义安装位置）。
两者都读不到时才回落自动探测。



校验入口只有一个：`normalizePdfLayout(raw)`（纯函数）。注意 `Number('')` 是 `0` 而不是 `NaN`，
清空输入框会被夹成最小值——必须显式判空回落到默认值。

预览的两点取舍：

- 抽屉内即时预览按**真实 px、满宽、不做纸张/分页模拟**（抽屉内容区仅约 384px，缩放会让字号失去参考意义）；
  页边距与真实分页由弹层里的**真实 PDF 预览**负责。
- 即时预览的 iframe 带 `sandbox="allow-same-origin"`（同源可用 data/blob 图片，但**禁止执行脚本**——
  文档里若混入 `<script>`，导出文件与预览都不该执行它）；**真实 PDF 预览的 iframe 不能加 sandbox**，
  否则 Chrome 内置 PDF 查看器会被禁掉。

## 6. 如何修改 Markdown 渲染

核心渲染在 `js/app.js` 的 `builtinMarkdown`。

- 行内样式：`builtinInline`
- 列表解析：`builtinParseList`
- 代码高亮入口：`highlightCode`
- 大纲生成：`renderOutline`

修改时注意：

- `highlightWithRules` 使用 `RegExp` 组合规则，规则中不要使用会破坏分组的捕获组
- 如果新增 CSS class，需要同步在 `themeCss` 中添加颜色映射
- 如果新增颜色项，需要同步修改 `COLOR_DEFS` 和 `BASE_COLORS`

### 6.1 行首锚定与缩进的硬约束（踩过坑，务必守住）

**标题 `/^(#{1,6})\s+(.*)$/` 和分隔线 `/^(-{3,}|\*{3,}|_{3,})\s*$/` 都锚定在行首（没有 `^\s*`）。**
给这两类行加任何前导空格，都会让它们**静默降级成普通段落**：
`# 标题` → 缩进 2 格 → `<p>  # 标题</p>`，`---` → `<p>  ---</p>`。
所以任何「缩进 / 批量加空格」类功能都必须先排除它们（`resolveIndentElement` 里显式挡掉 `H1`–`H6`）。

反过来，下面这些**允许**前导空格，缩进不会破坏语义：

- 围栏 `/^\s*```(.*)$/`
- 引用块 `/^\s*>\s?/`（注意：它只吃一个可选空格，剩下的缩进留在内容里）
- 列表项 `/^\s*([-*+]|\d+\.)\s+/`
- 表格分隔行 `/^\s*\|?[\s:\-|]+\|?\s*$/`

由此推出两条容易写错的地方：

1. **标题 / 分隔线缩进 = 破坏内容**；**段落缩进 = 视觉无变化**（HTML 会折叠前导空白，
   本渲染器也没有「4 空格成代码块」的规则）。
2. **引用块里的列表**要把空格加在 `> ` 之后（`> - b` → `>   - b` 才会嵌套），
   而**引用块自身**要加在 `>` 之前（`> quote` → `  > quote`）。加错位置都是静默无效。
   判定依据是「祖先引用块层数」，见 `ancestorQuotePrefix`。

### 6.2 列表缩进要按整棵子树移动

`builtinParseList` 的嵌套收集条件是 `lineIndent > indent`。因此：

- 只缩进列表项那一行，它下面的子项（本来靠更深缩进挂在它身上）会掉出来变成**同级**；
- 必须连同子项、续行一起平移，范围就是 `li` 的 `data-source-line` ~ `data-source-end`；
- `li` 的 `data-source-end` 由 `builtinParseList` 写入（循环退出时 `i` 已是下一项首行，故取 `i - 1`）。

### 6.3 插入补空行的判据

`computeInsertPadding` 只在「插入内容会与相邻行粘成同一个 `<p>`」时才补空行
（判据 `isParagraphLine`：非空且不是标题 / 围栏 / 引用 / 列表项 / 分隔线）。
不要退回「块边界一律补空行」的写法——那会把 `- 旧项 / - 新项 / - 旧项` 拆成**三个**独立 `<ul>`，
插入的列表项既接不上原列表，也无法再缩进成子级。插在段落**内部**时永远不补（会把该段拆成三段）。

### 6.4 缩进入口不能「不可用就藏起来」

「缩进」二级菜单**只要该块本身可缩进就渲染**（标题、整份代码文件除外），方向能不能用只体现在按钮置灰上。

- 曾经的写法是「两个方向都不可用就整块不渲染」，结果「在正文下面插了个列表项、再右键它」这种最常用的
  场景下（新列表只有一项 → 右移无上一项可挂靠、左移又没有空格）**菜单里根本没有缩进入口**，
  用户直接判定「功能没做」。**宁可显示一个带置灰项的入口，也不要让功能消失**，并用 `title` 写明原因。
- 缩进的本质是**被列表项的嵌套收集逻辑吸收**（`builtinParseList` 里 `lineIndent > indent`），
  所以「上方那一行是否属于某个列表项」是唯一判据（`listItemContainingLine`，靠 `li` 的
  `data-source-line` ~ `data-source-end` 范围判断），插入框里的「缩进一级」勾选项同样按它决定能否勾选：
  - 上方是列表项 → 缩进真的产生子级，可勾选；
  - 上方是普通段落 → 缩进是**惰性的**（`正文\n  新项` 与 `正文\n新项` 渲染完全一样），置灰；
  - 上方是围栏代码块 → 2 个空格会落进**代码内容**里（围栏自身允许前导空格，但内容行不会自动去缩进），
    等于把源码改坏，置灰。

### 6.5 插入点绝不能落进围栏代码块内部

右键「插入」优先按**落点所在源码行**定位（段落里可以精确插到中间某一行之后），
但**围栏代码块内部必须吸附到代码块的上下边界**（`fenceBlockAtLine` 判定，`computeMenuInsertCtx` 里最先处理）：

- 围栏内部插入的文本会**变成代码的一部分**（静默改坏代码）；
- 插入的是**围栏代码块**时更严重：新围栏的开启行会被当成外层代码块的**内容**，
  而外层的结束围栏转而开启一个新块并一路吞到文末 —— 也就是「代码块被截断」。
  实测：`# 标题 / ```bash / echo old / ``` / 结尾`，落在代码内容行上「下方插入代码块」，
  旧行为解析成 `bash 内容="echo old\n```json\n{}"` + 一个未闭合块 `"\n结尾"`；
  吸附到块边界后是 `bash "echo old"` + `json "{}"` 两个完好块。
- 判定必须**从文件头顺序扫描配对**（开围栏 → 其后第一个「裸围栏」为结束围栏，与渲染器一致）：
  反向找「最近的围栏行」会把**结束围栏之后的正文**误判成在代码块内，因为那个结束围栏会被当成开围栏。
- 吸附后**不要把 `rect` 传下去**：预览线原本按鼠标那一行画，吸附后必须改按块边界画，否则线与实际插入点不符。

### 6.6 图片放大必须走页面内弹层，不要用 `window.open`

单击正文图片 → `openImageLightbox(src)` 弹出 `#image-lightbox` 全屏遮罩（`closeImageLightbox` 关闭，三条路径：点遮罩空白处 / `Esc` / 点 `✕`）。

- **为什么不能用 `window.open` / 新标签页**：浏览器只禁止**顶层导航**到 `file://` 本地文件，
  不禁止页面内 `<img>` 加载本地图片。所以直接用 `index.html` 打开时，
  `window.open(本地图片)` 会被浏览器拒绝（旧版只能 toast「浏览器安全限制」），
  **页面内 `<img>` 反而能正常显示**。改成弹层等于顺手修掉了 `file://` 下图片看不了的问题。
- `data:` URL 也顺势不再需要「先 fetch 转 blob 再打开」那套临时 blob URL 生命周期管理。
- **幂等很重要**：`closeImageLightbox` 开头判 `box.hidden` 直接返回——`Esc`、点遮罩、点 `✕` 三条路径
  可能重复触发（`✕` 的 click 会冒泡到遮罩），不幂等就会重复操作 DOM。
- 关闭时**必须 `removeAttribute('src')`**：否则大图会一直挂在 DOM 上；
  同时要 `document.body.classList.remove('lightbox-open')`（该类负责 `overflow: hidden` 锁背景滚动）。
- 点遮罩关闭要判 `event.target === lightbox`（**点图片本身不关**）；`Esc` 处理里
  **PDF 弹层优先并 `return`**，保证一次 `Esc` 只关最上面那一层。
- **被 `<a>` 包裹的图片仍优先跟随链接**（`img.closest('a')` 提前 return），与 GFM / GitHub 行为一致。
### 6.7 删除：必须连带处理「列表项之间的空行」，但绝不能吃「段落之间的空行」

两个入口共用一个判据（`deleteSourceLines`）：
右键「🗑️ 删除」整块删（`deleteBlock`），以及在编辑框里把一行**清空**（`startEditTextElement` 的 `finish()`）。

**问题根源**：`finish()` 里 `newValue.split('\n')` 对空串会得到 `['']`，**仍占一行**，
所以「内容删光」写回的是**空行**而不是删行。而渲染器 `builtinParseList` 只把「后面那行缩进更深」的空行
当作列表内部，**同级列表项之间的空行会终止列表**：

- `- a` / `- b` / `- c` → 1 个 `<ul>`
- `- a` / **空行** / `- c` → **2 个 `<ul>`**（列表被切断，「列表不再连续」的根因）
- `- a` / `- c`（整行删掉）→ 1 个 `<ul>` ✅

**因此删除一行时要连带吃掉「夹在同一列表两项之间的空行」**，但**只能吃这一种**：

| 空行两侧 | 处理 | 原因 |
|---|---|---|
| 列表项 ↔ 列表项 | **必须吃** | 留着会把一个列表切成两个 `<ul>` |
| 段落 ↔ 段落 | **绝不能吃** | 实测 `AAA` / 空行 / `BBB` 去掉空行 → `AAA\nBBB` → **合成一个 `<p>`（出现 `<br>`）** |
| 列表 ↔ 段落 / 列表 ↔ 引用 / 引用 ↔ 引用 | 不吃 | 同理，空行是块与块的分隔 |

判据写法（先取 `lines` 再 splice）：
```js
const prevBlank = start - 1 >= 0 && lines[start - 1].trim() === '';
if (prevBlank) {
  const before = start - 2 >= 0 ? lines[start - 2] : null;
  if (before !== null && isListItemLine(before) && isListItemLine(lines[start])) start = start - 1;
}
```

其他必须守住的点：

- **`isListItemLine` 要与渲染器的 `markerRe` 同口径**：`/^\s*(?:[-*+]|\d+\.)\s+/`。
  注意 `- `（减号加空格）在渲染器里**算**列表项（渲染成 `<li></li>`），而 `-`（无空格）是段落——
  若自己另写一套更严的正则，判据就会与渲染结果不一致。
- **引用块（`quotePrefix` 非空）清空时仍走原逻辑**（写回 `> ` 前缀行），**不整块删**：
  它的 `>` 前缀在编辑框里是隐藏的，空行靠前缀维持引用结构，整块删掉会连引用一起没了。
- **整份代码文件（`pre[data-code-file]`）不提供右键删除**（会清空整个文件），与「缩进」的排除口径一致；
  空白处右键（`hasBlockTarget=false`）也不提供（没有块可删）。
- **删嵌套列表的父项**会连子项一起删：`builtinParseList` 写入的 `data-source-end` **已覆盖整棵子树**
  （实测父项带两个子项 = 行[0-2]），所以直接用 `getBlockRange` 的范围即可，不必自己向下扫。
- **删到文档为空时** `lines.join('\n')` 得到 `''`：仍是字符串，`state.currentText` 类型不能变。
- 撤销：走 `applySourceChange`（入栈上限 20），右键删除**不弹二次确认**——靠撤销栈兜底，与缩进/插入的直接执行风格一致。

### 6.8 核心逻辑拆分为 src/ 片段 + 拼接（v1.1.0 起，改代码前必读）

### 结论：改 `js/app.js` 是白改

`js/app.js` 从 v1.1.0 起是 **拼接产物**，由 `src/` 下的 14 个功能片段按文件名顺序拼接生成。
直接改 `js/app.js`，下次执行拼接就被覆盖。**改核心逻辑请改 `src/` 下对应的片段。**

```bash
node tools/split_app.js --bundle     # 改完片段后重新拼接，生成 js/app.js
node tools/split_app.js --diff       # 校验拼接结果与当前 js/app.js 一致
node tools/split_app.js --checkall   # 校验拼接结果与拆分前原始文件逐行一致（最强证据）
node tools/split_app.js --list       # 列出 js/app.js 的全部顶层单元
```

### 为什么不是「每模块一个独立 IIFE」

曾考虑把每个模块做成独立 IIFE、成员挂 `window.MD`，实测否决了：

- `js/app.js` 里涉及顶层函数的**调用点有 838 处**（`toast` 110 次、`escapeHtml` 55 次…）。
- 独立 IIFE 意味着这些裸调用全部要改成 `MD.xxx(...)` —— 838 处改动，回归风险远超收益。

改成「片段 + 拼接」后**函数体一个字都不用动**，且产物仍是单文件 `js/app.js`，
**双击 `index.html` 照常可用**（无构建依赖、无 npm、无网络）。
拼接只是开发期的整理手段，不是运行时构建。

### 片段分层（按依赖自下而上，拼接顺序 = 文件名顺序）

| 片段 | v1.1.0 前对应内容 | 行数 |
|---|---|---|
| `00-header.js` | 文件头 + IIFE 开场 | 7 |
| `10-core-util.js` | 工具函数 | 110 |
| `11-core-theme-def.js` | 主题定义 + PDF 版式定义（纯数据） | 521 |
| `12-core-state.js` | 全局状态 `state` + 自定义语言注册 | 58 |
| `20-core-markdown.js` | 内置 Markdown 渲染器 + 高亮引擎 | 195 |
| `21-core-anchor.js` | 工作区内部跳转 | 51 |
| `22-core-inline-html.js` | 内联 HTML 标签支持 | 223 |
| `23-core-parse.js` | Markdown 解析 + 原生图片 + 导出构建 | 420 |
| `24-core-files.js` | 文件索引与树 + 全文搜索 + 侧边栏 | 777 |
| `30-core-fence.js` | 正文编辑与撤销 + 选中着色 | 553 |
| `31-core-block.js` | 围栏解析 + 插入/缩进/删除 | 1305 |
| `40-ui-dir.js` | 文件夹拖拽 + 默认目录 + 缓存快照 | 425 |
| `50-ui-theme.js` | 主题生成 + 阅读设置 + 主题编辑器 + PDF 预览 | 555 |
| `60-ui-init.js` | 初始化 + 事件绑定 | 1560 |

### 片段书写约定

1. 片段内部就是原来 `js/app.js` 的「2 空格缩进」正文，**不加任何包装**（不写 `(function(){`）。
2. 第 1 个片段（`00-header.js`）负责开场 `(function () { 'use strict';`，最后一个片段负责收尾 `})();`。
3. 片段之间只靠**拼接顺序**保证定义先于使用；顶层函数有变量提升，但 `const`/`let` 没有。
   新增片段时，若它依赖后面的片段，说明分层放错了，应下移。
4. 每个片段末尾保留一个空行，拼接时用 `\n\n` 连接。

### 两条硬规则

- **不要往 `index.html` 加 `<script>` 标签**：仍只加载 `app.js` 一个核心脚本
  （语言子配置由根 `app.js` 的 `CONFIG_FILES` 加载）。
- **拆分只做「搬家」，不改逻辑**：任何行为改动都应是独立的一次提交，
  不要混在拆分里 —— 否则 `--checkall` 的逐行校验就失去意义。

### `bindEvents` 拆分（v1.1.0 的重点收益）

原来 `bindEvents` 是**单个 1422 行、最深 9 层嵌套**的函数，改任何一处都要在深层缩进里定位。
现拆为 **9 行调度函数 + 7 个按功能域命名的子函数**：

```js
function bindEvents() {
  bindFileOpenEvents();        // 打开文件/文件夹/默认目录下拉
  bindThemeDrawerEvents();     // 主题抽屉/配色编辑器/PDF 预览/导入导出
  bindSidebarEvents();         // 搜索框/侧边栏切换/搜索结果点击
  bindSidebarMenuEvents();     // 文档列表右键菜单
  bindContentMenuEvents();     // 正文右键菜单：复制/编辑/插入/缩进/删除
  bindContentJumpEvents();     // 工作区跳转/图片放大预览
  bindGlobalEvents();          // 拖拽打开/快捷键
}
```

**拆分时踩过的坑（务必注意）**：原来 `bindEvents` 顶部的局部 `const`
（`fileInput` / `folderInput` / `themeInput`）被全函数共享，
拆成子函数后**不再共享**，必须在用到它的子函数里各自 `document.getElementById` 重新获取，
否则报 `xxx is not defined`。新增子函数时同样要检查这一点。

**等价性验证方法**：拆分前后 `addEventListener` 数量必须一致（本次均为 **88**），
匿名函数数量必须一致（均为 **95**），且把子函数体拼起来用桩环境执行不报错。

### 发布流程的适配

`update_version.py` 已适配：版本字符串的真实来源是 `src/60-ui-init.js`，
脚本改完片段会**自动调用 `node tools/split_app.js --bundle` 重新拼接**，
再校验 `js/app.js` 与 `index.html` 的版本号一致。不需要手工拼接。

### 6.9 右键菜单必须按「实测高度」夹进视口，且主菜单绝不能加 overflow

**问题（用户报告）**：`showContentCtxMenu` 原先按写死的
`top: Math.min(y, window.innerHeight - 120)` 摆放菜单，导致在文档靠下的位置右键时，
底部的「删除」被窗口下沿遮住、点不到。

**根因**：那个 `120` 是按**早期只有 3 项菜单**估的常数；后来加了「缩进」二级菜单
与「删除」项，菜单变高，`innerHeight - 120` 不够，底部溢出约 80px，
**最下面的「删除」最先被裁**（菜单项越多，被裁的越是最下面那个）。

**修复**（`src/60-ui-init.js`）：新增 `clampMenuIntoViewport(menu, x, y)`，
在 `document.body.appendChild(menu)` **之后**调用（未挂载的节点量到的高度是 0），
用 `getBoundingClientRect()` 量出菜单**真实高度**再决定摆放：

1. 默认在光标下方（`top = y`）；
2. 下方放不下就整体上移，让菜单底边贴住视口底部（`top = vh - h - margin`）；
3. 上移后顶边仍越过视口（菜单比视口还高）→ 夹到 `margin`，保证至少能看到顶部；
4. 横向同理：右边放不下先翻到光标左侧，仍放不下则贴左边。

**关键：这个问题完全由 JS 解决，不要再用 CSS 兜底** —— 见 §6.9b。

### 6.9b ⚠️ 给容器加 overflow 前，先查后代里有没有要「溢出显示」的元素

**问题（用户报告）**：右键正文的**二级菜单**（「⇥ 缩进」「➕ 插入」）不弹出，
只看到主菜单出现滚动条。

**根因**：修 §6.9 时，为「高度兜底」给主菜单加了
`#content-context-menu { max-height: calc(100vh - 16px); overflow-y: auto; }`。
但**二级菜单是主菜单的后代节点**：

```
#content-context-menu          ← 加了 overflow-y:auto，成了溢出容器
  └ .context-submenu-wrap      ← position: relative
      ├ .ctx-submenu-trigger
      └ .context-submenu       ← position: absolute; left: 100% 向右展开
```

主菜单一旦成为溢出容器，**向右展开的子菜单就被它裁剪掉了**；
被裁后只剩一条缝，`overflow-y: auto` 又把这点内容当成纵向溢出、画出滚动条
—— 这就是「子菜单不弹出、反而出现滚动条」的成因。

**修复**：**删掉那条 CSS**。「低处右键被遮挡」本来就由 JS 的
`clampMenuIntoViewport()` 解决（上移到贴底，根本没有超出视口的机会），
CSS 兜底多余且有害。

**通用规则**：给任何容器加 `overflow` / `max-height` / `contain` / `transform` /
`filter` 之前，**先确认它的后代里有没有依赖「溢出可见」的绝对定位元素**
（下拉菜单、二级菜单、悬浮卡、tooltip）。这类元素「相对哪个祖先定位」与
「被哪个祖先裁剪」是两件事：定位找最近的**定位**祖先，
裁剪却由最近的**溢出**容器决定，两者常常不是同一个节点。

**同类教训**（都是「改共享基础设施时没检查其他使用者」）：

| 版本 | 改动 | 波及 |
|---|---|---|
| v1.1.0 | 复用 `hasBlockTarget` 当「删除」判据 | 非 Markdown 文件的「复制/编辑」一起消失（§6.10） |
| v1.1.0 | `bindEvents` 拆成多个 `bind*` 子函数 | `closeExportMenu` 被埋进子函数，顶层调用报 ReferenceError（§6.13） |
| v1.1.0 | 给主菜单加 `overflow-y: auto` | 二级菜单被裁切，无法弹出（§6.9b，v1.1.02 修复） |

### 6.10 `hasBlockTarget` 与 `canDelete` 必须分开传（踩过回归）

**问题（用户报告）**：**非 Markdown 文件**（.py / .js / .json 等）右键时，「✏️ 编辑」没了 ——
实际上整个菜单都不弹，而是弹出了浏览器原生右键菜单。

**根因**：`buildContentCtxMenuHtml(opts)` 里的 `opts.hasBlockTarget` 控制的是
**「📋 复制 / 🏷️ 更改类型 / ✏️ 编辑」这一整组**。
v1.0.72 新增「删除」功能时，把它**误传成了删除的判据**：

```js
// 错误（v1.0.72 ~ v1.1.0 修复前）
hasBlockTarget: canDeleteBlock,      // canDeleteBlock 对代码文件为 false
```

而 `canDeleteBlock = hasBlockItems && !isCodeFileBlock && !isCodeFile(path)`，
对代码文件恒为 `false` → `blockHtml` 整块为空 → 加上代码文件本来就
`insertMode='none'`、`indentMode='none'`、删除也不提供 → `hasAny=false` →
`showContentCtxMenu` 直接 `return`，**菜单完全不弹**。

对照 v1.0.71（最后一个正常版本）可以看到它传的是 `hasBlockTarget: hasBlockItems`：

```js
// 正确
hasBlockTarget: hasBlockItems,       // 有块目标 → 复制/更改类型/编辑
canDelete: canDeleteBlock,           // 是否允许删除（独立判据）
```

**教训**：一个布尔参数**只表达一件事**。给菜单生成器加新的可选区块时，
**新增独立参数**，不要复用语义不同的既有参数 —— 复用会造成
「A 功能被关掉，B 功能跟着一起消失」这种极难从现象反推的 bug。

**各场景的期望菜单内容（改菜单时请对照这张表）**：

| 右键场景 | 复制 | 更改类型 | 编辑 | 缩进 | 插入 | 删除 |
|---|---|---|---|---|---|---|
| Markdown 正文块 | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Markdown 围栏代码块 | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| 表格 | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| **非 Markdown 文件（整份 <pre data-code-file>）** | ✓ | — | **✓** | — | — | — |
| 正文空白处 | — | — | — | — | ✓ | — |

### 6.11 默认目录：句柄不可用时**必须**回退到缓存快照

**问题（用户报告）**：点「默认目录 ▾ → 📂 打开默认目录」只弹一句
「未获得默认目录访问权限」，目录打不开 —— 功能等同失效。

**根因**：`openDefaultDirectoryManually` 里只要 IndexedDB 存有目录句柄，
`queryPermission` 不为 `granted` 时就 `toast(...)` + `return`，
**完全不去尝试缓存快照**。

**为什么这在 `file://` 下必然发生（关键背景）**：

| 事实 | 后果 |
|---|---|
| 目录句柄的权限**不跨会话持久化** | 每次打开页面，句柄在、权限都是 `prompt` |
| 无用户手势时 `requestPermission` 常被浏览器拒绝 | 走到 `return` 是**必然**，不是偶发 |
| 缓存快照（IndexedDB）里存着上次打开的目录内容 | 明明有可用的兜底，却被跳过 |

**规则**：句柄是「可写回磁盘」的增强路径，**快照是兜底路径**。
两者是**降级**关系，不是二选一 —— 句柄不可用时**必须**继续尝试快照，
否则用户看到的就是「功能坏了」。快照是只读的，但能正常浏览，远好于什么都不打开。

**同时要注意**：句柄不可用时要把 `state.dirHandle` **清空**，
否则后续写盘逻辑会误用一个没授权的句柄（`state.dirReadOnly` 也要复位）。

**同类问题**：`restoreDefaultDirectory`（启动时自动恢复）原本有一样的提前 `return`，
且「授权成功但目录为空」时也不会回退快照 —— 两处都已修复。
「确实存过句柄但没拿到授权」才提示重新授权（`hadHandle`），
从未设置过默认目录的用户不该被打扰。

**自检方式**：在桩环境下**真实执行**这两个函数（不要只做字符串断言），
枚举这 6 种场景并断言最终动作：

| 场景 | 期望动作 |
|---|---|
| 无句柄 + 无快照 | 明确提示「还没有设置默认目录」 |
| 无句柄 + 有快照 | 从快照打开 |
| 句柄已授权 | 用句柄打开（可写回磁盘） |
| 句柄授权抛异常 + 有快照 | **回退到快照** |
| 句柄授权被拒 + 有快照 | **回退到快照** |
| 授权成功但目录为空 | **回退到快照** |

### 6.12 整函数重写时，`--checkall` 白名单按「函数区间」放行

`tools/split_app.js --checkall` 用逐行白名单（`KNOWN_FIXED`）放行有意修改。
但一次修改若是**整段重写**某个函数（如本次的 `openDefaultDirectoryManually`），
差异会膨胀到几十行，逐行列白名单既啰嗦又失去审计意义。

为此增加了 `REWRITTEN_FUNCS`：按**函数区间**放行，并单独打印
`ℹ 整函数重写：N 行（函数名）`，审计时能一眼看出「哪个函数被整段重写了」。

**实现要点（踩过）**：判定差异行是否落在区间内，必须用该行在**原始基线里**的
下标（`srcIdx`），**不能**在拼接产物里按内容反查 ——
`} else {`、空行这类重复内容在全文出现多次，按内容反查会定位到错误的函数。

### 6.13 ⚠ 拆分 `bindEvents` 时，共享辅助函数必须留在 IIFE 顶层

**问题（用户报告）**：点「📂 打开默认目录」「📌 设定默认目录」完全无反应，
控制台报 `Uncaught ReferenceError: closeExportMenu is not defined`（`app.js:5338`）。

**根因（v1.1.0 拆分引入的回归）**：

| | 拆分前 | 拆分后 |
|---|---|---|
| `bindEvents` | 单个 1422 行的大函数 | 7 个功能域子函数 |
| `closeExportMenu` | 定义在 `bindEvents` **内部**（缩进 6） | 被留在 `bindContentMenuEvents` 内部 |
| 调用点 | 全都在同一个函数里 → **天然可见** ✓ | `bindFileOpenEvents` 也调用 → **作用域隔离** ✗ |

**为什么这个错误特别危险**：

1. **语法完全合法** —— `node --check` 查不出来；
2. **静态检查也容易漏** —— 「标识符有声明」为真，但「声明的位置对调用方可见」为假；
3. **只在运行时点到那个按钮才暴露** —— 不点就永远发现不了。

**规则**：拆分大函数时，凡是**被多个功能域调用**的辅助函数，
**必须提到 IIFE 顶层（缩进 2）**，不能留在任何一个子函数里。
若该辅助函数依赖某个子函数里的局部变量（如缓存的 DOM 引用），
改成在函数内部用 `document.getElementById` **现查**。

**防复发**：`tools/scope_check.js`（已集成进 `--checkall`，在 `node --check` 之后自动跑）
扫描「嵌套在某子函数内、却被其它顶层函数调用」的辅助函数并报错：

```
✗ closeExportMenu (L6548) 嵌套在 bindContentMenuEvents 内，却被 [bindFileOpenEvents] 调用
```

它用「同名定义计数 > 1 则跳过」来排除合法情形（如 4 个 `finish`、
2 个 `autoResize` 是各子函数自带的局部辅助函数，互不相干），
并排除方法调用（`writable.close()` 不是本文件的函数 —— 这里踩过一次误报）。

**检查器必须反向验证**：写完后故意把 `closeExportMenu` 埋回 `bindContentMenuEvents`，
确认检查器能报错（退出码 1）—— 一个不会失败的检查等于没有检查。

**顺带提醒**：拆分 `bindEvents` 会让基线中该函数区间内的**所有行**因缩进变化
被判为差异，需在 `tools/split_app.js` 的 `REWRITTEN_FUNCS` 里登记
（本次登记了 `bindEvents`、`bindContentMenuEvents`、`restoreTheme`、`init` 等）。

### 6.14 重载当前目录：三种模式能力不同，必须明确区分

**入口**：文档列表标题栏右侧的「⟳」按钮（`#btn-reload-dir`，绑定在 `bindSidebarEvents`），
核心逻辑在 `src/40-ui-dir.js` 的 `reloadCurrentDirectory()` + `applyDirectoryReload()`。

**为什么拆成两个函数**：`reloadCurrentDirectory` 负责「判断模式 + 重新读取」，
`applyDirectoryReload` 负责「把读到的内容应用到界面并保留阅读现场」。
后者除了 `document` 几乎不碰浏览器 API，**可以在 Node 里直接断言行为**
（保留滚动位置 / 文档被删的处理），不必开浏览器。

**三种目录来源的行为差异（不要混为一谈）**：

| 目录来源 | 能否重读磁盘 | 重载行为 |
|---|---|---|
| `state.dirHandle`（File System Access） | ✅ 能 | 真正重读，能看到外部新增 / 删除的文件 |
| 快照模式（`<input webkitdirectory>`，无句柄） | ❌ **浏览器禁止** | 明确提示原因 + 引导「打开文件夹」重新选择 |
| 都没打开 | — | 提示先打开文件夹 |

**关键约束**：快照模式下**不能**假装重载成功（例如悄悄从缓存恢复旧内容）——
那会让用户以为看到了磁盘最新状态。浏览器安全模型就是不允许脚本重读
用户曾选过的目录，只能引导用户重新授权。**如实告知 > 静默给出过期数据**。

**保留阅读现场**（用户明确选择的方案）：重载后若当前文档仍在，
用 `openFile(item, true)`（`keepScroll=true`）重读内容，并恢复两级滚动
（`.content` 的 `scrollTop` + `window.scrollTo`）；
若文档已被删除 / 改名，回欢迎页并**点名是哪个文件**，
而不是静默跳走让用户以为重载失败。

**按钮反馈**：重载是异步的，期间加 `.spinning` 转圈并 `disabled` 防连点，
在 `Promise` 收尾的 `.then` 里恢复（不用 `.finally`，兼容性更稳）。
另外尊重 `prefers-reduced-motion`，系统开启「减少动态效果」时不做旋转动画。

**测试注意**：用桩 DOM 测按钮绑定时，**不要用通用循环覆盖 `addEventListener`**
（踩过：把 `addEventListener` 覆盖成空函数后绑定没被记录下来，
看起来像「按钮没绑定」，实际是测试桩的 bug）。事件桩要真的把回调存进数组。

### 6.15 图片背景：用 CSS 变量驱动，别写进图片标签

**需求背景**：透明 PNG / SVG（截图、流程图、公式图）本身没有底板，
暗色主题下与深色页面背景糊在一起，很难看清。

**做法**：给 `.markdown-body img` 加 `background-color: var(--md-image-bg, transparent)`
和 `padding: var(--md-image-padding, 0px)`，由 `applySettings()` 写这两个变量，
设置项在「主题 → 阅读设置」（总开关 + 取色器）。

**为什么用 CSS 变量而不是直接改 `<img>` 的 style**：

| 方式 | 问题 |
|---|---|
| 在渲染时给每个 `<img>` 写内联 `style` 背景 | 用户改设置要**重新渲染整篇文档**才生效；导出、`restoreHtmlImages` 等多条管线都要各自补一遍，容易漏 |
| 改成 `<img>` 外层包一个 `<div>` | 会破坏 Markdown 渲染结构（图片在段落/列表/表格里的位置都会变），还可能影响现有 CSS 选择器 |
| **CSS 变量（当前做法）** | 改设置只写一个变量，浏览器自动重绘；所有已渲染的图片立即生效，无需重渲染 |

**关键细节**：

1. `box-sizing` 必须是 `content-box`（原本就是），**背景紧贴图片边缘、不加内边距**。
   踩过：v1.1.01 最初留了 6px `padding`（想「让底板看得出来」），
   用户反馈是「像相框把图片包起来」—— 需求是**只补一层底板**，不是加边框。
   所以 `padding` 恒为 `0`、`border-radius` 为 `0`。
2. 变量要带兜底 `var(--md-image-bg, transparent)`：
   即使 JS 没跑（如脚本报错），外观也与改动前完全一致，不会出错；
3. 关闭时把变量设成 `transparent`，
   而不是去删 class —— 状态只有一处（变量），没有「css 类忘了摘」的中间态。

**设置项要向后兼容**：老版本的 `localStorage` 里没有新字段，
判断用 `parsed.imageBackground !== false` 而不是 `Boolean(parsed.imageBackground)`，
否则老用户升级后会变成「默认关闭」，与需求相反。

**颜色值必须校验**：`state.settings.imageBackgroundColor` 会被写进 CSS 变量，
直接拼字符串等于开放样式注入（`red;}body{display:none` 之类）。
`normalizeCssColor()` 只放行 `#rgb` / `#rrggbb` / `#rrggbbaa` / 具名色 / `rgb()` / `hsl()`，
非法值回退 `#ffffff`。

**顺带修掉的老问题**：`renderSettingsEditor()` 原先只在 `openDrawer()` 里调用，
导致页面刚加载时抽屉控件显示 HTML 硬编码默认值、用户存过的值要等打开抽屉才被纠正。
现在 `init()` 里 `loadSettings()` + `applySettings()` 之后补调一次。
**教训**：凡是「读设置 → 回填控件」的函数，**初始化时必须调一次**，
不能只挂在「打开面板」事件上。

## 7. 如何测试

### 本地运行

```bash
python serve.py
```

访问：

```text
http://localhost:8000
```

### 手动测试点

- 打开 `sample.md`，确认代码块高亮
- 打开 `keepalived.md`，确认 Keepalived 高亮
- 测试侧边栏「文档列表 / 当前大纲」切换
- 测试全文搜索
- 测试主题保存 / 导入 / 导出
- 测试文件热重载
- 测试侧边栏 / 顶部菜单折叠

### 用浏览器实测（默认不做，按需才做）

**默认不做浏览器实测**：改完代码不主动开浏览器验证，**只有用户明确要求实测时才做**。没被要求就自行启动浏览器属于多余动作，还会因为下面这个坑把整轮对话拖住。

真的要做实测时，**必须先启动 bsk 守护进程，否则浏览器工具会卡死**（工具调用一直不返回，表现为整轮对话无响应）：

```powershell
# 脚本位置（已加入用户 PATH，直接调用即可）
#   C:\Users\pc\.local\bin\bsk-up.bat
bsk-up.bat
```

- 脚本名是 `bsk-up.bat`（连字符），不是下划线
- 它内部会写 `C:\Users\pc\.bsk\`，若权限不足需以更宽的文件权限运行；脚本结尾有 `pause`，会一直挂住终端，所以更适合直接起守护进程：`bsk daemon start --daemon-idle 12h`
- 守护进程起来后再调用浏览器工具；`bsk daemon` **没有 `status` 子命令**，不要用 `bsk daemon status` 探测
- 实测结束后用 `browser_session stop` 关掉会话

### 哈希校验

如果修改了 `hutao.ico`，必须重新运行：

```bash
python compute_icon_hash.py
```

并把输出填入 `app.js` 的 `EXPECTED_ICON_HASH`。

## 8. 打包发布

```bash
python packup.py
```

生成：

```text
markdown-viewer-portable.zip
```

打包前会校验图标哈希，避免发布后无法启动。

## 9. 版本号更新与自动备份（必须执行）

**每次对项目文件进行任何修改后，必须先更新版本号、更新更新日志（CHANGELOG.md），再运行备份脚本。**

备份文件名包含版本号（`markdown-viewer-v<版本号>.zip`），如果不更新版本号，新备份会覆盖同名旧备份，导致历史版本丢失。

### 9.1 更新版本号

版本号存在于两处，**必须同步修改**：

| 文件 | 位置 | 示例 |
|------|------|------|
| `index.html` | `<link>` / `<script>` 的 `?v=` 参数 | `?v=8.1` → `?v=8.2` |
| `js/app.js` | `console.log` 中的版本字符串 | `(v8.1)` → `(v8.2)` |

推荐直接运行 **`update_version.py`** 脚本自动同步修改上述两处（无需手动编辑文件）：

```bash
python update_version.py            # 交互式：显示当前版本，回车接受自动递增的建议版本，或手动输入
python update_version.py 1.0.13     # 直接指定新版本号
```

脚本会自动完成：读取当前版本 → 校验新版本格式 → 同步修改 `js/app.js` 与 `index.html`（两处 `?v=`）→ 验证结果。更新完版本号后，仍需按本流程继续更新 `CHANGELOG.md` 并运行备份。

版本号规则：

- 小改动（bug 修复、样式微调、新增语言规则等）：递增小版本号，如 `8.1` → `8.2`
- 大改动（新功能、架构调整）：递增大版本号，如 `8.x` → `9.0`

### 9.1b 更新更新日志（CHANGELOG.md）（必须执行）

版本号更新后，**必须**在 `CHANGELOG.md` **顶部**添加对应版本的更新记录（与备份同步完成），格式如下：

```markdown
## [v1.0.12] - 2026-08-23
### 新增
- 具体新增的功能
### 修复
- 具体修复的问题
### 优化
- 具体的优化点
```

规范：

- 按版本**倒序**排列，最新的版本在最上面
- 标题格式：`## [v<版本号>] - <YYYY-MM-DD>`
- 内容按「新增 / 修复 / 优化 / 说明」分类，每条一句话，写清「做了什么、为什么」
- 版本号、CHANGELOG.md、备份**三者必须同步完成**，缺一不可

### 9.2 运行备份

版本号更新后，立即执行：

```bash
python all_backup.py
```

备份文件会保存到 `backup/` 目录，文件名格式为 `markdown-viewer-v<版本号>.zip`。

### 9.3 完整流程

```text
修改代码 → 更新版本号（index.html + js/app.js） → 更新 CHANGELOG.md → python all_backup.py → 验证备份生成
```

### 9.4 触发时机

以下操作完成后，**必须**执行「更新版本号 + 更新 CHANGELOG.md + 备份」：

- 新增 / 修改 / 删除 `js/` 下的语法高亮规则文件
- 修改根目录 `app.js`（CONFIG_FILES 等）
- 修改 `js/app.js`（核心逻辑）
- 修改 `css/style.css`
- 修改 `index.html`
- 新增 / 修改主题文件
- 修改打包脚本本身（`all_backup.py`、`packup.py`）
- 新增 / 修改 `CHANGELOG.md`、`AI_DEVELOPMENT.md` 等文档
- 任何其他影响项目功能的改动

### 9.5 注意事项

- 备份前会自动校验图标哈希，校验失败时备份中止并报错
- 如果备份失败，需要先排查错误再继续后续开发
- `backup/` 目录会自动创建，无需手动建立
- **禁止在不更新版本号的情况下运行备份**，否则会覆盖已有备份
- 修改 `CHANGELOG.md` 等文档同样属于项目文件改动，需要按本流程同步更新版本号并备份

## 10. 常见注意事项

- 不要引入外部 CDN，项目必须离线可用
- `js/` 下的子配置通过根 `app.js` 加载，不要直接在 `index.html` 手动加 script
- 修改 `js/app.js` 后，用户需要 `Ctrl + F5` 强制刷新
- 文件读取使用 File System Access API 时，`openFile` 会先获取最新文件句柄，避免读到旧内容
- 代码块换行由 CSS 控制：`white-space: pre-wrap; word-break: break-word;`
- 全文搜索会逐个读取文件，文件多时会有一定耗时，属正常现象

## 11. 版本号位置

当前版本号在：

- `index.html` 的资源版本参数
- `js/app.js` 的 console 输出

升级版本时两处需要同步修改，可直接运行 `python update_version.py` 自动完成（见 §9.1）。
