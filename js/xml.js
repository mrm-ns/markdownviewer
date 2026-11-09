/* XML 代码块高亮子配置 */
(function () {
  'use strict';

  window.MD_SYNTAX_RULES = window.MD_SYNTAX_RULES || {};

  // 规则顺序即优先级：highlightWithRules 会把各 pattern 用 ")|(" 拼成一个正则整体左到右扫描，
  // 在同一个起始位置上「先列出的规则」胜出。因此注释 / CDATA / 声明必须排在标签规则之前——
  // 否则 "<!--"、"<![CDATA["、"<?xml" 开头的 "<" 会先被标签规则吃掉，后面的内容就串色了。
  //
  // 两条硬约束（改规则时务必守住）：
  //   1. 任何 pattern 都不许出现捕获组。引擎靠 m[i+1] 判断命中了第几条规则，
  //      多一个捕获组就会让其后所有规则整体错位（这正是 §6 里警告过的坑），分组一律写 (?:...)。
  //   2. 零长度匹配会被引擎跳过，所以不要写形如 \b 这样能匹配空串的规则。
  //
  // 这里只用已有的主题类名（comment / string / meta / tag / name / attribute / literal），
  // 不新增颜色项，因此不需要改 COLOR_DEFS / BASE_COLORS，也不需要动 themeCss。
  //
  // 着色分工（尖括号与标签名分开，左右尖括号务必同色，否则一个标签会花掉）：
  //   <  </  >  />  → tag       （默认主题绿）
  //   标签名         → name      （默认主题蓝，比尖括号醒目）
  //   属性名         → attribute
  //   属性值         → string
  window.MD_SYNTAX_RULES.xml = [
    // 注释优先于一切：允许跨行，用惰性匹配，否则多个注释会被并成一大段
    { className: 'comment', pattern: /<!--[\s\S]*?-->/ },
    // CDATA 里是原样文本，整段当字符串，避免其中的 < > 被后面的标签规则误判
    { className: 'string', pattern: /<!\[CDATA\[[\s\S]*?\]\]>/ },
    // XML 声明与处理指令：<?xml version="1.0"?> / <?php ... ?>
    { className: 'meta', pattern: /<\?[\s\S]*?\?>/ },
    // DOCTYPE / ENTITY / ATTLIST 等声明（<![CDATA[ 以 "[" 紧跟，不会落到这条上）
    { className: 'meta', pattern: /<![A-Za-z][^>]*>/ },
    // 尖括号用 tag 色：< 与 </ 同色，收尾的 > 与 /> 也是 tag 色。
    // 为什么后面要加 (?=[A-Za-z_])：只把「真的开了个标签」的 < 染色，
    // 正文里孤零零的 <（严格 XML 里本该写成 &lt;）就不会被误染。
    { className: 'tag', pattern: /<\/?(?=[A-Za-z_])/ },
    // 标签名另用 name 色（紧跟 < 或 </ 之后），比尖括号更醒目；
    // 含命名空间前缀与连字符（<xsl:template、<my-tag）
    { className: 'name', pattern: /(?<=<\/?)[A-Za-z_][\w.:-]*/ },
    // 属性名：靠「后面紧跟 =」判定。不能只写 [\w-]+，否则正文里的普通单词会被整片染成属性色
    { className: 'attribute', pattern: /[A-Za-z_][\w.:-]*(?=\s*=)/ },
    // 属性值：单双引号都支持。要求前面是 "="，否则正文里的英文撇号
    // （如 <msg>don't</msg>）会与后面的撇号凑成一对，把中间一大段正文误染成字符串
    { className: 'string', pattern: /(?<==\s*)(?:"[^"]*"|'[^']*')/ },
    // 实体引用：&amp; &#38; &#x26;
    { className: 'literal', pattern: /&#?\w+;/ },
    // 标签收尾：与开头的 < 同为 tag 色，左右对称
    { className: 'tag', pattern: /\/?>/ }
  ];
})();
