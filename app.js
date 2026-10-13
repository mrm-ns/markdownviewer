/* ============================================================
 * Markdown Viewer 入口（主目录）
 * 自动加载 js/ 目录下的语法子配置，然后加载核心 app.js
 *
 * 启动前会校验主目录图标 hutao.ico 的 SHA-256 哈希码。
 * 如果图标不是指定的文件，应用将无法启动。
 * ============================================================ */
(function () {
  'use strict';

  // 校验哈希码
  var EXPECTED_ICON_HASH = '52cb104b77752e0431aa48cb161b125f579590bdc00fd1d3aa978248a0d405b5';

  // 这里列出 js/ 目录下的子配置文件
  // 以后新增语法配置时，把文件放进 js/ 并在这里加一行即可
  var CONFIG_FILES = [
    'js/bash.js',
    'js/ini.js',
    'js/conf.js',
    'js/keepalived.js',
    'js/python.js',
    'js/javascript.js',
    'js/json.js',
    'js/yaml.js'
  ];

  function showFatalError(message) {
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0d1117;color:#f85149;display:flex;align-items:center;justify-content:center;font-family:monospace;font-size:14px;padding:40px;text-align:center;';
    div.textContent = message;
    document.body.appendChild(div);
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () {
        console.warn('[Markdown Viewer] 子配置加载失败: ' + src);
        resolve();
      };
      document.head.appendChild(s);
    });
  }

  async function verifyIcon() {
    if (EXPECTED_ICON_HASH === 'REPLACE_WITH_SHA256') {
      showFatalError('图标哈希码未配置。\n请运行 python compute_icon_hash.py 获取 hutao.ico 的 SHA-256，并填写到 app.js 的 EXPECTED_ICON_HASH。');
      return false;
    }

    var response = await fetch('hutao.ico', { cache: 'no-store' });
    if (!response.ok) {
      showFatalError('无法读取主目录图标 hutao.ico，应用无法启动。');
      return false;
    }

    var buffer = await response.arrayBuffer();
    var hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    var hashHex = hashArray.map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');

    if (hashHex.toLowerCase() !== EXPECTED_ICON_HASH.toLowerCase()) {
      showFatalError('图标校验失败：当前 hutao.ico 不是预期的图标，应用无法启动。');
      return false;
    }

    return true;
  }

  verifyIcon().then(function (ok) {
    if (!ok) return;
    return Promise.all(CONFIG_FILES.map(loadScript))
      .then(function () {
        return loadScript('js/app.js');
      });
  }).catch(function (e) {
    console.error('[Markdown Viewer] 初始化失败', e);
    showFatalError('应用初始化失败：' + (e && e.message ? e.message : e));
  });
})();
