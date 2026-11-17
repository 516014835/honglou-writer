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
  header h1 { margin: 0; font-size: 17px; font-weight: 600; }
  header .sub { margin-top: 2px; font-size: 12px; opacity: .85; }
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
  .row { display: flex; align-items: center; gap: 10px; }
  .grow { flex: 1 1 auto; min-width: 0; }
  .btn {
    border: 1px solid var(--line); background: #fff; color: var(--ink); font-family: inherit;
    padding: 9px 14px; border-radius: 9px; font-size: 14px;
  }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
  .btn.danger { color: var(--err); border-color: #e8c4c1; }
  .btn.block { display: block; width: 100%; margin-top: 10px; }
  textarea, input {
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
    font-size: 14px; opacity: 0; pointer-events: none; transition: opacity .2s;
  }
  .toast.show { opacity: 1; }
  .hidden { display: none !important; }
</style>
</head>
<body>
<header>
  <h1 id="book-name">${bookName}</h1>
  <div class="sub" id="book-stat">加载中…</div>
</header>
<nav id="tabs">
  <button data-act="tab" data-tab="chapters" class="on">章回</button>
  <button data-act="tab" data-tab="chars">人物</button>
  <button data-act="tab" data-tab="foreshadows">伏笔</button>
  <button data-act="tab" data-tab="check">体检</button>
</nav>
<main id="view"></main>
<div class="toast" id="toast"></div>
<script>
(function () {
  var state = { tab: 'chapters', project: null, stats: null, diagnostics: [], editing: null, fresh: false };
  var view = document.getElementById('view');
  var tabs = document.getElementById('tabs');

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
    toast._t = setTimeout(function () { el.className = 'toast'; }, 2200);
  }

  function api(path, opts) {
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
        return data;
      });
    });
  }

  function refresh() {
    return api('/api/project').then(function (d) {
      state.project = d.project;
      state.stats = d.stats;
      state.diagnostics = d.diagnostics;
      var s = state.stats;
      document.getElementById('book-name').textContent = d.project.name;
      document.getElementById('book-stat').textContent =
        s.chapters + ' 章 · ' + s.totalWords + ' 字 · ' + d.diagnostics.length + ' 条提醒';
      render();
    }).catch(function (e) { toast(e.message, true); });
  }

  function chapterTitle(ch) { return ch.title || '（第 ' + ch.order + ' 章 · 无回目）'; }

  function renderChapters() {
    var p = state.project;
    if (state.editing) return renderEditor();
    var html = '<button class="btn primary block" data-act="new-chapter">＋ 写新的一章</button>';
    if (!p.chapters.length) {
      html += '<div class="empty">还没有章回，点上面那个按钮开始。</div>';
    }
    var list = p.chapters.slice().sort(function (a, b) { return a.order - b.order; });
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
    var p = state.project;
    var ch = null;
    if (state.editing !== 'new') {
      p.chapters.forEach(function (c) { if (c.id === state.editing) ch = c; });
    }
    var title = ch ? ch.title : '';
    var body = ch ? ch.body : '';
    return '<div class="card">' +
      '<label>回目</label>' +
      '<input id="ed-title" value="' + esc(title) + '" placeholder="如：甄士隐梦幻识通灵">' +
      '<label>正文</label>' +
      '<textarea id="ed-body" placeholder="在这里写正文…">' + esc(body) + '</textarea>' +
      '<div class="row" style="margin-top:10px">' +
      '<button class="btn primary grow" data-act="save-chapter">保存</button>' +
      (ch ? '<button class="btn danger" data-act="delete-chapter" data-id="' + esc(ch.id) + '">删除</button>' : '') +
      '<button class="btn" data-act="cancel-edit">返回</button>' +
      '</div></div>';
  }

  function renderChars() {
    var p = state.project;
    var html = '';
    if (!p.characters.length) html += '<div class="empty">还没有人物卡。</div>';
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
    var html = '';
    if (!p.foreshadows.length) html += '<div class="empty">还没有伏笔。</div>';
    p.foreshadows.forEach(function (f) {
      var at = '';
      p.chapters.forEach(function (ch) { if (ch.id === f.plantedChapterId) at = '第 ' + ch.order + ' 回埋下'; });
      var paid = f.status === 'paid';
      html += '<div class="card"><div class="row"><div class="grow">' +
        '<h2>' + esc(f.title) +
        '<span class="tag' + (paid ? ' paid' : '') + '">' + (paid ? '已回收' : f.status === 'dropped' ? '已弃用' : '未回收') + '</span></h2>' +
        '<div class="meta">' + at + (f.payoffChapterId ? ' · 已回收' : '') + '</div></div>' +
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
    var html = '';
    if (!state.diagnostics.length) return '<div class="empty">没有问题，写得挺稳。</div>';
    state.diagnostics.forEach(function (d) {
      html += '<div class="diag ' + d.level + '">' + esc(d.message) + '</div>';
    });
    return html;
  }

  function render() {
    if (state.tab === 'chapters') view.innerHTML = renderChapters();
    else if (state.tab === 'chars') view.innerHTML = renderChars();
    else if (state.tab === 'foreshadows') view.innerHTML = renderForeshadows();
    else view.innerHTML = renderCheck();
    Array.prototype.forEach.call(tabs.children, function (b) {
      b.className = b.dataset.tab === state.tab ? 'on' : '';
    });
  }

  function saveChapter() {
    var title = document.getElementById('ed-title').value.trim();
    var body = document.getElementById('ed-body').value;
    var url = state.editing === 'new' ? '/api/chapter' : '/api/chapter/' + encodeURIComponent(state.editing);
    var method = state.editing === 'new' ? 'POST' : 'PUT';
    api(url, {
      method: method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: title, body: body })
    }).then(function () {
      toast('已保存');
      state.editing = null;
      return refresh();
    }).catch(function (e) { toast(e.message, true); });
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el) return;
    var act = el.dataset.act;
    if (act === 'tab') { state.tab = el.dataset.tab; state.editing = null; render(); return; }
    if (act === 'new-chapter') { state.editing = 'new'; render(); return; }
    if (act === 'cancel-edit') { state.editing = null; render(); return; }
    if (act === 'edit') { state.editing = el.dataset.id; render(); return; }
    if (act === 'save-chapter') { saveChapter(); return; }
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
      var title2 = document.getElementById('fs-title').value.trim();
      var at = document.getElementById('fs-at').value.trim();
      if (!title2 || !at) { toast('名称和章号都要填', true); return; }
      api('/api/foreshadow', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: title2, at: at })
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
  });

  refresh();
  setInterval(refresh, 20000);
})();
</script>
</body>
</html>`;
}
