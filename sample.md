# Markdown Viewer 示例

这是一个 **GitHub 风格**的 Markdown 文档浏览器示例。

## 功能亮点

- [x] 打开单个 Markdown 文件
- [x] 打开整个文件夹并浏览
- [x] 基础 GFM 渲染（标题、列表、表格、引用、任务列表等）
- [x] 代码块语法高亮
- [x] 高度自定义代码块配色，支持导入 / 导出主题

## 代码块示例

### Python

```python
def greet(name: str) -> str:
    """返回问候语"""
    # 这是一条注释
    message = f"Hello, {name}!"
    return message

print(greet("GitHub"))
```

### JavaScript

```javascript
// 自定义配色可以单独修改每个语法类别
const colors = {
  keyword: '#cf222e',
  string: '#0a3069',
  comment: '#6e7781'
};

document.querySelectorAll('pre code').forEach((block) => {
  console.log(block.textContent.length);
});
```

### JSON

```json
{
  "name": "markdown-viewer",
  "version": "1.0.0",
  "features": ["github-style", "custom-theme", "syntax-highlight"]
}
```

## 引用

> GitHub 风格参考自 GitHub Markdown 渲染样式。
> 点击右上角「🎨 主题」即可实时修改代码配色。

## 表格

| 功能 | 说明 |
| --- | --- |
| 打开文件 | 支持 `.md`、`.markdown`、`.txt` |
| 打开文件夹 | 自动列出文件夹内所有 Markdown 文档 |
| 主题定制 | 覆盖关键字、字符串、注释、函数、变量等 38 项配色 |

## 行内代码

使用 `markdown-it` 解析，配合 `highlight.js` 高亮。

## 结语

打开右侧主题面板，打造属于你自己的代码配色吧！
