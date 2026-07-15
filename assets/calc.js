/* Умный калькулятор сметы дома.
   Объёмы бетона/арматуры/газоблока считаются из размеров; разбивка по
   конструкциям; блок «отделка и инженерия» до «под ключ»; экспорт CSV;
   сохранение в localStorage. Автономно (без зависимостей). */
(function () {
  "use strict";
  var root = document.getElementById('calc-app');
  if (!root) return;

  var LS = 'myhome-calc-v2';
  var PART_COEF = 0.095;   // м³ перегородок на м² полезной площади

  // размеры (толщины в см), цены, курс
  var DEFAULTS = {
    dims: { L: 14, B: 13, n: 2, H: 3, hall: 80, tFound: 30, tLean: 10, tSlab: 16,
            tExt: 20, colN: 20, colW: 30, beamLen: 188, beamSec: 0.12, openPct: 15, resPct: 5 },
    prices: { concrete: 40000, lean: 30000, rebar: 350000, gasblock: 42000, bedding: 8000,
              miscPct: 10, labor: 11000, rate: 385 }
  };

  var MAT = [
    { id: 'm300', name: 'Бетон М300 (с насосом+НДС)', unit: 'м³', pk: 'concrete' },
    { id: 'lean', name: 'Подбетонка М100', unit: 'м³', pk: 'lean' },
    { id: 'rebar', name: 'Арматура А500С', unit: 'т', pk: 'rebar' },
    { id: 'gas', name: 'Газоблок', unit: 'м³', pk: 'gasblock' },
    { id: 'bed', name: 'Подсыпка (щебень/песок)', unit: 'м³', pk: 'bedding' }
  ];

  // отделка / инженерия. base: footprint|useful|extWall|fixed
  var FIN = [
    { id: 'roof',  name: 'Гидроизоляция + утепление кровли', base: 'footprint', price: 8000, on: 1 },
    { id: 'win',   name: 'Окна и витражи',                   base: 'fixed', qty: 60, unit: 'м²', price: 45000, on: 1 },
    { id: 'rough', name: 'Штукатурка, стяжка (черновая)',    base: 'useful', price: 12000, on: 1 },
    { id: 'fac',   name: 'Фасад (утепление + облицовка)',    base: 'extWall', price: 12000, on: 1 },
    { id: 'elec',  name: 'Электрика',                        base: 'useful', price: 6000, on: 1 },
    { id: 'plumb', name: 'Сантехника',                       base: 'useful', price: 5000, on: 1 },
    { id: 'heat',  name: 'Отопление',                        base: 'useful', price: 7000, on: 1 },
    { id: 'fin',   name: 'Финишная отделка',                 base: 'useful', price: 20000, on: 1 }
  ];

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) {}
  var V = {
    dims: Object.assign({}, DEFAULTS.dims, saved.dims),
    prices: Object.assign({}, DEFAULTS.prices, saved.prices),
    fin: {}
  };
  FIN.forEach(function (f) {
    var s = (saved.fin && saved.fin[f.id]) || {};
    V.fin[f.id] = { price: s.price != null ? s.price : f.price, on: s.on != null ? s.on : f.on,
                    qty: s.qty != null ? s.qty : (f.qty || 0) };
  });

  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('ru-RU'); };

  // ---------- вычисления ----------
  function compute(d, p, fin) {
    var footprint = d.L * d.B;
    var Htot = d.n * d.H;
    var upper = Math.max(0, (d.n - 1) * footprint - d.hall);
    var useful = footprint + upper;
    var perim = 2 * (d.L + d.B);
    var res = 1 + d.resPct / 100;

    var vFound = footprint * d.tFound / 100;
    var vLean = footprint * d.tLean / 100;
    var vCols = d.colN * Math.pow(d.colW / 100, 2) * Htot;
    var vBeams = d.beamLen * d.beamSec;
    var vSlab = upper * d.tSlab / 100;
    var vRoof = footprint * d.tSlab / 100;
    var m300base = vFound + vCols + vBeams + vSlab + vRoof;
    var vM300 = m300base * res;

    var kg = (vFound * 100 + vCols * 150 + vBeams * 150 + (vSlab + vRoof) * 90) * res;
    var tReb = kg / 1000;

    var extArea = perim * Htot * (1 - d.openPct / 100);
    var vGas = (extArea * d.tExt / 100 + useful * PART_COEF) * res;
    var vBed = footprint * 0.30;

    var q = { m300: vM300, lean: vLean, rebar: tReb, gas: vGas, bed: vBed };
    var c = { m300: vM300 * p.concrete, lean: vLean * p.lean, rebar: tReb * p.rebar,
              gas: vGas * p.gasblock, bed: vBed * p.bedding };
    var matCore = c.m300 + c.lean + c.rebar + c.gas + c.bed;
    var misc = matCore * p.miscPct / 100;
    var materials = matCore + misc;
    var labor = useful * p.labor;
    var box = materials + labor;

    var finRows = FIN.map(function (f) {
      var st = fin[f.id];
      var qty = f.base === 'footprint' ? footprint : f.base === 'useful' ? useful
              : f.base === 'extWall' ? extArea : st.qty;
      var sum = st.on ? qty * st.price : 0;
      return { id: f.id, qty: qty, sum: sum };
    });
    var finish = finRows.reduce(function (s, r) { return s + r.sum; }, 0);

    return {
      footprint: footprint, useful: useful, upper: upper, Htot: Htot, extArea: extArea,
      q: q, c: c, misc: misc, materials: materials, labor: labor, box: box,
      finRows: finRows, finish: finish, turnkey: box + finish,
      bd: { found: [vFound, vFound * 100], lean: [vLean, 0], cols: [vCols, vCols * 150],
            beams: [vBeams, vBeams * 150], slab: [vSlab, vSlab * 90], roof: [vRoof, vRoof * 90],
            res: [m300base * (res - 1), kg / res * (res - 1)] }
    };
  }

  // ---------- разметка ----------
  function num(path, val, step) {
    return '<input type="number" step="' + (step || 'any') + '" min="0" data-path="' + path + '" value="' + val + '">';
  }
  function dim(path, label, step) {
    return '<div class="dim"><label>' + label + '</label>' + num('dims.' + path, V.dims[path.split('.').pop()], step) + '</div>';
  }

  function build() {
    var d = V.dims;
    var matRows = MAT.map(function (m) {
      return '<tr><td>' + m.name + '</td>'
        + '<td class="r auto"><span id="q-' + m.id + '">0</span> <span class="u">' + m.unit + '</span></td>'
        + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="prices.' + m.pk + '" value="' + V.prices[m.pk] + '"></td>'
        + '<td class="r"><span id="s-' + m.id + '">0</span></td></tr>';
    }).join('');

    var finRows = FIN.map(function (f) {
      var st = V.fin[f.id];
      var qtyCell = f.base === 'fixed'
        ? '<input class="qty" type="number" step="any" min="0" data-path="fin.' + f.id + '.qty" value="' + st.qty + '"> <span class="u">' + (f.unit || '') + '</span>'
        : '<span id="fq-' + f.id + '">0</span> <span class="u">м²</span>';
      return '<tr id="fr-' + f.id + '">'
        + '<td><input class="chk" type="checkbox" data-path="fin.' + f.id + '.on"' + (st.on ? ' checked' : '') + '> ' + f.name + '</td>'
        + '<td class="r auto">' + qtyCell + '</td>'
        + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="fin.' + f.id + '.price" value="' + st.price + '"></td>'
        + '<td class="r"><span id="fs-' + f.id + '">0</span></td></tr>';
    }).join('');

    root.innerHTML =
      '<section class="block"><h2>Габариты и параметры <span class="tag">DIM</span></h2>'
      + '<p class="sub">Меняйте — объёмы пересчитываются. Толщины в сантиметрах.</p>'
      + '<div class="dim-grid">'
      + dim('L', 'Фасад L, м') + dim('B', 'Глубина B, м') + dim('n', 'Этажей', '1')
      + dim('H', 'Высота этажа, м', '0.1') + dim('hall', 'Зал, м²')
      + dim('tFound', 'Плита фунд., см') + dim('tLean', 'Подбетонка, см')
      + dim('tSlab', 'Перекрытие, см') + dim('tExt', 'Стена нар., см')
      + dim('colN', 'Колонн, шт', '1') + dim('colW', 'Колонна, см')
      + dim('beamLen', 'Ригели, пог.м') + dim('beamSec', 'Ригель сеч., м²', '0.01')
      + dim('openPct', 'Проёмы, %') + dim('resPct', 'Запас, %')
      + '</div>'
      + '<div class="sub" id="dim-out"></div></section>'

      + '<section class="block"><h2>Материалы · коробка <span class="tag">MAT</span></h2>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Объём (авто)</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + matRows
      + '<tr><td>Клей, проволока, прочее</td><td class="r auto">'
      + '<input class="qty" type="number" step="1" min="0" data-path="prices.miscPct" value="' + V.prices.miscPct + '"> % от материалов</td>'
      + '<td class="r auto">—</td><td class="r"><span id="s-misc">0</span></td></tr>'
      + '<tr class="sub"><td colspan="3">Материалы, итого</td><td class="r"><span id="s-materials">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Разбивка по конструкциям <span class="tag">STR</span></h2>'
      + '<table class="calc"><thead><tr><th>Конструкция</th><th>Бетон, м³</th><th>Арматура, кг</th></tr></thead><tbody>'
      + bdRow('found', 'Плита фундамента') + bdRow('lean', 'Подбетонка М100')
      + bdRow('cols', 'Колонны') + bdRow('beams', 'Ригели')
      + bdRow('slab', 'Перекрытия') + bdRow('roof', 'Крыша')
      + bdRow('res', 'Запас (лестница/отходы)')
      + '</tbody></table></section>'

      + '<section class="block"><h2>Работа и итог коробки <span class="tag">BOX</span></h2>'
      + '<table class="calc"><tbody>'
      + '<tr><td>Работа бригады (полезная площадь × ставка)</td>'
      + '<td class="r auto"><span id="q-labor">0</span> м²</td>'
      + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="prices.labor" value="' + V.prices.labor + '"></td>'
      + '<td class="r"><span id="s-labor">0</span></td></tr>'
      + '</tbody></table>'
      + '<div class="totrow">'
      + '<div class="tot"><div class="k">Материалы</div><div class="v"><span id="t-mat">0</span></div></div>'
      + '<div class="tot"><div class="k">Работа</div><div class="v"><span id="t-work">0</span></div></div>'
      + '<div class="tot big key"><div class="k">Коробка, всего</div><div class="v"><span id="t-box">0</span> <span class="cur">֏</span></div></div>'
      + '</div></section>'

      + '<section class="block"><h2>Отделка и инженерия <span class="tag">FIN</span></h2>'
      + '<p class="sub">Галочка — включить в «под ключ». Нормы за м² ориентировочные — правьте под себя.</p>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + finRows
      + '<tr class="sub"><td colspan="3">Отделка + инженерия, итого</td><td class="r"><span id="t-finish">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Итог <span class="tag">TOTAL</span></h2>'
      + '<div class="totrow">'
      + '<div class="tot"><div class="k">Коробка</div><div class="v"><span id="t-box2">0</span></div></div>'
      + '<div class="tot"><div class="k">+ Отделка/инженерия</div><div class="v"><span id="t-finish2">0</span></div></div>'
      + '<div class="tot big key"><div class="k">ПОД КЛЮЧ</div><div class="v"><span id="t-turnkey">0</span> <span class="cur">֏</span></div></div>'
      + '</div>'
      + '<div class="totrow"><div class="tot"><div class="k">Коробка ≈ USD</div><div class="v">$<span id="t-usd">0</span></div></div>'
      + '<div class="tot"><div class="k">Коробка, ֏/м²</div><div class="v"><span id="t-perm2">0</span></div></div>'
      + '<div class="tot"><div class="k">Под ключ, ֏/м²</div><div class="v"><span id="t-perm2t">0</span></div></div>'
      + '<div class="dim" style="min-width:120px"><label>Курс ֏/$</label>' + num('prices.rate', V.prices.rate, '1') + '</div>'
      + '</div>'
      + '<div class="calc-actions"><button class="reset" id="c-reset">↺ Сбросить</button>'
      + '<button class="reset" id="c-csv">⤓ Скачать CSV</button>'
      + '<span class="rate">значения сохраняются в браузере</span></div>'
      + '</section>';
  }
  function bdRow(id, name) {
    return '<tr><td>' + name + '</td><td class="r"><span id="bc-' + id + '">0</span></td><td class="r"><span id="br-' + id + '">0</span></td></tr>';
  }

  // ---------- чтение состояния из DOM ----------
  function read() {
    root.querySelectorAll('[data-path]').forEach(function (inp) {
      var path = inp.dataset.path.split('.');
      var obj = V;
      for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      var key = path[path.length - 1];
      obj[key] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : (parseFloat(inp.value) || 0);
    });
  }

  var set = function (id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };

  function refresh() {
    read();
    var r = compute(V.dims, V.prices, V.fin);
    // материалы
    MAT.forEach(function (m) { set('q-' + m.id, m.id === 'rebar' ? f1(r.q[m.id]) : f1(r.q[m.id])); set('s-' + m.id, fmt(r.c[m.id])); });
    set('s-misc', fmt(r.misc)); set('s-materials', fmt(r.materials));
    // разбивка
    ['found', 'lean', 'cols', 'beams', 'slab', 'roof', 'res'].forEach(function (k) {
      set('bc-' + k, f1(r.bd[k][0])); set('br-' + k, fmt(r.bd[k][1]));
    });
    // работа / коробка
    set('q-labor', fmt(r.useful)); set('s-labor', fmt(r.labor));
    set('t-mat', fmt(r.materials)); set('t-work', fmt(r.labor));
    set('t-box', fmt(r.box)); set('t-box2', fmt(r.box));
    // отделка
    r.finRows.forEach(function (row) {
      set('fs-' + row.id, fmt(row.sum));
      var fq = document.getElementById('fq-' + row.id); if (fq) fq.textContent = fmt(row.qty);
      var tr = document.getElementById('fr-' + row.id); if (tr) tr.classList.toggle('off', !V.fin[row.id].on);
    });
    set('t-finish', fmt(r.finish)); set('t-finish2', fmt(r.finish));
    set('t-turnkey', fmt(r.turnkey));
    // производные
    set('t-usd', fmt(r.box / (V.prices.rate || 385)));
    set('t-perm2', fmt(r.box / (r.useful || 1)));
    set('t-perm2t', fmt(r.turnkey / (r.useful || 1)));
    set('dim-out', 'Пятно застройки ' + fmt(r.footprint) + ' м² · полезная ' + fmt(r.useful)
      + ' м² · высота ' + f1(r.Htot) + ' м · наружные стены ≈ ' + fmt(r.extArea) + ' м²');
    // шапка + обзор
    set('hdr-total', '≈ ' + f1(r.box / 1e6) + ' млн ֏');
    set('ov-total', f1(r.box / 1e6)); set('ov-area', fmt(r.useful));
    set('ov-usd', fmt(r.box / (V.prices.rate || 385) / 1000));
    try { localStorage.setItem(LS, JSON.stringify(V)); } catch (e) {}
  }

  function csv() {
    var r = compute(V.dims, V.prices, V.fin);
    var rows = [['Раздел', 'Позиция', 'Кол-во', 'Ед', 'Цена', 'Сумма']];
    MAT.forEach(function (m) { rows.push(['Материалы', m.name, Math.round(r.q[m.id] * 10) / 10, m.unit, V.prices[m.pk], Math.round(r.c[m.id])]); });
    rows.push(['Материалы', 'Прочее ' + V.prices.miscPct + '%', '', '', '', Math.round(r.misc)]);
    rows.push(['Работа', 'Бригада', Math.round(r.useful), 'м²', V.prices.labor, Math.round(r.labor)]);
    rows.push(['Итог', 'КОРОБКА', '', '', '', Math.round(r.box)]);
    FIN.forEach(function (f) {
      var row = r.finRows.filter(function (x) { return x.id === f.id; })[0];
      rows.push(['Отделка', f.name + (V.fin[f.id].on ? '' : ' (выкл)'), Math.round(row.qty), 'м²', V.fin[f.id].price, Math.round(row.sum)]);
    });
    rows.push(['Итог', 'ПОД КЛЮЧ', '', '', '', Math.round(r.turnkey)]);
    var text = '﻿' + rows.map(function (r) { return r.join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    a.download = 'smeta-dom.csv'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function reset() {
    V.dims = Object.assign({}, DEFAULTS.dims);
    V.prices = Object.assign({}, DEFAULTS.prices);
    FIN.forEach(function (f) { V.fin[f.id] = { price: f.price, on: f.on, qty: f.qty || 0 }; });
    build(); wire(); refresh();
  }

  function wire() {
    root.addEventListener('input', refresh);
    root.addEventListener('change', refresh);
    document.getElementById('c-reset').addEventListener('click', reset);
    document.getElementById('c-csv').addEventListener('click', csv);
  }

  build(); wire(); refresh();
})();
