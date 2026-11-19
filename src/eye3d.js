// Olho 3D do hero: peças da anatomia separadas ao longo do eixo óptico ("vista explodida").
// Gerado para assets/eye3d.js com `npm run build:eye` (esbuild, IIFE: window.Eye3D).
// O main.js controla o estado pelo scroll; este módulo só monta a cena e desenha.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Color, Vector3, Plane,
  SphereGeometry, RingGeometry, CircleGeometry, LatheGeometry, CylinderGeometry, TorusGeometry, Vector2,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, RepeatWrapping,
  CanvasTexture, SRGBColorSpace, PMREMGenerator, DirectionalLight, NeutralToneMapping, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 30;
const BRAND_IRIS = '#c9cd2a'; // íris do logo, um tom abaixo para não estourar na luz
const COPPER = '#b8662a';

// Ordem da frente para trás, que também é a ordem do tour no scroll.
// z: posição no olho montado (raio 1, eixo óptico = +Z); off: quanto anda na vista explodida.
// node: a peça que se mexe (a pupila é o furo da íris); r/up/tall: onde fica o rótulo.
export const PARTS = [
  { key: 'cornea', label: 'Córnea', z: 0.95, off: 3.6, r: 0.42, up: true },
  { key: 'iris', label: 'Íris', z: 0.86, off: 2.9, r: 0.41, up: true, tall: true },
  { key: 'pupil', node: 'iris', label: 'Pupila', r: 0, up: false, tall: true },
  { key: 'lens', label: 'Cristalino', z: 0.72, off: 2.25, r: 0.3, up: true },
  { key: 'ciliary', label: 'Corpo ciliar', z: 0.7, off: 1.6, r: 0.44, up: false },
  { key: 'vitreous', label: 'Humor vítreo', z: 0, off: 0.6, r: 0.86, up: false },
  { key: 'retina', label: 'Retina', z: 0, off: -0.6, r: 0.955, up: true },
  { key: 'choroid', label: 'Coroide', z: 0, off: -1.0, r: 0.975, up: true, tall: true },
  { key: 'sclera', label: 'Esclera', z: 0, off: -1.4, r: 1, up: false },
  { key: 'nerve', label: 'Nervo óptico', z: -1.45, off: -1.4, r: 0.18, up: false, tall: true },
];

// Aleatório com semente: as texturas saem iguais em toda visita
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) { const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 4; return t; }

// Íris: textura radial (o RingGeometry mapeia o quadrado inteiro no raio externo)
function irisTexture() {
  const S = 512, C = S / 2, inner = C * (0.125 / 0.41), r = rng(7);
  const [c, g] = canvas(S, S);
  const grad = g.createRadialGradient(C, C, inner, C, C, C);
  grad.addColorStop(0, '#5a2f12');
  grad.addColorStop(0.16, COPPER);
  grad.addColorStop(0.3, '#c9c62c');
  grad.addColorStop(0.62, BRAND_IRIS);
  grad.addColorStop(0.86, '#87901a');
  grad.addColorStop(1, '#3f4510');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.lineCap = 'round';
  for (let i = 0; i < 1100; i++) { // fibras do estroma
    const a = r() * Math.PI * 2, r0 = inner + r() * 30, r1 = C * (0.55 + r() * 0.42), w = (r() - 0.5) * 0.06;
    g.strokeStyle = r() < 0.55 ? `rgba(255,252,200,${0.06 + r() * 0.12})` : `rgba(55,48,8,${0.06 + r() * 0.14})`;
    g.lineWidth = 0.6 + r() * 1.4;
    g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0);
    g.quadraticCurveTo(C + Math.cos(a + w) * (r0 + r1) / 2, C + Math.sin(a + w) * (r0 + r1) / 2, C + Math.cos(a + w * 2) * r1, C + Math.sin(a + w * 2) * r1);
    g.stroke();
  }
  for (let i = 0; i < 46; i++) { // criptas
    const a = r() * Math.PI * 2, d = C * (0.42 + r() * 0.36);
    g.fillStyle = `rgba(70,58,10,${0.18 + r() * 0.2})`;
    g.beginPath(); g.ellipse(C + Math.cos(a) * d, C + Math.sin(a) * d, 3 + r() * 6, 1.5 + r() * 3, a, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(214,140,70,0.55)'; g.lineWidth = 2.5; g.beginPath(); // colarete
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * Math.PI * 2, d = C * 0.43 + Math.sin(i * 1.7) * 5;
    i ? g.lineTo(C + Math.cos(a) * d, C + Math.sin(a) * d) : g.moveTo(C + Math.cos(a) * d, C + Math.sin(a) * d);
  }
  g.stroke();
  return tex(c);
}

// Esclera: linha de cima = polo de trás, de baixo = borda da córnea (onde ficam os vasinhos)
function scleraTexture() {
  const W = 1024, H = 512, r = rng(3);
  const [c, g] = canvas(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#e6dccd'); grad.addColorStop(0.6, '#f4f0ea'); grad.addColorStop(1, '#f6eeea');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 34; i++) { // poucos vasinhos, discretos, só perto da córnea
    let x = r() * W, y = H; const a0 = 0.06 + r() * 0.1;
    g.strokeStyle = `rgba(178,48,46,${a0})`; g.lineWidth = 0.4 + r() * 0.8;
    g.beginPath(); g.moveTo(x, y);
    const len = 30 + r() * 90;
    for (let s = 0; s < len; s += 6) { x += (r() - 0.5) * 7; y -= 6; g.lineTo(x, y); }
    g.stroke();
  }
  return tex(c);
}

// Vasos que se ramificam a partir de um ponto (retina e coroide)
function vessels(g, r, x0, y0, n, spread, w0, colors, H) {
  g.lineCap = 'round';
  const vessel = (x, y, ang, w, col, depth) => {
    g.strokeStyle = col;
    for (let s = 0; s < 80 && w > 0.4; s++) {
      const nx = x + Math.cos(ang) * 7, ny = y + Math.sin(ang) * 7;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      x = nx; y = ny; ang += (r() - 0.5) * 0.35; w *= 0.985;
      if (depth < 3 && r() < 0.07) vessel(x, y, ang + (r() < 0.5 ? -0.7 : 0.7), w * 0.7, col, depth + 1);
      if (y > H || y < 0) break;
    }
  };
  for (let i = 0; i < n; i++) {
    const ang = Math.PI / 2 + (i / Math.max(1, n - 1) - 0.5) * spread + (r() - 0.5) * 0.2;
    vessel(x0, y0, ang, w0, colors[i % colors.length], 0);
  }
}

// Retina: laranja, com o disco óptico e os vasos saindo dele (linha de cima = fundo do olho)
function retinaTexture() {
  const W = 1024, H = 512, r = rng(11);
  const [c, g] = canvas(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#c8571f'); grad.addColorStop(0.1, '#ea8a36'); grad.addColorStop(0.7, '#e07a2c'); grad.addColorStop(1, '#b85a1e');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const dx = 260, dy = 62;
  const disc = g.createRadialGradient(dx, dy, 4, dx, dy, 46);
  disc.addColorStop(0, '#fff3d6'); disc.addColorStop(0.55, '#f6d7a0'); disc.addColorStop(1, 'rgba(234,138,54,0)');
  g.fillStyle = disc; g.beginPath(); g.ellipse(dx, dy, 52, 26, 0, 0, Math.PI * 2); g.fill();
  vessels(g, r, dx, dy, 10, 2.6, 3.2, ['rgba(150,40,14,0.8)', 'rgba(190,62,22,0.75)'], H);
  return tex(c);
}

// Coroide: vinho escuro, coberta de vasos
function choroidTexture() {
  const W = 1024, H = 512, r = rng(19);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#5c1a1d'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9; i++) vessels(g, r, r() * W, r() * H * 0.4, 5, 3.2, 2.4, ['rgba(178,58,52,0.75)', 'rgba(120,28,30,0.9)', 'rgba(210,92,80,0.5)'], H);
  return tex(c);
}

// Listras finas (corpo ciliar e nervo óptico); repete ao longo do comprimento
function stripeTexture(base, light, dark, n, seed) {
  const W = 512, H = 64, r = rng(seed);
  const [c, g] = canvas(W, H);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * W + (r() - 0.5) * 3;
    g.fillStyle = r() < 0.5 ? light : dark;
    g.fillRect(x, 0, (W / n) * (0.35 + r() * 0.3), H);
  }
  const t = tex(c); t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function supported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch { return false; }
}

export function create(host, { anchor } = {}) {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, innerWidth < 860 ? 1.5 : 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.localClippingEnabled = true; // a esclera vira uma tigela quando as peças se separam
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color('#ffffff'); // fundo opaco: a transmissão da córnea precisa dele
  const pmrem = new PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.03);
  scene.environment = envRT.texture;
  pmrem.dispose();
  const key = new DirectionalLight('#ffffff', 1.4); key.position.set(2.5, 3, 4); scene.add(key);

  const camera = new PerspectiveCamera(FOV, 1, 0.01, 60);

  const eye = new Group(); // posição/escala/rotação vindas do scroll
  const inner = new Group(); // compensa o centro de massa na vista explodida
  eye.add(inner); scene.add(eye);

  const textures = {
    iris: irisTexture(), sclera: scleraTexture(), retina: retinaTexture(), choroid: choroidTexture(),
    ciliary: stripeTexture('#a2413a', 'rgba(222,128,112,0.55)', 'rgba(92,22,22,0.6)', 96, 23),
    nerve: stripeTexture('#e7a75c', 'rgba(255,214,150,0.5)', 'rgba(170,96,40,0.45)', 60, 29),
  };
  textures.ciliary.repeat.set(1, 1);
  textures.nerve.repeat.set(1, 1);
  const nodes = {};
  const add = (key, ...meshes) => { const g = new Group(); meshes.forEach((m) => g.add(m)); inner.add(g); nodes[key] = g; return g; };
  // calota de esfera com o fundo virado para trás (tigela aberta na frente)
  const bowl = (r, theta) => { const geo = new SphereGeometry(r, 96, 48, 0, Math.PI * 2, 0, theta); geo.rotateX(-Math.PI / 2); return geo; };

  // Esclera: esfera com abertura na frente para a córnea; um plano de corte abre a frente na vista explodida
  const holeA = 0.42;
  const scleraCut = new Plane(new Vector3(0, 0, -1), 2), cutLocal = new Plane();
  const scleraMesh = new Mesh(bowl(1, Math.PI - holeA), new MeshPhysicalMaterial({
    map: textures.sclera, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, side: DoubleSide, clippingPlanes: [scleraCut],
  }));
  // Nervo óptico: sai da esclera e acompanha ela, um pouco para o lado nasal
  const nerveGeo = new CylinderGeometry(0.16, 0.19, 0.95, 40, 1, false); nerveGeo.rotateX(Math.PI / 2);
  const nerve = new Mesh(nerveGeo, new MeshStandardMaterial({ map: textures.nerve, roughness: 0.6 }));
  nerve.position.set(0.16, 0, -1.45);
  add('sclera', scleraMesh, nerve);
  nodes.nerve = nodes.sclera;

  // Coroide e retina: tigelas por dentro da esclera
  add('choroid', new Mesh(bowl(0.975, 1.45), new MeshStandardMaterial({ map: textures.choroid, roughness: 0.55, side: DoubleSide })));
  add('retina', new Mesh(bowl(0.955, 1.4), new MeshStandardMaterial({ map: textures.retina, roughness: 0.6, side: DoubleSide })));

  // Córnea: calota transparente que fecha a abertura
  const rimR = Math.sin(holeA), rimZ = Math.cos(holeA), Rc = 0.55, capA = Math.asin(rimR / Rc);
  const corneaGeo = new SphereGeometry(Rc, 64, 32, 0, Math.PI * 2, 0, capA); corneaGeo.rotateX(Math.PI / 2);
  const cornea = new Mesh(corneaGeo, new MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.03, ior: 1.376, thickness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, side: DoubleSide }));
  cornea.position.z = rimZ - Rc * Math.cos(capA) - 0.95; // relativo ao grupo, que fica em z 0.95
  add('cornea', cornea).position.z = 0.95;

  // Íris + pupila (o disco preto some quando as peças se separam)
  const iris = new Mesh(new RingGeometry(0.125, 0.41, 128, 1), new MeshStandardMaterial({ map: textures.iris, color: '#cfcfcf', roughness: 0.65, side: DoubleSide }));
  // opaca: material transparente não aparece através da córnea (passe de transmissão)
  const pupil = new Mesh(new CircleGeometry(0.13, 48), new MeshBasicMaterial({ color: '#040406' })); pupil.position.z = -0.004;
  add('iris', iris, pupil).position.z = 0.86;

  // Cristalino: lente biconvexa transparente (perfil girado em torno do eixo óptico)
  const pts = []; const R = 0.3, tf = 0.08, tb = 0.13;
  for (let i = 0; i <= 24; i++) { const x = (i / 24) * R; pts.push(new Vector2(x, -tb * (1 - (x / R) ** 2))); }
  for (let i = 23; i >= 0; i--) { const x = (i / 24) * R; pts.push(new Vector2(x, tf * (1 - (x / R) ** 2))); }
  const lensGeo = new LatheGeometry(pts, 64); lensGeo.rotateX(Math.PI / 2);
  add('lens', new Mesh(lensGeo, new MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.04, ior: 1.42, thickness: 0.3, attenuationColor: new Color('#e4eef4'), attenuationDistance: 1.2, clearcoat: 1, clearcoatRoughness: 0.03 })));

  // Corpo ciliar: anel muscular em volta do cristalino
  const cil = new Mesh(new TorusGeometry(0.35, 0.085, 28, 160), new MeshStandardMaterial({ map: textures.ciliary, bumpMap: textures.ciliary, bumpScale: 2.5, roughness: 0.55 }));
  add('ciliary', cil);

  // Humor vítreo: gel transparente
  const vitGeo = new SphereGeometry(0.86, 64, 48); vitGeo.scale(1, 1, 0.92);
  add('vitreous', new Mesh(vitGeo, new MeshPhysicalMaterial({ color: '#f7fcff', transmission: 1, roughness: 0.1, ior: 1.336, thickness: 1.4, attenuationColor: new Color('#d8ecf4'), attenuationDistance: 3, clearcoat: 0.6 })));

  for (const p of PARTS) if (!p.node && p.key !== 'nerve') nodes[p.key].position.z = p.z;

  // Rótulos (HTML sobre o canvas)
  const labelBox = document.createElement('div'); labelBox.className = 'eye-labels';
  host.appendChild(labelBox);
  const labels = PARTS.map((p) => {
    const el = document.createElement('span');
    el.className = 'eye-label ' + (p.up ? 'is-up' : 'is-down') + (p.tall ? ' is-tall' : '');
    el.textContent = p.label; labelBox.appendChild(el);
    return el;
  });

  // Layout: o olho fica sempre na coluna do hero (anchor); só a câmera se move no mergulho
  let W = 1, H = 1, dist = 7, halfH = 1, layout = { x0: 0, y0: 0, sAs: 1, sEx: 1, k: 0.6, tall: false };
  // extremos do olho explodido no eixo (frente da córnea, fundo do nervo), em raios
  const front = (k) => 0.95 + 3.6 * k, back = (k) => 1.925 + 1.4 * k;
  const measure = () => {
    const box = host.getBoundingClientRect();
    W = Math.max(1, box.width); H = Math.max(1, box.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = dist * Math.tan(MathUtils.degToRad(FOV / 2));
    const px = (H / 2) / halfH; // pixels por unidade no plano do olho
    const tall = W / H < 0.8, k = tall ? 0.45 : 0.6;
    const a = anchor ? anchor.getBoundingClientRect() : box;
    const cx = a.left + a.width / 2 - box.left, cy = a.top + a.height / 2 - box.top;
    const sAs = Math.min(Math.min(a.width * 0.84, a.height * (tall ? 1.1 : 2)) / 2 / px, 1.4); // montado
    const span = (front(k) + back(k)) * 0.95 + 0.5; // largura na tela, olhando de lado e um pouco de frente
    const room = Math.min(tall ? W - 24 : a.width * 1.25, 2 * (W - cx) - 40);
    const sEx = Math.min(sAs, room / (span * px)); // explodido: cabe na coluna
    layout = { x0: ((cx / W) * 2 - 1) * halfH * camera.aspect, y0: -((cy / H) * 2 - 1) * halfH, sAs, sEx, k, tall };
  };

  const v = new Vector3();
  const toScreen = (vec) => { v.copy(vec).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  // tour: -1 antes de começar; s..s+1 = passo s, com as peças 2s e 2s+1 em destaque; >= STEPS acabou
  const STEPS = Math.ceil(PARTS.length / 2);
  let state = { intro: 1, explode: 1, labels: 1, rot: 0, dolly: 0, tour: -1 };
  let queued = false;
  const cam0 = new Vector3(), pw = new Vector3(), lift = {};
  const focusOf = (i) => MathUtils.smoothstep(0.5 - Math.abs(state.tour - (Math.floor(i / 2) + 0.5)), 0, 0.18);

  const apply = () => {
    const { intro, explode: e, rot, dolly, tour } = state;
    const k = layout.k;
    const s = MathUtils.lerp(layout.sAs, layout.sEx, MathUtils.smootherstep(e, 0, 1)) * (0.9 + 0.1 * intro);
    eye.scale.setScalar(s);
    eye.position.set(layout.x0, layout.y0, 0);
    // fora do centro da tela a perspectiva entorta a íris: o olho mira a câmera
    const aimY = Math.atan2(-layout.x0, dist), aimX = Math.atan2(layout.y0, dist);
    eye.rotation.set(aimX + 0.24 * e, aimY + rot - (1 - intro) * 0.5, 0);
    inner.position.z = -e * (front(k) - back(k) + 0.975) / 2; // centraliza a vista explodida
    // a peça do tour sobe um pouco e cresce
    for (const key in nodes) lift[key] = 0;
    PARTS.forEach((p, i) => { const n = p.node || p.key; lift[n] = Math.max(lift[n], focusOf(i)); });
    for (const p of PARTS) {
      if (p.node || p.key === 'nerve') continue;
      const g = nodes[p.key], l = lift[p.key] * e;
      g.position.z = p.z + p.off * k * e;
      g.position.y = 0.1 * l;
      g.scale.setScalar(1 + 0.07 * l);
    }
    pupil.visible = e < 0.4; // explodido, o furo da íris fica aberto; montando, a retina apareceria por ele
    eye.updateMatrixWorld(true);
    // esclera: corte na frente (z local < c fica) que vai de "nada" (montada) a tigela (explodida)
    cutLocal.normal.set(0, 0, -1); cutLocal.constant = MathUtils.lerp(1.05, -0.05, MathUtils.smoothstep(e, 0.02, 0.5));
    scleraCut.copy(cutLocal).applyMatrix4(scleraMesh.matrixWorld);
    // mergulho: a câmera vai em linha reta até a pupila, que termina no centro da tela
    pw.set(0, 0, 0.86); inner.localToWorld(pw);
    const need = (0.13 * s * 0.8) / (Math.tan(MathUtils.degToRad(FOV / 2)) * Math.max(1, camera.aspect));
    const endDist = Math.max(need, 0.3 * s), d2 = dolly * dolly;
    cam0.set(0, 0, dist);
    const total = cam0.distanceTo(pw);
    camera.position.copy(pw).lerp(cam0, MathUtils.lerp(1, endDist / total, d2));
    v.set(0, 0, 0).lerp(pw, MathUtils.smoothstep(dolly, 0, 0.6));
    camera.lookAt(v);
    camera.updateMatrixWorld();
    const side = MathUtils.smoothstep(Math.abs(Math.sin(rot)), 0.35, 0.8); // de frente os rótulos se sobrepõem
    const touring = MathUtils.smoothstep(tour, -0.6, 0) * (1 - MathUtils.smoothstep(tour, STEPS - 0.4, STEPS + 0.2));
    PARTS.forEach((p, i) => {
      const el = labels[i], f = focusOf(i);
      // celular: só o rótulo da peça em destaque cabe acima do título
      const base = layout.tall ? f : MathUtils.lerp(1, 0.4 + 0.6 * f, touring);
      const o = state.labels * side * base;
      el.style.opacity = o.toFixed(3);
      el.classList.toggle('is-active', f > 0.5);
      if (o < 0.01) return;
      const n = nodes[p.node || p.key];
      v.set(0, (p.up ? 1 : -1) * p.r * 1.04, p.key === 'nerve' ? -1.45 : 0);
      n.localToWorld(v);
      let [x, y] = toScreen(v);
      const half = el.offsetWidth / 2 + 8; // o texto nunca sai da tela
      x = Math.min(Math.max(x, half), W - half);
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    });
  };

  const draw = () => { queued = false; apply(); renderer.render(scene, camera); };
  const request = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

  const api = {
    update(next) { Object.assign(state, next); request(); },
    resize() { measure(); request(); },
    dispose() {
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      Object.values(textures).forEach((t) => t.dispose());
      envRT.dispose(); renderer.dispose(); renderer.forceContextLoss();
      renderer.domElement.remove(); labelBox.remove();
    },
  };
  measure();
  draw();
  return api;
}
