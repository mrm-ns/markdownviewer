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

  // 锚点的「宽容键」：只保留字母 / 数字 / 汉字，丢掉一切的标点、空格、连字符与大小写。
  // 为什么需要：标题 id 是 slugify() 生成的 —— 它会把标题里的标点整段删掉
  // （`## 四、Kubernetes 安装` → id `四kubernetes-安装`），而笔记里跨文档引用的
  // fragment 往往是**照标题原文手写**的（`#四、Kubernetes-安装`）。
  // 两者字面不等 → getElementById 落空 → 表现为「文档打开了，但不跳到标题」。
  function anchorLooseKey(text) {
    return String(text || '').replace(ALLOWED_HTML_TAG_RE, '').toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]/g, '');
  }

  // 由 fragment 找到目标元素：① 精确 id；② 按渲染器同一规则归一后再查 id；
  // ③ 兜底逐个标题比较「宽容键」（容忍手写 fragment 与 id 在标点/大小写上的差异）。
  function findAnchorElement(anchor) {
    let raw = String(anchor || '').trim();
    if (!raw) return null;
    // fragment 可能带百分号编码（页内 `#%E5%9B%9B...` 不经过调用方解码），两种都试
    const candidates = [raw];
    try {
      const decoded = decodeURIComponent(raw);
      if (decoded !== raw) candidates.push(decoded);
    } catch (e) {
      // 非法编码：只用原样
    }
    for (let i = 0; i < candidates.length; i++) {
      const exact = document.getElementById(candidates[i]);
      if (exact) return exact;
    }
    for (let i = 0; i < candidates.length; i++) {
      const slug = slugify(candidates[i]);
      if (!slug) continue;
      const bySlug = document.getElementById(slug);
      if (bySlug) return bySlug;
    }
    const key = anchorLooseKey(raw);
    if (!key) return null;
    const keys = candidates.map(anchorLooseKey);
    const headings = document.querySelectorAll('#markdown-body h1, #markdown-body h2, #markdown-body h3, #markdown-body h4, #markdown-body h5, #markdown-body h6');
    let hit = null;
    headings.forEach(function (h) {
      if (hit) return;
      const idKey = anchorLooseKey(h.id);
      const textKey = anchorLooseKey(h.textContent);
      if (keys.indexOf(idKey) >= 0 || keys.indexOf(textKey) >= 0) hit = h;
    });
    return hit;
  }

  function scrollToAnchor(anchor) {
    if (!anchor) return;
    const el = findAnchorElement(anchor);
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
