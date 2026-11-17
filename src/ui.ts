/**
 * 手机端网页界面。整个页面塞在一个函数里返回：
 * 没有构建步骤、没有前端框架、没有外部 CDN（离线局域网也能用）。
 */
export function renderApp(bookName: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#7c1f2b">
<title>${bookName} · hlw</title>
<style>
  :root {
    --bg: #faf7f2; --card: #ffffff; --ink: #241c17; --muted: #8a7d72;
    --line: #e6ddd1; --accent: #7c1f2b; --accent-soft: #f4e7e6;
    --warn: #b06a00; --err: #b3261e; --ok: #2f6b3a;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 16px/1.6 "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    padding-bottom: env(safe-area-inset-bottom);
  }
  header {
    position: sticky; top: 0; z-index: 10; background: var(--accent); color: #fff;
    padding: calc(12px + env(safe-area-inset-top)) 16px 12px;
  }
  header .bar { display: flex; align-items: center; gap: 10px; }
  header h1 { margin: 0; font-size: 17px; font-weight: 600; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  header .sub { margin-top: 2px; font-size: 12px; opacity: .85; }
  header .shelf-btn {
    flex: 0 0 auto; background: rgba(255,255,255,.16); color: #fff; border: 1px solid rgba(255,255,255,.35);
    padding: 6px 12px; border-radius: 999px; font-size: 13px; font-family: inherit;
  }
  nav { display: flex; gap: 6px; padding: 10px 12px; background: #fff; border-bottom: 1px solid var(--line); overflow-x: auto; }
  nav button {
    flex: 0 0 auto; border: 1px solid var(--line); background: #fff; color: var(--muted);
    padding: 8px 14px; border-radius: 999px; font-size: 14px; font-family: inherit;
  }
  nav button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
  main { padding: 12px; max-width: 720px; margin: 0 auto; }
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px; margin-bottom: 10px; }
  .card h2 { margin: 0 0 4px; font-size: 15px; font-weight: 600; }
  .meta { color: var(--muted); font-size: 12px; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .grow { flex: 1 1 auto; min-width: 0; }
  .btn {
    border: 1px solid var(--line); background: #fff; color: var(--ink); font-family: inherit;
    padding: 12px 16px; border-radius: 10px; font-size: 15px; min-height: 44px;
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .btn.danger { color: var(--err); border-color: #e8c4c1; }
  .btn.block { display: block; width: 100%; margin-top: 10px; }
  .btn.small { padding: 8px 12px; font-size: 13px; min-height: 38px; }
  .btn:disabled { opacity: .5; }
  textarea, input, select {
    width: 100%; font-family: inherit; font-size: 15px; color: var(--ink);
    background: #fff; border: 1px solid var(--line); border-radius: 9px; padding: 10px;
  }
  textarea { min-height: 46vh; line-height: 1.8; resize: vertical; }
  label { display: block; font-size: 13px; color: var(--muted); margin: 10px 0 4px; }
  .diag { padding: 10px 12px; border-radius: 9px; margin-bottom: 8px; font-size: 14px; }
  .diag.error { background: #fdeceb; color: var(--err); }
  .diag.warning { background: #fdf3e2; color: var(--warn); }
  .diag.info { background: #eef2f5; color: #41606f; }
  .empty { color: var(--muted); font-size: 14px; padding: 18px; text-align: center; }
  .tag { display: inline-block; font-size: 11px; padding: 1px 7px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); margin-left: 6px; }
  .tag.paid { background: #e8f2e9; color: var(--ok); }
  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    background: #2b211c; color: #fff; padding: 10px 18px; border-radius: 999px;
    font-size: 14px; opacity: 0; pointer-events: none; transition: opacity .2s; z-index: 60;
  }
  .toast.show { opacity: 1; }

  /* ---------- 对话 ---------- */
  .ai-bar { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 10px; }
  .ai-bar button {
    flex: 0 0 auto; font-size: 13px; padding: 7px 12px; border-radius: 999px;
    border: 1px solid var(--line); background: #fff; color: var(--muted); font-family: inherit;
  }
  .ai-bar button.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
  .chat { display: flex; flex-direction: column; gap: 14px; padding-bottom: 10px; }
  .turn { display: flex; flex-direction: column; gap: 6px; }
  .turn.user { align-items: flex-end; }
  .bubble {
    padding: 11px 14px; border-radius: 14px; font-size: 15px; line-height: 1.85;
    max-width: 100%; word-break: break-word;
  }
  .bubble.user { background: var(--accent-soft); max-width: 92%; white-space: pre-wrap; }
  .bubble.assistant { background: #fff; border: 1px solid var(--line); }
  .bubble.pending { color: var(--muted); }
  .bubble .md p { margin: 0 0 10px; }
  .bubble .md p:last-child { margin-bottom: 0; }
  .bubble .md h1, .bubble .md h2, .bubble .md h3 { font-size: 15px; margin: 14px 0 6px; }
  .bubble .md ul, .bubble .md ol { margin: 6px 0 10px; padding-left: 22px; }
  .bubble .md li { margin: 3px 0; }
  .bubble .md blockquote {
    margin: 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid var(--line); color: #5b4f45;
  }
  .bubble .md code { background: #f3ece2; padding: 1px 5px; border-radius: 4px; font-size: 13px; }
  .bubble .md pre {
    background: #2b211c; color: #f6efe6; padding: 12px; border-radius: 8px;
    overflow-x: auto; font-size: 13px; margin: 8px 0;
  }
  .bubble .md pre code { background: none; color: inherit; padding: 0; }
  .bubble .md hr { border: none; border-top: 1px solid var(--line); margin: 12px 0; }
  .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  .acts button {
    font-size: 12px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line);
    background: #fff; color: var(--muted); font-family: inherit;
  }
  .think { border: 1px dashed var(--line); border-radius: 10px; padding: 8px 12px; background: #fbf7f1; font-size: 13px; color: var(--muted); }
  .think summary { cursor: pointer; font-size: 13px; color: var(--accent); }
  .think .body { margin-top: 8px; white-space: pre-wrap; line-height: 1.7; }
  .cursor::after { content: '▍'; animation: blink 1s steps(2) infinite; color: var(--accent); }
  @keyframes blink { 50% { opacity: 0; } }
  .composer { position: sticky; bottom: 0; background: var(--bg); padding: 10px 0 calc(10px + env(safe-area-inset-bottom)); }
  .composer textarea { min-height: 64px; max-height: 40vh; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
  .chip { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); }
  .chip button { border: none; background: none; color: inherit; font-size: 12px; cursor: pointer; padding: 0 0 0 4px; }

  /* ---------- 历史对话抽屉 ---------- */
  .overlay { position: fixed; inset: 0; background: rgba(20,14,10,.42); z-index: 40; display: flex; align-items: flex-end; }
  .sheet {
    background: var(--bg); width: 100%; max-height: 78vh; border-radius: 16px 16px 0 0;
    padding: 14px 14px calc(16px + env(safe-area-inset-bottom)); overflow-y: auto;
  }
  .sheet h2 { margin: 0 0 10px; font-size: 15px; display: flex; align-items: center; }
  .sheet h2 .grow { flex: 1 1 auto; }
  .chat-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-bottom: 1px solid var(--line); }
  .chat-item .grow { flex: 1 1 auto; min-width: 0; }
  .chat-item .t { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .chat-item .d { font-size: 11px; color: var(--muted); margin-top: 2px; }

  /* ---------- 手机操作优化 ---------- */
  nav button { min-height: 42px; }
  .acts button { min-height: 38px; padding: 7px 12px; font-size: 13px; }
  .savebar {
    position: sticky; bottom: 0; z-index: 5; background: var(--bg);
    display: flex; gap: 8px; padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    border-top: 1px solid var(--line); margin-top: 10px;
  }
  .savebar .btn { flex: 1 1 auto; }
  .savebar .btn.primary { flex: 2 1 auto; }
  .editor textarea { min-height: 42vh; }
  .search {
    display: flex; gap: 8px; align-items: center; margin-bottom: 10px;
  }
  .search input { flex: 1 1 auto; min-height: 42px; }
  .jump {
    display: inline-flex; align-items: center; gap: 6px; font-size: 13px;
    padding: 8px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent);
    min-height: 40px;
  }
  .jump button { border: none; background: none; color: inherit; font-size: 13px; padding: 0; }
  .copy-area { min-height: 40vh; font-size: 16px; line-height: 1.8; }
</style>
</head>
<body>
<header>
  <div class="bar">
    <h1 id="book-name">书架</h1>
    <button class="shelf-btn" data-act="shelf">书架</button>
  </div>
  <div class="sub" id="book-stat">加载中…</div>
</header>
<nav id="tabs">
  <button data-act="tab" data-tab="chapters" class="on">章回</button>
  <button data-act="tab" data-tab="ai">AI 写作</button>
  <button data-act="tab" data-tab="chars">人物</button>
  <button data-act="tab" data-tab="foreshadows">伏笔</button>
  <button data-act="tab" data-tab="check">体检</button>
</nav>
<main id="view"></main>
<div id="overlay"></div>
<div class="toast" id="toast"></div>
<script>
(function () {
  var state = {
    book: null, books: [], shelf: false, tab: 'chapters',
    project: null, stats: null, diagnostics: [],
    editing: null, aiConfig: null, busy: false, showSettings: false,
    chats: [], chat: null, showHistory: false, deepThink: false, useBook: true,
    aiChapterId: null, controller: null, chapterFilter: ''
  };
  var view = document.getElementById('view');
  var tabs = document.getElementById('tabs');
  var overlay = document.getElementById('overlay');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function toast(msg, bad) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = bad ? '#b3261e' : '#2b211c';
    el.className = 'toast show';
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.className = 'toast'; }, 2600);
  }

  function withBook(path) {
    if (!state.book || path.indexOf('/api/books') === 0) return path;
    return path + (path.indexOf('?') >= 0 ? '&' : '?') + 'book=' + encodeURIComponent(state.book);
  }

  function api(path, opts) {
    return fetch(withBook(path), opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  function ago(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    var d = new Date(ts);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  // ---------- 数据加载 ----------

  function loadBooks() {
    return api('/api/books').then(function (d) {
      state.books = d.books;
      var saved = null;
      try { saved = localStorage.getItem('hlw-book'); } catch (e) {}
      var has = null;
      state.books.forEach(function (b) { if (b.file === saved) has = b.file; });
      if (!has) has = state.books.length ? state.books[0].file : null;
      if (has !== state.book) { state.chat = null; state.chats = []; }
      state.book = has;
      if (state.book) { try { localStorage.setItem('hlw-book', state.book); } catch (e) {} }
      state.shelf = !state.books.length;
      return d;
    });
  }

  function refresh() {
    return loadBooks().then(function () {
      if (!state.book) { render(); return null; }
      return Promise.all([api('/api/project'), api('/api/ai/config')]).then(function (arr) {
        var d = arr[0];
        state.project = d.project;
        state.stats = d.stats;
        state.diagnostics = d.diagnostics;
        state.aiConfig = arr[1];
        var s = state.stats;
        document.getElementById('book-name').textContent = d.project.name;
        document.getElementById('book-stat').textContent =
          s.chapters + ' 章 · ' + s.totalWords + ' 字 · ' + d.diagnostics.length + ' 条提醒';
        render();
      });
    }).catch(function (e) { toast(e.message, true); });
  }

  function chapterById(id) {
    var found = null;
    if (state.project) state.project.chapters.forEach(function (c) { if (c.id === id) found = c; });
    return found;
  }

  // ---------- 书架 ----------

  function renderShelf() {
    var html = state.books.length ? '' : '<div class="empty">书架还空着，先建一本。</div>';
    state.books.forEach(function (b) {
      var cur = b.file === state.book;
      html += '<div class="card"><div class="row"><div class="grow">' +
        '<h2>' + esc(b.name) + (cur ? '<span class="tag">当前</span>' : '') + '</h2>' +
        '<div class="meta">' + b.chapters + ' 章 · ' + b.words + ' 字' +
        (b.foreshadowsOpen ? ' · ' + b.foreshadowsOpen + ' 条伏笔没回收' : '') +
        (b.author ? ' · ' + esc(b.author) : '') + '</div>' +
        '</div><button class="btn" data-act="open-book" data-file="' + esc(b.file) + '">打开</button></div></div>';
    });
    html += '<div class="card"><h2>开一个新故事</h2>' +
      '<label>书名</label><input id="nb-name" placeholder="比如：青瓦台记事">' +
      '<label>作者（可不填）</label><input id="nb-author" placeholder="你的名字">' +
      '<button class="btn primary block" data-act="create-book">新建</button>' +
      '<div class="meta" style="margin-top:8px">新故事是独立的一个 .json，和原来的互不影响。</div></div>';
    return html;
  }

  // ---------- 章回 ----------

  function renderChapters() {
    if (state.editing) return renderEditor();
    var p = state.project;
    var ordered = p.chapters.slice().sort(function (a, b) { return a.order - b.order; });
    var filter = (state.chapterFilter || '').trim();
    var list = ordered.filter(function (ch) {
      if (!filter) return true;
      return String(ch.order) === filter || (ch.title || '').indexOf(filter) >= 0;
    });

    var html = '<div class="search">' +
      '<input id="ch-search" placeholder="搜回目或章号" value="' + esc(filter) + '">' +
      '<button class="btn primary" data-act="new-chapter">＋ 新章</button></div>';

    if (!list.length) {
      html += '<div class="empty">' + (filter ? '没有匹配的章回。' : '还没有章回，点右上角「＋ 新章」开始。') + '</div>';
    }
    list.forEach(function (ch) {
      var stat = null;
      state.stats.perChapter.forEach(function (c) { if (c.id === ch.id) stat = c; });
      html += '<div class="card"><div class="row"><div class="grow">' +
        '<h2>第 ' + ch.order + ' 回 · ' + esc(ch.title || '无回目') + '</h2>' +
        '<div class="meta">' + (stat ? stat.words : 0) + ' 字' + (ch.body ? '' : ' · 空') + '</div>' +
        '</div><button class="btn" data-act="edit" data-id="' + esc(ch.id) + '">打开</button></div></div>';
    });
    return html;
  }

  function renderEditor() {
    var ch = state.editing === 'new' ? null : chapterById(state.editing);
    var ordered = state.project.chapters.slice().sort(function (a, b) { return a.order - b.order; });
    var idx = -1;
    for (var i = 0; i < ordered.length; i += 1) if (ch && ordered[i].id === ch.id) idx = i;
    var prev = idx > 0 ? ordered[idx - 1] : null;
    var next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

    return '<div class="editor">' +
      '<div class="card">' +
      '<label>回目</label>' +
      '<input id="ed-title" value="' + esc(ch ? ch.title : '') + '" placeholder="如：甄士隐梦幻识通灵">' +
      '<label>正文</label>' +
      '<textarea id="ed-body" placeholder="在这里写正文…">' + esc(ch ? ch.body : '') + '</textarea>' +
      '</div>' +
      '<div class="savebar">' +
      '<button class="btn primary" data-act="save-chapter">保存</button>' +
      '<button class="btn" data-act="cancel-edit">返回</button>' +
      (prev ? '<button class="btn" data-act="goto-chapter" data-id="' + esc(prev.id) + '">上一章</button>' : '') +
      (next ? '<button class="btn" data-act="goto-chapter" data-id="' + esc(next.id) + '">下一章</button>' : '') +
      (ch ? '<button class="btn" data-act="ai-continue" data-id="' + esc(ch.id) + '">AI 写</button>' : '') +
      (ch ? '<button class="btn danger" data-act="delete-chapter" data-id="' + esc(ch.id) + '">删除</button>' : '') +
      '</div></div>';
  }

  // ---------- AI ----------

  function renderAiSetup() {
    var cfg = state.aiConfig || { baseUrl: '', model: '' };
    return '<div class="card"><h2>先配一下模型</h2>' +
      '<div class="meta">用一个 DeepSeek 的 API Key（platform.deepseek.com 的「API keys」里创建）。Key 只存在这台电脑上。</div>' +
      '<label>API Key</label><input id="ai-key" placeholder="sk-...">' +
      '<label>接口地址</label><input id="ai-base" value="' + esc(cfg.baseUrl) + '">' +
      '<label>模型</label><input id="ai-model" value="' + esc(cfg.model) + '">' +
      '<button class="btn primary block" data-act="ai-save">保存</button></div>';
  }

  function renderAi() {
    if (state.showSettings || !state.aiConfig || !state.aiConfig.configured) return renderAiSetup();

    var html = '<div class="ai-bar">' +
      '<button data-act="ai-new">＋ 新对话</button>' +
      '<button data-act="ai-history">历史 ' + (state.chats.length || '') + '</button>' +
      '<button class="' + (state.deepThink ? 'on' : '') + '" data-act="ai-think">深度思考</button>' +
      '<button class="' + (state.useBook ? 'on' : '') + '" data-act="ai-usebook">引用本书</button>' +
      '<button data-act="ai-settings">设置</button>' +
      '</div>';

    if (!state.chat) {
      return html + '<div class="empty">正在准备对话…</div>';
    }

    var chapter = state.aiChapterId ? chapterById(state.aiChapterId) : null;
    if (chapter) {
      html += '<div class="chips"><span class="chip">正在读：第 ' + chapter.order + ' 回 ' +
        esc(chapter.title || '') + '<button data-act="ai-clear-chapter">×</button></span>' +
        '<button class="jump" data-act="ai-goto-chapter">回到正文 →</button></div>';
    }

    html += '<div class="chat" id="chat">';
    if (!state.chat.messages.length) {
      html += '<div class="empty">想聊什么？情节卡住了、人物写不下去了、想让它接着写一段，都可以。<br>' +
        (state.useBook ? '它会读这本书的人物、伏笔和最近几章。' : '当前没引用本书内容，答案会比较泛。') + '</div>';
    }
    state.chat.messages.forEach(function (m, i) { html += turnHtml(m, i); });
    html += '</div>';

    html += '<div class="composer">' +
      '<div class="chips">' +
      '<span class="chip" data-act="ai-quick" data-q="接下来可以怎么发展？给三个方向，每个说清楚怎么落地。">三个走向</span>' +
      '<span class="chip" data-act="ai-quick" data-q="帮我看看这几章有没有前后矛盾、人物称呼不一致的地方。">挑毛病</span>' +
      '<span class="chip" data-act="ai-quick" data-q="用一句话概括这一章写了什么。">一句话概括</span>' +
      '</div>' +
      '<textarea id="ai-input" placeholder="' + (state.busy ? '正在生成…' : '问它，或者让它写…') + '"></textarea>' +
      (state.busy
        ? '<button class="btn block" data-act="ai-stop">停止生成</button>'
        : '<button class="btn primary block" data-act="ai-send">发送</button>') +
      '</div>';
    return html;
  }

  function turnHtml(m, i) {
    if (m.role === 'user') {
      return '<div class="turn user"><div class="bubble user">' + esc(m.content) + '</div></div>';
    }
    var thinking = '';
    if (m.reasoning) {
      thinking = '<details class="think"' + (m.reasoningOpen ? ' open' : '') + '><summary>思考过程</summary>' +
        '<div class="body">' + esc(m.reasoning) + '</div></details>';
    }
    var body = m.content
      ? '<div class="md">' + renderMd(m.content) + '</div>'
      : '<span class="pending-text">正在思考…</span>';
    var acts = m.content && !m.pending
      ? '<div class="acts">' +
        '<button data-act="ai-copy" data-idx="' + i + '">复制</button>' +
        '<button data-act="ai-select" data-idx="' + i + '">选取</button>' +
        '<button data-act="ai-regen" data-idx="' + i + '">重新生成</button>' +
        (m.chapterId ? '<button data-act="ai-insert" data-idx="' + i + '">插入正文</button>' : '') +
        '</div>'
      : '';
    return '<div class="turn"><div class="bubble assistant' + (m.content ? '' : ' pending') + '" id="turn-' + i + '">' +
      thinking + body + (acts ? '<div style="margin-top:10px">' + acts + '</div>' : '') + '</div></div>';
  }

  // ---------- markdown ----------

  function inline(s) {
    var t = esc(s);
    t = t.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    t = t.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\\*([^*\\n]+)\\*/g, '$1<em>$2</em>');
    t = t.replace(/\\[([^\\]]+)\\]\\((https?:[^)]+)\\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
    return t;
  }

  function renderBlocks(text) {
    var blocks = text.split(/\\n{2,}/);
    var out = '';
    blocks.forEach(function (block) {
      if (!block.trim()) return;
      var lines = block.split('\\n');
      if (/^#/.test(lines[0])) {
        var level = Math.min(3, (lines[0].match(/^#+/) || ['#'])[0].length);
        out += '<h' + level + '>' + inline(lines[0].replace(/^#+\\s*/, '')) + '</h' + level + '>';
        var rest = lines.slice(1).join('\\n');
        if (rest.trim()) out += renderBlocks(rest);
        return;
      }
      if (lines.every(function (l) { return /^\\s*[-*]\\s+/.test(l) || !l.trim(); })) {
        out += '<ul>' + lines.filter(function (l) { return l.trim(); }).map(function (l) {
          return '<li>' + inline(l.replace(/^\\s*[-*]\\s+/, '')) + '</li>';
        }).join('') + '</ul>';
        return;
      }
      if (lines.every(function (l) { return /^\\s*\\d+[.、)]\\s+/.test(l) || !l.trim(); })) {
        out += '<ol>' + lines.filter(function (l) { return l.trim(); }).map(function (l) {
          return '<li>' + inline(l.replace(/^\\s*\\d+[.、)]\\s+/, '')) + '</li>';
        }).join('') + '</ol>';
        return;
      }
      if (lines.every(function (l) { return /^&gt;\\s?/.test(l) || !l.trim(); })) {
        out += '<blockquote>' + lines.filter(function (l) { return l.trim(); }).map(function (l) {
          return inline(l.replace(/^&gt;\\s?/, ''));
        }).join('<br>') + '</blockquote>';
        return;
      }
      if (/^-{3,}$/.test(block.trim())) { out += '<hr>'; return; }
      out += '<p>' + lines.map(inline).join('<br>') + '</p>';
    });
    return out;
  }

  function renderMd(src) {
    var parts = String(src || '').split('\`\`\`');
    var out = '';
    for (var i = 0; i < parts.length; i += 1) {
      if (i % 2 === 1) {
        out += '<pre><code>' + esc(parts[i].replace(/^[a-zA-Z0-9-]*\\n/, '')) + '</code></pre>';
      } else {
        out += renderBlocks(parts[i]);
      }
    }
    return out;
  }

  // ---------- 人物 / 伏笔 / 体检 ----------

  function renderChars() {
    var p = state.project;
    var html = p.characters.length ? '' : '<div class="empty">还没有人物卡。</div>';
    p.characters.forEach(function (c) {
      var debut = '';
      p.chapters.forEach(function (ch) { if (ch.id === c.firstChapterId) debut = '第 ' + ch.order + ' 回出场'; });
      html += '<div class="card"><h2>' + esc(c.name) + '</h2>' +
        '<div class="meta">' + esc((c.aliases || []).join('、') || '无别名') +
        (c.role ? ' · ' + esc(c.role) : '') + (debut ? ' · ' + debut : '') + '</div></div>';
    });
    html += '<div class="card"><h2>加个人物</h2>' +
      '<label>正名</label><input id="ch-name" placeholder="林黛玉">' +
      '<label>别名（用顿号或逗号隔开）</label><input id="ch-alias" placeholder="颦儿、林妹妹">' +
      '<label>身份</label><input id="ch-role" placeholder="贾母外孙女">' +
      '<label>首次出场章</label><input id="ch-debut" placeholder="填章号，如 3" inputmode="numeric">' +
      '<button class="btn primary block" data-act="add-char">添加</button></div>';
    return html;
  }

  function renderForeshadows() {
    var p = state.project;
    var html = p.foreshadows.length ? '' : '<div class="empty">还没有伏笔。</div>';
    p.foreshadows.forEach(function (f) {
      var at = '';
      p.chapters.forEach(function (ch) { if (ch.id === f.plantedChapterId) at = '第 ' + ch.order + ' 回埋下'; });
      var paid = f.status === 'paid';
      html += '<div class="card"><div class="row"><div class="grow">' +
        '<h2>' + esc(f.title) +
        '<span class="tag' + (paid ? ' paid' : '') + '">' + (paid ? '已回收' : f.status === 'dropped' ? '已弃用' : '未回收') + '</span></h2>' +
        '<div class="meta">' + at + '</div></div>' +
        (paid ? '' : '<button class="btn" data-act="pay" data-id="' + esc(f.id) + '">回收</button>') +
        '</div></div>';
    });
    html += '<div class="card"><h2>埋一条伏笔</h2>' +
      '<label>名称</label><input id="fs-title" placeholder="通灵宝玉">' +
      '<label>埋在第几章</label><input id="fs-at" placeholder="填章号，如 1" inputmode="numeric">' +
      '<button class="btn primary block" data-act="add-foreshadow">埋下</button></div>';
    return html;
  }

  function renderCheck() {
    if (!state.diagnostics.length) return '<div class="empty">没有问题，写得挺稳。</div>';
    return state.diagnostics.map(function (d) {
      return '<div class="diag ' + d.level + '">' + esc(d.message) + '</div>';
    }).join('');
  }

  function renderHistory() {
    if (!state.showHistory) { overlay.innerHTML = ''; return; }
    var html = '<div class="overlay" data-act="close-history"><div class="sheet" data-stop="1">' +
      '<h2><span class="grow">历史对话</span><button class="btn small" data-act="close-history-btn">关闭</button></h2>';
    if (!state.chats.length) html += '<div class="empty">还没有对话。</div>';
    state.chats.forEach(function (c) {
      html += '<div class="chat-item">' +
        '<div class="grow" data-act="ai-open" data-id="' + esc(c.id) + '">' +
        '<div class="t">' + esc(c.title) + '</div>' +
        '<div class="d">' + ago(c.updatedAt) + ' · ' + c.count + ' 条</div></div>' +
        '<button class="btn small danger" data-act="ai-del" data-id="' + esc(c.id) + '">删</button>' +
        '</div>';
    });
    html += '</div></div>';
    overlay.innerHTML = html;
  }

  function render() {
    if (state.shelf || !state.book || !state.project) {
      view.innerHTML = state.books.length || state.shelf ? renderShelf() : '<div class="empty">加载中…</div>';
    } else if (state.tab === 'chapters') view.innerHTML = renderChapters();
    else if (state.tab === 'ai') view.innerHTML = renderAi();
    else if (state.tab === 'chars') view.innerHTML = renderChars();
    else if (state.tab === 'foreshadows') view.innerHTML = renderForeshadows();
    else view.innerHTML = renderCheck();
    Array.prototype.forEach.call(tabs.children, function (b) {
      b.className = b.dataset.tab === state.tab && !state.shelf ? 'on' : '';
    });
    renderHistory();
    scrollChat();
    if (state.searchFocus) {
      state.searchFocus = false;
      var s = document.getElementById('ch-search');
      if (s) {
        s.focus();
        var n = s.value.length;
        s.setSelectionRange(n, n);
      }
    }
  }

  function scrollChat() {
    var chat = document.getElementById('chat');
    if (chat) chat.scrollIntoView({ block: 'end' });
  }

  // ---------- 复制（局域网 http 下 clipboard API 不可用，必须有兜底） ----------

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        toast('已复制');
      }).catch(function () {
        if (legacyCopy(text)) toast('已复制');
        else showCopySheet(text);
      });
      return;
    }
    if (legacyCopy(text)) toast('已复制');
    else showCopySheet(text);
  }

  function showCopySheet(text) {
    overlay.innerHTML = '<div class="overlay" data-act="close-sheet"><div class="sheet" data-stop="1">' +
      '<h2><span class="grow">长按选中，然后点复制</span><button class="btn small" data-act="close-sheet-btn">关闭</button></h2>' +
      '<textarea class="copy-area" id="copy-area" readonly>' + esc(text) + '</textarea>' +
      '<button class="btn primary block" data-act="copy-area">全选这段</button>' +
      '</div></div>';
    var ta = document.getElementById('copy-area');
    if (ta) { ta.focus(); ta.select(); }
  }

  function patchTurn(index) {
    var el = document.getElementById('turn-' + index);
    if (!el) { render(); return; }
    var m = state.chat.messages[index];
    if (!m) return;
    var wrap = el.parentElement;
    if (wrap) wrap.outerHTML = turnHtml(m, index);
  }

  // ---------- 对话流程 ----------

  function ensureChat() {
    if (state.chat) return Promise.resolve(state.chat);
    return api('/api/chats').then(function (d) {
      state.chats = d.chats;
      if (state.chats.length) {
        return api('/api/chats/' + encodeURIComponent(state.chats[0].id)).then(function (r) {
          state.chat = r.chat;
          return state.chat;
        });
      }
      return api('/api/chats', { method: 'POST' }).then(function (r) {
        state.chat = r.chat;
        state.chats.unshift({ id: r.chat.id, title: r.chat.title, updatedAt: r.chat.updatedAt, count: 0 });
        return state.chat;
      });
    });
  }

  function persistChat() {
    if (!state.chat || !state.chat.messages.length) return Promise.resolve();
    return api('/api/chats/' + encodeURIComponent(state.chat.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: state.chat.messages })
    }).then(function (r) {
      state.chat = r.chat;
      state.chats = state.chats.map(function (c) {
        return c.id === r.chat.id ? { id: r.chat.id, title: r.chat.title, updatedAt: r.chat.updatedAt, count: r.chat.messages.length } : c;
      });
    }).catch(function () {});
  }

  function newChat() {
    api('/api/chats', { method: 'POST' }).then(function (r) {
      state.chat = r.chat;
      state.chats.unshift({ id: r.chat.id, title: r.chat.title, updatedAt: r.chat.updatedAt, count: 0 });
      state.showHistory = false;
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  function openChat(id) {
    api('/api/chats/' + encodeURIComponent(id)).then(function (r) {
      state.chat = r.chat;
      state.showHistory = false;
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  function removeChat(id) {
    api('/api/chats/' + encodeURIComponent(id), { method: 'DELETE' }).then(function () {
      state.chats = state.chats.filter(function (c) { return c.id !== id; });
      if (state.chat && state.chat.id === id) state.chat = null;
      toast('已删除');
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  /** 保存当前正在编辑的这一章（返回 Promise） */
  function saveCurrent() {
    var titleEl = document.getElementById('ed-title');
    var bodyEl = document.getElementById('ed-body');
    if (!titleEl || !bodyEl || state.editing === 'new' || !state.editing) return Promise.resolve(null);
    return api('/api/chapter/' + encodeURIComponent(state.editing), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: titleEl.value.trim(), body: bodyEl.value })
    });
  }

  /** 把对话历史发给模型，边收边渲染 */
  function runAssistant() {
    var chat = state.chat;
    var bubble = { role: 'assistant', content: '', reasoning: '', pending: true, chapterId: state.aiChapterId || null };
    chat.messages.push(bubble);
    var index = chat.messages.length - 1;
    state.busy = true;
    state.controller = new AbortController();
    render();

    var payloadMessages = chat.messages
      .filter(function (m) { return !m.pending; })
      .map(function (m) { return { role: m.role, content: m.content }; });

    fetch(withBook('/api/ai/chat'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: state.controller.signal,
      body: JSON.stringify({
        messages: payloadMessages,
        chapterId: state.aiChapterId || null,
        useBook: state.useBook,
        deepThink: state.deepThink
      })
    }).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          throw new Error(d.error || ('HTTP ' + res.status));
        });
      }
      var reader = res.body.getReader();
      var dec = new TextDecoder('utf-8');
      var buffer = '';
      var last = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buffer += dec.decode(r.value, { stream: true }).replace(/\\r/g, '');
          var idx;
          while ((idx = buffer.indexOf('\\n\\n')) >= 0) {
            var chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            chunk.split('\\n').forEach(function (line) {
              if (line.indexOf('data:') !== 0) return;
              var raw = line.slice(5).trim();
              if (!raw || raw === '[DONE]') return;
              try {
                var parsed = JSON.parse(raw);
                var choice = parsed.choices && parsed.choices[0];
                var delta = choice && choice.delta;
                if (!delta) return;
                if (delta.reasoning_content) { bubble.reasoning += delta.reasoning_content; }
                if (delta.content) { bubble.pending = false; bubble.content += delta.content; }
                var now = Date.now();
                if (now - last > 90) {
                  last = now;
                  bubble.reasoningOpen = !bubble.content;
                  patchTurn(index);
                }
              } catch (e) { /* 心跳包 */ }
            });
          }
          return pump();
        });
      }
      return pump();
    }).then(function () {
      state.busy = false;
      state.controller = null;
      if (!bubble.content && !bubble.reasoning) bubble.content = '（模型没有返回内容）';
      bubble.pending = false;
      render();
      return persistChat();
    }).catch(function (e) {
      state.busy = false;
      state.controller = null;
      bubble.pending = false;
      if (e && e.name === 'AbortError') {
        bubble.content = bubble.content || '（已停止）';
      } else {
        bubble.content = bubble.content || ('出错了：' + (e && e.message ? e.message : '未知错误'));
        toast(e && e.message ? e.message : '出错了', true);
      }
      render();
      return persistChat();
    });
  }

  function sendText(text) {
    if (state.busy) { toast('等它写完这一句', true); return; }
    var content = (text || '').trim();
    if (!content) { toast('先说点什么', true); return; }
    state.chat.messages.push({ role: 'user', content: content });
    render();
    runAssistant();
  }

  function regenerate(index) {
    if (state.busy) return;
    var msg = state.chat.messages[index];
    if (!msg || msg.role !== 'assistant') return;
    state.chat.messages.splice(index, 1);
    state.aiChapterId = msg.chapterId || state.aiChapterId;
    render();
    runAssistant();
  }

  function continueWriting(chapterId) {    state.aiChapterId = chapterId || null;
    var ch = chapterId ? chapterById(chapterId) : null;
    state.chat.messages.push({ role: 'user', content: '续写' + (ch ? '第 ' + ch.order + ' 回' : '当前章节') });
    render();
    runAssistant();
  }

  // ---------- 交互 ----------

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;

    if (act === 'shelf') { state.shelf = !state.shelf; render(); return; }
    if (act === 'open-book') {
      state.book = el.dataset.file;
      try { localStorage.setItem('hlw-book', state.book); } catch (e) {}
      state.shelf = false; state.tab = 'chapters'; state.chat = null; state.chats = []; state.editing = null;
      refresh(); return;
    }
    if (act === 'create-book') {
      var nbName = document.getElementById('nb-name').value.trim();
      var nbAuthor = document.getElementById('nb-author').value.trim();
      if (!nbName) { toast('先给新故事起个名', true); return; }
      api('/api/books', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: nbName, author: nbAuthor })
      }).then(function (d) {
        state.book = d.file;
        try { localStorage.setItem('hlw-book', d.file); } catch (e) {}
        state.shelf = false; state.tab = 'chapters'; state.chat = null; state.chats = [];
        toast('已建好《' + d.name + '》');
        return refresh();
      }).catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'tab') {
      state.tab = el.dataset.tab; state.shelf = false; state.editing = null;
      state.showSettings = false; state.showHistory = false;
      if (state.tab === 'ai') {
        ensureChat().then(function () { render(); }).catch(function (e) { toast(e.message, true); });
      }
      render(); return;
    }
    if (act === 'new-chapter') { state.editing = 'new'; render(); return; }
    if (act === 'cancel-edit') { state.editing = null; render(); return; }
    if (act === 'goto-chapter') {
      var gotoId = el.dataset.id;
      if (state.editing === 'new') {
        state.editing = gotoId; state.aiChapterId = gotoId; render(); return;
      }
      saveCurrent().then(function () {
        state.editing = gotoId; state.aiChapterId = gotoId;
        return refresh();
      }).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'edit') { state.editing = el.dataset.id; state.aiChapterId = el.dataset.id; render(); return; }

    if (act === 'save-chapter') {
      var title = document.getElementById('ed-title').value.trim();
      var body = document.getElementById('ed-body').value;
      var url = state.editing === 'new' ? '/api/chapter' : '/api/chapter/' + encodeURIComponent(state.editing);
      api(url, {
        method: state.editing === 'new' ? 'POST' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title, body: body })
      }).then(function () { toast('已保存'); state.editing = null; return refresh(); })
        .catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'delete-chapter') {
      if (!confirm('这一章删了就没了，确定？')) return;
      api('/api/chapter/' + encodeURIComponent(el.dataset.id), { method: 'DELETE' })
        .then(function () { state.editing = null; toast('已删除'); return refresh(); })
        .catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'add-char') {
      var name = document.getElementById('ch-name').value.trim();
      var aliases = document.getElementById('ch-alias').value.split(/[、,，\\s]+/).filter(Boolean);
      var role = document.getElementById('ch-role').value.trim();
      var debut = document.getElementById('ch-debut').value.trim();
      if (!name) { toast('先填正名', true); return; }
      api('/api/character', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name, aliases: aliases, role: role, debut: debut })
      }).then(function () { toast('已添加'); return refresh(); }).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'add-foreshadow') {
      var ft = document.getElementById('fs-title').value.trim();
      var at = document.getElementById('fs-at').value.trim();
      if (!ft || !at) { toast('名称和章号都要填', true); return; }
      api('/api/foreshadow', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: ft, at: at })
      }).then(function () { toast('已埋下'); return refresh(); }).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'pay') {
      var at2 = prompt('在第几章回收？填章号');
      if (!at2) return;
      api('/api/pay', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: el.dataset.id, at: at2.trim() })
      }).then(function () { toast('已回收'); return refresh(); }).catch(function (e) { toast(e.message, true); });
      return;
    }

    if (act === 'ai-settings') { state.showSettings = !state.showSettings; render(); return; }
    if (act === 'ai-save') {
      var key = document.getElementById('ai-key').value.trim();
      var base = document.getElementById('ai-base').value.trim();
      var model = document.getElementById('ai-model').value.trim();
      api('/api/ai/config', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKey: key, baseUrl: base, model: model })
      }).then(function (cfg) {
        state.aiConfig = cfg; state.showSettings = false;
        toast(cfg.configured ? '已保存，可以开始用了' : '没填 Key，还是用不了');
        render();
      }).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'ai-send') {
      var input = document.getElementById('ai-input');
      sendText(input ? input.value : '');
      return;
    }
    if (act === 'ai-stop') {
      if (state.controller) state.controller.abort();
      return;
    }
    if (act === 'ai-quick') { sendText(el.dataset.q); return; }
    if (act === 'ai-think') {
      state.deepThink = !state.deepThink;
      try { localStorage.setItem('hlw-think', state.deepThink ? '1' : '0'); } catch (e) {}
      render(); return;
    }
    if (act === 'ai-usebook') {
      state.useBook = !state.useBook;
      try { localStorage.setItem('hlw-usebook', state.useBook ? '1' : '0'); } catch (e) {}
      render(); return;
    }
    if (act === 'ai-new') { newChat(); return; }
    if (act === 'ai-history') { state.showHistory = true; render(); return; }
    if (act === 'close-history') {
      if (ev.target.closest('[data-stop]')) return;
      state.showHistory = false; render(); return;
    }
    if (act === 'close-history-btn') {
      state.showHistory = false; render(); return;
    }
    if (act === 'ai-open') { openChat(el.dataset.id); return; }
    if (act === 'ai-del') { if (confirm('删掉这段对话？')) removeChat(el.dataset.id); return; }
    if (act === 'ai-clear-chapter') { state.aiChapterId = null; render(); return; }
    if (act === 'ai-goto-chapter') {
      if (!state.aiChapterId) return;
      state.tab = 'chapters'; state.shelf = false; state.editing = state.aiChapterId; render(); return;
    }
    if (act === 'ai-continue') {
      state.tab = 'ai'; state.shelf = false; state.showSettings = false; state.editing = null;
      ensureChat().then(function () { continueWriting(el.dataset.id); }).catch(function (e) { toast(e.message, true); });
      return;
    }
    if (act === 'ai-regen') { regenerate(Number(el.dataset.idx)); return; }
    if (act === 'ai-copy') {
      var m = state.chat.messages[Number(el.dataset.idx)];
      if (m) copyText(m.content);
      return;
    }
    if (act === 'ai-select') {
      var ms = state.chat.messages[Number(el.dataset.idx)];
      if (ms) showCopySheet(ms.content);
      return;
    }
    if (act === 'copy-area') {
      var ca = document.getElementById('copy-area');
      if (ca) { ca.focus(); ca.select(); }
      toast('已全选，长按选「复制」');
      return;
    }
    if (act === 'close-sheet') {
      if (ev.target.closest('[data-stop]')) return;
      overlay.innerHTML = '';
      return;
    }
    if (act === 'close-sheet-btn') {
      overlay.innerHTML = '';
      return;
    }
    if (act === 'ai-insert') {
      var msg = state.chat.messages[Number(el.dataset.idx)];
      if (!msg) return;
      var target = msg.chapterId ? chapterById(msg.chapterId) : null;
      if (!target) { toast('先在章回里打开一章，再点「AI 接着写」', true); return; }
      var nextBody = (target.body ? target.body.replace(/\\s+$/, '') + '\\n\\n' : '') + msg.content;
      api('/api/chapter/' + encodeURIComponent(target.id), {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: nextBody })
      }).then(function () {
        toast('已插入第 ' + target.order + ' 回');
        state.tab = 'chapters'; state.editing = target.id;
        return refresh();
      }).catch(function (e) { toast(e.message, true); });
      return;
    }
  });

  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (!t || t.id !== 'ch-search') return;
    state.chapterFilter = t.value;
    state.searchFocus = true;
    render();
  });

  // 键盘弹起时把输入框滚到可见区域
  document.addEventListener('focusin', function (ev) {
    var t = ev.target;
    if (!t || (t.tagName !== 'TEXTAREA' && t.tagName !== 'INPUT')) return;
    setTimeout(function () {
      try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { t.scrollIntoView(); }
    }, 280);
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter') return;
    var t = ev.target;
    if (!t || t.id !== 'ai-input') return;
    if (ev.shiftKey) return;
    if (ev.isComposing) return;
    ev.preventDefault();
    sendText(t.value);
  });

  try {
    state.deepThink = localStorage.getItem('hlw-think') === '1';
    state.useBook = localStorage.getItem('hlw-usebook') !== '0';
  } catch (e) { /* 隐私模式下忽略 */ }

  refresh();
  setInterval(function () { if (!state.busy) loadBooks(); }, 30000);
})();
</script>
</body>
</html>`;
}
