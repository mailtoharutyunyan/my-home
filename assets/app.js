/* Дом 13×14 — интерактивная смета и реестр листов проекта.
   Зависимость: marked (подключается в index.html до этого файла). */
(function () {
  "use strict";

  /* ---------- Базовые позиции сметы ---------- */
  var BASE = [
    { key: 'beton',    name: 'Бетон М300 (с насосом+НДС)',      unit: 'м³',    qty: 159,  price: 40000,   grp: 'mat',  color: 'var(--concrete)' },
    { key: 'armatura', name: 'Арматура А500С',                 unit: 'т',     qty: 15.3, price: 350000,  grp: 'mat',  color: 'var(--rebar)' },
    { key: 'gazoblok', name: 'Газоблок',                       unit: 'м³',    qty: 85,   price: 42000,   grp: 'mat',  color: 'var(--sand)' },
    { key: 'podsypka', name: 'Подсыпка, песок, щебень',        unit: 'компл', qty: 1,    price: 700000,  grp: 'mat',  color: '#a7b0aa' },
    { key: 'prochee',  name: 'Клей, цемент, проволока, прочее', unit: 'компл', qty: 1,    price: 1600000, grp: 'mat',  color: '#b8c0c4' },
    { key: 'rabota',   name: 'Работа бригады',                 unit: 'м²',    qty: 284,  price: 11000,   grp: 'work', color: 'var(--blue)' }
  ];
  var rows = BASE.map(function (r) { return { qty: r.qty, price: r.price }; });

  /* ---------- Разделы проекта (Markdown) ---------- */
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

  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- Калькулятор ---------- */
  function buildCalc() {
    var body = $('calcbody');
    BASE.forEach(function (r, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + r.name + '</td>' +
        '<td class="r"><input data-i="' + i + '" data-f="qty" type="number" min="0" step="any" value="' + r.qty + '"></td>' +
        '<td class="r"><span class="u">' + r.unit + '</span></td>' +
        '<td class="r"><input data-i="' + i + '" data-f="price" type="number" min="0" step="any" value="' + r.price + '"></td>' +
        '<td class="r"><span class="rowsum" id="sum' + i + '">0</span><div class="bar" id="bar' + i + '" style="background:' + r.color + '"></div></td>';
      body.appendChild(tr);
    });
    body.insertAdjacentHTML('beforeend',
      '<tr class="sub"><td colspan="4">Материалы</td><td class="r"><span id="matrow">0</span></td></tr>' +
      '<tr class="sub"><td colspan="4">Работа</td><td class="r"><span id="workrow">0</span></td></tr>' +
      '<tr class="grand"><td colspan="4">ВСЕГО · серая коробка</td><td class="r"><span id="grandrow">0</span> ֏</td></tr>');
  }

  function recalc() {
    var mat = 0, work = 0, max = 0, sums = [];
    rows.forEach(function (r, i) {
      var s = (+r.qty || 0) * (+r.price || 0);
      sums[i] = s;
      if (BASE[i].grp === 'work') work += s; else mat += s;
      if (s > max) max = s;
    });
    sums.forEach(function (s, i) {
      $('sum' + i).textContent = fmt(s);
      $('bar' + i).style.width = (max ? (s / max * 100) : 0) + '%';
    });
    var total = mat + work;
    var rate = +$('rate').value || 385;
    var area = +$('area').value || 1;
    $('matrow').textContent = fmt(mat);
    $('workrow').textContent = fmt(work);
    $('grandrow').textContent = fmt(total);
    $('grand').textContent = fmt(total);
    $('matsum').textContent = fmt(mat);
    $('worksum').textContent = fmt(work);
    $('usd').textContent = fmt(total / rate);
    $('perm2').textContent = fmt(total / area);
    $('hdr-total').textContent = '≈ ' + (total / 1e6).toFixed(1).replace('.', ',') + ' млн ֏';
  }

  function wireCalc() {
    $('calc').addEventListener('input', function (e) {
      var t = e.target;
      if (t.dataset.i === undefined) return;
      rows[+t.dataset.i][t.dataset.f] = +t.value;
      recalc();
    });
    $('rate').addEventListener('input', recalc);
    $('area').addEventListener('input', recalc);
    $('reset').addEventListener('click', function () {
      rows = BASE.map(function (r) { return { qty: r.qty, price: r.price }; });
      document.querySelectorAll('#calc input[data-i]').forEach(function (inp) {
        inp.value = BASE[+inp.dataset.i][inp.dataset.f];
      });
      $('rate').value = 385;
      $('area').value = 284;
      recalc();
    });
  }

  /* ---------- Реестр листов / роутер ---------- */
  function buildNav() {
    var wrap = $('doclinks');
    DOCS.forEach(function (d, i) {
      var a = document.createElement('a');
      a.href = '#лист=' + String(i).padStart(2, '0');
      a.dataset.doc = i;
      a.innerHTML = '<span class="no">' + d[0].slice(0, 2) + '</span><span>' + d[1] + '</span>';
      wrap.appendChild(a);
    });
  }

  function setActive(el) {
    document.querySelectorAll('nav.index a').forEach(function (a) { a.classList.remove('active'); });
    if (el) el.classList.add('active');
  }

  function showHome() {
    $('doc').classList.remove('on');
    $('home').style.display = '';
    setActive(document.querySelector('nav.index a[data-home]'));
    window.scrollTo({ top: 0 });
  }

  function showDoc(i) {
    var doc = $('doc');
    $('home').style.display = 'none';
    doc.classList.add('on');
    doc.innerHTML = '<p class="docmiss">Загрузка…</p>';
    setActive(document.querySelector('nav.index a[data-doc="' + i + '"]'));
    if (typeof marked === 'undefined') {
      doc.innerHTML = '<p class="docmiss">Не удалось загрузить рендерер Markdown (нет интернета?). ' +
        'Откройте файл <code>' + DOCBASE + DOCS[i][0] + '</code> напрямую.</p>';
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
        window.scrollTo({ top: 0 });
      })
      .catch(function () {
        doc.innerHTML = '<p class="docmiss">Файл откроется на GitHub Pages. Локально запустите сервер ' +
          '(<code>python3 -m http.server</code>) — браузер блокирует чтение файлов через file://.<br><br>' +
          'Прямая ссылка: <a href="' + DOCBASE + encodeURIComponent(DOCS[i][0]) + '">' + DOCS[i][0] + '</a></p>';
      });
  }

  function route() {
    var m = decodeURIComponent(location.hash || '').match(/лист=(\d{2})/);
    if (m) showDoc(parseInt(m[1], 10));
    else showHome();
  }

  /* ---------- Init ---------- */
  buildCalc();
  wireCalc();
  recalc();
  buildNav();
  window.addEventListener('hashchange', route);
  route();
})();
