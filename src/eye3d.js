// Olho 3D do hero: peças da anatomia separadas ao longo do eixo óptico ("vista explodida").
// Gerado para assets/eye3d.js com `npm run build:eye` (esbuild, IIFE: window.Eye3D).
// O main.js controla o estado pelo scroll; este módulo só monta a cena e desenha.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, Color, Vector3,
  SphereGeometry, RingGeometry, CircleGeometry, LatheGeometry, CylinderGeometry, Vector2,
  MeshPhysicalMaterial, MeshStandardMaterial, MeshBasicMaterial, DoubleSide,
  CanvasTexture, SRGBColorSpace, PMREMGenerator, DirectionalLight, NeutralToneMapping, MathUtils,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FOV = 30;
const BRAND_IRIS = '#c9cd2a'; // íris do logo, um tom abaixo para não estourar na luz
const COPPER = '#b8662a';

// Posições no olho montado (raio 1, eixo óptico = +Z) e quanto cada peça anda na vista explodida
const PARTS = [
  { key: 'cornea', label: 'Córnea', z: 0.95, r: 0.42, off: 1.7, up: true },
  { key: 'iris', label: 'Íris', z: 0.86, r: 0.41, off: 1.15, up: false },
  { key: 'lens', label: 'Cristalino', z: 0.72, r: 0.3, off: 0.6, up: true },
  { key: 'vitreous', label: 'Corpo vítreo', z: 0, r: 0.88, off: 0, up: false },
  { key: 'retina', label: 'Retina', z: -0.45, r: 0.97, off: -0.6, up: true },
  { key: 'sclera', label: 'Esclera', z: 0, r: 1, off: -1.2, up: false },
  { key: 'nerve', label: 'Nervo óptico', z: -1.45, r: 0.18, off: -1.75, up: true },
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

// Retina: linha de cima = mácula (polo de trás); disco óptico com vasos saindo dele
function retinaTexture() {
  const W = 1024, H = 512, r = rng(11);
  const [c, g] = canvas(W, H);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#9c3a1c'); grad.addColorStop(0.08, '#d0582f'); grad.addColorStop(0.7, '#b8452a'); grad.addColorStop(1, '#7c2617');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  const dx = 260, dy = 62;
  const disc = g.createRadialGradient(dx, dy, 4, dx, dy, 46);
  disc.addColorStop(0, '#fff3d6'); disc.addColorStop(0.55, '#f0cf95'); disc.addColorStop(1, 'rgba(208,88,47,0)');
  g.fillStyle = disc; g.beginPath(); g.ellipse(dx, dy, 52, 26, 0, 0, Math.PI * 2); g.fill();
  g.lineCap = 'round';
  const vessel = (x, y, ang, w, col, depth) => {
    g.strokeStyle = col;
    for (let s = 0; s < 70 && w > 0.4; s++) {
      const nx = x + Math.cos(ang) * 7, ny = y + Math.sin(ang) * 7;
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
      x = nx; y = ny; ang += (r() - 0.5) * 0.35; w *= 0.985;
      if (depth < 3 && r() < 0.06) vessel(x, y, ang + (r() < 0.5 ? -0.7 : 0.7), w * 0.7, col, depth + 1);
      if (y > H || y < 0) break;
    }
  };
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI / 2 + (i / 9 - 0.5) * 2.6 + (r() - 0.5) * 0.2;
    vessel(dx, dy, ang, 3.4, i % 2 ? 'rgba(110,18,14,0.85)' : 'rgba(176,34,24,0.8)', 0);
  }
  return tex(c);
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

  const textures = { iris: irisTexture(), sclera: scleraTexture(), retina: retinaTexture() };
  const nodes = {};
  const add = (key, ...meshes) => { const g = new Group(); meshes.forEach((m) => g.add(m)); inner.add(g); nodes[key] = g; return g; };

  // Esclera: esfera com abertura na frente para a córnea
  const holeA = 0.42;
  const scleraGeo = new SphereGeometry(1, 96, 64, 0, Math.PI * 2, 0, Math.PI - holeA); scleraGeo.rotateX(-Math.PI / 2);
  add('sclera', new Mesh(scleraGeo, new MeshPhysicalMaterial({ map: textures.sclera, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25, side: DoubleSide })));

  // Córnea: calota transparente que fecha a abertura
  const rimR = Math.sin(holeA), rimZ = Math.cos(holeA), Rc = 0.55, capA = Math.asin(rimR / Rc);
  const corneaGeo = new SphereGeometry(Rc, 64, 32, 0, Math.PI * 2, 0, capA); corneaGeo.rotateX(Math.PI / 2);
  const cornea = new Mesh(corneaGeo, new MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0.03, ior: 1.376, thickness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, side: DoubleSide }));
  cornea.position.z = rimZ - Rc * Math.cos(capA) - 0.95; // relativo ao grupo, que fica em z 0.95
  add('cornea', cornea).position.z = 0.95;

  // Íris + pupila (o disco preto some quando as peças se separam)
  const iris = new Mesh(new RingGeometry(0.125, 0.41, 128, 1), new MeshStandardMaterial({ map: textures.iris, color: '#cfcfcf', roughness: 0.65, side: DoubleSide }));
  // opaca: material transparente não aparece através da córnea (passe de transmissão)
  const pupilMat = new MeshBasicMaterial({ color: '#040406' });
  const pupil = new Mesh(new CircleGeometry(0.13, 48), pupilMat); pupil.position.z = -0.004;
  add('iris', iris, pupil).position.z = 0.86;

  // Cristalino: lente biconvexa (perfil girado em torno do eixo óptico)
  const pts = []; const R = 0.3, tf = 0.07, tb = 0.12;
  for (let i = 0; i <= 24; i++) { const x = (i / 24) * R; pts.push(new Vector2(x, -tb * (1 - (x / R) ** 2))); }
  for (let i = 23; i >= 0; i--) { const x = (i / 24) * R; pts.push(new Vector2(x, tf * (1 - (x / R) ** 2))); }
  const lensGeo = new LatheGeometry(pts, 64); lensGeo.rotateX(Math.PI / 2);
  add('lens', new Mesh(lensGeo, new MeshPhysicalMaterial({ color: '#fff6df', transmission: 1, roughness: 0.08, ior: 1.42, thickness: 0.25, attenuationColor: new Color('#f0d993'), attenuationDistance: 0.7, clearcoat: 0.6 }))).position.z = 0.72;

  // Corpo vítreo: gel transparente
  const vitGeo = new SphereGeometry(0.88, 64, 48); vitGeo.scale(1, 1, 0.92);
  add('vitreous', new Mesh(vitGeo, new MeshPhysicalMaterial({ color: '#f4fbff', transmission: 1, roughness: 0.3, ior: 1.336, thickness: 1.2, attenuationColor: new Color('#cfe7f1'), attenuationDistance: 2.2 })));

  // Retina: calota interna no fundo do olho
  const retGeo = new SphereGeometry(0.965, 96, 48, 0, Math.PI * 2, 0, 2.2); retGeo.rotateX(-Math.PI / 2);
  const retina = new Mesh(retGeo, new MeshStandardMaterial({ map: textures.retina, roughness: 0.7, side: DoubleSide }));
  retina.position.z = 0.45;
  add('retina', retina).position.z = -0.45;

  // Nervo óptico, levemente para o lado nasal
  const nerveGeo = new CylinderGeometry(0.16, 0.19, 0.95, 40, 1, false); nerveGeo.rotateX(Math.PI / 2);
  const nerve = new Mesh(nerveGeo, new MeshStandardMaterial({ color: '#ecdcb8', roughness: 0.6 }));
  nerve.position.x = 0.16;
  add('nerve', nerve).position.z = -1.45;

  // Rótulos (HTML sobre o canvas)
  const labelBox = document.createElement('div'); labelBox.className = 'eye-labels';
  host.appendChild(labelBox);
  const labels = PARTS.map((p) => {
    const el = document.createElement('span');
    el.className = 'eye-label ' + (p.up ? 'is-up' : 'is-down');
    el.textContent = p.label; labelBox.appendChild(el);
    return el;
  });

  // Layout: o olho fica sempre na coluna do hero (anchor); só a câmera se move no mergulho
  let W = 1, H = 1, dist = 7, halfH = 1, layout = { x0: 0, y0: 0, sAs: 1, sEx: 1, k: 0.6, tall: false };
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
    const span = (3.0 + 3.45 * k) * 0.92; // comprimento da vista explodida, em raios (com o nervo, de leve na diagonal)
    const room = Math.min(tall ? W - 32 : a.width * 1.15, 2 * (W - cx) - 48);
    const sEx = Math.min(sAs, room / (span * px)); // explodido: cabe na coluna
    layout = { x0: ((cx / W) * 2 - 1) * halfH * camera.aspect, y0: -((cy / H) * 2 - 1) * halfH, sAs, sEx, k, tall };
  };

  const v = new Vector3();
  const toScreen = (vec) => { v.copy(vec).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
  let state = { intro: 1, explode: 1, labels: 1, rot: 0, dolly: 0 };
  let queued = false;
  const cam0 = new Vector3(), pw = new Vector3();

  const apply = () => {
    const { intro, explode: e, rot, dolly } = state;
    const s = MathUtils.lerp(layout.sAs, layout.sEx, MathUtils.smootherstep(e, 0, 1)) * (0.9 + 0.1 * intro);
    eye.scale.setScalar(s);
    eye.position.set(layout.x0, layout.y0, 0);
    // fora do centro da tela a perspectiva entorta a íris: o olho mira a câmera
    const aimY = Math.atan2(-layout.x0, dist), aimX = Math.atan2(layout.y0, dist);
    eye.rotation.set(aimX + 0.24 * e, aimY + rot - (1 - intro) * 0.5, 0);
    inner.position.z = 0.43 * e; // centraliza a vista explodida (o nervo pesa para trás)
    for (const p of PARTS) nodes[p.key].position.z = p.z + p.off * layout.k * e;
    pupil.visible = e < 0.4; // explodido, o furo da íris fica aberto; montando, a retina vermelha apareceria por ele
    eye.updateMatrixWorld(true);
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
    PARTS.forEach((p, i) => {
      // celular: sem espaço para 7 rótulos acima do título
      const el = labels[i], o = layout.tall ? 0 : state.labels * side;
      el.style.opacity = o.toFixed(3);
      if (o < 0.01) return;
      v.set(0, (p.up ? 1 : -1) * p.r * 1.04, nodes[p.key].position.z);
      inner.localToWorld(v);
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
