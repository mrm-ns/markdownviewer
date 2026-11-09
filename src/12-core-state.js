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
    settings: { textSize: 16, codeSize: 13.5, inlineCodeSize: 12 },
    imageMap: {},       // path -> objectURL，用于相对路径图片
    dirHandle: null,    // File System Access API 的当前目录句柄
    dirReadOnly: false, // 当前目录是否为只读模式（Apache/HTTP 快照模式时为 true）
    snapshotData: null, // 默认目录浏览器缓存快照（File System Access API 不可用时 fallback）
    pendingSnapshot: null, // 正在异步构建的内存快照 Promise（打开兼容目录时记录）
    isDefaultSession: false, // 当前会话是否属于默认目录（为 true 时编辑写回才会持久化到默认缓存槽）
    pendingCompatibleNote: false, // 系统目录受限回退后，是否提示兼容模式说明
    userThemes: [],     // 用户导入的主题，会出现在预设下拉框中
    sidebarTab: 'files',
    sidebarCollapsed: false,
    toolbarCollapsed: false,
    expandedFolders: new Set(), // 文件树中已展开的目录路径（默认收起）
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
