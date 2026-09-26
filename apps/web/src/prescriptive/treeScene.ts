import type { InteractionCheckResponse, ProfileNode, ProfileNodeType, Relationship } from '@medifyrx/shared';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { NODE_CAPTION, NODE_COLOR, STATUS_STYLE, TONE } from './status';

// Imperative three.js engine for the Prescriptive interaction tree. React (TreeViewer.tsx) owns the
// UI around it; this file owns everything drawn in 3D, the same scene in plain 3D, camera and WebXR.

export type ViewMode = '3d' | 'camera';

export interface SceneCallbacks {
  onNodeClick: (id: string | null) => void;
  onARChange: (state: 'off' | 'searching' | 'placed') => void;
}

const ORB_R = 0.34;
const CENTER_R = 0.46;
const BG = 0xefeff2;
/** Real-world size of the tree in AR: about 60 cm across on a table. */
const AR_SCALE = 0.075;
/** Lift so the lowest nodes sit on the surface instead of sinking into it. */
const AR_LIFT = 2.2;

const DEFAULT_TARGET = new THREE.Vector3(0, 0.1, 0);
const DEFAULT_CAMERA = new THREE.Vector3(0, 2.4, 10.5);

// ---------- canvas textures ----------

const ICON_PATHS: Record<'pill' | 'food' | 'shield' | 'star', { stroke?: string[]; fill?: string[] }> = {
  pill: {},
  food: { stroke: ['M7 3v6a2.5 2.5 0 0 0 5 0V3', 'M9.5 3v18', 'M17.5 21V3c-2.4 1.4-3.5 4-3.5 7 0 2.3 1.3 3.8 3.5 3.8'] },
  shield: { stroke: ['M12 3 5 6v5.5c0 4.4 3 8.2 7 9.5 4-1.3 7-5.1 7-9.5V6z', 'm9 12 2 2 4-4'] },
  star: { fill: ['M12 2.8l2.75 5.6 6.15.9-4.45 4.35 1.05 6.1L12 16.9l-5.5 2.85 1.05-6.1L3.1 9.3l6.15-.9z'] },
};

/** The pill glyph: drawn at -45° and 17.2/24 of the icon's width; the icon is ICON_SCALE × the orb radius. */
const PILL_ANGLE_DEG = -45;
const PILL_LENGTH = 17.2 / 24;
const ICON_SCALE = 1.15;

const iconFor = (t: ProfileNodeType) => (t === 'food' ? 'food' : t === 'allergy' ? 'shield' : t === 'other' ? 'star' : 'pill');

const textureCache = new Map<string, THREE.Texture>();

function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cached = textureCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

function iconTexture(kind: keyof typeof ICON_PATHS) {
  return canvasTexture(`icon:${kind}`, 256, 256, (ctx) => {
    ctx.scale(256 / 24, 256 / 24);
    ctx.shadowColor = 'rgba(40,30,70,.35)';
    ctx.shadowBlur = 0.8;
    ctx.fillStyle = ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.9;
    ctx.lineCap = ctx.lineJoin = 'round';
    if (kind === 'pill') {
      // Two-tone capsule.
      ctx.translate(12, 12);
      ctx.rotate(THREE.MathUtils.degToRad(PILL_ANGLE_DEG));
      ctx.beginPath();
      ctx.roundRect(-8.6, -3.6, 17.2, 7.2, 3.6);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(-8.6, -3.6, 8.6, 7.2, [3.6, 0, 0, 3.6]);
      ctx.fill();
      return;
    }
    const p = ICON_PATHS[kind];
    p.stroke?.forEach((d) => ctx.stroke(new Path2D(d)));
    p.fill?.forEach((d) => ctx.fill(new Path2D(d)));
  });
}

function haloTexture() {
  return canvasTexture('halo', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

function shadowTexture() {
  return canvasTexture('shadow', 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(120,118,150,0.28)');
    g.addColorStop(0.6, 'rgba(120,118,150,0.10)');
    g.addColorStop(1, 'rgba(120,118,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });
}

function labelTexture(title: string, caption: string, accent: string) {
  const key = `label:${title}|${caption}|${accent}`;
  const cached = textureCache.get(key);
  if (cached) return { tex: cached, aspect: (cached.image as HTMLCanvasElement).width / (cached.image as HTMLCanvasElement).height };
  const scale = 2;
  const measure = document.createElement('canvas').getContext('2d')!;
  const titleFont = `700 ${30 * scale}px Quicksand, "Segoe UI", system-ui, sans-serif`;
  const capFont = `600 ${20 * scale}px Quicksand, "Segoe UI", system-ui, sans-serif`;
  measure.font = titleFont;
  const tw = measure.measureText(title).width;
  measure.font = capFont;
  const cw = measure.measureText(caption.toUpperCase()).width + caption.length * 2 * scale;
  const w = Math.ceil(Math.max(tw, cw) + 44 * scale);
  const h = 92 * scale;
  const tex = canvasTexture(key, w, h, (ctx) => {
    ctx.fillStyle = 'rgba(247,247,250,0.92)';
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(2 * scale, 2 * scale, w - 4 * scale, h - 4 * scale, 22 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#272A3B';
    ctx.font = titleFont;
    ctx.fillText(title, w / 2, 44 * scale);
    ctx.fillStyle = accent;
    ctx.font = capFont;
    ctx.letterSpacing = `${2 * scale}px`;
    ctx.fillText(caption.toUpperCase(), w / 2, 74 * scale);
  });
  return { tex, aspect: w / h };
}

// ---------- layout ----------

function layout(nodes: ProfileNode[], rels: Relationship[]): Map<string, THREE.Vector3> {
  const pos = new Map<string, THREE.Vector3>();
  pos.set('patient', new THREE.Vector3(0, 2.1, 0));
  const mine = nodes.filter((n) => n.type !== 'patient' && !n.related);
  const related = nodes.filter((n) => n.related);

  const r1 = Math.min(4.2, Math.max(2.3, 1.3 + mine.length * 0.32));
  const angle = new Map<string, number>();
  mine.forEach((n, i) => {
    const a = (i / Math.max(mine.length, 1)) * Math.PI * 2 + Math.PI / 2;
    angle.set(n.id, a);
    pos.set(n.id, new THREE.Vector3(Math.cos(a) * r1, 0.2, Math.sin(a) * r1));
  });

  // Related items sit on an outer, lower ring, fanned out around the item(s) they relate to.
  const r2 = r1 + 2.1;
  const fan = new Map<number, number>();
  related.forEach((n) => {
    const anchors = rels
      .filter((r) => r.sourceNodeId === n.id || r.targetNodeId === n.id)
      .map((r) => angle.get(r.sourceNodeId === n.id ? r.targetNodeId : r.sourceNodeId))
      .filter((a): a is number => a !== undefined);
    const base = anchors.length ? Math.atan2(anchors.reduce((s, a) => s + Math.sin(a), 0), anchors.reduce((s, a) => s + Math.cos(a), 0)) : 0;
    const k = Math.round(base * 100);
    const j = fan.get(k) ?? 0;
    fan.set(k, j + 1);
    const a = base + (j % 2 ? 1 : -1) * Math.ceil(j / 2) * 0.42;
    pos.set(n.id, new THREE.Vector3(Math.cos(a) * r2, -1.55 - (j % 2) * 0.35, Math.sin(a) * r2));
  });
  return pos;
}

// ---------- scene ----------

interface NodeView {
  node: ProfileNode;
  group: THREE.Group;
  orb: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  halo: THREE.Sprite;
  icon: THREE.Sprite;
  label: THREE.Sprite;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  radius: number;
  phase: number;
  order: number;
}

interface EdgeView {
  a: string;
  b: string;
  mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  curve: THREE.QuadraticBezierCurve3;
  pulse?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  colored: boolean;
}

const easeOutBack = (p: number) => 1 + 2.4 * Math.pow(p - 1, 3) + 1.4 * Math.pow(p - 1, 2);
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export class TreeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
  private controls: OrbitControls;
  private root = new THREE.Group();
  private floor: THREE.Mesh;
  private reticle: THREE.Mesh;
  private nodes = new Map<string, NodeView>();
  private edges: EdgeView[] = [];
  private selected: string[] = [];
  private hovered: string | null = null;
  private raycaster = new THREE.Raycaster();
  private pointerDown: { x: number; y: number } | null = null;
  private tween: { t0: number; dur: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3 } | null = null;
  private reveal = { centerAt: Infinity, centerDur: 1, restAt: Infinity };
  private interacted = false;
  private fog: [number, number] = [16, 34];
  /** Camera spot that frames the whole tree; recomputed whenever the data changes. */
  private home = { target: DEFAULT_TARGET.clone(), position: DEFAULT_CAMERA.clone() };
  private visible = true;
  private mode: ViewMode = '3d';
  private ar: { session: XRSession; hitSource?: XRHitTestSource; placed: boolean } | null = null;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private disposed = false;

  constructor(
    private container: HTMLElement,
    canvas: HTMLCanvasElement,
    private cb: SceneCallbacks,
    startHidden: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.xr.enabled = true;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    pmrem.dispose();
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 16, 34);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ced6, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(4, 8, 6);
    this.scene.add(key);

    this.floor = new THREE.Mesh(
      new THREE.CircleGeometry(8, 64),
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -2.7;
    this.root.add(this.floor);
    this.scene.add(this.root);

    this.reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.08, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    this.reticle.matrixAutoUpdate = false;
    this.reticle.visible = false;
    this.scene.add(this.reticle);

    this.camera.position.copy(DEFAULT_CAMERA);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(DEFAULT_TARGET);
    this.controls.enableDamping = true;
    this.controls.minDistance = 2.5;
    this.controls.maxDistance = 22;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.addEventListener('start', () => {
      this.interacted = true;
      this.controls.autoRotate = false;
      this.tween = null;
    });

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointermove', this.onPointerMove);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.io = new IntersectionObserver(([e]) => (this.visible = e.isIntersecting));
    this.io.observe(container);
    this.resize();

    if (!startHidden) this.revealAll();
    // Development only: lets browser tests find node positions.
    if (import.meta.env.DEV) (canvas as HTMLCanvasElement & { __scene?: TreeScene }).__scene = this;
    this.renderer.setAnimationLoop(this.loop);

    // Labels use the site font; redraw them once it has loaded.
    void document.fonts?.ready.then(() => {
      if (this.disposed) return;
      [...textureCache.keys()].filter((k) => k.startsWith('label:')).forEach((k) => textureCache.delete(k));
      this.nodes.forEach((v) => this.applyLabel(v));
    });
  }

  // ---------- data ----------

  setData(data: InteractionCheckResponse | null) {
    const nodes: ProfileNode[] = data?.nodes ?? [{ id: 'patient', type: 'patient', label: 'You' }];
    const rels = data?.relationships ?? [];
    const pos = layout(nodes, rels);

    // Remove nodes/edges that are gone; keep existing node objects so the reveal doesn't replay.
    for (const [id, v] of this.nodes) {
      if (!pos.has(id)) {
        this.root.remove(v.group);
        v.orb.geometry.dispose();
        v.orb.material.dispose();
        v.ring.geometry.dispose();
        this.nodes.delete(id);
      }
    }
    this.edges.forEach((e) => {
      this.root.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      if (e.pulse) {
        this.root.remove(e.pulse);
        e.pulse.material.dispose();
      }
    });
    this.edges = [];

    let order = 0;
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      let v = this.nodes.get(n.id);
      if (!v) {
        v = this.makeNode(n);
        this.nodes.set(n.id, v);
        this.root.add(v.group);
      }
      v.node = n;
      v.order = n.id === 'patient' ? 0 : ++order;
      v.group.position.copy(p);
      v.group.userData.base = p.clone();
      this.applyLabel(v);
    }

    // Soft neutral "tree" cables from the center to each item in the profile.
    const center = pos.get('patient')!;
    for (const n of nodes) {
      if (n.type === 'patient' || n.related) continue;
      this.edges.push(this.makeEdge('patient', n.id, center, pos.get(n.id)!, null));
    }
    for (const r of rels) {
      const a = pos.get(r.sourceNodeId);
      const b = pos.get(r.targetNodeId);
      if (a && b) this.edges.push(this.makeEdge(r.sourceNodeId, r.targetNodeId, a, b, TONE[STATUS_STYLE[r.status].tone].cable));
    }
    this.selected = this.selected.filter((id) => this.nodes.has(id));
    this.fitHome([...pos.values()]);
  }

  /** Frame every node (plus room for labels) and glide there unless the user is exploring. */
  private fitHome(points: THREE.Vector3[]) {
    const box = new THREE.Box3().setFromPoints(points).expandByVector(new THREE.Vector3(0.9, 0.9, 0.9));
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const fov = Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect));
    const dist = Math.max(6, (sphere.radius / Math.tan(fov / 2)) * 0.66);
    this.fog = [dist * 0.95, dist * 2.4];
    if (this.scene.fog instanceof THREE.Fog) [this.scene.fog.near, this.scene.fog.far] = this.fog;
    // Aim a little below center: the camera looks down on the tree, which leaves empty space on top.
    const target = sphere.center.clone().add(new THREE.Vector3(0, -sphere.radius * 0.16, 0));
    this.home = {
      target,
      position: target.clone().add(new THREE.Vector3(0, 0.32, 1).normalize().multiplyScalar(dist)),
    };
    this.controls.maxDistance = dist * 1.8;
    if (!this.interacted && !this.ar) this.startTween(this.home.target.clone(), this.home.position.clone(), true);
  }

  private makeNode(n: ProfileNode): NodeView {
    const radius = n.type === 'patient' ? CENTER_R : n.related ? ORB_R * 0.85 : ORB_R;
    const color = new THREE.Color(NODE_COLOR[n.type]);
    const group = new THREE.Group();
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 32),
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.55,
        roughness: 0.22,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.15,
        transparent: true,
      }),
    );
    orb.userData.nodeId = n.id;
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: haloTexture(), color, transparent: true, depthWrite: false, opacity: 0.7 }),
    );
    halo.scale.setScalar(radius * 4.2);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(iconFor(n.type)), transparent: true, depthWrite: false }));
    icon.scale.setScalar(radius * ICON_SCALE);
    // Labels draw on top of cables so they always stay readable.
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }));
    label.renderOrder = 10;
    label.position.y = -radius - 0.36;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.4, 0.016, 10, 72),
      new THREE.MeshBasicMaterial({ color: 0x5b4f8c, transparent: true, opacity: 0 }),
    );
    group.add(halo, orb, icon, label, ring);
    return { node: n, group, orb, halo, icon, label, ring, radius, phase: Math.random() * Math.PI * 2, order: 0 };
  }

  private applyLabel(v: NodeView) {
    const n = v.node;
    const title = n.type === 'patient' ? 'You' : n.label;
    const caption = NODE_CAPTION[n.type][n.related ? 1 : 0];
    const accent = n.related ? '#8A4F57' : '#665C82';
    const { tex, aspect } = labelTexture(title, caption, accent);
    v.label.material.map = tex;
    v.label.material.needsUpdate = true;
    const h = n.type === 'patient' ? 0.52 : 0.44;
    v.label.scale.set(h * aspect, h, 1);
  }

  private makeEdge(a: string, b: string, pa: THREE.Vector3, pb: THREE.Vector3, color: number | null): EdgeView {
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const dist = pa.distanceTo(pb);
    // Cables sag a little under their own weight, and bow outward from the center.
    const out = new THREE.Vector3(mid.x, 0, mid.z);
    if (out.lengthSq() > 1e-4) mid.add(out.normalize().multiplyScalar(dist * 0.12));
    mid.y -= dist * (color === null ? 0.12 : 0.22);
    const curve = new THREE.QuadraticBezierCurve3(pa.clone(), mid, pb.clone());
    const colored = color !== null;
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, colored ? 0.05 : 0.022, 12, false),
      new THREE.MeshStandardMaterial({
        color: colored ? color : 0xcdc6dc,
        emissive: colored ? color : 0x9f97b8,
        emissiveIntensity: colored ? 0.7 : 0.12,
        roughness: 0.35,
        transparent: true,
      }),
    );
    this.root.add(mesh);
    let pulse: EdgeView['pulse'];
    if (colored) {
      pulse = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
      this.root.add(pulse);
    }
    return { a, b, mesh, curve, pulse, colored };
  }

  // ---------- selection & view ----------

  setSelected(ids: string[]) {
    this.selected = ids.filter((id) => this.nodes.has(id));
  }

  focusNode(id: string) {
    const v = this.nodes.get(id);
    if (!v || this.ar) return;
    // Center on the node, but pull back far enough to keep everything it's connected to in view.
    const at = v.group.getWorldPosition(new THREE.Vector3());
    const pts = [at];
    for (const e of this.edges) {
      if (!e.colored || (e.a !== id && e.b !== id)) continue;
      const other = this.nodes.get(e.a === id ? e.b : e.a);
      if (other) pts.push(other.group.getWorldPosition(new THREE.Vector3()));
    }
    const sphere = new THREE.Sphere().setFromPoints(pts);
    const to = at.clone().lerp(sphere.center, 0.35);
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const fov = Math.min(vfov, 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect));
    const dist = Math.max(5, ((sphere.radius + 1.2) / Math.tan(fov / 2)) * 0.9);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.startTween(to, to.clone().add(dir.multiplyScalar(dist)));
  }

  resetView() {
    if (this.ar) return;
    this.startTween(this.home.target.clone(), this.home.position.clone());
  }

  private startTween(toT: THREE.Vector3, toP: THREE.Vector3, keepSpinning = false) {
    if (!keepSpinning) this.controls.autoRotate = false;
    this.tween = { t0: performance.now(), dur: 750, fromT: this.controls.target.clone(), toT, fromP: this.camera.position.clone(), toP };
  }

  // ---------- hand-gesture hooks (Camera view) ----------

  private stopAuto() {
    this.interacted = true;
    this.controls.autoRotate = false;
    this.tween = null;
  }

  /** Spin the tree around its vertical axis by `radians` (positive = counter-clockwise from above). */
  orbitBy(radians: number) {
    if (this.ar) return;
    this.stopAuto();
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), radians);
    this.camera.position.copy(this.controls.target).add(offset);
  }

  /** Zoom in (factor > 1) or out (factor < 1). */
  zoomBy(factor: number) {
    if (this.ar || !(factor > 0)) return;
    this.stopAuto();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const dist = THREE.MathUtils.clamp(offset.length() / factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(dist));
  }

  /**
   * The node at a point on screen (viewport pixels), if any. With `slop` > 0 (hand controls), a point
   * that misses every orb still picks the nearest one whose edge is within `slop` pixels.
   */
  nodeAtScreen(x: number, y: number, slop = 0): string | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    if (x < r.left - slop || x > r.right + slop || y < r.top - slop || y > r.bottom + slop) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.pick(this.raycaster);
    if (hit || slop <= 0) return hit;

    let best: string | null = null;
    let bestGap = slop;
    for (const [id, v] of this.nodes) {
      if (!v.group.visible || v.group.scale.x < 0.5) continue;
      const c = this.nodeScreenRect(id);
      if (!c) continue;
      const gap = Math.hypot(c.x - x, c.y - y) - c.size / 2; // distance from the orb's edge
      if (gap < bestGap) {
        bestGap = gap;
        best = id;
      }
    }
    return best;
  }

  /** Same as clicking at a point on screen (hand controls pass a generous `slop`). */
  clickAt(x: number, y: number, slop = 0) {
    this.interacted = true;
    this.cb.onNodeClick(this.nodeAtScreen(x, y, slop));
  }

  /** Highlight the node a hand cursor is over, so users can see what a pinch will pick. */
  setHover(id: string | null) {
    this.hovered = id;
  }

  setMode(mode: ViewMode) {
    this.mode = mode;
    this.applyBackground();
  }

  private applyBackground() {
    const passthrough = this.mode === 'camera' || !!this.ar;
    this.scene.background = passthrough ? null : new THREE.Color(BG);
    this.scene.fog = passthrough ? null : new THREE.Fog(BG, ...this.fog);
    this.floor.visible = !passthrough;
  }

  /** Intro hand-off: fade the center node in over `ms`, then bring in everything else. */
  revealCenter(ms: number) {
    const now = performance.now();
    this.reveal = { centerAt: now, centerDur: ms, restAt: now + ms };
  }

  revealAll() {
    const now = performance.now();
    this.reveal = { centerAt: now - 10_000, centerDur: 1, restAt: now };
  }

  /** The center node's pill icon on screen (viewport px), so the intro's pill can land exactly on it. */
  centerPillRect(): { x: number; y: number; length: number; angleDeg: number } | null {
    const r = this.nodeScreenRect('patient');
    // r.size is the orb's diameter; the pill spans PILL_LENGTH of the icon, which is ICON_SCALE × the radius.
    return r && { x: r.x, y: r.y, length: (r.size / 2) * ICON_SCALE * PILL_LENGTH, angleDeg: PILL_ANGLE_DEG };
  }

  nodeScreenRect(id: string): { x: number; y: number; size: number } | null {
    const v = this.nodes.get(id);
    if (!v) return null;
    this.camera.updateMatrixWorld();
    const rect = this.renderer.domElement.getBoundingClientRect();
    const world = v.group.getWorldPosition(new THREE.Vector3());
    const edge = world.clone().add(new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion).multiplyScalar(v.radius));
    const toPx = (p: THREE.Vector3) => {
      const s = p.clone().project(this.camera);
      return { x: rect.left + ((s.x + 1) / 2) * rect.width, y: rect.top + ((1 - s.y) / 2) * rect.height };
    };
    const c = toPx(world);
    const e = toPx(edge);
    return { x: c.x, y: c.y, size: Math.hypot(e.x - c.x, e.y - c.y) * 2 };
  }

  // ---------- pointer ----------

  private ndc(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  private pick(ray: THREE.Raycaster): string | null {
    const orbs = [...this.nodes.values()].filter((v) => v.group.visible && v.group.scale.x > 0.5).map((v) => v.orb);
    const hit = ray.intersectObjects(orbs, false)[0];
    return (hit?.object.userData.nodeId as string | undefined) ?? null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.pointerDown;
    this.pointerDown = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return; // a drag, not a click
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    this.interacted = true;
    this.cb.onNodeClick(this.pick(this.raycaster));
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons) return;
    this.raycaster.setFromCamera(this.ndc(e), this.camera);
    this.renderer.domElement.style.cursor = this.pick(this.raycaster) ? 'pointer' : 'grab';
  };

  // ---------- WebXR (AR on a real surface) ----------

  static async arSupported(): Promise<boolean> {
    try {
      return !!(await navigator.xr?.isSessionSupported('immersive-ar'));
    } catch {
      return false;
    }
  }

  async enterAR(overlay: HTMLElement) {
    if (!navigator.xr || this.ar) return;
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay },
    });
    this.renderer.xr.setReferenceSpaceType('local');
    await this.renderer.xr.setSession(session);
    this.ar = { session, placed: false };
    this.root.visible = false;
    this.applyBackground();
    this.cb.onARChange('searching');

    const viewer = await session.requestReferenceSpace('viewer');
    const hitSource = await session.requestHitTestSource?.({ space: viewer });
    if (this.ar) this.ar.hitSource = hitSource;

    const controller = this.renderer.xr.getController(0);
    const onSelect = () => this.onARSelect(controller);
    controller.addEventListener('select', onSelect);
    this.scene.add(controller);

    session.addEventListener('end', () => {
      controller.removeEventListener('select', onSelect);
      this.scene.remove(controller);
      this.ar?.hitSource?.cancel();
      this.ar = null;
      this.reticle.visible = false;
      this.root.position.set(0, 0, 0);
      this.root.rotation.set(0, 0, 0);
      this.root.scale.setScalar(1);
      this.root.visible = true;
      this.applyBackground();
      this.cb.onARChange('off');
    });
  }

  exitAR() {
    void this.ar?.session.end();
  }

  private onARSelect(controller: THREE.Group) {
    if (!this.ar) return;
    if (!this.ar.placed) {
      if (!this.reticle.visible) return;
      // Snap the tree onto the detected surface, facing the viewer.
      const p = new THREE.Vector3().setFromMatrixPosition(this.reticle.matrix);
      this.root.scale.setScalar(AR_SCALE);
      this.root.position.set(p.x, p.y + AR_LIFT * AR_SCALE, p.z);
      const cam = this.renderer.xr.getCamera().getWorldPosition(new THREE.Vector3());
      this.root.lookAt(cam.x, this.root.position.y, cam.z);
      this.root.visible = true;
      this.reticle.visible = false;
      this.ar.placed = true;
      this.cb.onARChange('placed');
      return;
    }
    const m = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(m);
    this.cb.onNodeClick(this.pick(this.raycaster));
  }

  // ---------- loop ----------

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h || this.renderer.xr.isPresenting) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = (time: number, frame?: XRFrame) => {
    if (!this.visible && !this.renderer.xr.isPresenting) return;
    const now = performance.now();
    const t = time / 1000;

    if (this.tween) {
      const p = easeInOut(clamp01((now - this.tween.t0) / this.tween.dur));
      this.controls.target.lerpVectors(this.tween.fromT, this.tween.toT, p);
      this.camera.position.lerpVectors(this.tween.fromP, this.tween.toP, p);
      if (p >= 1) this.tween = null;
    }
    if (!this.renderer.xr.isPresenting) this.controls.update();

    // AR: follow detected surfaces with the placement ring until the tree is placed.
    if (frame && this.ar?.hitSource && !this.ar.placed) {
      const space = this.renderer.xr.getReferenceSpace();
      const hit = space ? frame.getHitTestResults(this.ar.hitSource)[0]?.getPose(space) : undefined;
      this.reticle.visible = !!hit;
      if (hit) this.reticle.matrix.fromArray(hit.transform.matrix);
    }

    const cam = (this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this.camera).getWorldPosition(new THREE.Vector3());
    const sel = this.selected;
    const neighbors = new Set<string>();
    for (const e of this.edges) {
      if (!e.colored) continue;
      if (sel.includes(e.a)) neighbors.add(e.b);
      if (sel.includes(e.b)) neighbors.add(e.a);
    }

    const appear = new Map<string, number>();
    for (const [id, v] of this.nodes) {
      const a =
        id === 'patient'
          ? clamp01((now - this.reveal.centerAt) / this.reveal.centerDur)
          : clamp01((now - this.reveal.restAt - v.order * 70) / 550);
      appear.set(id, a);
      const s = a <= 0 ? 0.0001 : id === 'patient' ? 0.6 + 0.4 * easeInOut(a) : Math.max(0.0001, easeOutBack(a));
      const isSel = sel.includes(id);
      const isHover = id === this.hovered;
      const dim = sel.length && !isSel && !neighbors.has(id) && id !== 'patient' ? 0.35 : 1;
      v.group.visible = a > 0;
      v.group.scale.setScalar(s * (isSel ? 1.12 : isHover ? 1.18 : 1));
      v.orb.material.opacity = a * dim;
      v.orb.material.emissiveIntensity = isSel ? 1.0 : 0.5 + Math.sin(t * 1.6 + v.phase) * 0.08;
      (v.icon.material as THREE.SpriteMaterial).opacity = a * dim;
      (v.label.material as THREE.SpriteMaterial).opacity = a * dim;
      const haloM = v.halo.material as THREE.SpriteMaterial;
      haloM.opacity = a * (isSel || isHover ? 0.95 : dim * (0.55 + Math.sin(t * 1.6 + v.phase) * 0.12));
      v.halo.scale.setScalar(v.radius * (isSel ? 5.4 : isHover ? 5.8 : 4.2));
      // Keep the icon on the side of the orb that faces the viewer.
      const local = v.group.worldToLocal(cam.clone()).normalize();
      v.icon.position.copy(local.multiplyScalar(v.radius * 1.02));
      v.ring.material.opacity = isSel ? 0.75 : 0;
      v.ring.lookAt(cam);
      v.ring.rotateZ(t);
      // Gentle bob so the tree feels alive.
      const base = v.group.userData.base as THREE.Vector3 | undefined;
      if (base) v.group.position.y = base.y + Math.sin(t * 0.9 + v.phase) * 0.04;
    }

    for (const e of this.edges) {
      const a = Math.min(appear.get(e.a) ?? 0, appear.get(e.b) ?? 0);
      const touches = sel.includes(e.a) || sel.includes(e.b);
      const dim = sel.length && !touches ? 0.18 : 1;
      e.mesh.visible = a > 0;
      e.mesh.material.opacity = a * dim * (e.colored ? 1 : 0.8);
      if (e.pulse) {
        const pair = sel.length === 2 && sel.includes(e.a) && sel.includes(e.b);
        const u = (t * (pair ? 0.9 : 0.35) + e.a.length * 0.13) % 1;
        e.pulse.position.copy(e.curve.getPoint(u));
        e.pulse.visible = a > 0.9;
        e.pulse.material.opacity = 0.85 * dim;
      }
    }

    if (!this.interacted && this.reveal.restAt < now) this.controls.autoRotate = true;
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    this.exitAR();
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.io.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    this.controls.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
      if (o instanceof THREE.Sprite) o.material.dispose();
    });
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}
