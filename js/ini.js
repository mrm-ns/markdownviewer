/* INI 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.ini = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'section', pattern: /^\[[^\]]+\]/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*(?=\s*=)/ },
    { className: 'string', pattern: /(?<==)\s*[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];
})();
