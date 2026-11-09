  // ---------- 工具函数 ----------
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  // Markdown 文档：按 Markdown 语法排版渲染
  function isMarkdownFile(name) {
    return /\.(md|markdown|mdown|mkd)$/i.test(name);
  }

  // 扩展名 → 代码块语言：这类文件按对应语言的代码块规则高亮显示（不做 Markdown 解析）
  const EXT_LANG_MAP = {
    txt: 'text',
    bash: 'bash', sh: 'bash', zsh: 'bash', ksh: 'bash',
    py: 'python',
    js: 'javascript',
    json: 'json',
    yaml: 'yaml', yml: 'yaml',
    ini: 'ini',
    conf: 'conf',
    sql: 'sql',
    promql: 'promql',
    // XML 家族。注意**不要**加 svg：isSupportedFile() 先于 isImageFile() 判断，
    // 加了会让 Markdown 里引用的 .svg 图片被当成代码文件打开，图片就不显示了。
    xml: 'xml', xsl: 'xml', xslt: 'xml', xsd: 'xml'
  };

  // 按文件名（无扩展名）识别的文件
  const FILENAME_LANG_MAP = {
    dockerfile: 'dockerfile',
    containerfile: 'dockerfile'
  };

  // 取文件名（去掉目录部分）
  function baseName(nameOrPath) {
    return String(nameOrPath || '').replace(/^.*[\\/]/, '');
  }

  // 返回该文件应使用的代码块语言；Markdown 或未识别的类型返回 ''
  function getFileLang(nameOrPath) {
    const base = baseName(nameOrPath).toLowerCase();
    if (!base) return '';
    if (FILENAME_LANG_MAP[base]) return FILENAME_LANG_MAP[base];
    const dot = base.lastIndexOf('.');
    if (dot < 0 || dot === base.length - 1) return '';
    const ext = base.slice(dot + 1);
    return EXT_LANG_MAP[ext] || '';
  }

  // 是否为「按代码块显示的代码/配置文件」
  function isCodeFile(nameOrPath) {
    return !!getFileLang(nameOrPath);
  }

  // 是否可加入文档列表：Markdown 文档 或 代码/配置文件
  function isSupportedFile(name) {
    return isMarkdownFile(name) || isCodeFile(name);
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
