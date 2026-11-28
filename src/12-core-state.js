  // ---------- 全局状态 ----------
  const state = {
    files: [],          // [{ path, name, file }]
    currentPath: null,
    currentText: null,
    undoStack: [],
    undoStacks: {},
    theme: completeTheme({ name: 'github-light', isDark: false, colors: {} }),
    search: '',
    searchMode: 'name',
    contentSearchResults: null, // 全文搜索行级结果：[{ path, name, lineIndex, lineNumber, text, isHeading, headingLevel, breadcrumbs, heading }]
    contentSearchTruncated: false, // 全文搜索结果是否因达到上限被截断
    searchReqSeq: 0,            // 全文搜索竞态序号
    searchTextCache: {},        // path -> { lastModified, size, text }，全文搜索文本缓存
    searchExpandedFiles: new Set(), // 全文搜索里已展开的文件路径（结果按文件分组折叠，默认全部收起）
    // 全文搜索里**已收起**的目录路径（Set，元素形如 'notes/ops/'；根目录用 ''）。
    // 为什么存「收起」而不是「展开」：目录默认是**展开**的 —— 用户要的是「结果按目录归类」，
    // 归类的目录头一出现就把结果藏起来会让人以为搜索没结果。
    // 存反面的好处是新搜索（Set 为空）自然落到「全部展开」，不需要额外初始化。
    searchCollapsedDirs: new Set(),
    settings: {
      textSize: 16,
      codeSize: 13.5,
      inlineCodeSize: 12,
      // 代码块注释是否斜体：默认关闭（正体）。
      // 斜体只对拉丁字母明显，中文注释被强制倾斜后反而更难读，
      // 所以默认正体，需要的人可在「主题 → 阅读设置」里打开。
      commentItalic: false,
      // 图片背景：透明 PNG / SVG（截图、流程图、公式图）在暗色主题下没有底板会看不清，
      // 默认给所有正文图片铺一层白底；用户可在「主题 → 阅读设置」里改色或关闭
      imageBackground: true,
      imageBackgroundColor: '#ffffff',
      // 正文里的**外部链接**（http / https / mailto / tel）是否在新窗口打开。
      // 字段名沿用历史名（localStorage 里就存这个键，改名会让老用户的选择丢失）。
      // 默认 false = 保持历史行为（当前窗口打开）。
      // 只作用于阅读器里的点击（见 bindContentJumpEvents 的链接处理）；
      // 导出的 HTML 不含这个开关的影响。
      openLinksInNewTab: false,
      // 阅读宽度（v1.1.25）：正文栏最大宽度（px），0 = 占满窗口。
      // 只影响阅读界面 —— 导出的 HTML / PDF 仍用各自的版式（§5.1），不读这个值。
      readingWidth: 900,
      // 工作区**内部文档链接**（含 #标题 锚点）是否在新窗口打开。
      // 与上面的外部链接开关相互独立：两个都开 = 所有链接都新窗口。
      // 实现上不是 window.open(href) —— 应用没有文件级 URL，只能打开
      // "index.html?open=<工作区相对路径>#<锚点>"，让新标签页启动时自己恢复工作区
      // 再打开目标文档（见 openInternalLinkNewTab / openRequestedFileFromUrl）。
      // 因此只在「默认目录会话」下可用：临时打开的文件夹在新标签页里不存在。
      // 默认 false = 保持历史行为（应用内跳转）。
      openInternalLinksInNewTab: false
    },
    imageMap: {},       // path -> objectURL，用于相对路径图片
    dirHandle: null,    // File System Access API 的当前目录句柄
    dirReadOnly: false, // 当前目录是否为只读模式（Apache/HTTP 快照模式时为 true）
    snapshotData: null, // 默认目录浏览器缓存快照（File System Access API 不可用时 fallback）
    pendingSnapshot: null, // 正在异步构建的内存快照 Promise（打开兼容目录时记录）
    isDefaultSession: false, // 当前会话是否属于默认目录（为 true 时编辑写回才会持久化到默认缓存槽）
    // 「工作区文档链接在新窗口打开」开启、但当前不是默认目录时的提示只弹一次：
    // 每次点链接都弹会打断阅读，而原因在「设定默认目录」之前不会变。
    internalNewTabHintShown: false,
    pendingCompatibleNote: false, // 系统目录受限回退后，是否提示兼容模式说明
    userThemes: [],     // 用户导入的主题，会出现在预设下拉框中
    sidebarTab: 'files',
    sidebarCollapsed: false,
    // 侧栏宽度（v1.1.25）：拖拽条改这里，并落 localStorage。
    // CSS 通过 --sidebar-width 消费它，所以只在 applySidebarWidth() 里写一处。
    sidebarWidth: 300,
    toolbarCollapsed: false,
    // 目录展开态：现在会持久化到 localStorage（刷新后仍保持展开）
    expandedFolders: new Set(), // 文件树中已展开的目录路径（默认收起）
    // 阅读现场（v1.1.25）：lastPath = 上次读到的文档；scrollByPath = 每篇文档的滚动位置。
    // 两者都存在 localStorage（见 24-core-files.js 的 loadReadingState / saveReadingState），
    // 启动时先恢复目录、再恢复文档与滚动位置。
    readingState: { lastPath: null, scrollByPath: {} },
    pdfColors: Object.assign({}, PDF_BASE_COLORS), // 导出 PDF 配色
    pdfLayout: Object.assign({}, PDF_LAYOUT_DEFAULTS), // 导出 PDF 版式（字号/行高/纸张/字体），与阅读器 state.settings 无关
    pdfPreviewBody: null, // PDF 预览缓存的正文 HTML（图片已内联）；正文重渲染时置空
    themeMode: 'code', // 主题编辑器模式：'code' | 'pdf'
    lastInsertLang: '' // 上次插入代码块时填写的语言（下次插入默认沿用）
  };

  // ---------- 自定义语言支持 ----------
  function registerCustomLanguages() {
    if (!window.hljs) return;

    if (!window.hljs.getLanguage('keepalived')) {
      window.hljs.registerLanguage('keepalived', function (hljs) {
        return {
          case_insensitive: true,
          keywords: {
            keyword: 'global_defs vrrp_instance virtual_server real_server authentication',
            literal: 'MASTER BACKUP NAT DR PASS TCP LVS_MASTER LVS_SLAVE',
            built_in: 'router_id state interface virtual_router_id priority advert_int auth_type auth_pass virtual_ipaddress delay_loop lb_algo lb_kind persistence_timeout protocol weight connect_timeout retry delay_before_retry'
          },
          contains: [
            hljs.HASH_COMMENT_MODE,
            { className: 'number', begin: /\b\d{1,3}(?:\.\d{1,3}){3}\b/ },
            { className: 'number', begin: /\b\d+(?:\.\d+)?\b/ },
            { className: 'string', begin: /"/, end: /"/ }
          ]
        };
      });
    }
  }
