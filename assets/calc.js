/* Умный калькулятор сметы дома.
   Земляные работы + опция подвала + объёмы бетона/арматуры/газоблока из размеров;
   разбивка по конструкциям; отделка/инженерия/остекление/двери до «под ключ»;
   экспорт CSV; печать/PDF; сохранение в localStorage. Автономно. */
(function () {
  "use strict";
  var root = document.getElementById('calc-app');
  if (!root) return;

  var LS = 'myhome-calc-v3';
  var PART_COEF = 0.095;   // м³ перегородок на м² полезной

  var DEFAULTS = {
    dims: { L: 14, B: 13, n: 2, H: 3, hall: 80, fLen: 84, fW: 50, fH: 80, tGround: 10, tLean: 10,
            tSlab: 16, tExt: 20, colN: 20, colW: 30, beamLen: 188, beamSec: 0.12, openPct: 15, resPct: 5,
            bsmtOn: 0, bsmtDepth: 2.4, bsmtWall: 25 },
    prices: { concrete: 40000, lean: 30000, rebar: 350000, gasblock: 42000, bedding: 8000,
              miscPct: 10, labor: 11000, rate: 385, exc: 2500, earth: 2500, wproof: 6000 }
  };

  var MAT = [
    { id: 'm300', name: 'Бетон М300 (фундамент/каркас/перекрытия)', unit: 'м³', pk: 'concrete' },
    { id: 'lean', name: 'Подбетонка М100', unit: 'м³', pk: 'lean' },
    { id: 'rebar', name: 'Арматура А500С', unit: 'т', pk: 'rebar' },
    { id: 'gas', name: 'Газоблок', unit: 'м³', pk: 'gasblock' },
    { id: 'bed', name: 'Подсыпка (щебень/песок)', unit: 'м³', pk: 'bedding' }
  ];

  // отделка / инженерия / остекление / двери. base: footprint|useful|extWall|fixed
  var FIN = [
    { id: 'vitr',  name: 'Витражи / панорама (тёплый алюминий)', base: 'fixed', qty: 40, unit: 'м²', price: 70000, on: 1 },
    { id: 'win',   name: 'Окна ПВХ (стеклопакеты)',              base: 'fixed', qty: 20, unit: 'м²', price: 45000, on: 1 },
    { id: 'dfront',name: 'Входная дверь',                        base: 'fixed', qty: 1,  unit: 'шт', price: 200000, on: 1 },
    { id: 'dint',  name: 'Межкомнатные двери',                   base: 'fixed', qty: 8,  unit: 'шт', price: 60000, on: 1 },
    { id: 'roof',  name: 'Гидроизоляция + утепление кровли',     base: 'footprint', price: 8000, on: 1 },
    { id: 'rough', name: 'Штукатурка, стяжка (черновая)',        base: 'useful', price: 12000, on: 1 },
    { id: 'fac',   name: 'Фасад (утепление + облицовка)',        base: 'extWall', price: 12000, on: 1 },
    { id: 'elec',  name: 'Электрика',                            base: 'useful', price: 6000, on: 1 },
    { id: 'plumb', name: 'Сантехника',                           base: 'useful', price: 5000, on: 1 },
    { id: 'heat',  name: 'Отопление',                            base: 'useful', price: 7000, on: 1 },
    { id: 'fin',   name: 'Финишная отделка',                     base: 'useful', price: 20000, on: 1 }
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
    var bsmt = d.bsmtOn ? 1 : 0;

    // --- фундамент / подвал ---
    var vLenta = 0, vFloorG = 0, vBsWall = 0, vBsFloor = 0, wproofArea = 0, foundConc = 0, foundReb = 0, vLean = 0;
    var foundRows = [];
    if (bsmt) {
      vBsWall = perim * d.bsmtDepth * (d.bsmtWall / 100);
      vBsFloor = footprint * 0.20;
      wproofArea = perim * d.bsmtDepth + footprint;
      foundConc = vBsWall + vBsFloor;
      foundReb = vBsWall * 80 + vBsFloor * 90;
      vLean = footprint * d.tLean / 100;
      foundRows = [['Стены подвала', vBsWall, vBsWall * 80], ['Плита подвала', vBsFloor, vBsFloor * 90]];
    } else {
      vLenta = d.fLen * (d.fW / 100) * (d.fH / 100);
      vFloorG = footprint * d.tGround / 100;
      foundConc = vLenta + vFloorG;
      foundReb = vLenta * 100 + vFloorG * 70;
      vLean = d.fLen * (d.fW / 100) * (d.tLean / 100);
      foundRows = [['Ленточный фундамент', vLenta, vLenta * 100], ['Пол по грунту', vFloorG, vFloorG * 70]];
    }

    var vCols = d.colN * Math.pow(d.colW / 100, 2) * Htot;
    var vBeams = d.beamLen * d.beamSec;
    var vSlab = upper * d.tSlab / 100;
    var vRoof = footprint * d.tSlab / 100;
    var m300base = foundConc + vCols + vBeams + vSlab + vRoof;
    var vM300 = m300base * res;

    var kg = (foundReb + vCols * 150 + vBeams * 150 + (vSlab + vRoof) * 90) * res;
    var tReb = kg / 1000;

    var extArea = perim * Htot * (1 - d.openPct / 100);
    var vGas = (extArea * d.tExt / 100 + useful * PART_COEF) * res;
    var vBed = footprint * 0.15;

    // --- земляные работы ---
    var excVol = bsmt
      ? footprint * (d.bsmtDepth + 0.4) * 1.1
      : d.fLen * ((d.fW / 100) + 0.4) * ((d.fH / 100) + 0.2) + footprint * 0.20;
    var earthRows = [
      ['Разработка грунта (' + (bsmt ? 'котлован' : 'траншеи') + ')', excVol, 'м³', p.exc, excVol * p.exc],
      ['Вывоз + засыпка + трамбовка', excVol * 1.3, 'м³', p.earth, excVol * 1.3 * p.earth]
    ];
    if (bsmt) earthRows.push(['Гидроизоляция подвала', wproofArea, 'м²', p.wproof, wproofArea * p.wproof]);
    var earthTotal = earthRows.reduce(function (s, r) { return s + r[4]; }, 0);

    // --- материалы ---
    var q = { m300: vM300, lean: vLean, rebar: tReb, gas: vGas, bed: vBed };
    var c = { m300: vM300 * p.concrete, lean: vLean * p.lean, rebar: tReb * p.rebar,
              gas: vGas * p.gasblock, bed: vBed * p.bedding };
    var matCore = c.m300 + c.lean + c.rebar + c.gas + c.bed;
    var misc = matCore * p.miscPct / 100;
    var materials = matCore + misc;

    // --- работа ---
    var laborArea = useful + (bsmt ? footprint : 0);
    var labor = laborArea * p.labor;
    var box = earthTotal + materials + labor;

    // --- разбивка ---
    var bd = foundRows.concat([
      ['Подбетонка М100', vLean, 0],
      ['Колонны', vCols, vCols * 150],
      ['Ригели', vBeams, vBeams * 150],
      ['Перекрытия', vSlab, vSlab * 90],
      ['Крыша', vRoof, vRoof * 90],
      ['Запас ' + d.resPct + '%', m300base * (res - 1), kg / res * (res - 1)]
    ]);

    // --- отделка ---
    var finRows = FIN.map(function (f) {
      var st = fin[f.id];
      var qty = f.base === 'footprint' ? footprint : f.base === 'useful' ? useful
              : f.base === 'extWall' ? extArea : st.qty;
      return { id: f.id, qty: qty, sum: st.on ? qty * st.price : 0 };
    });
    var finish = finRows.reduce(function (s, r) { return s + r.sum; }, 0);

    return {
      footprint: footprint, useful: useful, laborArea: laborArea, Htot: Htot, extArea: extArea, bsmt: bsmt,
      q: q, c: c, misc: misc, materials: materials, labor: labor, box: box,
      earthRows: earthRows, earthTotal: earthTotal, bd: bd,
      finRows: finRows, finish: finish, turnkey: box + finish
    };
  }

  // ---------- разметка ----------
  function num(path, val, step) {
    return '<input type="number" step="' + (step || 'any') + '" min="0" data-path="' + path + '" value="' + val + '">';
  }
  function dim(path, label, step) {
    return '<div class="dim"><label>' + label + '</label>' + num('dims.' + path, V.dims[path], step) + '</div>';
  }

  function build() {
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
      + '<p class="sub">Меняйте — объёмы и земляные работы пересчитываются. Толщины в сантиметрах.</p>'
      + '<div class="dim-grid">'
      + dim('L', 'Фасад L, м') + dim('B', 'Глубина B, м') + dim('n', 'Этажей', '1')
      + dim('H', 'Высота этажа, м', '0.1') + dim('hall', 'Зал, м²')
      + dim('fLen', 'Лента, пог.м') + dim('fW', 'Лента ширина, см') + dim('fH', 'Лента высота, см')
      + dim('tGround', 'Пол по грунту, см') + dim('tLean', 'Подбетонка, см')
      + dim('tSlab', 'Перекрытие, см') + dim('tExt', 'Стена нар., см')
      + dim('colN', 'Колонн, шт', '1') + dim('colW', 'Колонна, см')
      + dim('beamLen', 'Ригели, пог.м') + dim('beamSec', 'Ригель сеч., м²', '0.01')
      + dim('openPct', 'Проёмы, %') + dim('resPct', 'Запас, %')
      + '<div class="dim"><label>Подвал</label><label class="chkline"><input type="checkbox" class="chk" data-path="dims.bsmtOn"' + (V.dims.bsmtOn ? ' checked' : '') + '> есть подвал</label></div>'
      + dim('bsmtDepth', 'Подвал глубина, м', '0.1') + dim('bsmtWall', 'Стена подвала, см')
      + '</div>'
      + '<div class="sub" id="dim-out"></div></section>'

      + '<section class="block"><h2>Земляные работы <span class="tag">ЗЕМ</span></h2>'
      + '<p class="sub">Копка, вывоз и засыпка. С подвалом — котлован вместо траншей.</p>'
      + '<table class="calc"><thead><tr><th>Работа</th><th>Объём</th><th>Цена, ֏</th><th>Сумма, ֏</th></tr></thead>'
      + '<tbody id="earthbody"></tbody>'
      + '<tbody><tr class="sub"><td colspan="3">Земляные работы, итого</td><td class="r"><span id="s-earth">0</span></td></tr></tbody></table>'
      + '<p class="hint">Расценки редактируемы: разработка/вывоз — <input class="price" style="width:80px" type="number" data-path="prices.exc" value="' + V.prices.exc + '"> / '
      + '<input class="price" style="width:80px" type="number" data-path="prices.earth" value="' + V.prices.earth + '"> ֏/м³ · гидроизоляция '
      + '<input class="price" style="width:80px" type="number" data-path="prices.wproof" value="' + V.prices.wproof + '"> ֏/м²</p></section>'

      + '<section class="block"><h2>Материалы · коробка <span class="tag">MAT</span></h2>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Объём (авто)</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + matRows
      + '<tr><td>Клей, проволока, прочее</td><td class="r auto"><input class="qty" type="number" step="1" min="0" data-path="prices.miscPct" value="' + V.prices.miscPct + '"> % от материалов</td>'
      + '<td class="r auto">—</td><td class="r"><span id="s-misc">0</span></td></tr>'
      + '<tr class="sub"><td colspan="3">Материалы, итого</td><td class="r"><span id="s-materials">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Разбивка по конструкциям <span class="tag">STR</span></h2>'
      + '<table class="calc"><thead><tr><th>Конструкция</th><th>Бетон, м³</th><th>Арматура, кг</th></tr></thead>'
      + '<tbody id="bdbody"></tbody></table></section>'

      + '<section class="block"><h2>Работа и итог коробки <span class="tag">BOX</span></h2>'
      + '<table class="calc"><tbody>'
      + '<tr><td>Работа бригады (площадь × ставка)</td><td class="r auto"><span id="q-labor">0</span> м²</td>'
      + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="prices.labor" value="' + V.prices.labor + '"></td>'
      + '<td class="r"><span id="s-labor">0</span></td></tr></tbody></table>'
      + '<div class="totrow">'
      + '<div class="tot"><div class="k">Земляные</div><div class="v"><span id="t-earth">0</span></div></div>'
      + '<div class="tot"><div class="k">Материалы</div><div class="v"><span id="t-mat">0</span></div></div>'
      + '<div class="tot"><div class="k">Работа</div><div class="v"><span id="t-work">0</span></div></div>'
      + '<div class="tot big key"><div class="k">Коробка, всего</div><div class="v"><span id="t-box">0</span> <span class="cur">֏</span></div></div>'
      + '</div></section>'

      + '<section class="block"><h2>Отделка, инженерия, окна, двери <span class="tag">FIN</span></h2>'
      + '<p class="sub">Галочка — включить в «под ключ». Витражи/окна — м², двери — шт. Нормы правьте под себя.</p>'
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
      + '<button class="reset" id="c-pdf">🖨 PDF / печать</button>'
      + '<span class="rate">значения сохраняются в браузере</span></div>'
      + '</section>';
  }

  // ---------- чтение ----------
  function read() {
    root.querySelectorAll('[data-path]').forEach(function (inp) {
      var path = inp.dataset.path.split('.'), obj = V;
      for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      var key = path[path.length - 1];
      obj[key] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : (parseFloat(inp.value) || 0);
    });
  }
  var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };

  function refresh() {
    read();
    var r = compute(V.dims, V.prices, V.fin);
    MAT.forEach(function (m) { set('q-' + m.id, f1(r.q[m.id])); set('s-' + m.id, fmt(r.c[m.id])); });
    set('s-misc', fmt(r.misc)); set('s-materials', fmt(r.materials));
    // земляные
    document.getElementById('earthbody').innerHTML = r.earthRows.map(function (row) {
      return '<tr><td>' + row[0] + '</td><td class="r">' + f1(row[1]) + ' ' + row[2] + '</td><td class="r">' + fmt(row[3]) + '</td><td class="r">' + fmt(row[4]) + '</td></tr>';
    }).join('');
    set('s-earth', fmt(r.earthTotal));
    // разбивка
    document.getElementById('bdbody').innerHTML = r.bd.map(function (row) {
      return '<tr><td>' + row[0] + '</td><td class="r">' + f1(row[1]) + '</td><td class="r">' + fmt(row[2]) + '</td></tr>';
    }).join('');
    // работа/коробка
    set('q-labor', fmt(r.laborArea)); set('s-labor', fmt(r.labor));
    set('t-earth', fmt(r.earthTotal)); set('t-mat', fmt(r.materials)); set('t-work', fmt(r.labor));
    set('t-box', fmt(r.box)); set('t-box2', fmt(r.box));
    // отделка
    r.finRows.forEach(function (row) {
      set('fs-' + row.id, fmt(row.sum));
      var fq = document.getElementById('fq-' + row.id); if (fq) fq.textContent = fmt(row.qty);
      var tr = document.getElementById('fr-' + row.id); if (tr) tr.classList.toggle('off', !V.fin[row.id].on);
    });
    set('t-finish', fmt(r.finish)); set('t-finish2', fmt(r.finish)); set('t-turnkey', fmt(r.turnkey));
    set('t-usd', fmt(r.box / (V.prices.rate || 385)));
    set('t-perm2', fmt(r.box / (r.useful || 1)));
    set('t-perm2t', fmt(r.turnkey / (r.useful || 1)));
    set('dim-out', 'Пятно застройки ' + fmt(r.footprint) + ' м² · полезная ' + fmt(r.useful)
      + ' м²' + (r.bsmt ? ' + подвал ' + fmt(r.footprint) + ' м²' : '') + ' · наружные стены ≈ ' + fmt(r.extArea) + ' м²');
    set('hdr-total', '≈ ' + f1(r.box / 1e6) + ' млн ֏');
    set('ov-total', f1(r.box / 1e6)); set('ov-area', fmt(r.useful));
    set('ov-usd', fmt(r.box / (V.prices.rate || 385) / 1000));
    try { localStorage.setItem(LS, JSON.stringify(V)); } catch (e) {}
  }

  function csv() {
    var r = compute(V.dims, V.prices, V.fin);
    var rows = [['Раздел', 'Позиция', 'Кол-во', 'Ед', 'Цена', 'Сумма']];
    r.earthRows.forEach(function (x) { rows.push(['Земляные', x[0], Math.round(x[1]), x[2], x[3], Math.round(x[4])]); });
    MAT.forEach(function (m) { rows.push(['Материалы', m.name, Math.round(r.q[m.id] * 10) / 10, m.unit, V.prices[m.pk], Math.round(r.c[m.id])]); });
    rows.push(['Материалы', 'Прочее ' + V.prices.miscPct + '%', '', '', '', Math.round(r.misc)]);
    rows.push(['Работа', 'Бригада', Math.round(r.laborArea), 'м²', V.prices.labor, Math.round(r.labor)]);
    rows.push(['Итог', 'КОРОБКА', '', '', '', Math.round(r.box)]);
    FIN.forEach(function (f) {
      var row = r.finRows.filter(function (x) { return x.id === f.id; })[0];
      rows.push(['Отделка', f.name + (V.fin[f.id].on ? '' : ' (выкл)'), Math.round(row.qty), f.unit || 'м²', V.fin[f.id].price, Math.round(row.sum)]);
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
    document.getElementById('c-pdf').addEventListener('click', function () { window.print(); });
  }

  build(); wire(); refresh();
})();
