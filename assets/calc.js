/* Умный калькулятор сметы дома.
   КОРОБКА (тёплый контур) = земляные + материалы + окна/двери + работа.
   Опция подвала, разбивка по конструкциям, подсказки по нормам,
   отделка/инженерия/благоустройство до «под ключ», пресеты, CSV, печать, localStorage. */
(function () {
  "use strict";
  var root = document.getElementById('calc-app');
  if (!root) return;

  var LS = 'myhome-calc-v5';
  var PART_COEF = 0.095;

  var DEFAULTS = {
    dims: { L: 14, B: 13, n: 2, H: 3, hall: 80, fLen: 84, fW: 50, fH: 80, tGround: 10, tLean: 10,
            tSlab: 16, tExt: 20, colN: 20, colW: 30, beamLen: 188, beamSec: 0.12, openPct: 15, resPct: 5,
            hallBeams: 1, bsmtOn: 0, bsmtDepth: 2.4, bsmtWall: 25 },
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

  // окна и двери — входят в КОРОБКУ (тёплый контур, нужны для финального акта)
  var OPEN = [
    { id: 'vitr',  name: 'Витражи / панорама (тёплый алюминий)', base: 'fixed', qty: 40, unit: 'м²', price: 70000, on: 1 },
    { id: 'win',   name: 'Окна ПВХ (стеклопакеты)',              base: 'fixed', qty: 20, unit: 'м²', price: 45000, on: 1 },
    { id: 'dfront',name: 'Входная дверь',                        base: 'fixed', qty: 1,  unit: 'шт', price: 200000, on: 1 },
    { id: 'dint',  name: 'Межкомнатные двери',                   base: 'fixed', qty: 8,  unit: 'шт', price: 60000, on: 1 }
  ];

  // отделка / инженерия — сверх коробки, до «под ключ»
  var FIN = [
    { id: 'roof',  name: 'Гидроизоляция + утепление кровли', base: 'footprint', price: 8000, on: 1 },
    { id: 'rough', name: 'Штукатурка, стяжка (черновая)',    base: 'useful', price: 12000, on: 1 },
    { id: 'fac',   name: 'Фасад (утепление + облицовка)',    base: 'extWall', price: 12000, on: 1 },
    { id: 'elec',  name: 'Электрика',                        base: 'useful', price: 6000, on: 1 },
    { id: 'plumb', name: 'Сантехника',                       base: 'useful', price: 5000, on: 1 },
    { id: 'heat',  name: 'Отопление (котёл/тёплый пол)',     base: 'useful', price: 7000, on: 1 },
    { id: 'hpump', name: 'Тепловой насос (воздух-вода)',     base: 'fixed', qty: 1, unit: 'компл', price: 2500000, on: 0 },
    { id: 'solar', name: 'Солнечные панели (фотовольтаика)', base: 'fixed', qty: 5, unit: 'кВт', price: 350000, on: 0 },
    { id: 'fin',   name: 'Финишная отделка',                 base: 'useful', price: 20000, on: 1 }
  ];

  var SITE = [
    { id: 'fence',  name: 'Забор по периметру участка', qty: 90,  unit: 'пог.м', price: 15000, on: 1 },
    { id: 'gate',   name: 'Ворота въездные',            qty: 1,   unit: 'шт',    price: 200000, on: 1 },
    { id: 'septic', name: 'Септик / локальная канализация', qty: 1, unit: 'компл', price: 700000, on: 1 },
    { id: 'blind',  name: 'Отмостка вокруг дома',        qty: 54,  unit: 'пог.м', price: 8000, on: 1 },
    { id: 'pave',   name: 'Мощение двора / дорожки',     qty: 100, unit: 'м²',    price: 12000, on: 1 },
    { id: 'skitchen', name: 'Летняя кухня / беседка',    qty: 1,   unit: 'компл', price: 2500000, on: 0 },
    { id: 'pool',   name: 'Бассейн (бетонный, с оборуд.)', qty: 1, unit: 'компл', price: 5000000, on: 0 }
  ];

  var PRESETS = {
    'Эконом':   { vitr: { on: 0 }, win: { price: 35000 }, dfront: { price: 90000 }, dint: { price: 35000 },
                  rough: { price: 9000 }, fac: { price: 9000 }, elec: { price: 4500 }, plumb: { price: 4000 },
                  heat: { price: 5000 }, fin: { price: 11000 } },
    'Стандарт': {},
    'Премиум':  { vitr: { on: 1, qty: 60, price: 95000 }, win: { price: 60000 }, dfront: { price: 450000 },
                  dint: { price: 120000 }, rough: { price: 15000 }, fac: { price: 18000 }, elec: { price: 9000 },
                  plumb: { price: 8000 }, heat: { price: 11000 }, fin: { price: 35000 },
                  hpump: { on: 1 }, solar: { on: 1, qty: 8 } }
  };

  // ── состояние ──
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) {}
  function initStore(arr, savedStore) {
    var o = {};
    arr.forEach(function (f) {
      var s = (savedStore && savedStore[f.id]) || {};
      o[f.id] = { price: s.price != null ? s.price : f.price, on: s.on != null ? s.on : f.on,
                  qty: s.qty != null ? s.qty : (f.qty || 0) };
    });
    return o;
  }
  var V = {
    dims: Object.assign({}, DEFAULTS.dims, saved.dims),
    prices: Object.assign({}, DEFAULTS.prices, saved.prices),
    open: initStore(OPEN, saved.open),
    fin: initStore(FIN, saved.fin),
    site: initStore(SITE, saved.site)
  };

  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU'); };
  var f1 = function (n) { return (Math.round(n * 10) / 10).toLocaleString('ru-RU'); };

  function groupRows(arr, store, footprint, useful, extArea) {
    return arr.map(function (f) {
      var st = store[f.id];
      var qty = f.base === 'footprint' ? footprint : f.base === 'useful' ? useful
              : f.base === 'extWall' ? extArea : st.qty;
      return { id: f.id, qty: qty, sum: st.on ? qty * st.price : 0, on: st.on };
    });
  }

  // ── вычисления ──
  function compute(d, p, V) {
    var footprint = d.L * d.B;
    var Htot = d.n * d.H;
    var upper = Math.max(0, (d.n - 1) * footprint - d.hall);
    var useful = footprint + upper;
    var perim = 2 * (d.L + d.B);
    var res = 1 + d.resPct / 100;
    var bsmt = d.bsmtOn ? 1 : 0;

    var vBsWall = 0, vBsFloor = 0, wproofArea = 0, foundConc, foundReb, vLean, foundRows;
    if (bsmt) {
      vBsWall = perim * d.bsmtDepth * (d.bsmtWall / 100);
      vBsFloor = footprint * 0.20;
      wproofArea = perim * d.bsmtDepth + footprint;
      foundConc = vBsWall + vBsFloor;
      foundReb = vBsWall * 80 + vBsFloor * 90;
      vLean = footprint * d.tLean / 100;
      foundRows = [['Стены подвала', vBsWall, vBsWall * 80], ['Плита подвала', vBsFloor, vBsFloor * 90]];
    } else {
      var vLenta = d.fLen * (d.fW / 100) * (d.fH / 100);
      var vFloorG = footprint * d.tGround / 100;
      foundConc = vLenta + vFloorG;
      foundReb = vLenta * 100 + vFloorG * 70;
      vLean = d.fLen * (d.fW / 100) * (d.tLean / 100);
      foundRows = [['Ленточный фундамент', vLenta, vLenta * 100], ['Пол по грунту', vFloorG, vFloorG * 70]];
    }

    var hallSpan = Math.round(Math.sqrt(d.hall / 1.25));
    var vCols = d.colN * Math.pow(d.colW / 100, 2) * Htot;
    var vBeams = (d.beamLen + (d.hallBeams ? 2 * hallSpan : 0)) * d.beamSec;  // +2 ригеля над залом
    var vSlab = upper * d.tSlab / 100;
    var vRoof = footprint * d.tSlab / 100;
    var m300base = foundConc + vCols + vBeams + vSlab + vRoof;
    var vM300 = m300base * res;
    var kg = (foundReb + vCols * 150 + vBeams * 150 + (vSlab + vRoof) * 90) * res;
    var tReb = kg / 1000;
    var extArea = perim * Htot * (1 - d.openPct / 100);
    var vGas = (extArea * d.tExt / 100 + useful * PART_COEF) * res;
    var vBed = footprint * 0.15;

    // земляные
    var excVol = bsmt ? footprint * (d.bsmtDepth + 0.4) * 1.1
      : d.fLen * ((d.fW / 100) + 0.4) * ((d.fH / 100) + 0.2) + footprint * 0.20;
    var earthRows = [
      ['Разработка грунта (' + (bsmt ? 'котлован' : 'траншеи') + ')', excVol, 'м³', p.exc, excVol * p.exc],
      ['Вывоз + засыпка + трамбовка', excVol * 1.3, 'м³', p.earth, excVol * 1.3 * p.earth]
    ];
    if (bsmt) earthRows.push(['Гидроизоляция подвала', wproofArea, 'м²', p.wproof, wproofArea * p.wproof]);
    var earthTotal = earthRows.reduce(function (s, r) { return s + r[4]; }, 0);

    // материалы
    var q = { m300: vM300, lean: vLean, rebar: tReb, gas: vGas, bed: vBed };
    var c = { m300: vM300 * p.concrete, lean: vLean * p.lean, rebar: tReb * p.rebar,
              gas: vGas * p.gasblock, bed: vBed * p.bedding };
    var matCore = c.m300 + c.lean + c.rebar + c.gas + c.bed;
    var misc = matCore * p.miscPct / 100;
    var materials = matCore + misc;

    // окна и двери (в коробку)
    var openRows = groupRows(OPEN, V.open, footprint, useful, extArea);
    var openTotal = openRows.reduce(function (s, r) { return s + r.sum; }, 0);

    // работа + КОРОБКА (тёплый контур)
    var laborArea = useful + (bsmt ? footprint : 0);
    var labor = laborArea * p.labor;
    var box = earthTotal + materials + openTotal + labor;

    // разбивка
    var bd = foundRows.concat([
      ['Подбетонка М100', vLean, 0], ['Колонны', vCols, vCols * 150],
      ['Ригели', vBeams, vBeams * 150], ['Перекрытия', vSlab, vSlab * 90],
      ['Крыша', vRoof, vRoof * 90], ['Запас ' + d.resPct + '%', m300base * (res - 1), kg / res * (res - 1)]
    ]);

    // отделка/инженерия + благоустройство
    var finRows = groupRows(FIN, V.fin, footprint, useful, extArea);
    var finish = finRows.reduce(function (s, r) { return s + r.sum; }, 0);
    var siteRows = groupRows(SITE, V.site, footprint, useful, extArea);
    var siteTotal = siteRows.reduce(function (s, r) { return s + r.sum; }, 0);

    // подсказки по нормам (не расчёт, ориентир)
    var warn = [];
    var shag = Math.sqrt(footprint / Math.max(1, d.colN));
    var recSlab = Math.ceil(shag * 100 / 30);
    if (d.tSlab < recSlab)
      warn.push({ msg: 'Перекрытие ' + d.tSlab + ' см при пролёте ≈ ' + shag.toFixed(1) + ' м. По нормам ЖБК Армении (ՀՀՇՆ 52; ориентир 1/30 пролёта) нужно ≈ ' + recSlab + ' см. → Увеличьте «Перекрытие» до ' + recSlab + ' см или добавьте колонн.',
        fix: { label: 'плита ' + recSlab + ' см', path: 'dims.tSlab', val: recSlab } });
    if (shag > 6)
      warn.push({ msg: 'Шаг колонн ≈ ' + shag.toFixed(1) + ' м > 6 м — безбалочная плита требует расчёта на продавливание. → Добавьте колонн (шаг 4–6 м) или заложите ж/б ригели.',
        fix: { label: 'колонн ' + Math.ceil(footprint / 30), path: 'dims.colN', val: Math.ceil(footprint / 30) } });
    if (hallSpan > 6 && !d.hallBeams)
      warn.push({ msg: 'Кровля над залом перекрывает пролёт ≈ ' + hallSpan + ' м. Плоская плита без опор — до 6 м (ЖБК ՀՀՇՆ 52). → Заложите ж/б балки (ригели) над залом с шагом 3–4 м.',
        fix: { label: 'заложить балки над залом', path: 'dims.hallBeams', val: 1 } });
    if (d.H < 2.7)
      warn.push({ msg: 'Высота этажа ' + d.H + ' м ниже 2,7 м — минимум для жилых помещений. → Увеличьте до ≥ 2,7 м.',
        fix: { label: 'высота 2,7 м', path: 'dims.H', val: 2.7 } });
    if (d.n > 2)
      warn.push({ msg: 'Этажей ' + d.n + ' — по ՀՀՇՆ II-6.02-2006 обязателен сейсморасчёт и усиленный монолитный каркас. → Закажите проект конструктора.', fix: null });
    if (!bsmt && d.fW < 40)
      warn.push({ msg: 'Ширина ленты ' + d.fW + ' см меньше 40 см (минимум для 2 этажей). → Расширьте до 40–60 см.',
        fix: { label: 'лента 50 см', path: 'dims.fW', val: 50 } });
    if (!bsmt && d.fH < 60)
      warn.push({ msg: 'Заглубление ленты ' + d.fH + ' см — рекомендуется ниже промерзания (60–80 см). → Заглубите до 60–100 см.',
        fix: { label: 'лента 80 см', path: 'dims.fH', val: 80 } });

    return {
      footprint: footprint, useful: useful, laborArea: laborArea, Htot: Htot, extArea: extArea, bsmt: bsmt,
      q: q, c: c, misc: misc, materials: materials, earthRows: earthRows, earthTotal: earthTotal,
      openRows: openRows, openTotal: openTotal, labor: labor, box: box, bd: bd,
      finRows: finRows, finish: finish, siteRows: siteRows, siteTotal: siteTotal,
      turnkey: box + finish + siteTotal, warnings: warn
    };
  }

  // ── разметка ──
  function num(path, val, step) {
    return '<input type="number" step="' + (step || 'any') + '" min="0" data-path="' + path + '" value="' + val + '">';
  }
  function dim(path, label, step) {
    return '<div class="dim"><label>' + label + '</label>' + num('dims.' + path, V.dims[path], step) + '</div>';
  }
  function grpHTML(arr, store, ns, pfx) {
    return arr.map(function (f) {
      var st = store[f.id];
      var qtyCell = f.base === 'fixed'
        ? '<input class="qty" type="number" step="any" min="0" data-path="' + ns + '.' + f.id + '.qty" value="' + st.qty + '"> <span class="u">' + (f.unit || '') + '</span>'
        : '<span id="' + pfx + 'q-' + f.id + '">0</span> <span class="u">м²</span>';
      return '<tr id="' + pfx + 'r-' + f.id + '">'
        + '<td><input class="chk" type="checkbox" data-path="' + ns + '.' + f.id + '.on"' + (st.on ? ' checked' : '') + '> ' + f.name + '</td>'
        + '<td class="r auto">' + qtyCell + '</td>'
        + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="' + ns + '.' + f.id + '.price" value="' + st.price + '"></td>'
        + '<td class="r"><span id="' + pfx + 's-' + f.id + '">0</span></td></tr>';
    }).join('');
  }
  var presetBar = '<div class="calc-actions" style="margin:0"><span class="rate">Уровень комплектации:</span>'
    + '<button class="reset" data-preset="Эконом">Эконом</button>'
    + '<button class="reset" data-preset="Стандарт">Стандарт</button>'
    + '<button class="reset" data-preset="Премиум">Премиум</button></div>';

  function build() {
    var matRows = MAT.map(function (m) {
      return '<tr><td>' + m.name + '</td>'
        + '<td class="r auto"><span id="q-' + m.id + '">0</span> <span class="u">' + m.unit + '</span></td>'
        + '<td class="r"><input class="price" type="number" step="any" min="0" data-path="prices.' + m.pk + '" value="' + V.prices[m.pk] + '"></td>'
        + '<td class="r"><span id="s-' + m.id + '">0</span></td></tr>';
    }).join('');

    root.innerHTML =
      // ── Результат сверху ──
      '<section class="block result-card">'
      + '<div class="rc-grid">'
      + '<div><div class="rc-k">Коробка · тёплый контур</div><div class="rc-v"><span id="rc-box">0</span> ֏</div><div class="rc-sub" id="rc-box-sub"></div></div>'
      + '<div><div class="rc-k">Под ключ · с отделкой и участком</div><div class="rc-v key"><span id="rc-tk">0</span> ֏</div><div class="rc-sub" id="rc-tk-sub"></div></div>'
      + '</div>'
      + '<div class="rc-bar" id="rc-bar"></div>'
      + '<div class="rc-leg"><span><i class="l1"></i>коробка</span><span><i class="l2"></i>отделка/инженерия</span><span><i class="l3"></i>участок</span></div>'
      + '</section>'

      // ── 1. Параметры дома (основное) ──
      + '<section class="block"><h2>1 · Параметры дома <span class="tag">DIM</span></h2>'
      + '<p class="sub">Заполните основное — суммы считаются сразу. Инженерные параметры — в «расширенных».</p>'
      + '<div class="dim-grid">'
      + dim('L', 'Фасад L, м') + dim('B', 'Глубина B, м') + dim('n', 'Этажей', '1')
      + dim('H', 'Высота этажа, м', '0.1') + dim('hall', 'Зал, м²')
      + '<div class="dim"><label>Подвал</label><label class="chkline"><input type="checkbox" class="chk" data-path="dims.bsmtOn"' + (V.dims.bsmtOn ? ' checked' : '') + '> есть подвал</label></div>'
      + '</div>'
      + '<div class="sub" id="dim-out"></div>'
      + '<div id="norm-advisory"></div>'
      + '<details class="adv"><summary>⚙ Расширенные параметры (для инженера)</summary><div class="dim-grid">'
      + dim('fLen', 'Лента, пог.м') + dim('fW', 'Лента ширина, см') + dim('fH', 'Лента высота, см')
      + dim('tGround', 'Пол по грунту, см') + dim('tLean', 'Подбетонка, см')
      + dim('tSlab', 'Перекрытие, см') + dim('tExt', 'Стена нар., см')
      + dim('colN', 'Колонн, шт', '1') + dim('colW', 'Колонна, см')
      + dim('beamLen', 'Ригели, пог.м') + dim('beamSec', 'Ригель сеч., м²', '0.01')
      + '<div class="dim"><label>Балки над залом</label><label class="chkline"><input type="checkbox" class="chk" data-path="dims.hallBeams"' + (V.dims.hallBeams ? ' checked' : '') + '> заложены</label></div>'
      + dim('openPct', 'Проёмы, %') + dim('resPct', 'Запас, %')
      + dim('bsmtDepth', 'Подвал глубина, м', '0.1') + dim('bsmtWall', 'Стена подвала, см')
      + '</div></details>'
      + '<div style="margin-top:16px"><div class="rc-k" style="margin-bottom:8px">2 · Уровень комплектации</div>' + presetBar + '</div></section>'

      + '<section class="block"><h2>Земляные работы <span class="tag">ЗЕМ</span></h2>'
      + '<p class="sub">Копка, вывоз и засыпка. С подвалом — котлован вместо траншей.</p>'
      + '<table class="calc"><thead><tr><th>Работа</th><th>Объём</th><th>Цена, ֏</th><th>Сумма, ֏</th></tr></thead>'
      + '<tbody id="earthbody"></tbody>'
      + '<tbody><tr class="sub"><td colspan="3">Земляные работы, итого</td><td class="r"><span id="s-earth">0</span></td></tr></tbody></table>'
      + '<p class="hint">Расценки: разработка/вывоз <input class="price" style="width:80px" type="number" data-path="prices.exc" value="' + V.prices.exc + '"> / '
      + '<input class="price" style="width:80px" type="number" data-path="prices.earth" value="' + V.prices.earth + '"> ֏/м³ · гидроизоляция '
      + '<input class="price" style="width:80px" type="number" data-path="prices.wproof" value="' + V.prices.wproof + '"> ֏/м²</p></section>'

      + '<section class="block"><h2>Материалы · коробка <span class="tag">MAT</span></h2>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Объём (авто)</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + matRows
      + '<tr><td>Клей, проволока, прочее</td><td class="r auto"><input class="qty" type="number" step="1" min="0" data-path="prices.miscPct" value="' + V.prices.miscPct + '"> % от материалов</td>'
      + '<td class="r auto">—</td><td class="r"><span id="s-misc">0</span></td></tr>'
      + '<tr class="sub"><td colspan="3">Материалы, итого</td><td class="r"><span id="s-materials">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Окна и двери · тёплый контур <span class="tag">КОНТУР</span></h2>'
      + '<p class="sub">Входят в коробку — без остекления и дверей нет закрытого контура и финального акта.</p>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + grpHTML(OPEN, V.open, 'open', 'o')
      + '<tr class="sub"><td colspan="3">Окна и двери, итого</td><td class="r"><span id="s-open">0</span></td></tr>'
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
      + '<div class="tot"><div class="k">Окна/двери</div><div class="v"><span id="t-open">0</span></div></div>'
      + '<div class="tot"><div class="k">Работа</div><div class="v"><span id="t-work">0</span></div></div>'
      + '<div class="tot big key"><div class="k">Коробка (тёплый контур)</div><div class="v"><span id="t-box">0</span> <span class="cur">֏</span></div></div>'
      + '</div></section>'

      + '<section class="block"><h2>Отделка и инженерия <span class="tag">FIN</span></h2>'
      + '<p class="sub">Сверх коробки, до «под ключ». Тепловой насос и солнечные — по галочке.</p>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + grpHTML(FIN, V.fin, 'fin', 'f')
      + '<tr class="sub"><td colspan="3">Отделка + инженерия, итого</td><td class="r"><span id="t-finish">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Благоустройство участка <span class="tag">УЧАСТОК</span></h2>'
      + '<p class="sub">Забор, ворота, септик, отмостка, двор, летняя кухня, бассейн.</p>'
      + '<table class="calc"><thead><tr><th>Позиция</th><th>Кол-во</th><th>Цена за ед., ֏</th><th>Сумма, ֏</th></tr></thead><tbody>'
      + grpHTML(SITE, V.site, 'site', 's')
      + '<tr class="sub"><td colspan="3">Благоустройство, итого</td><td class="r"><span id="t-site">0</span></td></tr>'
      + '</tbody></table></section>'

      + '<section class="block"><h2>Итог <span class="tag">TOTAL</span></h2>'
      + '<div class="totrow">'
      + '<div class="tot"><div class="k">Коробка (контур)</div><div class="v"><span id="t-box2">0</span></div></div>'
      + '<div class="tot"><div class="k">+ Отделка/инженерия</div><div class="v"><span id="t-finish2">0</span></div></div>'
      + '<div class="tot"><div class="k">+ Благоустройство</div><div class="v"><span id="t-site2">0</span></div></div>'
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
      + '</section>'
      + '<section class="block"><h2>График платежей по этапам <span class="tag">CASH</span></h2>'
      + '<p class="sub">Сколько денег нужно на каждом этапе и нарастающим итогом (по ходу стройки).</p>'
      + '<table class="calc"><thead><tr><th>Этап</th><th>Сумма, ֏</th><th>Нарастающим</th><th>% от «под ключ»</th></tr></thead>'
      + '<tbody id="paybody"></tbody></table></section>';
  }

  // ── чтение / вывод ──
  function read() {
    root.querySelectorAll('[data-path]').forEach(function (inp) {
      var path = inp.dataset.path.split('.'), obj = V;
      for (var i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      var key = path[path.length - 1];
      obj[key] = inp.type === 'checkbox' ? (inp.checked ? 1 : 0) : (parseFloat(inp.value) || 0);
    });
  }
  var set = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  function renderGroup(rows, store, pfx) {
    rows.forEach(function (row) {
      set(pfx + 's-' + row.id, fmt(row.sum));
      var fq = document.getElementById(pfx + 'q-' + row.id); if (fq) fq.textContent = fmt(row.qty);
      var tr = document.getElementById(pfx + 'r-' + row.id); if (tr) tr.classList.toggle('off', !store[row.id].on);
    });
  }

  function refresh() {
    read();
    var r = compute(V.dims, V.prices, V);
    MAT.forEach(function (m) { set('q-' + m.id, f1(r.q[m.id])); set('s-' + m.id, fmt(r.c[m.id])); });
    set('s-misc', fmt(r.misc)); set('s-materials', fmt(r.materials));
    document.getElementById('earthbody').innerHTML = r.earthRows.map(function (x) {
      return '<tr><td>' + x[0] + '</td><td class="r">' + f1(x[1]) + ' ' + x[2] + '</td><td class="r">' + fmt(x[3]) + '</td><td class="r">' + fmt(x[4]) + '</td></tr>';
    }).join('');
    set('s-earth', fmt(r.earthTotal));
    document.getElementById('bdbody').innerHTML = r.bd.map(function (x) {
      return '<tr><td>' + x[0] + '</td><td class="r">' + f1(x[1]) + '</td><td class="r">' + fmt(x[2]) + '</td></tr>';
    }).join('');
    renderGroup(r.openRows, V.open, 'o'); set('s-open', fmt(r.openTotal));
    set('q-labor', fmt(r.laborArea)); set('s-labor', fmt(r.labor));
    set('t-earth', fmt(r.earthTotal)); set('t-mat', fmt(r.materials)); set('t-open', fmt(r.openTotal));
    set('t-work', fmt(r.labor)); set('t-box', fmt(r.box)); set('t-box2', fmt(r.box));
    renderGroup(r.finRows, V.fin, 'f'); set('t-finish', fmt(r.finish)); set('t-finish2', fmt(r.finish));
    renderGroup(r.siteRows, V.site, 's'); set('t-site', fmt(r.siteTotal)); set('t-site2', fmt(r.siteTotal));
    set('t-turnkey', fmt(r.turnkey));
    // верхняя карточка-результат
    var rate = V.prices.rate || 385, tk = r.turnkey || 1;
    set('rc-box', fmt(r.box)); set('rc-tk', fmt(r.turnkey));
    set('rc-box-sub', '≈ $' + fmt(r.box / rate) + ' · ' + fmt(r.box / (r.useful || 1)) + ' ֏/м²');
    set('rc-tk-sub', '≈ $' + fmt(r.turnkey / rate) + ' · ' + fmt(r.turnkey / (r.useful || 1)) + ' ֏/м²');
    var bar = document.getElementById('rc-bar');
    if (bar) bar.innerHTML = '<span class="s1" style="width:' + (r.box / tk * 100) + '%"></span>'
      + '<span class="s2" style="width:' + (r.finish / tk * 100) + '%"></span>'
      + '<span class="s3" style="width:' + (r.siteTotal / tk * 100) + '%"></span>';
    // график платежей
    var stages = [['Земляные работы', r.earthTotal], ['Материалы коробки', r.materials],
      ['Работа бригады', r.labor], ['Окна и двери', r.openTotal],
      ['Отделка и инженерия', r.finish], ['Благоустройство', r.siteTotal]];
    var cum = 0, pb = document.getElementById('paybody');
    if (pb) pb.innerHTML = stages.map(function (s) {
      cum += s[1];
      return '<tr><td>' + s[0] + '</td><td class="r">' + fmt(s[1]) + '</td><td class="r">' + fmt(cum) + '</td><td class="r">' + Math.round(s[1] / tk * 100) + '%</td></tr>';
    }).join('') + '<tr class="sub"><td>Итого под ключ</td><td class="r">' + fmt(tk) + '</td><td class="r">' + fmt(cum) + '</td><td class="r">100%</td></tr>';
    set('t-usd', fmt(r.box / (V.prices.rate || 385)));
    set('t-perm2', fmt(r.box / (r.useful || 1)));
    set('t-perm2t', fmt(r.turnkey / (r.useful || 1)));
    set('dim-out', 'Пятно застройки ' + fmt(r.footprint) + ' м² · полезная ' + fmt(r.useful)
      + ' м²' + (r.bsmt ? ' + подвал ' + fmt(r.footprint) + ' м²' : '') + ' · наружные стены ≈ ' + fmt(r.extArea) + ' м²');
    var adv = document.getElementById('norm-advisory');
    if (adv) {
      if (r.warnings.length) {
        adv.className = 'advisory warn';
        adv.innerHTML = '⚠️ Проверьте у инженера (нормы Армении):<ul>' + r.warnings.map(function (w) {
          var btn = w.fix ? ' <button class="fixbtn" data-fixpath="' + w.fix.path + '" data-fixval="' + w.fix.val + '">✓ применить: ' + w.fix.label + '</button>' : '';
          return '<li>' + w.msg + btn + '</li>';
        }).join('') + '</ul>';
      } else {
        adv.className = 'advisory ok';
        adv.innerHTML = '✓ Параметры в типовых рамках. Джрвеж (Котайк) — высокосейсмичная зона (до 0,4g): точные сечения и армирование задаёт проект по нормам Армении ՀՀՇՆ II-6.02-2006 (сейсмика) и ՀՀՇՆ 52 (ЖБК).';
      }
    }
    set('hdr-total', '≈ ' + f1(r.box / 1e6) + ' млн ֏');
    set('ov-total', f1(r.box / 1e6)); set('ov-area', fmt(r.useful));
    set('ov-usd', fmt(r.box / (V.prices.rate || 385) / 1000));
    try { localStorage.setItem(LS, JSON.stringify(V)); } catch (e) {}
  }

  function csv() {
    var r = compute(V.dims, V.prices, V);
    var rows = [['Раздел', 'Позиция', 'Кол-во', 'Ед', 'Цена', 'Сумма']];
    r.earthRows.forEach(function (x) { rows.push(['Земляные', x[0], Math.round(x[1]), x[2], x[3], Math.round(x[4])]); });
    MAT.forEach(function (m) { rows.push(['Материалы', m.name, Math.round(r.q[m.id] * 10) / 10, m.unit, V.prices[m.pk], Math.round(r.c[m.id])]); });
    rows.push(['Материалы', 'Прочее ' + V.prices.miscPct + '%', '', '', '', Math.round(r.misc)]);
    OPEN.forEach(function (f) { var row = r.openRows.filter(function (x) { return x.id === f.id; })[0]; rows.push(['Окна/двери', f.name + (V.open[f.id].on ? '' : ' (выкл)'), Math.round(row.qty), f.unit, V.open[f.id].price, Math.round(row.sum)]); });
    rows.push(['Работа', 'Бригада', Math.round(r.laborArea), 'м²', V.prices.labor, Math.round(r.labor)]);
    rows.push(['Итог', 'КОРОБКА (тёплый контур)', '', '', '', Math.round(r.box)]);
    FIN.forEach(function (f) { var row = r.finRows.filter(function (x) { return x.id === f.id; })[0]; rows.push(['Отделка', f.name + (V.fin[f.id].on ? '' : ' (выкл)'), Math.round(row.qty), f.unit || 'м²', V.fin[f.id].price, Math.round(row.sum)]); });
    SITE.forEach(function (f) { var row = r.siteRows.filter(function (x) { return x.id === f.id; })[0]; rows.push(['Участок', f.name + (V.site[f.id].on ? '' : ' (выкл)'), Math.round(row.qty), f.unit, V.site[f.id].price, Math.round(row.sum)]); });
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
    V.open = initStore(OPEN); V.fin = initStore(FIN); V.site = initStore(SITE);
    build(); wire(); refresh();
  }
  function applyPreset(name) {
    V.open = initStore(OPEN); V.fin = initStore(FIN);
    var pr = PRESETS[name] || {};
    Object.keys(pr).forEach(function (id) {
      if (V.open[id]) Object.assign(V.open[id], pr[id]);
      else if (V.fin[id]) Object.assign(V.fin[id], pr[id]);
    });
    build(); wire(); refresh();
  }
  function wire() {
    root.addEventListener('input', refresh);
    root.addEventListener('change', refresh);
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var p = t.getAttribute('data-preset');
      if (p) { applyPreset(p); return; }
      var fp = t.getAttribute('data-fixpath');
      if (fp) {
        var inp = root.querySelector('[data-path="' + fp + '"]');
        var val = t.getAttribute('data-fixval');
        if (inp) {
          if (inp.type === 'checkbox') inp.checked = (+val === 1);
          else inp.value = val;
          refresh();
        }
      }
    });
    document.getElementById('c-reset').addEventListener('click', reset);
    document.getElementById('c-csv').addEventListener('click', csv);
    document.getElementById('c-pdf').addEventListener('click', function () { window.print(); });
  }

  build(); wire(); refresh();
})();
