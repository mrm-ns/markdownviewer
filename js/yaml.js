/* YAML 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  var yamlRules = [
    // 行注释（允许前导空格）
    { className: 'comment', pattern: /(?<!\S)#[^\n]*/ },
    // 引号字符串
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    // 数字（IPv4 和普通数字，含端口号）
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    // 变量（$VAR 或 ${VAR}）
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    // 布尔值和 null
    { className: 'literal', pattern: /\b(?:true|false|null|yes|no|on|off|~)\b/i },
    // 属性键：行首冒号前的标识符，支持列表项前缀（"- "）
    { className: 'attribute', pattern: /(?<=^\s*(?:-\s+)?)[A-Za-z_][A-Za-z0-9_.-]*(?=\s*:)/ },
    // 冒号后的未加引号简单值（例如 URL、路径等）
    { className: 'unquoted', pattern: /(?<=:\s*)[A-Za-z_][A-Za-z0-9_.\/:@-]*/ },
    // 符号（注意：- 和 , 等会在列表项/数组中使用）
    { className: 'symbol', pattern: /[>+*()@!~=|&;{}\[\]:?,-]/ }
  ];

  // 同时支持 yaml 和 yml
  window.MD_SYNTAX_RULES.yaml = yamlRules;
  window.MD_SYNTAX_RULES.yml = yamlRules;
})();