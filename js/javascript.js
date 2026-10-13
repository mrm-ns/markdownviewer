/* JavaScript 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  window.MD_SYNTAX_RULES.javascript = [
    { className: 'comment', pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { className: 'string', pattern: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|import|export|from|try|catch|finally|throw|async|await|typeof|instanceof|in|of|this|null|undefined|true|false)\b/ },
    { className: 'built_in', pattern: /\b(?:console|document|window|Math|JSON|Object|Array|String|Number|Boolean|Promise|setTimeout|setInterval|require|module|process)\b/ }
  ];
})();
