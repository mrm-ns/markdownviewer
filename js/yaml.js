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
    // <占位内容>：尖括号自身按符号色、中间内容按变量色，与 bash 保持一致。
    // 这条规则与 js/bash.js 里的同名规则一致，两处要一起改。
    // 内容限定「不含空白」是有意的：若允许空白，比较式 cond: a < b 这类写法里
    // 两个尖括号之间的整段文本会被当成变量染色，误伤远大于收益。
    // YAML 里几个容易误伤的写法实测都不受影响：
    //   块标量 key: > / key: >- / key: |、合并键 <<: *default、比较符 a < b，
    //   它们要么「尖括号紧跟非空白」、要么「没有成对的尖括号」，都不会匹配。
    // 已知代价：值里写 XML 片段（如 html: <b>粗体</b>）会把标签名 b、/b 染成变量色，
    //   但整段仍可读，且 YAML 里直接内嵌 XML 属少见写法，取舍上可接受。
    { className: 'variable', pattern: /(?<=<)[^\s<>]+(?=>)/ },
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
