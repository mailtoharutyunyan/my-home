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
    ['13-ai-render.md', 'AI 3D-рендер · промпты'],
    ['14-нормы.md', 'Соответствие нормам']
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

  // ---- Лайтбокс галереи ----
  function initLightbox() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.gallery a'));
    if (!links.length) return;
    var items = links.map(function (a) {
      var cap = a.querySelector('.cap');
      return { src: a.getAttribute('href'), cap: cap ? cap.innerHTML : '' };
    });
    var lb = document.createElement('div');
    lb.className = 'lb'; lb.hidden = true;
    lb.innerHTML =
      '<div class="lb-count"></div>'
      + '<button class="lb-close" aria-label="Закрыть">✕</button>'
      + '<button class="lb-prev" aria-label="Назад">‹</button>'
      + '<img class="lb-img" alt="">'
      + '<button class="lb-next" aria-label="Вперёд">›</button>'
      + '<div class="lb-cap"></div>';
    document.body.appendChild(lb);
    var img = lb.querySelector('.lb-img'), cap = lb.querySelector('.lb-cap'),
        cnt = lb.querySelector('.lb-count');
    var cur = 0;
    function show(i) {
      cur = (i + items.length) % items.length;
      img.src = items[cur].src; cap.innerHTML = items[cur].cap;
      cnt.textContent = (cur + 1) + ' / ' + items.length;
    }
    function open(i) { show(i); lb.hidden = false; document.body.style.overflow = 'hidden'; }
    function close() { lb.hidden = true; document.body.style.overflow = ''; }

    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) { e.preventDefault(); open(i); });
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(cur - 1);
      else if (e.key === 'ArrowRight') show(cur + 1);
    });
    // свайп на телефоне
    var tx = 0;
    lb.addEventListener('touchstart', function (e) { tx = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - tx;
      if (Math.abs(dx) > 40) show(cur + (dx < 0 ? 1 : -1));
    }, { passive: true });
  }

  // ---- Появление секций при скролле ----
  function initReveal() {
    var els = document.querySelectorAll('#v-обзор .block');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    els.forEach(function (el) { el.classList.add('reveal'); });
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---- Init ----
  buildDocs();
  initLightbox();
  initReveal();
  window.addEventListener('hashchange', route);
  route();
})();
