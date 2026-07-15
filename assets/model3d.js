/* Интерактивный 3D-массинг дома 14×13×6 м (Three.js).
   Центр в начале координат. X — фасад (14), Z — глубина (13), Y — высота (6).
   Фронт (двор) = +Z. Управление: OrbitControls (вращение/зум). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const mount = document.getElementById('model3d');
if (mount) init(mount);

function init(mount) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = mount.clientWidth, H = mount.clientHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dfe6ea');

  const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 500);
  camera.position.set(20, 14, 24);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 2.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 14;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // не уходить под землю
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.7;

  // ---- Свет ----
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfc6ba, 0.95));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.15);
  sun.position.set(18, 26, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = 22;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 80;
  scene.add(sun);

  // ---- Материалы ----
  const matWall  = new THREE.MeshStandardMaterial({ color: 0xeef1ec, roughness: 0.92 });
  const matStone = new THREE.MeshStandardMaterial({ color: 0xd8cdb4, roughness: 0.95 });
  const matSlab  = new THREE.MeshStandardMaterial({ color: 0x8a9299, roughness: 0.9 });
  const matFound = new THREE.MeshStandardMaterial({ color: 0x6f767b, roughness: 1 });
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0x8bb7e6, roughness: 0.06, metalness: 0, transmission: 0.85,
    transparent: true, opacity: 0.5, ior: 1.3
  });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x14202b, roughness: 0.6 });

  const edgeMat = new THREE.LineBasicMaterial({ color: 0x2b3742 });

  // box по границам (min..max), с рёбрами
  function box(x0, x1, y0, y1, z0, z1, mat, edges = true, shadow = true) {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = shadow; m.receiveShadow = shadow;
    scene.add(m);
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edgeMat);
      e.position.copy(m.position);
      scene.add(e);
    }
    return m;
  }

  // ---- Геометрия дома ----
  // Габарит: X [-7,7]=14, Z [-6.5,6.5]=13, Y [0,6]
  const HW = 4.5;            // половина ширины центральной зоны (центр = 9 м)
  const HALL_Z = -1.5;       // задняя граница зала (глубина зала 8 м: -1.5..6.5)

  // боковые объёмы (камень) — как на рендерах
  box(-7, -HW, 0, 6, -6.5, 6.5, matStone);
  box(HW, 7, 0, 6, -6.5, 6.5, matStone);
  // задний центральный блок (белый)
  box(-HW, HW, 0, 6, -6.5, HALL_Z, matWall);
  // зал — стеклянный двусветный объём у фасада
  box(-HW, HW, 0, 6, HALL_Z, 6.5, matGlass, false, false);

  // межэтажное перекрытие (2-й этаж) — везде, кроме зала
  box(-7, -HW, 2.9, 3.1, -6.5, 6.5, matSlab, false);
  box(HW, 7, 2.9, 3.1, -6.5, 6.5, matSlab, false);
  box(-HW, HW, 2.9, 3.1, -6.5, HALL_Z, matSlab, false);
  // балкон-галерея над залом (узкая полоса у задней стены зала)
  box(-HW, HW, 2.9, 3.1, HALL_Z, HALL_Z + 1.4, matSlab, false);

  // плита крыши (с небольшим выносом)
  box(-7.3, 7.3, 6, 6.35, -6.8, 6.8, matSlab);
  // плита фундамента
  box(-7.3, 7.3, -0.35, 0, -6.8, 6.8, matFound, false);

  // витраж зала — переплёты (мулионы) на фасаде z=6.5
  const zf = 6.5;
  [-3, 0, 3].forEach(x => box(x - 0.06, x + 0.06, 0.1, 6, zf - 0.05, zf + 0.02, matFrame, false, false));
  box(-HW, HW, 2.95, 3.08, zf - 0.05, zf + 0.02, matFrame, false, false); // горизонт на уровне галереи

  // ---- Участок: газон + подъезд ----
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0xbcccae, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.35;
  grass.receiveShadow = true;
  scene.add(grass);

  const drive = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 9),
    new THREE.MeshStandardMaterial({ color: 0xb9bdb6, roughness: 1 })
  );
  drive.rotation.x = -Math.PI / 2;
  drive.position.set(0, -0.34, 11.5);
  drive.receiveShadow = true;
  scene.add(drive);

  // ---- Рендер-цикл ----
  function tick() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();

  // ---- Ресайз ----
  function onResize() {
    W = mount.clientWidth; H = mount.clientHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  }
  window.addEventListener('resize', onResize);

  // остановить автоповорот при первом взаимодействии
  controls.addEventListener('start', () => { controls.autoRotate = false; });
}
