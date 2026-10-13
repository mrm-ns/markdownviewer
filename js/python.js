/* Python 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.python = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:def|return|if|elif|else|for|while|import|from|class|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|assert|raise|in|not|and|or|is|None|True|False)\b/ },
    { className: 'built_in', pattern: /\b(?:print|len|range|type|str|int|float|list|dict|set|tuple|enumerate|zip|map|filter|open|sum|min|max|sorted|reversed|isinstance|super|self)\b/ }
  ];
})();
