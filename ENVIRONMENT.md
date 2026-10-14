# 环境要求

## 必需环境

- 现代浏览器
  - 推荐：Chrome / Edge
  - 支持：Firefox、Safari 等现代浏览器
- 无需安装 Node.js、npm、数据库或任何第三方依赖

## 推荐环境

- Python 3.6 或更高版本
  - 用于启动本地静态服务器：`python serve.py`
  - 用于生成备份：`python make_backup.py`
  - 用于计算图标哈希：`python compute_icon_hash.py`
- 如果不想使用 Python，也可以直接双击打开 `index.html`

## 功能与环境对应关系

| 功能 | 环境要求 |
| --- | --- |
| Markdown 渲染 / 高亮 / 主题 | 仅浏览器即可 |
| 本地静态服务器 | Python 3.6+ |
| 默认目录自动打开 | Chrome / Edge 的 File System Access API |
| 图标哈希校验 | 浏览器 Web Crypto + 本地服务器或允许 fetch 的环境 |
| 右键重命名（真实磁盘） | Chrome / Edge + 读写权限目录 |

## 网络要求

- 不需要联网
- 所有资源均为本地文件
- 不依赖 CDN

## 启动方式

### 方式一：直接打开

双击 `index.html` 即可使用。

> 注意：直接使用 `file://` 打开时，浏览器通常禁止读取本地文件，因此会跳过图标哈希校验；通过本地服务器打开时才会执行严格校验。


### 方式二：使用本地服务器（推荐）

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
