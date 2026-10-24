import * as THREE from 'three';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './style.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

document.querySelector('#app').innerHTML = `
  <main class="stage">
    <canvas id="scene" aria-label="可交互的三角钢琴"></canvas>
    <aside class="right-tools" aria-label="场景操作">
      <button class="icon" id="menu" title="场景设置" aria-label="场景设置" aria-expanded="false">☰</button>
      <button class="icon" id="camera" title="切换镜头" aria-label="切换镜头">◉</button>
      <button class="icon" id="full" title="全屏" aria-label="全屏">⛶</button>
    </aside>
    <div class="hint" id="hint">按乐谱提示演奏 · 点击琴键也可练习 · 拖动旋转视角</div>
    <output class="key-info" id="keyInfo" aria-live="off"></output>
    <section class="practice-hud" aria-live="polite">
      <div class="practice-copy"><strong id="practiceTitle">欢乐颂 · 单音练习</strong><span id="practiceStatus">准备开始 · C大调简化旋律</span></div>
      <div class="practice-next"><small>当前音符 / 对应键</small><strong id="practiceNext">E4 · ;</strong></div>
      <div class="practice-actions"><button id="restart" type="button">重新开始</button><button id="midiPlay" type="button" disabled>播放</button><button id="midiStop" type="button" disabled>停止</button><label class="tempo-control">速度<select id="midiSpeed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label class="file-button">导入 MIDI<input id="midiFile" type="file" accept=".mid,.midi,audio/midi"></label><label class="file-button audio-file-button">导入音频<input id="audioFile" type="file" accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a"></label><label class="file-button score-file-button">导入 PDF 乐谱<input id="scorePdfFile" type="file" accept=".pdf,application/pdf"></label><label class="file-button score-file-button">导入图片乐谱<input id="scoreImageFile" type="file" accept="image/*"></label><progress id="audioProgress" max="100" value="0" hidden aria-label="音频识别进度"></progress><progress id="scoreProgress" max="100" value="0" hidden aria-label="乐谱识别进度"></progress></div>
    </section>
    <section class="panel" id="panel" aria-label="场景设置" inert>
      <header><strong>场景设置</strong><button id="close" aria-label="关闭设置">×</button></header>
      <label>音量 <input type="range" id="volume" min="0" max="1" step=".01" value=".55"></label>
      <label>音色 <select id="tone"><option value="grand">音乐会三角钢琴</option><option value="soft">柔和钢琴</option></select></label>
      <p>每个琴键上标注了对应按键。高音区使用 Shift + 标注按键。音频识别在浏览器本地完成，不会上传；支持 MIDI 及常见 MP3/WAV 等音频。音符识别是估算结果，单一乐器旋律更可靠，复杂伴奏或人声可能需要人工校正。</p>
    </section>
  </main>`;

const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#eee3d4');
const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 1500);
const target = new THREE.Vector3(0, 2.02, 0.15);
scene.add(new THREE.HemisphereLight(0xfff9ee, 0xc8b5a1, 3.1));
const sun = new THREE.DirectionalLight(0xfff5e6, 4.2);
sun.position.set(-3, 8, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -7;
sun.shadow.camera.right = 7;
sun.shadow.camera.top = 7;
sun.shadow.camera.bottom = -7;
sun.shadow.normalBias = 0.025;
sun.shadow.bias = -0.0002;
sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xe8f1ff, 2.3);
fill.position.set(5, 5, -5);
scene.add(fill);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: 0xb89b78, roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.055;
floor.receiveShadow = true;
scene.add(floor);

const piano = new THREE.Group();
// Keep the instrument closer to a compact concert-grand silhouette.
piano.scale.set(1, 1.10, 1);
piano.position.y = 0.04;
scene.add(piano);
const lacquer = new THREE.MeshPhysicalMaterial({ color: 0x242426, roughness: 0.29, metalness: 0.08, clearcoat: 0.84, clearcoatRoughness: 0.21 });
const edgeBlack = new THREE.MeshStandardMaterial({ color: 0x35302d, roughness: 0.38, metalness: 0.28 });
const underside = new THREE.MeshStandardMaterial({ color: 0x34302e, roughness: 0.68 });
const soundboard = new THREE.MeshStandardMaterial({ color: 0x956839, roughness: 0.74, side: THREE.DoubleSide });
const castIron = new THREE.MeshStandardMaterial({ color: 0xb39058, roughness: 0.46, metalness: 0.55, side: THREE.DoubleSide });
const gold = new THREE.MeshStandardMaterial({ color: 0xc9954a, metalness: 0.65, roughness: 0.24 });
const ivory = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.4 });
const ebony = new THREE.MeshPhysicalMaterial({ color: 0x101115, roughness: 0.32, clearcoat: 0.55 });
function addMesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(parent, w, h, d, material, x, y, z) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
}
function beam(parent, a, b, radius, material) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const delta = end.clone().sub(start);
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius, radius, delta.length(), 12), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}

// All case parts use the same plan coordinates: +z is the keyboard side.
// The keyboard establishes the width; the case is never scaled independently.
const dimensions = { keyboardWidth: 4.28, cheek: 0.22, wall: 0.16, front: 1.18, rear: -1.62 };
dimensions.halfWidth = dimensions.keyboardWidth / 2 + dimensions.cheek + 0.12;
const casework = new THREE.Group();
piano.add(casework);
function caseContour(inset = 0, frontLimit = dimensions.front) {
  const shape = new THREE.Shape();
  const left = -dimensions.halfWidth + inset, right = dimensions.halfWidth - inset;
  const front = frontLimit - inset, rear = dimensions.rear + inset;
  shape.moveTo(left, front);
  shape.lineTo(right, front);
  shape.lineTo(right, 0.26);
  shape.bezierCurveTo(right, -0.42, 1.96 - inset, rear, 0.64, rear);
  shape.lineTo(left, rear);
  shape.closePath();
  return shape;
}
const outline = caseContour();
const contour = outline.getPoints(64);
function plate(parent, shape, material, y, depth) {
  const mesh = addMesh(parent, new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 48 }), material, 0, y, 0);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
function contourTube(parent, points, radius, material) {
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length; i++) path.add(new THREE.LineCurve3(points[i], points[(i + 1) % points.length]));
  return addMesh(parent, new THREE.TubeGeometry(path, points.length, radius, 6, false), material);
}
plate(casework, outline, underside, 1.51, 0.08);
// A warm wood surface remains visible through the open iron frame.
const woodCanvas = document.createElement('canvas');
woodCanvas.width = 256; woodCanvas.height = 256;
const woodContext = woodCanvas.getContext('2d');
woodContext.fillStyle = '#b88c55'; woodContext.fillRect(0, 0, 256, 256);
for (let i = 0; i < 128; i++) {
  woodContext.strokeStyle = `rgba(91,54,26,${0.025 + (i % 7) * 0.009})`;
  woodContext.beginPath(); woodContext.moveTo(0, i * 2);
  woodContext.bezierCurveTo(85, i * 2 + Math.sin(i) * 2, 170, i * 2 - 2, 256, i * 2);
  woodContext.stroke();
}
const woodTexture = new THREE.CanvasTexture(woodCanvas);
woodTexture.colorSpace = THREE.SRGBColorSpace;
soundboard.map = woodTexture; soundboard.color.setHex(0xffffff);
plate(casework, caseContour(0.10), soundboard, 1.61, 0.055);
const shellShape = caseContour();
shellShape.holes.push(new THREE.Path(caseContour(dimensions.wall).getPoints(64).reverse()));
plate(casework, shellShape, lacquer, 1.94, 0.43);
for (const [height, radius, material] of [[1.955, 0.007, gold], [1.53, 0.012, edgeBlack]]) {
  const trim = contourTube(casework, contour.map(p => new THREE.Vector3(p.x, height, p.y)), radius, material);
  trim.castShadow = false;
}
// An open perimeter casting exposes the soundboard instead of covering it in gold.
const frame = caseContour(0.23);
frame.holes.push(new THREE.Path(caseContour(0.34).getPoints(64).reverse()));
plate(casework, frame, castIron, 1.71, 0.07);
const pinblockMaterial = new THREE.MeshStandardMaterial({ color: 0x735039, roughness: 0.65 });
box(casework, 4.38, 0.10, 0.22, pinblockMaterial, 0, 1.69, 0.86);
box(casework, 4.38, 0.055, 0.10, castIron, 0, 1.755, 0.94);
// Casting struts sit below the strings and meet the perimeter at both ends.
for (const [a, b] of [
  [[-2.22, 1.70, 0.72], [-1.74, 1.70, -1.34]],
  [[-0.35, 1.70, 0.72], [0.10, 1.70, -1.34]],
  [[1.18, 1.70, 0.72], [1.40, 1.70, -1.03]],
]) beam(casework, a, b, 0.040, castIron);
const copper = new THREE.MeshStandardMaterial({ color: 0x9c5c32, metalness: 0.68, roughness: 0.38 });
const steel = new THREE.MeshStandardMaterial({ color: 0xc8c4af, metalness: 0.78, roughness: 0.32 });
const bridgeWood = new THREE.MeshStandardMaterial({ color: 0x86542e, roughness: 0.58 });
const bassWires = [], steelWires = [], tuningPins = [], hitchPins = [];
const bridgePaths = [[], [], []], hitchPaths = [[], [], []];
// 88 note courses: wound bass singles/doubles and steel middle/treble triples.
// Bass strings cross the lower end of the tenor bank on a separate height plane.
for (let note = 0; note < 88; note++) {
  const bank = note < 24 ? 0 : note < 60 ? 1 : 2;
  const t = bank === 0 ? note / 23 : bank === 1 ? (note - 24) / 35 : (note - 60) / 27;
  const startX = -2.08 + note / 87 * 4.16;
  const endX = bank === 0 ? -1.25 + t * 1.05 : bank === 1 ? -1.12 + t * 1.88 : 0.83 + t * 1.17;
  const endZ = bank === 0 ? -1.30 + t * 0.13 : bank === 1 ? -1.29 + t * 0.55 : -0.67 + t * 0.78;
  const height = bank === 0 ? 1.825 : 1.785;
  const start = new THREE.Vector3(startX, height, 0.83);
  const end = new THREE.Vector3(endX, height, endZ);
  const bridge = start.clone().lerp(end, 0.86);
  bridgePaths[bank].push(bridge);
  hitchPaths[bank].push(new THREE.Vector3(endX, bank === 0 ? 1.75 : 1.71, endZ));
  const count = note < 10 ? 1 : bank === 0 ? 2 : 3;
  const spacing = bank === 0 ? 0.011 : 0.008;
  for (let course = 0; course < count; course++) {
    const offset = (course - (count - 1) / 2) * spacing;
    const a = start.clone().add(new THREE.Vector3(offset, 0, 0));
    const b = end.clone().add(new THREE.Vector3(offset, 0, 0));
    (bank === 0 ? bassWires : steelWires).push([a, b, bank === 0 ? 0.0038 : 0.0018]);
    tuningPins.push([new THREE.Vector3(a.x, 1.70, a.z), a.clone().add(new THREE.Vector3(0, 0.016, 0)), 0.009]);
    hitchPins.push([b.clone().add(new THREE.Vector3(0, -0.045, 0)), b.clone().add(new THREE.Vector3(0, 0.009, 0)), 0.006]);
  }
}
// Instance repeated wires/pins so the detailed layout stays inexpensive to render.
function cylinderInstances(segments, material, sides = 8) {
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, sides), material, segments.length);
  const transform = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0);
  segments.forEach(([a, b, radius], i) => {
    const delta = b.clone().sub(a);
    transform.position.copy(a).add(b).multiplyScalar(0.5);
    transform.quaternion.setFromUnitVectors(up, delta.clone().normalize());
    transform.scale.set(radius, delta.length(), radius); transform.updateMatrix();
    mesh.setMatrixAt(i, transform.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  casework.add(mesh);
}
cylinderInstances(bassWires, copper);
cylinderInstances(steelWires, steel);
cylinderInstances(tuningPins, steel);
cylinderInstances(hitchPins, gold);
for (const points of hitchPaths) {
  const path = new THREE.CatmullRomCurve3(points);
  addMesh(casework, new THREE.TubeGeometry(path, 64, 0.045, 8, false), castIron);
}
for (const points of bridgePaths) {
  // The bridge cap touches the strings; the wider wooden bridge meets the board.
  const capPath = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, p.y - 0.018, p.z)));
  const footPath = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, 1.66, p.z)));
  addMesh(casework, new THREE.TubeGeometry(footPath, 72, 0.050, 8, false), bridgeWood);
  addMesh(casework, new THREE.TubeGeometry(capPath, 72, 0.018, 8, false), gold);
  // A continuous web supports the cap without floating above the soundboard.
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const web = box(casework, Math.hypot(b.x - a.x, b.z - a.z) + 0.012, a.y - 1.65, 0.055, bridgeWood, (a.x + b.x) / 2, (a.y + 1.65) / 2 - 0.018, (a.z + b.z) / 2);
    web.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
  }
}
// The music desk bridges the case front and key rail with one slim shelf.
box(piano, dimensions.halfWidth * 2 - 0.08, 0.085, 0.34, lacquer, 0, 1.85, 1.12);
box(piano, dimensions.keyboardWidth + 0.10, 0.018, 0.025, gold, 0, 1.90, 0.96);
// The lid is built after the music desk so its front edge clears the entire desk.
const keyboardWidth = dimensions.keyboardWidth, keyboardLeft = -keyboardWidth / 2, keyboardRight = keyboardWidth / 2;
const keybedCenter = 0;
const keybedWidth = keyboardWidth + dimensions.cheek * 2;
box(piano, keybedWidth, 0.23, 0.16, lacquer, 0, 1.39, 1.18);
box(piano, keybedWidth, 0.16, 0.16, lacquer, 0, 1.38, 2.15);
for (const x of [keyboardLeft - dimensions.cheek / 2, keyboardRight + dimensions.cheek / 2]) {
  box(piano, dimensions.cheek, 0.25, 1.10, lacquer, x, 1.40, 1.67);
  // Cheek shoulders join the raised case without a stack of protruding boards.
  box(piano, dimensions.cheek, 0.25, 0.23, lacquer, x, 1.65, 1.24);
}
box(piano, keybedWidth, 0.16, 0.92, lacquer, 0, 1.27, 1.67);
box(piano, keybedWidth - 0.08, 0.014, 0.024, gold, 0, 1.47, 2.236);
box(piano, keyboardWidth + 0.06, 0.045, 0.05, edgeBlack, 0, 1.635, 1.22);

function labelTexture(text, dark = false) {
  const sheet = document.createElement('canvas');
  sheet.width = 256;
  sheet.height = 128;
  const ctx = sheet.getContext('2d');
  ctx.fillStyle = dark ? '#f5e5c8' : '#423a34';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 88px Arial,sans-serif';
  ctx.fillText(text, sheet.width / 2, sheet.height / 2);
  const texture = new THREE.CanvasTexture(sheet);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}
// The score stand sits on the long rear shelf, not inside the string bed.
// The shelf itself is created above so it remains a single continuous plane.
const stand = new THREE.Group();
stand.position.set(0, 1.90, 1.16);
stand.rotation.x = -0.12;
piano.add(stand);
// Keep retaining rails outside the printed area; the former top rail and
// diagonal braces crossed the score and obscured its notation.
box(stand, 2.44, 0.045, 0.075, lacquer, 0, -0.035, 0);
for (const x of [-1.18, 1.18]) box(stand, 0.045, 0.92, 0.055, lacquer, x, 0.36, 0);
// No top crossbar: keep the full printed score unobstructed.
box(stand, 2.44, 0.024, 0.035, gold, 0, -0.045, 0.045);

const scoreCanvas = document.createElement('canvas');
scoreCanvas.width = 1600;
scoreCanvas.height = 720;
const scoreContext = scoreCanvas.getContext('2d');
const scoreTexture = new THREE.CanvasTexture(scoreCanvas);
scoreTexture.colorSpace = THREE.SRGBColorSpace;
scoreTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
const scorePage = addMesh(stand, new THREE.PlaneGeometry(2.18, 0.78),
  new THREE.MeshBasicMaterial({ map: scoreTexture, side: THREE.DoubleSide, toneMapped: false }), 0, 0.36, 0.032);
scorePage.castShadow = false;
scorePage.receiveShadow = false;

// Rear braces belong to the desk envelope, including the score's back-lean.
for (const x of [-0.99, 0.99]) {
  beam(stand, [x, 0, -0.10], [x, 0.66, -0.035], 0.014, gold);
  box(stand, 0.09, 0.025, 0.15, lacquer, x, -0.045, -0.05);
}
// Measure in piano coordinates; +z is forward. Rotation about z preserves this
// separation for every lid angle, including the bevels and the desk braces.
piano.updateWorldMatrix(true, true);
const deskEnvelope = new THREE.Box3().setFromObject(stand)
  .applyMatrix4(piano.matrixWorld.clone().invert());
const lidSpec = {
  angle: THREE.MathUtils.degToRad(25), thickness: 0.07, clearance: 0.12,
  overhang: 0.025, hingeX: -dimensions.halfWidth, hingeY: 1.99,
};
lidSpec.front = deskEnvelope.min.z - lidSpec.clearance;
// A fixed front deck carries the desk, separate from the moving rear lid.
const deskDeck = new THREE.Group();
piano.add(deskDeck);
box(deskDeck, dimensions.halfWidth * 2, 0.075,
  dimensions.front - lidSpec.front, lacquer, 0, 1.9225,
  (dimensions.front + lidSpec.front) / 2);
box(deskDeck, dimensions.halfWidth * 2 - 0.04, 0.012, 0.012,
  gold, 0, 1.965, lidSpec.front + 0.012);

const lidPivot = new THREE.Group();
lidPivot.name = 'grand-lid-pivot';
lidPivot.position.set(lidSpec.hingeX, lidSpec.hingeY, 0);
lidPivot.rotation.z = lidSpec.angle;
piano.add(lidPivot);
const lidShape = caseContour(-lidSpec.overhang, lidSpec.front - lidSpec.overhang);
// Translate the shared outline so the left edge lies along the hinge axis.
const lidPlan = new THREE.Shape(lidShape.getPoints(96).map(p =>
  new THREE.Vector2(p.x - lidSpec.hingeX, p.y)));
const lidUnderside = new THREE.MeshPhysicalMaterial({
  color: 0x302a25, roughness: 0.39, metalness: 0.06, clearcoat: 0.35,
});
// Extrusion faces share the lacquer finish; a thin inset panel softens the underside.
const lidPanel = plate(lidPivot, lidPlan, lacquer, lidSpec.thickness, lidSpec.thickness);
lidPanel.name = 'grand-lid-panel';
const undersidePlan = new THREE.Shape(caseContour(0.055, lidSpec.front - 0.025)
  .getPoints(96).map(p => new THREE.Vector2(p.x - lidSpec.hingeX, p.y)));
const lidLining = addMesh(lidPivot, new THREE.ShapeGeometry(undersidePlan, 64), lidUnderside, 0, -0.009, 0);
lidLining.rotation.x = Math.PI / 2;
contourTube(lidPivot, lidPlan.getPoints(96).map(p =>
  new THREE.Vector3(p.x, 0.018, p.y)), 0.0045, gold);

const lidHinges = new THREE.Group();
piano.add(lidHinges);
for (const z of [lidSpec.front - 0.24, -0.38, dimensions.rear + 0.24]) {
  beam(lidHinges, [lidSpec.hingeX, lidSpec.hingeY, z - 0.095],
    [lidSpec.hingeX, lidSpec.hingeY, z + 0.095], 0.023, gold);
  box(lidHinges, 0.13, 0.012, 0.18, gold,
    lidSpec.hingeX + 0.055, 1.956, z);
  box(lidPivot, 0.13, 0.014, 0.18, gold, 0.055, -0.008, z);
}

// Derive the prop from its two sockets rather than guessing its angle/length.
const lidProp = new THREE.Group();
lidProp.name = 'grand-lid-prop';
piano.add(lidProp);
const propBase = new THREE.Vector3(dimensions.halfWidth - 0.075, 2.005, -0.04);
const propSocketLocal = new THREE.Vector3(3.58, -0.028, -0.04);
lidPivot.updateMatrix();
const propTop = propSocketLocal.clone().applyMatrix4(lidPivot.matrix);
box(lidProp, 0.14, 0.025, 0.22, gold, propBase.x, 1.9725, propBase.z);
for (const dz of [-0.059, 0.059]) {
  box(lidProp, 0.09, 0.075, 0.022, gold, propBase.x, 2.01, propBase.z + dz);
}
beam(lidProp, [propBase.x, propBase.y, propBase.z - 0.085],
  [propBase.x, propBase.y, propBase.z + 0.085], 0.018, gold);
const propDirection = propTop.clone().sub(propBase).normalize();
beam(lidProp, propBase.toArray(), propTop.toArray(), 0.026, lacquer);
for (const [a, b] of [[0, 0.13], [propBase.distanceTo(propTop) - 0.10, propBase.distanceTo(propTop)]]) {
  beam(lidProp, propBase.clone().addScaledVector(propDirection, a).toArray(),
    propBase.clone().addScaledVector(propDirection, b).toArray(), 0.029, gold);
}
box(lidPivot, 0.18, 0.025, 0.17, gold,
  propSocketLocal.x, -0.016, propSocketLocal.z);
for (const dz of [-0.06, 0.06]) {
  box(lidPivot, 0.085, 0.065, 0.018, gold,
    propSocketLocal.x, -0.045, propSocketLocal.z + dz);
}
beam(lidPivot, [propSocketLocal.x, propSocketLocal.y, propSocketLocal.z - 0.085],
  [propSocketLocal.x, propSocketLocal.y, propSocketLocal.z + 0.085], 0.016, gold);

// 88 unique notes: the first 44 physical keys, then Shift + those same keys.
const codes = [
  ...Array.from({ length: 10 }, (_, i) => `Digit${(i + 1) % 10}`),
  ...'QWERTYUIOP'.split('').map(c => `Key${c}`),
  ...'ASDFGHJKL'.split('').map(c => `Key${c}`),
  ...'ZXCVBNM'.split('').map(c => `Key${c}`),
  'Comma', 'Period', 'Slash', 'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Semicolon',
];
const glyphs = ['1','2','3','4','5','6','7','8','9','0',...'QWERTYUIOP',...'ASDFGHJKL',...'ZXCVBNM',',','.','/','-','=','[',']',';'];
const noteToMesh = new Map();
const whiteNotes = [];
for (let midi = 21; midi <= 108; midi++) {
  if (![1, 3, 6, 8, 10].includes(midi % 12)) whiteNotes.push(midi);
}
const keyWidth = keyboardWidth / whiteNotes.length;
const keys = [];
for (let i = 0; i < whiteNotes.length; i++) {
  const midi = whiteNotes[i];
  const x = keyboardLeft + keyWidth * (i + 0.5);
  const key = box(piano, keyWidth - 0.006, 0.085, 0.82, ivory, x, 1.485, 1.66);
  key.userData = { midi, baseY: 1.485 };
  keys.push(key);
  noteToMesh.set(midi, key);
}
for (let i = 0; i < whiteNotes.length - 1; i++) {
  const midi = whiteNotes[i] + 1;
  if (midi === whiteNotes[i + 1]) continue;
  const x = keyboardLeft + keyWidth * (i + 1);
  const key = box(piano, keyWidth * 0.64, 0.14, 0.47, ebony, x, 1.594, 1.48);
  key.userData = { midi, baseY: 1.594 };
  keys.push(key);
  noteToMesh.set(midi, key);
}
for (let midi = 21; midi <= 108; midi++) {
  const key = noteToMesh.get(midi);
  const index = midi - 21;
  const blackKey = key.material === ebony;
  const text = `${index >= codes.length ? '⇧' : ''}${glyphs[index % codes.length]}`;
  const label = addMesh(key, new THREE.PlaneGeometry(keyWidth * (blackKey ? 0.59 : 0.92), blackKey ? 0.081 : 0.08),
    new THREE.MeshBasicMaterial({ map: labelTexture(text, blackKey), transparent: true, depthWrite: false }), 0, blackKey ? 0.067 : 0.045, blackKey ? 0.04 : 0.29);
  label.rotation.x = -Math.PI / 2;
  label.castShadow = false;
  key.userData.label = text;
}

// Public-domain Ode to Joy, arranged in eight clear 4/4 measures for note-by-note practice.
// Each score note displays its pitch and the exact physical keyboard shortcut.
const practiceBars = [
  [[64, 1], [64, 1], [65, 1], [67, 1]],
  [[67, 1], [65, 1], [64, 1], [62, 1]],
  [[60, 1], [60, 1], [62, 1], [64, 1]],
  [[64, 1], [62, 1], [62, 2]],
  [[64, 1], [64, 1], [65, 1], [67, 1]],
  [[67, 1], [65, 1], [64, 1], [62, 1]],
  [[60, 1], [60, 1], [62, 1], [64, 1]],
  [[62, 1], [60, 1], [60, 2]],
];
const defaultPracticeBars = practiceBars.map(bar => bar.map(([midi, beats]) => ({ notes: [midi], beats })));
let activePracticeBars = defaultPracticeBars;
let practiceNotes = activePracticeBars.flat();
let practiceBarStarts = [];
function rebuildPracticeIndex() {
  practiceNotes = activePracticeBars.flat();
  practiceBarStarts = [];
  let count = 0;
  for (const bar of activePracticeBars) { practiceBarStarts.push(count); count += bar.length; }
}
rebuildPracticeIndex();
let practiceIndex = 0;
let practiceFeedbackTimer;
const practiceTitle = document.querySelector('#practiceTitle');
const midiPlay = document.querySelector('#midiPlay');
const midiStop = document.querySelector('#midiStop');
const midiFile = document.querySelector('#midiFile');
const audioFile = document.querySelector('#audioFile');
const scorePdfFile = document.querySelector('#scorePdfFile');
const scoreImageFile = document.querySelector('#scoreImageFile');
const scoreProgress = document.querySelector('#scoreProgress');
const midiSpeed = document.querySelector('#midiSpeed');
let practicePending = new Set();
let scoreTitle = '欢乐颂';
let scoreSubtitle = '贝多芬 · C大调 · 4/4';
let scoreMeter = [4, 4];
let scoreInstruction = '弹对提示键后自动前进';
let midiEvents = [], midiTimer = null, midiEventIndex = 0, midiPlaying = false, midiIndexOffset = 0, midiDueAt = 0, midiResumeDelay = 0;
let activeSource = 'default';
let audioTranscriptionId = 0;
const practiceStatus = document.querySelector('#practiceStatus');
const practiceNext = document.querySelector('#practiceNext');
const pitchNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
function pitchName(midi) { return `${pitchNames[midi % 12]}${Math.floor(midi / 12) - 1}`; }
function shortcut(midi) { return noteToMesh.get(midi)?.userData.label.replace('⇧', 'Shift + ') ?? '—'; }
function scoreShortcut(midi) { return noteToMesh.get(midi)?.userData.label.replace('⇧', '⇧ + ') ?? '—'; }
function staffStep(midi) {
  const semitone = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const naturalLetter = [0, 2, 4, 5, 7, 9, 11].findIndex(value => value === semitone);
  const fallbackLetter = semitone < 2 ? 0 : semitone < 4 ? 1 : semitone < 5 ? 2 : semitone < 7 ? 3 : semitone < 9 ? 4 : semitone < 11 ? 5 : 6;
  return (octave - 4) * 7 + (naturalLetter >= 0 ? naturalLetter : fallbackLetter) - 2; // E4 is the bottom treble line.
}
function currentPracticeBar() {
  if (practiceIndex >= practiceNotes.length) return activePracticeBars.length - 1;
  for (let bar = 0; bar < practiceBarStarts.length; bar++) {
    if (practiceIndex < practiceBarStarts[bar] + activePracticeBars[bar].length) return bar;
  }
  return activePracticeBars.length - 1;
}
function drawScore() {
  const ctx = scoreContext;
  const w = scoreCanvas.width, h = scoreCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fffaf1'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d8c6aa'; ctx.lineWidth = 5; ctx.strokeRect(4, 4, w - 8, h - 8);
  ctx.textAlign = 'left'; ctx.fillStyle = '#332b24';
  ctx.font = 'bold 48px Georgia, "Noto Serif CJK SC", serif'; ctx.fillText(scoreTitle, 250, 72);
  ctx.fillStyle = '#86745f'; ctx.font = '25px Arial, "Microsoft YaHei", sans-serif'; ctx.fillText(scoreSubtitle, 560, 70);
  ctx.textAlign = 'right'; ctx.font = '22px Arial, "Microsoft YaHei", sans-serif'; ctx.fillText(scoreInstruction, w - 42, 70); ctx.textAlign = 'left';

  const staffLeft = 155, staffRight = 1550, lineGap = 28;
  const trebleTop = 270, trebleBottom = trebleTop + 4 * lineGap;
  const bassTop = 424, bassBottom = bassTop + 4 * lineGap;
  ctx.strokeStyle = '#51463a'; ctx.lineWidth = 3;
  for (const top of [trebleTop, bassTop]) for (let i = 0; i < 5; i++) {
    const y = top + i * lineGap; ctx.beginPath(); ctx.moveTo(staffLeft, y); ctx.lineTo(staffRight, y); ctx.stroke();
  }
  ctx.fillStyle = '#43382e'; ctx.textAlign = 'left';
  ctx.font = '112px serif'; ctx.fillText('𝄞', 28, trebleBottom + 13); ctx.fillText('𝄢', 31, bassBottom + 7);
  ctx.font = 'bold 27px Arial,sans-serif';
  for (const top of [trebleTop, bassTop]) { ctx.fillText(String(scoreMeter[0]), 106, top + 25); ctx.fillText(String(scoreMeter[1]), 106, top + 55); }

  const barAt = currentPracticeBar();
  const barNotes = activePracticeBars[barAt] ?? [];
  const barStart = practiceBarStarts[barAt] ?? 0;
  const totalBeats = barNotes.reduce((sum, event) => sum + (event.beats ?? event[1] ?? 1), 0);
  const beatWidth = Math.min(325, (staffRight - 215) / Math.max(4, totalBeats));
  function scorePosition(midi) {
    let written = midi, octaveMark = '';
    if (midi >= 96) { written -= 24; octaveMark = '15ma'; }
    else if (midi >= 84) { written -= 12; octaveMark = '8va'; }
    else if (midi < 36) { written += 12; octaveMark = '8vb'; }
    const semitone = written % 12, octave = Math.floor(written / 12) - 1;
    const letters = [0, 2, 4, 5, 7, 9, 11];
    let letter = letters.indexOf(semitone);
    if (letter < 0) letter = semitone < 2 ? 0 : semitone < 4 ? 1 : semitone < 6 ? 2 : semitone < 7 ? 3 : semitone < 9 ? 4 : semitone < 11 ? 5 : 6;
    const clef = written < 60 ? 'bass' : 'treble';
    const step = clef === 'treble' ? (octave - 4) * 7 + letter - 2 : octave * 7 + letter - 18;
    const bottom = clef === 'treble' ? trebleBottom : bassBottom;
    return { written, step, clef, octaveMark, y: bottom - step * (lineGap / 2), bottom };
  }
  ctx.fillStyle = '#8d7c67'; ctx.font = 'bold 24px Arial,sans-serif'; ctx.fillText(String(barAt + 1), 178, trebleTop - 14);
  let elapsedBeats = 0;
  barNotes.forEach((event, noteInBar) => {
    const notes = event.notes ?? [event[0]], beats = event.beats ?? event[1] ?? 1;
    const absoluteIndex = barStart + noteInBar;
    const isDone = absoluteIndex < practiceIndex, isCurrent = absoluteIndex === practiceIndex;
    const x = 215 + (elapsedBeats + beats / 2) * beatWidth;
    const color = isCurrent ? '#a65f18' : isDone ? '#788b6c' : '#332b24';
    const badgeY = 78;
    if (isCurrent) { ctx.fillStyle = '#d99b4e24'; ctx.beginPath(); ctx.roundRect(x - 84, 250, 168, 300, 16); ctx.fill(); }
    ctx.fillStyle = isCurrent ? '#f1d7af' : isDone ? '#e6ebdf' : '#f1eadf';
    ctx.beginPath(); ctx.roundRect(x - 96, badgeY, 192, 166, 14); ctx.fill();
    const keyHint = notes.map(scoreShortcut).join(' + ');
    ctx.fillStyle = color; ctx.textAlign = 'center';
    ctx.fillStyle = '#8f755c'; ctx.font = 'bold 21px Arial,"Microsoft YaHei",sans-serif';
    ctx.fillText('按键提示', x, badgeY + 31);
    ctx.fillStyle = color;
    ctx.font = 'bold ' + Math.max(42, Math.min(70, 470 / Math.max(1, keyHint.length))) + 'px Arial,sans-serif';
    ctx.fillText(keyHint, x, badgeY + 94, 176);
    const pitchHint = notes.map(note => pitchName(note) + (scorePosition(note).octaveMark ? ' ' + scorePosition(note).octaveMark : '')).join(' · ');
    ctx.fillStyle = '#6f6255';
    ctx.font = 'bold ' + Math.max(25, Math.min(32, 320 / Math.max(1, pitchHint.length))) + 'px Arial,sans-serif';
    ctx.fillText(pitchHint, x, badgeY + 143, 176);

    ctx.strokeStyle = color; ctx.lineWidth = 4;
    for (const chordMidi of notes) {
      const pos = scorePosition(chordMidi), noteY = pos.y;
      ctx.beginPath(); ctx.ellipse(x, noteY, 17, 11, -0.28, 0, Math.PI * 2);
      if (beats >= 2) { ctx.fillStyle = '#fffaf1'; ctx.fill(); ctx.stroke(); } else { ctx.fillStyle = color; ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(x + 15, noteY - 2); ctx.lineTo(x + 15, noteY - 62); ctx.stroke();
      if (pos.step <= -2) for (let ledger = -2; ledger >= pos.step; ledger -= 2) {
        const ledgerY = pos.bottom - ledger * (lineGap / 2); ctx.beginPath(); ctx.moveTo(x - 27, ledgerY); ctx.lineTo(x + 25, ledgerY); ctx.stroke();
      }
      if (pos.step >= 10) for (let ledger = 10; ledger <= pos.step; ledger += 2) {
        const ledgerY = pos.bottom - ledger * (lineGap / 2); ctx.beginPath(); ctx.moveTo(x - 27, ledgerY); ctx.lineTo(x + 25, ledgerY); ctx.stroke();
      }
      if ([1, 3, 6, 8, 10].includes(chordMidi % 12)) {
        ctx.fillStyle = color; ctx.font = 'bold 25px Arial,sans-serif'; ctx.textAlign = 'right'; ctx.fillText('♯', x - 20, noteY + 9); ctx.textAlign = 'center';
      }
      if (pos.octaveMark) {
        ctx.fillStyle = color; ctx.font = 'bold 15px Arial,sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(pos.octaveMark, x + 21, noteY + (pos.octaveMark === '8vb' ? 24 : -15)); ctx.textAlign = 'center';
      }
    }
    ctx.textAlign = 'left'; elapsedBeats += beats;
  });
  ctx.strokeStyle = '#776956'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(1515, trebleTop - 4); ctx.lineTo(1515, bassBottom + 4); ctx.stroke();
  const completed = practiceIndex >= practiceNotes.length;
  ctx.strokeStyle = '#d8cfc0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(38, 620); ctx.lineTo(w - 38, 620); ctx.stroke();
  ctx.fillStyle = '#756650'; ctx.font = '23px Arial,"Microsoft YaHei",sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(completed ? '练习完成 · ' + practiceNotes.length + ' / ' + practiceNotes.length : '第 ' + (barAt + 1) + ' / ' + activePracticeBars.length + ' 小节 · ' + practiceIndex + ' / ' + practiceNotes.length, 42, 666);
  ctx.textAlign = 'right'; ctx.fillText('提示键与琴键标注一致 · 高音 8va/15ma · 低音 8vb', w - 42, 666); ctx.textAlign = 'left';
  scoreTexture.needsUpdate = true;
  if (practiceIndex >= practiceNotes.length) practiceNext.textContent = '完成！';
  else { const event = practiceNotes[practiceIndex], nextNotes = event.notes ?? [event[0]]; practiceNext.textContent = nextNotes.map(pitchName).join(' + ') + ' · ' + nextNotes.map(shortcut).join(' + '); }
}
function advancePractice(midi) {
  if (practiceIndex >= practiceNotes.length) return;
  const current = practiceNotes[practiceIndex];
  const expected = current.notes ?? [current[0]];
  if (!expected.includes(midi)) {
    practiceStatus.textContent = `再试一次 · 当前需要 ${expected.map(pitchName).join(' + ')}（${expected.map(shortcut).join(' + ')}）`;
    practiceStatus.classList.add('practice-error');
    clearTimeout(practiceFeedbackTimer);
    practiceFeedbackTimer = setTimeout(() => practiceStatus.classList.remove('practice-error'), 900);
    return;
  }
  practicePending.add(midi);
  if (practicePending.size < expected.length) {
    practiceStatus.textContent = `和弦已按 ${practicePending.size} / ${expected.length} · 继续按剩余提示键`;
    return;
  }
  practiceIndex++;
  practicePending.clear();
  practiceStatus.classList.remove('practice-error');
  practiceStatus.textContent = practiceIndex >= practiceNotes.length
    ? '练习完成！可以重新开始再弹一遍。'
    : `正确 · ${practiceIndex} / ${practiceNotes.length} · 下一个音符已前进`;
  drawScore();
}
drawScore();
document.querySelector('#restart').addEventListener('click', () => {
  stopMidi(); midiEventIndex = 0; practicePending.clear(); practiceIndex = 0;
  if (!midiEvents.length) { activeSource = 'default'; activePracticeBars = defaultPracticeBars; rebuildPracticeIndex(); practiceTitle.textContent = '欢乐颂 · 单音练习'; scoreTitle = '欢乐颂'; scoreSubtitle = '贝多芬 · C大调 · 4/4'; scoreMeter = [4, 4]; scoreInstruction = '弹对提示键后自动前进'; }
  practiceStatus.textContent = activeSource === 'audio' ? '重新开始 · 已导入音频转谱' : activeSource === 'midi' ? '重新开始 · 已导入 MIDI' : '重新开始 · C大调简化旋律';
  practiceStatus.classList.remove('practice-error');
  drawScore();
});

function stopMidi() { if (midiTimer) clearTimeout(midiTimer); midiTimer = null; midiDueAt = 0; midiResumeDelay = 0; midiPlaying = false; midiPlay.textContent = '播放'; }
function scheduleMidi(delay) { midiResumeDelay = 0; midiDueAt = Date.now() + delay; midiTimer = setTimeout(() => { midiTimer = null; midiDueAt = 0; runMidi(); }, delay); }
function loadPerformance(title, rawNotes, { source, quarterSeconds = 0.6, meter = [4, 4] } = {}) {
  rawNotes = rawNotes
    .filter(note => note.midi >= 21 && note.midi <= 108 && Number.isFinite(note.time) && Number.isFinite(note.duration))
    .sort((a, b) => a.time - b.time || a.midi - b.midi);
  if (!rawNotes.length) throw new Error('没有位于钢琴 88 键范围内的音符');
  midiEvents = [];
  for (const note of rawNotes) {
    let group = midiEvents.at(-1);
    if (!group || note.time - group.time > 0.035) { group = { time: note.time, notes: [], duration: note.duration }; midiEvents.push(group); }
    if (!group.notes.includes(note.midi)) group.notes.push(note.midi);
    group.duration = Math.max(group.duration, note.duration);
  }
  const quarter = quarterSeconds;
  scoreTitle = title.replace(/\.[^.]+$/, '').slice(0, 20) || '导入曲目';
  scoreMeter = meter;
  scoreSubtitle = source === 'audio' ? '音频转谱 · AI 音高识别 · 4/4' : source === 'score' ? '图片识谱 · 高音谱表单旋律估算' : `MIDI · ${Math.round(60 / quarter)} BPM · ${meter[0]}/${meter[1]}`;
  scoreInstruction = source === 'audio' ? '自动演奏 · AI 识别结果' : source === 'score' ? '识别估算 · 请核对原谱' : '自动演奏 · 键盘提示同步';
  const measureLength = scoreMeter[0] * 4 / scoreMeter[1];
  const groups = midiEvents.map((event, index) => ({
    notes: event.notes,
    duration: event.duration,
    beats: index < midiEvents.length - 1 ? Math.max(0.25, (midiEvents[index + 1].time - event.time) / quarter) : Math.max(0.5, Math.min(2, event.duration / quarter)),
  }));
  activePracticeBars = [];
  let measure = [], beatsInMeasure = 0;
  for (const group of groups) {
    measure.push(group); beatsInMeasure += group.beats;
    if (beatsInMeasure >= measureLength - 0.05) { activePracticeBars.push(measure); measure = []; beatsInMeasure = 0; }
  }
  if (measure.length) activePracticeBars.push(measure);
  rebuildPracticeIndex(); practiceIndex = 0; practicePending.clear(); midiEventIndex = 0;
  activeSource = source;
  practiceTitle.textContent = scoreTitle + (source === 'audio' ? ' · 音频自动演奏' : source === 'score' ? ' · 乐谱识别练习' : ' · MIDI 自动演奏');
  midiIndexOffset = 0;
  practiceStatus.textContent = source === 'audio'
    ? `AI 识别到 ${rawNotes.length} 个音符 · ${midiEvents.length} 组 · 复杂伴奏可能有误差`
    : `已读取 ${rawNotes.length} 个音符 · ${midiEvents.length} 组 · 支持和弦`;
  midiPlay.disabled = false; midiStop.disabled = false; drawScore();
}
function loadMidi(file, midi) {
  audioTranscriptionId++;
  const tempo = midi.header.tempos[0]?.bpm || 100;
  loadPerformance(file.name, midi.tracks.flatMap(track => track.notes.map(note => ({ midi: note.midi, time: note.time, duration: note.duration }))), {
    source: 'midi', quarterSeconds: 60 / tempo, meter: midi.header.timeSignatures[0]?.timeSignature ?? [4, 4],
  });
}
const audioProgress = document.querySelector('#audioProgress');
let basicPitchModulePromise;
async function transcribeAudio(file) {
  const taskId = ++audioTranscriptionId;
  stopMidi(); midiEvents = []; midiEventIndex = 0; practiceIndex = 0;
  midiPlay.disabled = true; midiStop.disabled = true;
  audioProgress.removeAttribute('hidden'); audioProgress.hidden = false; audioProgress.value = 0;
  practiceStatus.textContent = '正在读取音频文件…';
  let decodeContext;
  try {
    if (file.size > 25 * 1024 * 1024) throw new Error('文件超过 25 MB，请选择较短或较小的音频');
    decodeContext = new AudioContext();
    const decoded = await decodeContext.decodeAudioData(await file.arrayBuffer());
    if (taskId !== audioTranscriptionId) return;
    if (decoded.duration > 120) throw new Error('当前版本单次最多识别 2 分钟音频');
    if (decoded.duration < 0.5) throw new Error('音频太短，请选择至少 0.5 秒的曲目');
    await decodeContext.close(); decodeContext = null;

    practiceStatus.textContent = '正在转换音频格式…';
    const sampleRate = 22050;
    const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded; source.connect(offline.destination); source.start();
    const monoBuffer = await offline.startRendering();
    if (taskId !== audioTranscriptionId) return;

    practiceStatus.textContent = '正在加载音符识别模型（首次加载需要下载）…';
    if (!basicPitchModulePromise) basicPitchModulePromise = Promise.all([
      import('@spotify/basic-pitch'), import('@tensorflow/tfjs'),
    ]);
    const [{ BasicPitch, outputToNotesPoly, noteFramesToTime }, tf] = await basicPitchModulePromise;
    await tf.ready();
    if (taskId !== audioTranscriptionId) return;

    const basicPitch = new BasicPitch(`${import.meta.env.BASE_URL}models/basic-pitch/model.json`);
    const frames = [], onsets = [], contours = [];
    await basicPitch.evaluateModel(monoBuffer, (frameData, onsetData, contourData) => {
      frames.push(...frameData); onsets.push(...onsetData); contours.push(...contourData);
    }, percent => {
      if (taskId !== audioTranscriptionId) return;
      audioProgress.value = Math.round(percent * 100);
      practiceStatus.textContent = `正在识别音符 · ${Math.round(percent * 100)}%`;
    });
    if (taskId !== audioTranscriptionId) return;
    const detected = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.35, 0.35, 5))
      .map(note => ({ midi: note.pitchMidi, time: note.startTimeSeconds, duration: note.durationSeconds }))
      .filter(note => note.duration > 0.07);
    loadPerformance(file.name, detected, { source: 'audio', quarterSeconds: 0.6, meter: [4, 4] });
    audioProgress.value = 100;
    audioProgress.hidden = true; audioProgress.setAttribute('hidden', '');
  } catch (error) {
    if (taskId === audioTranscriptionId) {
      audioProgress.hidden = true; audioProgress.setAttribute('hidden', '');
      midiPlay.disabled = !midiEvents.length; midiStop.disabled = !midiEvents.length;
      practiceStatus.textContent = `音频识别失败 · ${error.message || '请尝试 WAV、MP3 或更清晰的单乐器录音'}`;
    }
  } finally {
    if (decodeContext && decodeContext.state !== 'closed') await decodeContext.close().catch(() => {});
  }
}
function runMidi() {
  if (!midiEvents.length || midiEventIndex >= midiEvents.length) return;
  midiPlaying = true; midiPlay.textContent = '暂停';
  const event = midiEvents[midiEventIndex];
  const speed = Number(midiSpeed.value) || 1;
  for (const midiNote of event.notes) play(midiNote, { advance: false, duration: event.duration / speed });
  practiceIndex = Math.min(midiIndexOffset + midiEventIndex + 1, practiceNotes.length);
  drawScore(); midiEventIndex++;
  if (midiEventIndex >= midiEvents.length) { stopMidi(); practiceStatus.textContent = '自动演奏完成 · 可重新开始或手动练习'; return; }
  const gap = Math.max(45, (midiEvents[midiEventIndex].time - event.time) * 1000 / speed);
  scheduleMidi(gap);
}
function imageCanvas(file) { return new Promise((resolve,reject)=>{ const image=new Image(), url=URL.createObjectURL(file); image.onload=()=>{const scale=Math.min(1,2200/image.width,3000/image.height),c=document.createElement('canvas');c.width=Math.round(image.width*scale);c.height=Math.round(image.height*scale);c.getContext('2d').drawImage(image,0,0,c.width,c.height);URL.revokeObjectURL(url);resolve(c);};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('图片无法读取'));};image.src=url;}); }
async function loadScoreCanvas(file) { if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')) {const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,page=await pdf.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,2000/base.width)}),c=document.createElement('canvas');c.width=Math.ceil(viewport.width);c.height=Math.ceil(viewport.height);await page.render({canvas:c,canvasContext:c.getContext('2d'),viewport}).promise;return c;} if(!file.type.startsWith('image/'))throw new Error('请选择 PDF 或图片');return imageCanvas(file);}
function readMelody(canvas) {const {width:w,height:h}=canvas,ctx=canvas.getContext('2d',{willReadFrequently:true}),data=ctx.getImageData(0,0,w,h).data,dark=new Uint8Array(w*h);for(let i=0;i<dark.length;i++){const j=i*4;dark[i]=(data[j]*.299+data[j+1]*.587+data[j+2]*.114)<100?1:0;}const rows=[];for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++)count+=dark[y*w+x];if(count>w*.32)rows.push(y);}const bands=[];for(const y of rows){if(!bands.length||y-bands.at(-1).at(-1)>2)bands.push([y]);else bands.at(-1).push(y);}const lines=bands.filter(b=>b.length<5).map(b=>Math.round(b.reduce((a,v)=>a+v,0)/b.length));let staff=null;for(let i=0;i+4<lines.length;i++){const a=lines.slice(i,i+5),g=a.slice(1).map((v,j)=>v-a[j]),avg=g.reduce((x,y)=>x+y,0)/4;if(g.every(v=>v>avg*.7&&v<avg*1.3)){staff={top:a[0],bottom:a[4],gap:avg};break;}}if(!staff)throw new Error('未找到五线谱；请使用清晰的印刷单页谱');const step=staff.gap/2,candidates=[];for(let y=Math.max(0,staff.top-staff.gap*3);y<Math.min(h,staff.bottom+staff.gap*2);y+=Math.max(2,Math.floor(step*.55)))for(let x=Math.floor(w*.12)+4;x<w*.96-4;x+=3){let n=0;for(let yy=Math.max(0,y-3);yy<=Math.min(h-1,y+3);yy++)for(let xx=x-4;xx<=x+4;xx++)n+=dark[yy*w+xx];if(n>30&&!candidates.some(q=>Math.abs(q.x-x)<w*.012&&Math.abs(q.y-y)<step))candidates.push({x,y});}const notes=[];for(const c of candidates.sort((a,b)=>a.x-b.x)){const d=Math.round((staff.bottom-c.y)/step),oct=4+Math.floor((d+2)/7),idx=((d+2)%7+7)%7,midi=[64,65,67,69,71,72,74][idx]+12*(oct-4);if(midi>=48&&midi<=88&&(!notes.length||notes.at(-1).midi!==midi))notes.push({midi,time:notes.length*.6,duration:.55});}if(notes.length<4)throw new Error('未能可靠定位音符。当前支持清晰的高音谱表单旋律；复杂钢琴谱建议先转 MIDI。');return notes;}
async function importScore(file){scoreProgress.hidden=false;scoreProgress.value=10;practiceStatus.classList.remove('practice-error');practiceStatus.textContent='正在读取乐谱第一页…';try{const canvas=await loadScoreCanvas(file);scoreProgress.value=55;const notes=readMelody(canvas);scoreProgress.value=90;loadPerformance(file.name,notes,{source:'score',quarterSeconds:.6,meter:[4,4]});practiceStatus.textContent+=' · 为近似识别结果，请对照原谱';}catch(error){practiceStatus.classList.add('practice-error');practiceStatus.textContent='识谱失败 · '+error.message;}finally{scoreProgress.value=100;setTimeout(()=>{scoreProgress.hidden=true;scoreProgress.value=0;},700);}}
scorePdfFile.addEventListener('change',async e=>{if(e.target.files[0])await importScore(e.target.files[0]);e.target.value='';});
scoreImageFile.addEventListener('change',async e=>{if(e.target.files[0])await importScore(e.target.files[0]);e.target.value='';});
midiFile.addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;stopMidi();midiIndexOffset=0;try{const { Midi }=await import('@tonejs/midi');loadMidi(f,new Midi(await f.arrayBuffer()));}catch(err){practiceStatus.textContent='导入失败 · '+err.message;}finally{e.target.value='';}});
audioFile.addEventListener('change', async e => { const file = e.target.files[0]; if (!file) return; try { await transcribeAudio(file); } finally { e.target.value = ''; } });
midiPlay.addEventListener('click',()=>{if(midiPlaying){clearTimeout(midiTimer);midiTimer=null;midiResumeDelay=Math.max(0,midiDueAt-Date.now());midiDueAt=0;midiPlaying=false;midiPlay.textContent='继续';practiceStatus.textContent='自动演奏已暂停';}else {if(midiEventIndex>=midiEvents.length){midiEventIndex=0;practiceIndex=midiIndexOffset;drawScore();}if(midiResumeDelay>0){midiPlaying=true;midiPlay.textContent='暂停';scheduleMidi(midiResumeDelay);}else runMidi();}});
midiStop.addEventListener('click',()=>{stopMidi();midiEventIndex=0;practiceIndex=0;practicePending.clear();drawScore();practiceStatus.textContent='自动演奏已停止';});

const grandLegProfile = [
  new THREE.Vector2(0.082, 0.035), new THREE.Vector2(0.105, 0.09),
  new THREE.Vector2(0.112, 0.16), new THREE.Vector2(0.096, 0.24),
  new THREE.Vector2(0.105, 0.38), new THREE.Vector2(0.132, 0.70),
  new THREE.Vector2(0.158, 1.08), new THREE.Vector2(0.19, 1.56),
];
for (const [x, z] of [[-2.14, 1.20], [2.14, 1.20], [-0.56, -1.20]]) {
  // Sculpted tapered legs echo the reference's curved shoulder and narrow ankle.
  const leg = addMesh(piano, new THREE.LatheGeometry(grandLegProfile, 32), lacquer, x, 0, z);
  leg.scale.z = 0.90;
  const ferrule = addMesh(piano, new THREE.TorusGeometry(0.112, 0.014, 10, 32), gold, x, 0.19, z);
  ferrule.rotation.x = Math.PI / 2;
  const wheel = addMesh(piano, new THREE.TorusGeometry(0.071, 0.022, 10, 24), edgeBlack, x, 0.04, z);
  wheel.rotation.y = Math.PI / 2;
}

// The pedal lyre is braced into the underside of the keybed; its three rods terminate at real treadles.
box(piano, 1.12, 0.11, 0.30, lacquer, 0, 1.205, 1.02);
beam(piano, [-0.44, 1.19, 1.04], [-0.30, 0.40, 1.18], 0.065, lacquer);
beam(piano, [0.44, 1.19, 1.04], [0.30, 0.40, 1.18], 0.065, lacquer);
box(piano, 0.78, 0.085, 0.20, lacquer, 0, 0.40, 1.18);
box(piano, 0.72, 0.018, 0.13, gold, 0, 0.345, 1.18);

function roundedTreadleShape(width, length, radius) {
  const x = width / 2, z = length / 2, r = radius;
  const shape = new THREE.Shape();
  shape.moveTo(-x + r, -z);
  shape.lineTo(x - r, -z); shape.quadraticCurveTo(x, -z, x, -z + r);
  shape.lineTo(x, z - r); shape.quadraticCurveTo(x, z, x - r, z);
  shape.lineTo(-x + r, z); shape.quadraticCurveTo(-x, z, -x, z - r);
  shape.lineTo(-x, -z + r); shape.quadraticCurveTo(-x, -z, -x + r, -z);
  return shape;
}
for (const x of [-0.19, 0, 0.19]) {
  const treadle = addMesh(piano,
    new THREE.ExtrudeGeometry(roundedTreadleShape(0.14, 0.36, 0.045), {
      depth: 0.035, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.006, bevelThickness: 0.004,
    }), gold, x, 0.205, 1.56);
  treadle.rotation.x = Math.PI / 2;
  beam(piano, [x, 1.195, 1.08], [x, 0.215, 1.43], 0.021, gold);
  const hinge = addMesh(piano, new THREE.CylinderGeometry(0.035, 0.035, 0.10, 12), edgeBlack, x, 0.222, 1.41);
  hinge.rotation.x = Math.PI / 2;
}
function resize() {
  const { width, height } = canvas.getBoundingClientRect();
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.fov = width < 640 ? 51 : 37;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
let orbit = 0.52, elevation = 0.38, radius = 10.6;
let pointer = null;
const touchPoints = new Map();
let pinchDistance = 0;
const raycaster = new THREE.Raycaster();
function pickKey(e) {
  const rect = canvas.getBoundingClientRect();
  raycaster.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), camera);
  return raycaster.intersectObjects(keys, false)[0]?.object;
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') {
    touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touchPoints.size === 2) {
      const [a, b] = [...touchPoints.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pointer = null;
    }
  }
  if (touchPoints.size > 1) return;
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, lastNote: null };
  canvas.setPointerCapture(e.pointerId);
  const key = pickKey(e);
  if (key) { play(key.userData.midi); pointer.lastNote = key.userData.midi; showKey(key); }
});
canvas.addEventListener('pointermove', e => {
  if (touchPoints.has(e.pointerId)) touchPoints.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touchPoints.size === 2) {
    const [a, b] = [...touchPoints.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    radius = THREE.MathUtils.clamp(radius * pinchDistance / distance, 5, 20);
    pinchDistance = distance;
    return;
  }
  if (!pointer && e.pointerType === 'mouse') showKey(pickKey(e));
  if (!pointer || pointer.id !== e.pointerId) return;
  const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
  if (pointer.lastNote !== null) {
    const key = pickKey(e);
    if (key && key.userData.midi !== pointer.lastNote) { play(key.userData.midi); pointer.lastNote = key.userData.midi; showKey(key); }
  } else {
    orbit += dx * 0.006;
    elevation = THREE.MathUtils.clamp(elevation + dy * 0.003, 0.08, 0.87);
  }
  pointer.x = e.clientX; pointer.y = e.clientY;
});
function endPointer(e) { touchPoints.delete(e.pointerId); pointer = null; }
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { if (!pointer) showKey(null); });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  radius = THREE.MathUtils.clamp(radius + e.deltaY * 0.006, 5, 20);
}, { passive: false });

let context, master, volume = 0.55, tone = 'grand';
const keyInfo = document.querySelector('#keyInfo');
function showKey(key) {
  keyInfo.textContent = key ? `琴键 ${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][key.userData.midi % 12]}${Math.floor(key.userData.midi / 12) - 1} · 键盘 ${key.userData.label.replace('⇧', 'Shift + ')}` : '';
  keyInfo.classList.toggle('visible', Boolean(key));
}
function play(midi, { advance = true, duration = null } = {}) {
  const key = noteToMesh.get(midi);
  if (!key) return;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = volume;
    master.connect(context.destination);
  }
  context.resume();
  const now = context.currentTime;
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  for (const [multiple, level] of [[1, 0.28], [2, 0.07], [3, 0.025]]) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = tone === 'soft' ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency * multiple;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(level, now + 0.012);
    const noteLength = duration === null ? (tone === 'soft' ? 1.6 : 2.8) / Math.sqrt(multiple) : Math.max(0.08, duration);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + noteLength + (duration === null ? 0 : 0.12));
    oscillator.connect(envelope).connect(master);
    oscillator.start(now);
    oscillator.stop(now + noteLength + (duration === null ? 0.25 : 0.15));
  }
  key.position.y = key.userData.baseY - 0.025;
  clearTimeout(key.userData.timer);
  key.userData.timer = setTimeout(() => { key.position.y = key.userData.baseY; }, 130);
  document.querySelector('#hint').classList.add('gone');
  showKey(key);
  if (advance) advancePractice(midi);
}
window.addEventListener('keydown', e => {
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
  const index = codes.indexOf(e.code);
  if (index < 0) return;
  e.preventDefault();
  play(21 + index + (e.shiftKey ? codes.length : 0));
});

const panel = document.querySelector('#panel');
const menu = document.querySelector('#menu');
function showPanel(show) {
  panel.classList.toggle('show', show);
  panel.inert = !show;
  menu.setAttribute('aria-expanded', String(show));
}
menu.addEventListener('click', () => showPanel(!panel.classList.contains('show')));
document.querySelector('#close').addEventListener('click', () => showPanel(false));
document.querySelector('#volume').addEventListener('input', e => { volume = Number(e.target.value); if (master) master.gain.value = volume; });
document.querySelector('#tone').addEventListener('change', e => { tone = e.target.value; });
document.querySelector('#full').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.querySelector('.stage').requestFullscreen());
document.querySelector('#camera').addEventListener('click', () => {
  orbit = orbit < 0 ? 0.84 : -0.16;
  elevation = orbit < 0 ? 0.24 : 0.40;
});
function render() {
  requestAnimationFrame(render);
  const portraitScale = innerWidth < 640 ? Math.max(16.2, innerHeight / innerWidth * 7.1) / 8.9 : 1;
  const distance = radius * portraitScale;
  camera.position.set(Math.sin(orbit) * distance, 1.8 + elevation * 7, Math.cos(orbit) * distance);
  camera.lookAt(target);
  renderer.render(scene, camera);
}
render();
















