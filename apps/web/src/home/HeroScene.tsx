import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// The rendered clipboard and stethoscope (transparent images) floating in front of the portal.
// Cropped .webp copies are made by apps/web/scripts/optimize-hero-renders.py from the PNG renders.
const RENDERS = {
  clipboard: { url: '/hero-renders/clipboard.webp', height: 4.6 },
  stethoscope: { url: '/hero-renders/stethoscope.webp', height: 4.4 },
};

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 17);

    // Each render is a flat, unlit image panel so it looks exactly as rendered.
    const loader = new THREE.TextureLoader();
    const panel = (url: string, height: number) => {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, depthWrite: false, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.scale.set(height * 0.6, height, 1);
      const ready = loader.loadAsync(url).then((tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        mat.map = tex;
        mat.opacity = 1;
        mat.needsUpdate = true;
        const img = tex.image as HTMLImageElement;
        mesh.scale.set(height * (img.width / img.height), height, 1);
      });
      return { mesh, ready };
    };
    const clipboard = panel(RENDERS.clipboard.url, RENDERS.clipboard.height);
    const steth = panel(RENDERS.stethoscope.url, RENDERS.stethoscope.height);

    // ---------- placement + entrance ----------
    // Rotations stay small: these are flat images, so big turns would show they have no depth.
    const actors = [
      // Clipboard behind on the right, stethoscope in front on the left (the last one draws on top).
      { g: clipboard.mesh, base: new THREE.Vector3(1.05, -0.35, 0), rot: new THREE.Euler(-0.04, -0.12, -0.07), delay: 0.15, ph: 0 },
      { g: steth.mesh, base: new THREE.Vector3(-1.2, 0, 1.2), rot: new THREE.Euler(0.03, 0.1, 0.06), delay: 0.55, ph: 2 },
    ];
    actors.forEach((a) => {
      a.g.position.copy(a.base);
      a.g.rotation.copy(a.rot);
      a.g.renderOrder = a === actors[1] ? 1 : 0;
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

    // The entrance starts once both renders have loaded, so they rise in together.
    let visible = true, start: number | null = null, raf = 0, loaded = false;
    const kick = () => {
      if (!raf && loaded) raf = requestAnimationFrame(loop);
    };
    void Promise.all([clipboard.ready, steth.ready])
      .catch(() => {})
      .then(() => {
        loaded = true;
        kick();
      });
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
          a.rot.x + sy * 0.12 + Math.sin(t * 0.6 + a.ph) * 0.03,
          a.rot.y + sx * 0.2 + (1 - e) * 0.35,
          a.rot.z + Math.cos(t * 0.5 + a.ph) * 0.03 + (1 - e) * -0.5,
        );
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      removeEventListener('pointermove', onPointer);
      for (const a of actors) {
        a.g.geometry.dispose();
        a.g.material.map?.dispose();
        a.g.material.dispose();
      }
      renderer.dispose();
    };
  }, []);

  return <canvas id="hero3d" ref={canvasRef} />;
}
