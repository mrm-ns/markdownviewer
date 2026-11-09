/* PromQL 代码块高亮子配置（兼容 pql 标识） */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  var promqlRules = [
    // # 开头为注释
    { className: 'comment', pattern: /^\s*#[^\n]*/ },
    // 字符串（双引号或单引号，包括标签值）
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    // 数字（整数、浮点数、科学计数法及时间单位）
    { className: 'number', pattern: /\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:ms|s|m|h|d|w|y)?\b/ },
    // 指标名：标识符后跟 { 或 [ （如 node_cpu_seconds_total[5m]），用「变量」色
    { className: 'variable', pattern: /[A-Za-z_:][A-Za-z0-9_:]*(?=\s*[{[])/ },
    // 标签名：标识符后跟 =、=~、!~（排除 == 和 != 比较符，避免把 `up == 1` 的指标误判为标签），用「属性名」色
    { className: 'attribute', pattern: /[A-Za-z_][A-Za-z0-9_]*(?=\s*(?:=~|!~|=)(?!\s*=))/ },
    // 关键字：聚合操作符、修饰符、常用函数
    { className: 'keyword', pattern: /\b(?:sum|min|max|avg|stddev|stdvar|count|count_values|bottomk|topk|quantile|by|without|on|ignoring|group_left|group_right|offset|bool|and|or|unless|rate|irate|increase|delta|idelta|deriv|predict_linear|histogram_quantile|label_replace|label_join|sort|sort_desc|time|timestamp|vector|scalar|abs|absent|ceil|floor|round|exp|ln|log2|log10|sqrt|clamp_max|clamp_min|holt_winters|resets|changes|avg_over_time|min_over_time|max_over_time|sum_over_time|count_over_time|quantile_over_time|stddev_over_time|stdvar_over_time|last_over_time|present_over_time)\b/ },
    // 通用标识符（未匹配到上面的指标/标签，如裸指标 up），用「变量」色
    { className: 'variable', pattern: /\b[A-Za-z_:][A-Za-z0-9_:]*\b/ },
    // 操作符与符号（多字符操作符优先）
    { className: 'symbol', pattern: /=~|!~|==|!=|<=|>=|[+\-*/%^(){}\[\],=]/ }
  ];

  // 同时支持 promql 和 pql 两种语言标识
  window.MD_SYNTAX_RULES.promql = promqlRules;
  window.MD_SYNTAX_RULES.pql = promqlRules;
})();
