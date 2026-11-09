# 环境要求

## 必需环境

- **现代浏览器**
  - 推荐：Chrome / Edge
  - 支持：Firefox、Safari 等现代浏览器
- 无需安装 Node.js、npm、数据库或任何第三方依赖
- 所有资源均为本地文件，不依赖 CDN，无需联网

## 推荐环境：本地服务器（支持 PDF 导出）

### Python 3.6+

用于启动本地静态服务器，提供 PDF 导出 API：

```bash
python serve.py
```

然后访问：

```text
http://localhost:8000
```

也可使用 `start.bat`（Windows）或 `start.sh`（Linux/macOS）自动启动。

> **无需第三方依赖**：`serve.py` 仅使用 Python 标准库，不需要 pip 安装任何包，也不需要虚拟环境（venv）。
> 服务器已内置 HTTP/1.1 keep-alive、gzip 压缩与 304 条件缓存，刷新和二次访问都很快。

### Prince（PDF 导出必需）

`serve.py` 的 PDF 导出功能通过 [Prince](https://www.princexml.com/) 命令行工具将 HTML 转换为 PDF。

- 下载地址：<https://www.princexml.com/download/>
- 安装后将 `prince` 命令添加到系统环境变量（PATH）
- 验证安装：在终端执行 `prince --version` 应显示版本信息
- 无需 Prince 也能正常浏览 Markdown 文档，仅「导出 PDF」功能需要

## 功能与环境对应关系

| 功能 | 环境要求 |
| --- | --- |
| Markdown 渲染 / 高亮 / 主题 / 搜索 | 仅浏览器即可 |
| 打开代码 / 配置文件（`.txt` / `.py` / `.sh` / `.json` / `.yaml` / `Dockerfile` 等，按语法高亮） | 仅浏览器即可 |
| 本地静态服务器 | Python 3.6+ |
| 导出 PDF | Python 3.6+ + Prince |
| 默认目录自动打开 / 编辑写回磁盘 | Chrome / Edge 的 File System Access API |
| 右键重命名（真实磁盘） | Chrome / Edge + 读写权限目录 |

## 启动方式

### 方式一：直接打开（无需安装）

双击 `index.html` 即可使用基础浏览功能。

> 注意：`file://` 协议下浏览器限制较多（图片无法在新标签页打开、不支持 PDF 导出等），建议使用本地服务器。

### 方式二：使用本地服务器（推荐，支持 PDF 导出）

Windows：

```bat
start.bat
```

Linux / macOS：

```bash
./start.sh
```

或手动执行：

```bash
python serve.py
```

然后访问：

```text
http://localhost:8000
```

## 目录结构（部署态）

```
markdownviewer/
├── index.html              # 页面入口
├── app.js                  # 主入口
├── css/style.css           # 所有样式
├── js/                     # 代码块高亮规则
├── themes/                 # 主题 JSON 文件
├── serve.py                # 本地服务器 + PDF 导出 API
├── start.bat / start.sh    # 启动脚本
├── hutao.ico               # 应用图标
├── README.md
└── ENVIRONMENT.md
```