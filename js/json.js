/* JSON 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.json = [
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'literal', pattern: /\b(?:true|false|null)\b/ }
  ];
})();
