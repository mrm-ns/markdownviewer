// 复现「文本上色」的定位算法：它是按关键字内容定位，不是按选区位置定位
function buildLooseSourceRegex(text) {
  const inter = '(?:[*_~`]|\\*\\*|~~)*';
  const body = String(text).split('').map(function (ch) {
    return ch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
  }).join(inter);
  return new RegExp(inter + body + inter, 'gi');
}

function findUnique(scope, selText) {
  const re = buildLooseSourceRegex(selText);
  const matches = [];
  let m;
  while ((m = re.exec(scope)) !== null) {
    matches.push(m.index);
    if (matches.length > 1) break;
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return { count: matches.length, at: matches };
}

console.log('=== 场景 1：同一行里同一个词出现两次 ===');
const line = 'the cat sat on the mat';
console.log('源码行  : ' + JSON.stringify(line));
console.log('选中文字: "the"（用户点的是最后那个 the）');
console.log('定位结果: ' + JSON.stringify(findUnique(line, 'the')));
console.log('→ 找到 2 处，判定失败，toast「无法在源码中唯一确定选中的文字」');
console.log();

console.log('=== 场景 2：用户想给第二个 the 上色，但算法只认内容 ===');
console.log('即使只匹配到 2 处，算法也无法区分用户选的是哪一处');
console.log('→ 直接报错，用户被迫扩大选区或放弃');
console.log();

console.log('=== 场景 3：短词/常见词跨行出现 ===');
const doc = '阿里云服务器\n腾讯云服务器\n华为云服务器';
console.log('文档:');
doc.split('\n').forEach((l, i) => console.log('  ' + (i + 1) + ': ' + l));
console.log('选中第二行的 "云服务器"');
console.log('定位结果: ' + JSON.stringify(findUnique(doc, '云服务器')));
console.log('→ 找到 3 处，判定失败');
console.log();

console.log('=== 场景 4：英文单词边界问题 ===');
console.log('选中 "cat"，但源码里有 "category"');
console.log('源码: "a cat and a category"');
console.log('定位结果: ' + JSON.stringify(findUnique('a cat and a category', 'cat')));
console.log('→ 2 处匹配（cat 和 category 里的 cat），失败');
console.log();

console.log('=== 场景 5：行内的相对位置信息完全没被使用 ===');
console.log('算法只看 selText 的「内容」，range 里的字符偏移、');
console.log('data-source-line 只用来缩小到「哪一行」，');
console.log('行内没有用「选区的第几个字符到第几个字符」来校准');
