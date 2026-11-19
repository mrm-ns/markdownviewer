/* CONF / Nginx 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.conf = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*/ },
    // 值规则必须用 [^\S\n]（水平空白）而不是 \s：\s 含 \n，会跨越行边界
    // 把下一行的关键字一并吃掉，导致「除第一行外所有值同色」的串色（详见 AGENTS §6.18）
    { className: 'string', pattern: /(?<=\S)[^\S\n]+[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];
})();
