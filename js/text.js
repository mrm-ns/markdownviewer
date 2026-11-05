/* Text 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.text = [
    // # 开头为注释
    { className: 'comment', pattern: /^\s*#[^\n]*|\/\*[\s\S]*?\*\// },
    // "" 内为字符串
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    // () [] >< +-= 以及 1. 2. 这类序号
    { className: 'symbol', pattern: /\b\d+\.(?=\s|$)|[()\[\]><+\-=*\/]/ }
  ];
})();