/* Интерактивная 3D-модель дома 14×13×6 м (Three.js).
   X — фасад (14), Z — глубина (13), Y — высота (6). Фронт (двор) = +Z.
   Зал-студия 10×8 у фасада СЛЕВА, двусветный. Каркас: стены, окна, дверь,
   2 этажа, внутренние перегородки, подписи комнат. Виды: дом/без крыши/1/2 этаж. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mount = document.getElementById('model3d');
if (mount) init(mount);

function init(mount) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = mount.clientWidth, H = mount.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e7edf0');

  const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 500);
  camera.position.set(18, 15, 22);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 80;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // ---- Свет ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4cabd, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sun = new THREE.DirectionalLight(0xfff3e4, 1.15);
  sun.position.set(16, 26, 13);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = 24;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, far: 90 });
  scene.add(sun);

  // ---- Материалы ----
  const M = {
    wall:  new THREE.MeshStandardMaterial({ color: 0xf0f1ec, roughness: 0.94 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xd6c9ac, roughness: 0.96 }),
    slab:  new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.9 }),
    roof:  new THREE.MeshStandardMaterial({ color: 0x868d93, roughness: 0.85 }),
    found: new THREE.MeshStandardMaterial({ color: 0x6f767b, roughness: 1 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xa7c4e6, roughness: 0.05, metalness: 0,
             transmission: 0.9, transparent: true, opacity: 0.4, ior: 1.25, side: THREE.DoubleSide }),
    win:   new THREE.MeshPhysicalMaterial({ color: 0x2b3a47, roughness: 0.1, metalness: 0.1,
             transmission: 0.5, transparent: true, opacity: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1b2830, roughness: 0.5 }),
    door:  new THREE.MeshStandardMaterial({ color: 0x4a3a2b, roughness: 0.7 }),
    rail:  new THREE.MeshPhysicalMaterial({ color: 0xbfd2e8, roughness: 0.1, transmission: 0.7,
             transparent: true, opacity: 0.35 })
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x38454f });

  // ---- Группы (для переключения видов) ----
  const G = {
    roof: new THREE.Group(), slab: new THREE.Group(),
    lo: new THREE.Group(), hi: new THREE.Group(),
    p1: new THREE.Group(), p2: new THREE.Group(),
    l1: new THREE.Group(), l2: new THREE.Group(),
    site: new THREE.Group()
  };
  Object.values(G).forEach(g => scene.add(g));

  // box по границам min..max
  function box(group, x0, x1, y0, y1, z0, z1, mat, edges = false, shadow = true) {
    const g = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = shadow; m.receiveShadow = shadow;
    group.add(m);
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
      e.position.copy(m.position);
      group.add(e);
    }
    return m;
  }

  // подпись комнаты (спрайт)
  function label(group, text, x, y, z) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(245,246,242,0.92)';
    roundRect(ctx, 2, 14, 252, 36, 8); ctx.fill();
    ctx.strokeStyle = '#c8532a'; ctx.lineWidth = 2; roundRect(ctx, 2, 14, 252, 36, 8); ctx.stroke();
    ctx.fillStyle = '#14202b';
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.position.set(x, y, z);
    sp.scale.set(3.2, 0.8, 1);
    group.add(sp);
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /* ======================= ГЕОМЕТРИЯ ========================
     Габарит X[-7,7] Z[-6.5,6.5] Y[0,6].  Пол 2-го этажа y=3.
     Зал (стекло, двусвет): X[-7,3] Z[-1.5,6.5]  (10×8, слева, у фасада).
     Правая полоса: X[3,7] — вход, лестница, гостевой с/у, мастер-спальня.
     Задне-левый блок: X[-7,3] Z[-6.5,-1.5] — 1эт кухня-студия, 2эт спальня 2. */
  const t = 0.2;

  // --- Наружные стены: нижний этаж (gLo) и верхний (gHi) ---
  function walls(g, y0, y1) {
    box(g, -7, -6.8, y0, y1, -6.5, 6.5, M.stone, true);        // левая (камень)
    box(g, 6.8, 7, y0, y1, -6.5, 6.5, M.stone, true);          // правая (камень)
    box(g, -7, 7, y0, y1, -6.5, -6.3, M.wall, true);           // задняя
    box(g, 3, 7, y0, y1, 6.3, 6.5, y0 < 1 ? M.stone : M.wall, true); // фасад справа (вход. объём)
  }
  walls(G.lo, 0, 3);
  walls(G.hi, 3, 6);

  // --- Витраж зала (двусветный) — стекло + переплёты ---
  box(G.lo, -7, 3, 0.05, 3, 6.44, 6.49, M.glass, false, false);
  box(G.hi, -7, 3, 3, 5.95, 6.44, 6.49, M.glass, false, false);
  [-5, -3, -1, 1].forEach(x => {
    box(G.lo, x - 0.06, x + 0.06, 0.1, 3, 6.43, 6.5, M.frame, false, false);
    box(G.hi, x - 0.06, x + 0.06, 3, 6, 6.43, 6.5, M.frame, false, false);
  });
  box(G.lo, -7, 3, 2.9, 3.08, 6.43, 6.5, M.frame, false, false); // горизонталь на уровне галереи
  box(G.lo, -7, 3, 5.9, 6, 6.43, 6.5, M.frame, false, false);

  // --- Окна и дверь ---
  // вход + окно над ним (правый фасадный объём)
  box(G.lo, 4.6, 5.7, 0, 2.4, 6.48, 6.56, M.door, true);
  box(G.hi, 3.5, 6.6, 3.7, 5.4, 6.5, 6.55, M.win, false, false);
  // левая стена: кухня (низ), спальня 2 (верх)
  box(G.lo, -7.04, -6.99, 0.8, 2.2, -5.6, -3.4, M.win, false, false);
  box(G.hi, -7.04, -6.99, 3.7, 5.2, -5.6, -3.2, M.win, false, false);
  // правая стена: мастер (низ), спальня 1 (верх)
  box(G.lo, 6.99, 7.04, 0.8, 2.2, -6.1, -3.2, M.win, false, false);
  box(G.hi, 6.99, 7.04, 3.7, 5.2, -6.1, -3.2, M.win, false, false);
  // задняя стена
  box(G.lo, -5, -2, 0.8, 2.2, -6.54, -6.49, M.win, false, false);
  box(G.hi, -5, -2, 3.7, 5.2, -6.54, -6.49, M.win, false, false);
  box(G.hi, 1, 4, 3.7, 5.2, -6.54, -6.49, M.win, false, false);

  // --- Внутренние перегородки, 1 этаж (gP1) ---
  box(G.p1, 2.9, 3.1, 0, 3, -1.5, 6.5, M.wall, true);   // зал | правая полоса (двусвет → тянем и в p2)
  // раздвижная перегородка зал|кухня (студия): два стеновых «пенька», центр открыт
  box(G.p1, -7, -4.6, 0, 2.6, -1.6, -1.4, M.wall, true);
  box(G.p1, 1.2, 3, 0, 2.6, -1.6, -1.4, M.wall, true);
  box(G.p1, -4.6, 1.2, 2.4, 2.6, -1.55, -1.45, M.frame, false, false); // рельс раздвижной
  box(G.p1, 3, 7, 0, 3, -2.1, -1.9, M.wall, true);      // мастер | прихожая-лестница
  box(G.p1, 3, 4.7, 0, 2.6, 3.6, 3.8, M.wall, true);    // гостевой с/у (стенка)
  box(G.p1, 4.6, 4.8, 0, 2.6, 3.8, 6.3, M.wall, true);
  // лестница (ступени) в правой полосе
  for (let i = 0; i < 8; i++) {
    box(G.p1, 5.2, 6.6, i * 0.375, i * 0.375 + 0.375, 0.4 - i * 0.32, 0.72 - i * 0.32, M.slab, false);
  }

  // --- Внутренние перегородки, 2 этаж (gP2) ---
  box(G.p2, 2.9, 3.1, 3, 6, -1.5, 6.5, M.wall, true);        // продолжение разделителя (двусвет)
  box(G.p2, 3, 7, 3, 6, -2.1, -1.9, M.wall, true);           // спальня 1 | холл
  // стеклянные ограждения галереи вокруг проёма зала
  box(G.p2, 2.95, 3.05, 3, 4, -1.5, 6.4, M.rail, false, false);
  box(G.p2, -6.9, 3, 3, 4, -1.55, -1.45, M.rail, false, false);

  // --- Межэтажное перекрытие (кроме проёма зала) ---
  box(G.slab, 3, 7, 2.9, 3.05, -6.5, 6.5, M.slab, true);          // над правой полосой
  box(G.slab, -7, 3, 2.9, 3.05, -6.5, -1.5, M.slab, true);        // над задне-левым блоком (спальня 2)
  box(G.slab, -7, 3, 2.9, 3.05, -1.5, -0.1, M.slab, true);        // галерея-балкон над залом

  // --- Крыша (плоская) + парапет ---
  box(G.roof, -7.15, 7.15, 6, 6.25, -6.65, 6.65, M.roof, true);
  box(G.roof, -7.15, 7.15, 6.25, 6.7, -6.65, -6.5, M.wall, true);
  box(G.roof, -7.15, 7.15, 6.25, 6.7, 6.5, 6.65, M.wall, true);
  box(G.roof, -7.15, -6.9, 6.25, 6.7, -6.5, 6.5, M.wall, true);
  box(G.roof, 6.9, 7.15, 6.25, 6.7, -6.5, 6.5, M.wall, true);

  // --- Фундамент ---
  box(G.site, -7.15, 7.15, -0.3, 0, -6.65, 6.65, M.found, false);

  // --- Подписи комнат ---
  label(G.l1, 'ЗАЛ', -2, 1.6, 3);
  label(G.l1, 'КУХНЯ', -3, 1.6, -4);
  label(G.l1, 'МАСТЕР', 5, 1.6, -4.2);
  label(G.l1, 'С/У', 3.9, 1.6, 5);
  label(G.l1, 'ЛЕСТНИЦА', 5.9, 1.6, 1.3);
  label(G.l2, 'СПАЛЬНЯ 2', -3, 4.6, -4);
  label(G.l2, 'СПАЛЬНЯ 1', 5, 4.6, -4.2);
  label(G.l2, 'ГАЛЕРЕЯ', 1, 4.6, -0.7);
  label(G.l2, 'ЗАЛ (двусвет) ↓', -3, 4.6, 3);

  // --- Участок ---
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(70, 70),
    new THREE.MeshStandardMaterial({ color: 0xbccbad, roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.3; grass.receiveShadow = true;
  G.site.add(grass);
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(15, 9),
    new THREE.MeshStandardMaterial({ color: 0xb7bbb4, roughness: 1 }));
  drive.rotation.x = -Math.PI / 2; drive.position.set(0, -0.29, 11.5); drive.receiveShadow = true;
  G.site.add(drive);
  // пара деревьев для контекста
  function tree(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x6d5942 }));
    trunk.position.set(x, 0.4, z); trunk.castShadow = true; G.site.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0x7f9c6a, roughness: 1 }));
    crown.position.set(x, 1.8, z); crown.castShadow = true; crown.scale.y = 1.2; G.site.add(crown);
  }
  tree(-9, 7); tree(9.5, 5);

  // ======================= ВИДЫ =======================
  const views = {
    'Дом':        { roof: 1, slab: 1, lo: 1, hi: 1, p1: 1, p2: 1, l1: 0, l2: 0 },
    'Без крыши':  { roof: 0, slab: 1, lo: 1, hi: 1, p1: 1, p2: 1, l1: 0, l2: 1 },
    '1 этаж':     { roof: 0, slab: 0, lo: 1, hi: 0, p1: 1, p2: 0, l1: 1, l2: 0 },
    '2 этаж':     { roof: 0, slab: 1, lo: 0, hi: 1, p1: 0, p2: 1, l1: 0, l2: 1 }
  };
  function setView(v) {
    const s = views[v];
    G.roof.visible = !!s.roof; G.slab.visible = !!s.slab;
    G.lo.visible = !!s.lo; G.hi.visible = !!s.hi;
    G.p1.visible = !!s.p1; G.p2.visible = !!s.p2;
    G.l1.visible = !!s.l1; G.l2.visible = !!s.l2;
  }

  // toolbar
  const tools = document.createElement('div');
  tools.className = 'm3d-tools';
  Object.keys(views).forEach((name, i) => {
    const b = document.createElement('button');
    b.textContent = name; if (i === 0) b.classList.add('on');
    b.addEventListener('click', () => {
      tools.querySelectorAll('button').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); setView(name);
    });
    tools.appendChild(b);
  });
  mount.appendChild(tools);
  setView('Дом');

  // ======================= ЦИКЛ =======================
  function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }
  tick();
  window.addEventListener('resize', () => {
    W = mount.clientWidth; H = mount.clientHeight;
    camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H);
  });
}
