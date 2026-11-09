  // ---------- 内联 HTML 标签支持（<font color> / <br>） ----------
  // 渲染管线默认对所有正文做 HTML 转义，这里在转义前把允许的标签
  // 提取成令牌、渲染后再还原，从而支持 <font color='red'> 与 <br>。
  // 仅放行 <font>（只保留 color / size / face 属性）和 <br>，其余标签照旧转义。
  const ALLOWED_HTML_TAG_RE = /<\/?font\b[^>]*>|<br\s*\/?>/gi;

  function sanitizeAllowedTag(raw) {
    if (/^<\/font\s*>/i.test(raw)) return '</font>';
    if (/^<br\s*\/?>/i.test(raw)) return '<br>';
    // <font ...>：仅保留 color / size / face 属性，其余（含事件属性）全部丢弃
    const attrRe = /\b(color|size|face)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
    const attrs = [];
    let m;
    while ((m = attrRe.exec(raw))) {
      attrs.push(m[1].toLowerCase() + '=' + m[2]);
    }
    return attrs.length ? '<font ' + attrs.join(' ') + '>' : '<font>';
  }

  function extractAllowedHtmlTags(text) {
    const tags = [];
    const replaced = String(text || '').replace(ALLOWED_HTML_TAG_RE, function (match) {
      const token = '%%%MD_HTML_TAG_' + tags.length + '%%%';
      tags.push({ token: token, html: sanitizeAllowedTag(match) });
      return token;
    });
    return { text: replaced, tags: tags };
  }

  function restoreAllowedHtmlTags(text, tags) {
    tags.forEach(function (t) {
      text = text.split(t.token).join(t.html);
    });
    return text;
  }

  // 行内渲染：转义前提取 <font>/<br>，转义 + markdown 行内解析后还原
  function inlineRender(raw) {
    const extracted = extractAllowedHtmlTags(raw);
    const out = builtinInline(escapeHtml(extracted.text));
    return restoreAllowedHtmlTags(out, extracted.tags);
  }

  function builtinTableRow(line) {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
  }

  function builtinParseList(lines, start, baseOffset) {
    const offset = baseOffset || 0;
    const ordered = /^\s*\d+\.\s+/.test(lines[start]);
    const items = [];
    let i = start;
    const markerRe = ordered ? /^(\s*)(\d+)\.\s+(.*)$/ : /^(\s*)([-*+])\s+(.*)$/;
    while (i < lines.length) {
      const m = lines[i].match(markerRe);
      if (!m) break;
      const itemLine = i;
      const indent = m[1].length;
      const content = m[3];
      const contentIndent = indent + m[2].length + 1;
      const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
      let inner;
      if (task) {
        const checked = task[1] !== ' ' ? ' checked' : '';
        inner = '<input type="checkbox" disabled' + checked + '> ' + inlineRender(task[2]);
      } else {
        inner = inlineRender(content);
      }
      i++;

      // 收集当前列表项下缩进的内容（嵌套引用、代码块、图片、嵌套列表等）
        const nestedStart = i;

      const nestedLines = [];
      while (i < lines.length) {
        const line = lines[i];
        const lineIndent = (line.match(/^\s*/) || [''])[0].length;
        const trimmed = line.trim();

        if (trimmed === '') {
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === '') j++;
          if (j < lines.length) {
            const nextIndent = (lines[j].match(/^\s*/) || [''])[0].length;
            if (nextIndent > indent) {
              nestedLines.push('');
              i++;
              continue;
            }
          }
          break;
        }

        // 同一层级的下一个列表项，结束当前项
        if (/^\s*([-*+]|\d+\.)\s+/.test(line) && lineIndent <= indent) break;

        if (lineIndent > indent) {
          nestedLines.push(line.slice(Math.min(contentIndent, line.length)));
          i++;
        } else {
          break;
        }
      }

      let nestedHtml = '';
      if (nestedLines.length) {
        nestedHtml = builtinMarkdown(nestedLines.join('\n'), nestedStart + offset);
      }
      // data-source-end 指向本项整棵子树的末行（循环退出时 i 已是下一项的首行）。
      // 必须写在 li 上：仅靠 data-source-line 推不出末行，computeBlockEndLine 的通用分支
      // 遇到嵌套子列表会提前收尾（"- a / - a1 / - a11" 会算成只占 1 行），
      // 缩进功能要按整棵子树一起平移，少算一行就会把子项拆成同级。
      items.push('<li data-source-line="' + (itemLine + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + inner + nestedHtml + '</li>');
    }
    const tag = ordered ? 'ol' : 'ul';
    return { html: '<' + tag + ' data-source-line="' + (start + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + items.join('') + '</' + tag + '>', next: i };
  }

  function builtinMarkdown(text, baseOffset) {
    const offset = baseOffset || 0;
    const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^\s*$/.test(line)) {
        i++;
        continue;
      }

      // 围栏语言名允许包含空格（如 ```Plain Text），与标准 Markdown 一致
      const fence = line.match(/^\s*```(.*)$/);
      if (fence) {
        const fenceStart = i;
          const lang = normalizeFenceLang((fence[1] || '').trim());
        const buf = [];
        i++;
        while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        // i 此时指向结束围栏（未闭合时越界），记录块末尾行号供插入定位使用
        const fenceEnd = Math.min(i, lines.length - 1);
        if (i < lines.length) i++;
        html += '<pre data-source-line="' + (fenceStart + offset) + '" data-source-end="' + (fenceEnd + offset) + '"><code class="hljs language-' + escapeHtml(lang) + '">' + highlightCode(buf.join('\n'), lang) + '</code></pre>';
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        const level = heading[1].length;
        const headingId = slugify(heading[2]);
          html += '<h' + level + ' id="' + escapeHtml(headingId) + '" data-source-line="' + (i + offset) + '" data-source-end="' + (i + offset) + '">' + inlineRender(heading[2]) + '</h' + level + '>';
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += '<hr data-source-line="' + (i + offset) + '" data-source-end="' + (i + offset) + '">';
        i++;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
          const blockquoteStart = i;

        const buf = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          buf.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        html += '<blockquote data-source-line="' + (blockquoteStart + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + builtinMarkdown(buf.join('\n'), blockquoteStart + offset) + '</blockquote>';
        continue;
      }

      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:\-|]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
        const header = builtinTableRow(line);
        const headerLine = i; // 表头行号（i 随后会被递增，需先记录）
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
          rows.push({ line: i, cells: builtinTableRow(lines[i]) });
          i++;
        }
        html += '<table data-source-line="' + (headerLine + offset) + '" data-source-end="' + (i - 1 + offset) + '"><thead><tr>' + header.map(function (c, ci) {
          return '<th data-source-line="' + (headerLine + offset) + '" data-col="' + ci + '">' + inlineRender(c.trim()) + '</th>';
        }).join('') + '</tr></thead><tbody>';
        html += rows.map(function (r) {
          return '<tr>' + r.cells.map(function (c, ci) {
            return '<td data-source-line="' + (r.line + offset) + '" data-col="' + ci + '">' + inlineRender(c.trim()) + '</td>';
          }).join('') + '</tr>';
        }).join('');
        html += '</tbody></table>';
        continue;
      }

      if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
        const parsed = builtinParseList(lines, i, offset);
        html += parsed.html;
        i = parsed.next;
        continue;
      }

      const startLine = i;
        const buf = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' &&
             !/^(#{1,6})\s/.test(lines[i]) &&
             !/^\s*```/.test(lines[i]) &&
             !/^\s*>\s?/.test(lines[i]) &&
             !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      html += '<p data-source-line="' + (startLine + offset) + '" data-source-end="' + (i - 1 + offset) + '">' + buf.map(function (l) {
        return inlineRender(l);
      }).join('<br>') + '</p>';
    }
    return html;
  }

  // ---------- Markdown 解析 ----------
  let md = null;
