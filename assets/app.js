/* SPA-роутер: переключение видов (обзор/планировка/галерея/смета/документы),
   реестр разделов и рендер Markdown. Зависимость: marked. */
(function () {
  "use strict";

  // ---- Тема (светлая / тёмная) ----
  var THEME = 'myhome-theme';
  function applyTheme(t) {
    if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    var b = document.getElementById('theme-toggle');
    if (b) b.textContent = t === 'dark' ? '☀️' : '🌙';
  }
  var theme = 'light';
  try { theme = localStorage.getItem(THEME) || 'light'; } catch (e) {}
  applyTheme(theme);
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'theme-toggle') {
      theme = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME, theme); } catch (e2) {}
      applyTheme(theme);
    }
  });

  var VIEWS = ['обзор', 'планировка', 'галерея', 'смета', 'документы'];

  var DOCS = [
    ['00-ОГЛАВЛЕНИЕ.md', 'Оглавление'],
    ['01-исходные-данные.md', 'Исходные данные'],
    ['02-архитектура-схемы.md', 'Архитектура · схемы'],
    ['03-фундамент.md', 'Фундамент'],
    ['04-каркас-колонны-ригели.md', 'Каркас'],
    ['05-стены-газоблок.md', 'Стены · газоблок'],
    ['06-перекрытия-крыша.md', 'Перекрытия · крыша'],
    ['07-бетон-сводка.md', 'Бетон · сводка'],
    ['08-арматура-сводка.md', 'Арматура · сводка'],
    ['09-цены-источники.md', 'Цены · источники'],
    ['10-СМЕТА-ИТОГ.md', 'Смета · итог'],
    ['11-не-входит.md', 'Не входит'],
    ['12-экономия-варианты.md', 'Экономия'],
    ['13-ai-render.md', 'AI 3D-рендер · промпты']
  ];
  var DOCBASE = 'dom-proekt/';
  var $ = function (id) { return document.getElementById(id); };

  // ---- Реестр документов ----
  function buildDocs() {
    var wrap = $('doclinks');
    DOCS.forEach(function (d, i) {
      var a = document.createElement('a');
      a.href = '#лист=' + String(i).padStart(2, '0');
      a.dataset.doc = i;
      a.innerHTML = '<span class="no">' + d[0].slice(0, 2) + '</span><span>' + d[1] + '</span>';
      wrap.appendChild(a);
    });
  }
  function markDoc(i) {
    document.querySelectorAll('#doclinks a').forEach(function (a) {
      a.classList.toggle('active', +a.dataset.doc === i);
    });
  }
  function loadDoc(i) {
    var doc = $('doc');
    doc.innerHTML = '<p class="docmiss">Загрузка…</p>';
    markDoc(i);
    if (typeof marked === 'undefined') {
      doc.innerHTML = '<p class="docmiss">Нет рендерера Markdown. Файл: <code>' + DOCBASE + DOCS[i][0] + '</code></p>';
      return;
    }
    fetch(DOCBASE + encodeURIComponent(DOCS[i][0]))
      .then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (md) {
        doc.innerHTML = marked.parse(md);
        doc.querySelectorAll('a').forEach(function (a) {
          var m = (a.getAttribute('href') || '').match(/([0-9]{2})-[^\/]*\.md$/);
          if (m) { a.setAttribute('href', '#лист=' + m[1]); a.dataset.doc = parseInt(m[1], 10); }
        });
      })
      .catch(function () {
        doc.innerHTML = '<p class="docmiss">Файл откроется на GitHub Pages. Локально запустите сервер '
          + '(<code>python3 -m http.server</code>).<br>Прямая ссылка: '
          + '<a href="' + DOCBASE + encodeURIComponent(DOCS[i][0]) + '">' + DOCS[i][0] + '</a></p>';
      });
  }

  // ---- Виды ----
  function showView(v) {
    VIEWS.forEach(function (name) {
      var el = $('v-' + name);
      if (el) el.classList.toggle('on', name === v);
    });
    document.querySelectorAll('.tabs a').forEach(function (a) {
      a.classList.toggle('on', a.dataset.view === v);
    });
    if (v === 'планировка') window.dispatchEvent(new Event('m3d:show'));
    window.scrollTo({ top: 0 });
  }

  function route() {
    var h = decodeURIComponent(location.hash || '').replace('#', '');
    var m = h.match(/лист=(\d{2})/);
    if (m) { showView('документы'); loadDoc(parseInt(m[1], 10)); return; }
    if (VIEWS.indexOf(h) >= 0) { showView(h); }
    else { showView('обзор'); }
  }

  // ---- Init ----
  buildDocs();
  window.addEventListener('hashchange', route);
  route();
})();
