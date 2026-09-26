import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Floating clipboard + stethoscope on the home page. Purely decorative. */
export function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      return; // No WebGL: the neumorphic portal behind the canvas still looks fine on its own.
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
    scene.environment = envMap;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 17);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xc8ced6, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(4, 7, 8);
    scene.add(key);
    const rim = new THREE.PointLight(0xffffff, 12, 30);
    rim.position.set(-5, -2, 4);
    scene.add(rim);

    // Soft satin, palette colors, no glass.
    const satin = (c: number, r = 0.42) =>
      new THREE.MeshPhysicalMaterial({ color: c, roughness: r, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4, envMapIntensity: 0.9 });
    const jelly = satin(0xc9bfe0);
    const jellyDeep = satin(0x736a86, 0.38);
    const metal = new THREE.MeshPhysicalMaterial({ color: 0xdadde3, metalness: 0.85, roughness: 0.28, envMapIntensity: 1 });
    const paper = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.7 });
    const ink = new THREE.MeshStandardMaterial({ color: 0xc8ced6, roughness: 0.6 });
    const inkDark = new THREE.MeshStandardMaterial({ color: 0x736a86, roughness: 0.5 });
    const tipMat = satin(0x272a3b, 0.35);
    const rimMat = satin(0xd4cac5);
    const diaphragmMat = new THREE.MeshStandardMaterial({ color: 0xf7f7f7, roughness: 0.5 });

    // ---------- clipboard ----------
    const clipboard = new THREE.Group();
    clipboard.add(new THREE.Mesh(new RoundedBoxGeometry(3.3, 4.4, 0.22, 6, 0.2), jelly));
    const sheet = new THREE.Mesh(new RoundedBoxGeometry(2.85, 3.75, 0.04, 2, 0.02), paper);
    sheet.position.set(0, -0.2, 0.14);
    clipboard.add(sheet);
    [2.1, 1.7, 2.2, 1.4, 2.0, 1.2].forEach((w, i) => {
      const l = new THREE.Mesh(new RoundedBoxGeometry(w, 0.1, 0.02, 2, 0.04), i === 0 ? inkDark : ink);
      l.position.set(-1.05 + w / 2 + 0.05, 0.95 - i * 0.42, 0.17);
      clipboard.add(l);
    });
    const check = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 40), inkDark);
    check.position.set(0.85, -1.4, 0.18);
    clipboard.add(check);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 20), inkDark);
    dot.position.set(0.85, -1.4, 0.18);
    clipboard.add(dot);
    const clipBase = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.5, 0.22, 4, 0.1), metal);
    clipBase.position.set(0, 2.05, 0.2);
    clipboard.add(clipBase);
    const clipRing = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 16, 48), metal);
    clipRing.position.set(0, 2.42, 0.2);
    clipboard.add(clipRing);

    // ---------- stethoscope ----------
    type P = [number, number, number];
    const steth = new THREE.Group();
    const tube = (pts: P[], r: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 120, r, 20, false), mat);
    const earL: P[] = [[-0.35, 2.75, 0.2], [-0.62, 2.45, 0.1], [-0.62, 1.8, 0], [-0.42, 1.05, 0], [-0.12, 0.45, 0], [0, 0.15, 0]];
    const earR: P[] = earL.map(([x, y, z]) => [-x, y, z]);
    steth.add(tube(earL, 0.055, metal), tube(earR, 0.055, metal));
    [earL[0], earR[0]].forEach((p) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 24), tipMat);
      s.position.set(...p);
      s.scale.set(1, 1.2, 1);
      steth.add(s);
    });
    const yoke = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), metal);
    yoke.position.set(0, 0.15, 0);
    steth.add(yoke);
    const hoseEnd = new THREE.Vector3(1.35, -0.75, 0.35);
    steth.add(
      tube(
        [[0, 0.15, 0], [0.05, -0.6, 0.25], [-0.45, -1.45, 0.5], [-0.85, -2.2, 0.25], [-0.3, -2.8, -0.15], [0.6, -2.6, -0.1], [1.15, -1.9, 0.2], [1.35, -1.2, 0.35], [hoseEnd.x, hoseEnd.y, hoseEnd.z]],
        0.12,
        jellyDeep,
      ),
    );
    const chest = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.22, 64), metal);
    const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.09, 20, 64), rimMat);
    rimRing.rotation.x = Math.PI / 2;
    const diaphragm = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 64), diaphragmMat);
    diaphragm.position.y = 0.12;
    chest.add(disc, rimRing, diaphragm);
    chest.rotation.x = Math.PI / 2 - 0.35;
    chest.rotation.z = 0.2;
    chest.position.set(hoseEnd.x + 0.05, hoseEnd.y + 0.72, hoseEnd.z + 0.1);
    const neck = tube(
      [[hoseEnd.x, hoseEnd.y, hoseEnd.z], [hoseEnd.x + 0.03, hoseEnd.y + 0.25, hoseEnd.z + 0.05], [chest.position.x, chest.position.y - 0.25, chest.position.z]],
      0.07,
      metal,
    );
    steth.add(chest, neck);

    // ---------- placement + entrance ----------
    const actors = [
      { g: clipboard, base: new THREE.Vector3(-0.9, 0.35, 0), rot: new THREE.Euler(-0.18, 0.38, 0.12), delay: 0.15, ph: 0 },
      { g: steth, base: new THREE.Vector3(1.25, -0.2, 1.4), rot: new THREE.Euler(0.12, -0.35, -0.18), delay: 0.55, ph: 2 },
    ];
    steth.scale.setScalar(0.92);
    actors.forEach((a) => {
      a.g.position.copy(a.base);
      a.g.rotation.copy(a.rot);
      scene.add(a.g);
    });
    const easeOutBack = (p: number) => {
      const c1 = 1.4, c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    };

    // ---------- sizing, pointer, loop ----------
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width) return;
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.position.z = camera.aspect < 0.95 ? 19 : 17;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let px = 0, py = 0, sx = 0, sy = 0;
    const onPointer = (e: PointerEvent) => {
      px = e.clientX / innerWidth - 0.5;
      py = e.clientY / innerHeight - 0.5;
    };
    addEventListener('pointermove', onPointer, { passive: true });

    let visible = true, start: number | null = null, raf = 0;
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);

    function loop(now: number) {
      raf = 0;
      if (!visible) return;
      if (start === null) start = now;
      const t = (now - start) / 1000;
      sx += (px - sx) * 0.05;
      sy += (py - sy) * 0.05;
      actors.forEach((a) => {
        const p = reduce ? 1 : Math.min(1, Math.max(0, (t - a.delay) / 2.3));
        const e = easeOutBack(p);
        const float = Math.sin(t * 0.9 + a.ph) * 0.16;
        a.g.position.set(a.base.x, a.base.y + (1 - e) * -11 + float * p, a.base.z);
        a.g.rotation.set(
          a.rot.x + sy * 0.25 + Math.sin(t * 0.6 + a.ph) * 0.04,
          a.rot.y + sx * 0.45 + (1 - e) * 0.9,
          a.rot.z + Math.cos(t * 0.5 + a.ph) * 0.03 + (1 - e) * -0.5,
        );
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }
    kick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener('pointermove', onPointer);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      [jelly, jellyDeep, metal, paper, ink, inkDark, tipMat, rimMat, diaphragmMat].forEach((m) => m.dispose());
      envMap.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas id="hero3d" ref={canvasRef} />;
}
