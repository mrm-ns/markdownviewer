  // ---------- 内置 Markdown 渲染（离线可用） ----------
  function highlightWithRules(code, rules) {
    // 无规则时直接转义，避免空正则 '()' 造成零长度匹配死循环
    if (!rules || !rules.length) return escapeHtml(code);
    const combined = '(' + rules.map(function (r) { return r.pattern.source; }).join(')|(') + ')';
    const regex = new RegExp(combined, 'gim');
    let result = '';
    let last = 0;
    let m;
    while ((m = regex.exec(code)) !== null) {
      // 零长度匹配（如规则形如 \b）不推进 lastIndex，手动跳过防止死循环
      if (m.index === regex.lastIndex) {
        regex.lastIndex++;
        continue;
      }
      result += escapeHtml(code.slice(last, m.index));
      for (let i = 0; i < rules.length; i++) {
        if (m[i + 1] !== undefined) {
          result += '<span class="hljs-' + rules[i].className + '">' + escapeHtml(m[i + 1]) + '</span>';
          break;
        }
      }
      last = regex.lastIndex;
    }
    result += escapeHtml(code.slice(last));
    return result;
  }

  const KEEPALIVED_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+\b/ },
    { className: 'literal', pattern: /\b(?:MASTER|BACKUP|NAT|DR|PASS|TCP|LVS_MASTER|LVS_SLAVE)\b/ },
    { className: 'keyword', pattern: /\b(?:global_defs|vrrp_instance|virtual_server|real_server|authentication)\b/ },
    { className: 'built_in', pattern: /\b(?:router_id|state|interface|virtual_router_id|priority|advert_int|auth_type|auth_pass|virtual_ipaddress|delay_loop|lb_algo|lb_kind|persistence_timeout|protocol|weight|connect_timeout|retry|delay_before_retry)\b/ }
  ];

  const PYTHON_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:def|return|if|elif|else|for|while|import|from|class|try|except|finally|with|as|pass|break|continue|lambda|yield|global|nonlocal|assert|raise|in|not|and|or|is|None|True|False)\b/ },
    { className: 'built_in', pattern: /\b(?:print|len|range|type|str|int|float|list|dict|set|tuple|enumerate|zip|map|filter|open|sum|min|max|sorted|reversed|isinstance|super|self)\b/ }
  ];

  const JS_RULES = [
    { className: 'comment', pattern: /\/\/[^\n]*|\/\*[\s\S]*?\*\// },
    { className: 'string', pattern: /`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'keyword', pattern: /\b(?:function|return|const|let|var|if|else|for|while|do|switch|case|break|continue|new|class|extends|super|import|export|from|try|catch|finally|throw|async|await|typeof|instanceof|in|of|this|null|undefined|true|false)\b/ },
    { className: 'built_in', pattern: /\b(?:console|document|window|Math|JSON|Object|Array|String|Number|Boolean|Promise|setTimeout|setInterval|require|module|process)\b/ }
  ];

  const JSON_RULES = [
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"/ },
    { className: 'number', pattern: /\b\d+(?:\.\d+)?\b/ },
    { className: 'literal', pattern: /\b(?:true|false|null)\b/ }
  ];

  const BASH_RULES = [
    // 与 js/bash.js 保持一致：见该文件说明，# 仅在行首或左侧全为空白时才是注释
    { className: 'comment', pattern: /(?<!\S)#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d+\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'bashPrompt', pattern: /^\s*\$[ \t]/ },
    { className: 'bashOption', pattern: /(?:^|\s)(?:-[a-zA-Z][a-zA-Z0-9_-]*|--[a-zA-Z0-9][a-zA-Z0-9_-]*)/ },
    { className: 'symbol', pattern: /[><+*()@!~=|&;{}\[\]:?]/ },
    { className: 'keyword', pattern: /\b(?:if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|export|local|read|cd|source|sudo|dnf|yum|apt|apt-get|dpkg|rpm|pacman|zypper|vim|vi|nano|emacs|grep|egrep|fgrep|sed|awk|cat|less|more|tail|head|ip|ifconfig|netstat|ping|traceroute|curl|wget|nmap|tcpdump|ss|route|arp|hostname|dig|nslookup|ssh|scp|rsync|cobbler|cobblerd|ipvsadm|keepalived|openssl|systemctl|journalctl|systemd-analyze|systemd-cat|pvcreate|pvdisplay|pvs|pvscan|pvremove|pvchange|pvresize|vgcreate|vgdisplay|vgs|vgscan|vgremove|vgchange|vgextend|vgreduce|vgconvert|lvcreate|lvdisplay|lvs|lvscan|lvremove|lvchange|lvextend|lvreduce|lvresize|lvconvert|lvm|mkfs|mount|umount|blkid|lsblk|fdisk|parted|ls|pwd|cp|mv|rm|mkdir|rmdir|touch|chmod|chown|ln|tar|unzip|zip|gzip|gunzip|xz|ps|kill|pkill|jobs|bg|fg|nohup|service|chkconfig|useradd|usermod|userdel|groupadd|passwd|su|history|clear|alias|unalias|test)\b/ }
  ];


  const INI_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'section', pattern: /^\[[^\]]+\]/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*(?=\s*=)/ },
    { className: 'string', pattern: /(?<==)\s*[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];

  const CONF_RULES = [
    { className: 'comment', pattern: /#[^\n]*/ },
    { className: 'string', pattern: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/ },
    { className: 'number', pattern: /\b\d{1,3}(?:\.\d{1,3}){3}\b|\b\d+(?:\.\d+)?\b/ },
    { className: 'variable', pattern: /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/ },
    { className: 'attribute', pattern: /^\s*[A-Za-z_][A-Za-z0-9_.-]*/ },
    { className: 'string', pattern: /(?<=\S)\s+[A-Za-z_][A-Za-z0-9_.\/:@-]*/ }
  ];

  function detectLanguage(code) {
    const s = code || '';
    if (/vrrp_instance|global_defs|virtual_server|real_server/.test(s)) return 'keepalived';
    // XML：只认显式声明，不能靠「有尖括号」判断——那样会把 HTML 片段、C++ 模板
    // 甚至 Markdown 里的 <br> 都判成 XML，反而把颜色搞乱
    if (/^\s*<\?xml\b/i.test(s) || /^\s*<[A-Za-z_][\w.:-]*(?:\s[^>]*)?>\s*\n[\s\S]*<\/[A-Za-z_][\w.:-]*>\s*$/i.test(s)) return 'xml';
    // Dockerfile：行首为 FROM 且存在其他 Dockerfile 指令
    if (/^[ \t]*FROM\s+\S+/im.test(s) && /^[ \t]*(?:RUN|CMD|COPY|ADD|ENV|LABEL|WORKDIR|ENTRYPOINT|EXPOSE|ARG|VOLUME|USER)\s/im.test(s)) return 'dockerfile';
    if (/^\s*\{[\s\S]*"\s*:\s*/.test(s) || (/^\s*\[/.test(s) && /"\s*:/.test(s))) return 'json';
    if (/^\s*[A-Za-z_][A-Za-z0-9_.-]*:\s+\S+/m.test(s) && !/\bdef\s+\w+\s*\(/.test(s)) return 'yaml';
    if (/\bdef\s+\w+\s*\(/.test(s) || (/\bimport\s+\w+/.test(s) && /:\s*$/.test(s))) return 'python';
    if (/\bfunction\s+\w+\s*\(|=>|\bconst\s+\w+\s*=/.test(s)) return 'javascript';
    if (/^\s*#!\/bin\/bash|\becho\s+|\bsudo\s+/.test(s)) return 'bash';
    if (/^\s*(server\s*\{|location\s+)/m.test(s)) return 'nginx';
    return '';
  }

  // 归一化代码围栏语言名：兼容带空格/大小写/别名写法
  // 例如「Plain Text」「plain text」「PlainText」「text/plain」→ text
  function normalizeFenceLang(rawLang) {
    const raw = String(rawLang || '').trim();
    if (!raw) return '';
    const lower = raw.toLowerCase();
    // 取第一个词作为主标识（Markdown 允许 ```lang 后面跟额外信息）
    const first = lower.split(/\s+/)[0];
    // 纯文本类写法统一归为 text
    if (/^(plain|plaintext|text|txt)$/.test(first)) return 'text';
    if (/^text\/(plain|txt)$/.test(lower)) return 'text';
    // 其余语言按首个词返回，并把常见别名归一
    if (first === 'py') return 'python';
    if (first === 'js' || first === 'node' || first === 'nodejs') return 'javascript';
    if (first === 'sh' || first === 'shell' || first === 'zsh' || first === 'ksh' || first === 'console' || first === 'terminal') return 'bash';
    if (first === 'yml') return 'yaml';
    if (first === 'config' || first === 'cfg') return 'conf';
    if (first === 'pql') return 'promql';
    if (first === 'docker' || first === 'containerfile') return 'dockerfile';
    if (first === 'mysql' || first === 'mariadb' || first === 'postgresql' || first === 'postgres' || first === 'sqlite' || first === 'plsql' || first === 'tsql') return 'sql';
    return first;
  }


  function getSyntaxRules(name) {
    if (window.MD_SYNTAX_RULES && window.MD_SYNTAX_RULES[name]) {
      return window.MD_SYNTAX_RULES[name];
    }
    var fallback = {
      keepalived: KEEPALIVED_RULES,
      python: PYTHON_RULES,
      javascript: JS_RULES,
      json: JSON_RULES,
      bash: BASH_RULES,
      ini: INI_RULES,
      conf: CONF_RULES,
      yaml: [],
      text: [],
      apache: [],
      nginx: [],
      promql: [],
      sql: [],
      xml: [],
      dockerfile: []
    };
    return fallback[name] || [];
  }

  // text 代码块：在规则高亮之外支持 **强调**（加粗 + 颜色）。
  // 先把 **...** 提取为令牌，避免被 symbol 规则把 * 当符号高亮，
  // 规则处理完后再还原为 <span class="hljs-strong">。
  function highlightTextCode(code) {
    const emph = [];
    const tokenized = String(code || '').replace(/\*\*([^*]+)\*\*/g, function (m, inner) {
      const token = '%%%MD_EMPH_' + emph.length + '%%%';
      emph.push('<span class="hljs-strong">**' + escapeHtml(inner) + '**</span>');
      return token;
    });
    let html = highlightWithRules(tokenized, getSyntaxRules('text'));
    emph.forEach(function (repl, i) {
      html = html.split('%%%MD_EMPH_' + i + '%%%').join(repl);
    });
    return html;
  }

  function highlightCode(code, lang) {
    const l = normalizeFenceLang(lang || detectLanguage(code) || '');
    if (l === 'keepalived' || l === 'lvs' || l.indexOf('keepalived') === 0) return highlightWithRules(code, getSyntaxRules('keepalived'));
    if (l === 'python' || l === 'py' || l.indexOf('python') === 0) return highlightWithRules(code, getSyntaxRules('python'));
    if (l === 'javascript' || l === 'js' || l === 'node' || l === 'nodejs' || l.indexOf('javascript') === 0) return highlightWithRules(code, getSyntaxRules('javascript'));
    if (l === 'json' || l.indexOf('json') === 0) return highlightWithRules(code, getSyntaxRules('json'));
    if (l === 'bash' || l === 'shell' || l === 'sh' || l === 'zsh' || l === 'ksh' || l === 'console' || l === 'terminal') return highlightWithRules(code, getSyntaxRules('bash'));
    if (l === 'ini') return highlightWithRules(code, getSyntaxRules('ini'));
    if (l === 'nginx' || l === 'conf' || l === 'config' || l === 'cfg') return highlightWithRules(code, getSyntaxRules('conf'));
    if (l === 'yaml' || l === 'yml') return highlightWithRules(code, getSyntaxRules('yaml'));
    if (l === 'text' || l === 'txt') return highlightTextCode(code);
    if (l === 'apache') return highlightWithRules(code, getSyntaxRules('apache'));
    if (l === 'sql' || l === 'mysql' || l === 'mariadb' || l === 'postgresql' || l === 'postgres' || l === 'sqlite' || l === 'plsql' || l === 'tsql') return highlightWithRules(code, getSyntaxRules('sql'));
    if (l === 'promql' || l === 'pql') return highlightWithRules(code, getSyntaxRules('promql'));
    if (l === 'dockerfile') return highlightWithRules(code, getSyntaxRules('dockerfile'));
    // XML 家族：这些围栏名写的都是 XML 文档，共用同一套规则；
    // 不收录 html —— HTML 的语法更松（属性可无引号、有自闭合空元素），套 XML 规则会串色
    if (l === 'xml' || l === 'xhtml' || l === 'xsl' || l === 'xslt' || l === 'xsd' ||
        l === 'svg' || l === 'plist' || l === 'rss' || l === 'atom' || l === 'csproj' || l === 'xaml' ||
        l === 'pom' || l === 'wsdl' || l === 'dtd') return highlightWithRules(code, getSyntaxRules('xml'));
    return escapeHtml(code);
  }
