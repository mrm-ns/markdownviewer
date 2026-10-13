# Markdown Viewer

一个用于浏览 Markdown 文档的 Web 应用，界面风格参照 GitHub Markdown。

## 功能

- **GitHub 风格渲染**：标题、列表、表格、引用、任务列表等 GFM 基础语法
- **打开文件 / 文件夹**：可以打开单个 Markdown 文件，也可以打开整个文件夹，在侧边栏快速切换文档
- **文档列表右键改名**：在左侧文档列表右键选择“重命名”
- **主题自动保存**：导入或修改的主题会自动保存，下次打开自动加载上次主题
- **导入主题加入预设菜单**：导入的主题会自动出现在「🎨 主题」预设下拉框中，方便以后切换
- **保存当前主题**：菜单栏新增「💾 保存主题」，可将当前编辑的主题保存到预设主题列表

- **代码语法高亮**：内置轻量高亮，支持 Python / JavaScript / JSON / Bash / Keepalived 等
- **内置 Keepalived 配置语法高亮**：使用 ` ```keepalived ` 代码块即可高亮 LVS/Keepalived 配置
- **Bash 深度高亮**：识别常用命令、软件包命令、LVM/LVS/Systemd 命令、长短选项、符号和行首 `$` 提示符
- **Shell 兼容**：`shell` / `sh` / `zsh` / `ksh` / `console` / `terminal` 代码块统一使用 Bash 高亮规则
- **INI / CONF / YAML 深度高亮**：注释、字符串、IP、数字、`$` 变量；INI 区分 `key = value`，CONF 区分 `key value`，YAML 区分 `key: value`

- **正文字号 / 代码字号调节**：在主题面板中可分别调整
- **支持原生 HTML / Markdown 图片**：可直接渲染 `<img src="..." width="600">` 和 `![](图片路径)`，打开文件夹时会自动解析相对路径图片
- **默认目录**：使用“打开文件夹”时，支持 File System Access API 的浏览器会自动记住目录，下次启动尝试自动加载；也可点击“默认目录”按钮手动恢复
- **行内代码与代码块独立配置**：行内代码和代码块可分别设置字号、文字颜色、背景色
- **工作区内部跳转**：支持 `[文字](./其他.md#标题锚点)` 在工作区内切换文档并定位到标题



- **高度自定义代码块配色**：
  - 内置 GitHub Light / GitHub Dark / Atom One Dark / Dracula / Solarized Light / Keepalived Config 等预设
  - 可单独修改关键字、字符串、注释、数字、函数、变量、类型等 42 项颜色
    - 支持高级 CSS 覆盖，可针对具体语言进一步定制（例如 `.language-python .hljs-keyword`）

  - 实时预览
  - 主题可导出 / 导入为 JSON，自动保存在浏览器本地

## 使用方法

本项目是纯静态页面，直接打开 `index.html` 即可使用，**完全离线可用，不依赖任何 CDN**。

也可以启动本地静态服务器：

```bash
# 在项目目录下执行
python serve.py
# 或使用 Python 自带的 http.server
python -m http.server 8000
```

然后访问 <http://localhost:8000>。

### 打开文档

- 点击「打开文件」选择单个 `.md` / `.markdown` / `.txt` 文件
- 点击「打开文件夹」选择整个文件夹，侧边栏会列出其中所有 Markdown 文档
- 也可以直接把文件或文件夹拖入窗口

### 自定义代码主题

1. 点击顶部「🎨 主题」按钮
2. 选择一个预设主题，或直接在列表中修改颜色
   - Keepalived 配置可直接选择 **Keepalived Config** 预设，或点击「导入主题」选择 `themes/keepalived.theme.json`

3. 修改会实时应用到代码块，并自动保存到浏览器 `localStorage`
4. 可点击「下载主题 JSON」保存，之后通过「导入主题」复用

## 项目结构

```text
markdownviewer/
├── index.html          # 页面结构
├── app.js              # 主入口，自动加载 js/ 下的子配置
├── hutao.ico            # 主目录图标（favicon / header 图标）
├── compute_icon_hash.py # 计算 hutao.ico 的 SHA-256 哈希码

├── css/
│   └── style.css       # 应用布局 / 侧边栏 / 主题面板样式
├── js/
│   ├── app.js          # Markdown 渲染、文件浏览、主题定制逻辑
│   ├── bash.js         # Bash 代码块高亮配置
│   ├── ini.js          # INI 代码块高亮配置
│   ├── conf.js         # CONF 代码块高亮配置
│   ├── keepalived.js   # Keepalived 代码块高亮配置
│   ├── python.js       # Python 代码块高亮配置
│   ├── javascript.js   # JavaScript 代码块高亮配置
│   ├── json.js         # JSON 代码块高亮配置
│   └── yaml.js         # YAML 代码块高亮配置
├── serve.py            # 可选：本地静态服务器
├── sample.md           # 示例文档
├── keepalived.md       # Keepalived 配置高亮示例
├── themes/
│   └── keepalived.theme.json # Keepalived 配色主题，可直接导入
├── make_backup.py       # 按当前版本号生成 zip 备份
└── README.md

```

## 技术栈

- 原生 JavaScript 内置 Markdown 渲染器（离线可用）
- 原生 JavaScript 内置轻量语法高亮（支持 Keepalived、Python、JavaScript、JSON、Bash 等）
- 纯 CSS 实现 GitHub 风格基础样式
- 不依赖任何 CDN 或外部网络资源
