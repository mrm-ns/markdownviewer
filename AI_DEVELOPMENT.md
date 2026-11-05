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
├── js/
│   ├── app.js              # 核心逻辑：Markdown 渲染、文件浏览、主题、搜索、侧边栏等
│   ├── bash.js             # Bash/Shell 高亮规则
│   ├── ini.js              # INI 高亮规则
│   ├── conf.js             # CONF 高亮规则
│   ├── keepalived.js       # Keepalived 高亮规则
│   ├── python.js           # Python 高亮规则
│   ├── javascript.js       # JavaScript 高亮规则
│   ├── json.js             # JSON 高亮规则
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
├── start.bat / start.sh    # 启动脚本
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
| 设置系统 | `loadSettings`、`saveSettings`、`applySettings` | 正文字号、代码字号、行内代码字号 |
| 文件系统 | `indexFiles`、`indexWrappedFiles`、`openFile`、`getFreshFile` | 打开文件/文件夹、读取最新内容 |
| 文件树 | `buildTree`、`renderTree`、`renderNode` | 侧边栏文档列表渲染 |
| 全文搜索 | `performContentSearch` | 在工作区所有 Markdown 文件中搜索内容 |
| 侧边栏 | `renderOutline`、`setSidebarTab`、`toggleSidebar` | 文档列表 / 当前大纲切换、折叠 |
| 顶部菜单 | `toggleToolbar`、`loadToolbarState` | 顶部工具栏折叠/展开 |
| Markdown 渲染 | `builtinMarkdown`、`builtinInline`、`builtinParseList` | 内置 Markdown 解析器 |
| 代码高亮 | `highlightCode`、`highlightWithRules`、`getSyntaxRules` | 根据语言规则高亮代码 |
| 图片处理 | `extractHtmlImages`、`resolveImageSrc`、`restoreHtmlImages` | 支持 HTML 图片和相对路径图片 |
| 内部跳转 | `resolveWorkspacePath`、`scrollToAnchor` | 工作区内 Markdown 文件跳转 |
| 正文编辑 | `startEditTextElement`、`startEditCodeBlock`、`applySourceChange` | 右键编辑行/代码块 |
| 撤销 | `undoLastEdit`、`state.undoStacks` | 按文件保存撤销记录 |
| 右键菜单 | 文件树菜单、正文菜单 | 重命名、复制、编辑 |

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

### `themes/`
- 存放主题 JSON
- 用户可导入 / 导出主题
- 导入后自动加入预设主题下拉框

### Python 脚本
| 脚本 | 功能 |
|------|------|
| `serve.py` | 本地静态服务器 |
| `add_language.py` | 自动添加新的代码块高亮语言 |
| `all_backup.py` | 完整备份到 `backup/`，文件名带当前版本号 |
| `packup.py` | 生成便携版 zip，供分发部署 |
| `compute_icon_hash.py` | 计算 `hutao.ico` 的 SHA-256 |

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

**每次对项目文件进行任何修改后，必须先更新版本号，再运行备份脚本。**

备份文件名包含版本号（`markdown-viewer-v<版本号>.zip`），如果不更新版本号，新备份会覆盖同名旧备份，导致历史版本丢失。

### 9.1 更新版本号

版本号存在于两处，**必须同步修改**：

| 文件 | 位置 | 示例 |
|------|------|------|
| `index.html` | `<link>` / `<script>` 的 `?v=` 参数 | `?v=8.1` → `?v=8.2` |
| `js/app.js` | `console.log` 中的版本字符串 | `(v8.1)` → `(v8.2)` |

版本号规则：

- 小改动（bug 修复、样式微调、新增语言规则等）：递增小版本号，如 `8.1` → `8.2`
- 大改动（新功能、架构调整）：递增大版本号，如 `8.x` → `9.0`

### 9.2 运行备份

版本号更新后，立即执行：

```bash
python all_backup.py
```

备份文件会保存到 `backup/` 目录，文件名格式为 `markdown-viewer-v<版本号>.zip`。

### 9.3 完整流程

```text
修改代码 → 更新版本号（index.html + js/app.js） → python all_backup.py → 验证备份生成
```

### 9.4 触发时机

以下操作完成后，**必须**执行「更新版本号 + 备份」：

- 新增 / 修改 / 删除 `js/` 下的语法高亮规则文件
- 修改根目录 `app.js`（CONFIG_FILES 等）
- 修改 `js/app.js`（核心逻辑）
- 修改 `css/style.css`
- 修改 `index.html`
- 新增 / 修改主题文件
- 修改打包脚本本身（`all_backup.py`、`packup.py`）
- 任何其他影响项目功能的改动

### 9.5 注意事项

- 备份前会自动校验图标哈希，校验失败时备份中止并报错
- 如果备份失败，需要先排查错误再继续后续开发
- `backup/` 目录会自动创建，无需手动建立
- **禁止在不更新版本号的情况下运行备份**，否则会覆盖已有备份

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

升级版本时两处需要同步修改。
